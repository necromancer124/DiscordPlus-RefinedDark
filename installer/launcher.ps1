<#
.SYNOPSIS
    Discord+ launcher: makes sure the newest Discord version is patched with Vencord, then starts it.

.DESCRIPTION
    Every Discord update installs into a new app-<version> folder that does not contain Vencord's patch.
    Vencord re-patches updates that happen while it is running, but not updates applied while Discord is
    starting (for example the first start of the day). This script closes that gap:

      1. Before starting: if the newest app-* version is not patched, patch it the way Vencord does
         (resources\app.asar -> _app.asar, then copy in Vencord's loader app.asar).
      2. Start Discord.
      3. For a few minutes, watch for an update landing during startup. If the new version is not
         patched: close Discord, patch it, start Discord again.

    Mode "check" (used at Windows login) skips step 2: it waits for Discord's own autostart and only
    repairs + restarts if needed.

    A copy of Vencord's loader is kept in %LOCALAPPDATA%\DiscordPlus\vencord-loader.asar, so a repair is
    possible even after Discord has deleted every older (patched) version folder, and in Discord installs that
    Vencord's installer never touched (e.g. a per-user copy under C:\ProgramData\<user>\Discord).
    Before all of that (step 0), a newer Discord+ release on GitHub is downloaded and built with its own
    installer (install.ps1 -SkipInject -KeepChoices), so Discord starts with it. Off with the plugin setting
    "Install updates automatically"; skipped when Discord is already open (the next start updates).
    Log: %LOCALAPPDATA%\DiscordPlus\launcher.log (installer output of the last update: update.log)
#>
param(
    [ValidateSet("Discord", "DiscordPTB", "DiscordCanary")]
    [string]$Flavor = "Discord",
    [ValidateSet("launch", "check")]
    [string]$Mode = "launch",
    # The Discord install folder (has Update.exe and app-* folders). Default: %LOCALAPPDATA%\<Flavor>.
    [string]$Root,
    # Testing only: $Root is a fake Discord folder; no processes are started or stopped.
    [switch]$Test,
    [int]$WatchSeconds = 180
)

$ErrorActionPreference = "Continue"
$Testing = [bool]$Test
$Base = if ($Root) { $Root.TrimEnd("\") } else { Join-Path $env:LOCALAPPDATA $Flavor }
$StateDir = Join-Path $env:LOCALAPPDATA "DiscordPlus"
if ($Testing) { $StateDir = Join-Path $Base "_state" }
$Loader = Join-Path $StateDir "vencord-loader.asar"
$LogFile = Join-Path $StateDir "launcher.log"
$Updater = Join-Path $Base "Update.exe"
New-Item -ItemType Directory -Force -Path $StateDir | Out-Null

function Write-Log([string]$text) {
    if ((Test-Path $LogFile) -and (Get-Item $LogFile).Length -gt 256KB) { Remove-Item $LogFile -Force }
    Add-Content -Path $LogFile -Value ("{0:s} [{1}/{2}] {3}" -f (Get-Date), $Flavor, $Mode, $text)
}

function Get-VersionOf([string]$name) {
    try { return [version]($name.Substring(4)) } catch { return [version]"0.0" }
}

function Get-AppDirs {
    if (-not (Test-Path $Base)) { return @() }
    return @(Get-ChildItem -Path $Base -Directory -Filter "app-*" | Sort-Object { Get-VersionOf $_.Name })
}

function Get-Latest { Get-AppDirs | Select-Object -Last 1 }

function Test-Patched([string]$dir) { Test-Path (Join-Path $dir "resources\_app.asar") }

# Keep our own copy of Vencord's loader from any patched version (newest first).
function Save-Loader {
    $dirs = @(Get-AppDirs)
    [array]::Reverse($dirs)
    foreach ($d in $dirs) {
        if (Test-Patched $d.FullName) {
            $asar = Join-Path $d.FullName "resources\app.asar"
            if (Test-Path $asar) {
                Copy-Item -Path $asar -Destination $Loader -Recurse -Force
                return
            }
        }
    }
}

# Same steps as Vencord's own persistAfterDiscordUpdates: keep Discord's app.asar as _app.asar,
# put Vencord's loader in its place.
function Repair-Version([string]$dir) {
    $res = Join-Path $dir "resources"
    $asar = Join-Path $res "app.asar"
    $backup = Join-Path $res "_app.asar"
    if (Test-Path $backup) { return $true }
    if (-not (Test-Path $asar)) { Write-Log "cannot patch $dir (no app.asar yet)"; return $false }
    if (-not (Test-Path $Loader)) { Write-Log "cannot patch $dir (no saved Vencord loader; run INSTALL.bat -Reinject)"; return $false }
    try {
        Rename-Item -Path $asar -NewName "_app.asar" -ErrorAction Stop
        Copy-Item -Path $Loader -Destination $asar -Recurse -Force -ErrorAction Stop
        Write-Log "patched $(Split-Path $dir -Leaf)"
        return $true
    } catch {
        Write-Log "patching $dir failed: $($_.Exception.Message)"
        return $false
    }
}

# Only this install's processes (two installs can both be called Discord.exe).
function Get-DiscordProcesses {
    if ($Testing) { return @() }
    return @(Get-Process -Name $Flavor -ErrorAction SilentlyContinue | Where-Object { -not $_.Path -or $_.Path -like "$Base\*" })
}

function Stop-Discord {
    Get-DiscordProcesses | Stop-Process -Force -ErrorAction SilentlyContinue
    for ($i = 0; $i -lt 20 -and (Get-DiscordProcesses); $i++) { Start-Sleep -Milliseconds 500 }
}

function Start-Discord {
    if ($Testing) { Write-Log "would start $Flavor"; return }
    if (Test-Path $Updater) { Start-Process -FilePath $Updater -ArgumentList "--processStart", "$Flavor.exe" }
    else { Write-Log "Update.exe not found at $Updater" }
}

# -- 0. Discord+ update --------------------------------------------------------------
$Repo = "necromancer124/DiscordPlus-RefinedDark"
$StateFile = Join-Path $StateDir "install-state.json"
$UpdateDir = Join-Path $StateDir "updates"
$UpdateLog = Join-Path $StateDir "update.log"

function ConvertTo-Version([string]$text) {
    try { return [version]$text } catch { return [version]"0.0" }
}

# The plugin setting "Install updates automatically" lives in Vencord's settings; unset means on.
function Test-AutoUpdateOn {
    try {
        $plugin = (Get-Content (Join-Path $env:APPDATA "Vencord\settings\settings.json") -Raw | ConvertFrom-Json).plugins.DiscordPlus
        return $plugin.enabled -ne $false -and $plugin.autoUpdate -ne $false
    } catch { return $true }
}

# Download and build the newest release if it's newer than the installed one. True when Discord+ was updated.
function Update-DiscordPlus {
    if ($Testing -or -not (Test-Path $StateFile) -or -not (Test-AutoUpdateOn)) { return $false }
    $state = try { Get-Content $StateFile -Raw | ConvertFrom-Json } catch { $null }
    if (-not $state -or -not $state.pluginVersion) { return $false }
    # One update at a time: the login check and a shortcut can start together.
    $lock = New-Object System.Threading.Mutex($false, "Local\DiscordPlusUpdate")
    if (-not $lock.WaitOne(0)) { $lock.Dispose(); return $false }
    try {
        [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12
        $release = Invoke-RestMethod "https://api.github.com/repos/$Repo/releases/latest" -Headers @{ "User-Agent" = "DiscordPlus-launcher" } -TimeoutSec 10
        $version = "$($release.tag_name)".TrimStart("v")
        if ((ConvertTo-Version $version) -le (ConvertTo-Version $state.pluginVersion)) { return $false }

        # Only the full release zip of this repository, from GitHub's own download address.
        $name = "DiscordPlus-RefinedDark-$version"
        $asset = @($release.assets) | Where-Object { $_.name -eq "$name.zip" } | Select-Object -First 1
        $url = "$($asset.browser_download_url)"
        if (-not $url.StartsWith("https://github.com/$Repo/releases/download/")) { Write-Log "update $version has no $name.zip"; return $false }

        Write-Log "downloading Discord+ $version"
        New-Item -ItemType Directory -Force -Path $UpdateDir | Out-Null
        Get-ChildItem $UpdateDir -Force | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
        $zip = Join-Path $UpdateDir "$name.zip"
        Invoke-WebRequest $url -OutFile $zip -UseBasicParsing -TimeoutSec 120
        Expand-Archive -Path $zip -DestinationPath $UpdateDir -Force
        $installer = Join-Path $UpdateDir "$name\installer\install.ps1"
        if (-not (Test-Path $installer)) { Write-Log "update $version has no installer in its zip"; return $false }

        Write-Log "building Discord+ $version"
        $installArgs = @("-NoProfile", "-ExecutionPolicy", "Bypass", "-File", $installer, "-SkipInject", "-KeepChoices", "-NoStart")
        if ($state.vencordDir) { $installArgs += @("-VencordDir", $state.vencordDir) }
        & powershell.exe @installArgs *> $UpdateLog
        if ($LASTEXITCODE -ne 0) { Write-Log "update $version failed (exit code $LASTEXITCODE); see update.log"; return $false }

        # The new launcher is used from the next start on (this run already has the old one in memory).
        Copy-Item -Path (Join-Path $UpdateDir "$name\installer\launcher.ps1"), (Join-Path $UpdateDir "$name\installer\DiscordPlus.vbs") -Destination $StateDir -Force
        Remove-Item -Path $zip -Force -ErrorAction SilentlyContinue
        Write-Log "updated Discord+ to $version"
        return $true
    } catch {
        Write-Log "Discord+ update failed: $($_.Exception.Message)"
        return $false
    } finally {
        $lock.ReleaseMutex()
        $lock.Dispose()
    }
}

# Opening Discord+ while Discord is already open only brings its window up: no update wait then.
$wasOpen = [bool](Get-DiscordProcesses)
if (-not ($Mode -eq "launch" -and $wasOpen) -and (Update-DiscordPlus) -and $Mode -eq "check") {
    # At login Discord's own autostart may already run the old build: restart it, but only if it just started.
    $running = @(Get-DiscordProcesses)
    if ($running -and -not ($running | Where-Object { $_.StartTime -lt (Get-Date).AddMinutes(-5) })) {
        Write-Log "restarting Discord to load the new Discord+"
        Stop-Discord
        Start-Discord
    }
}

# -- 1. Before starting ------------------------------------------------------------
Save-Loader
$latest = Get-Latest
if ($latest -and -not (Test-Patched $latest.FullName)) {
    if (Get-DiscordProcesses) {
        # Discord is already running the unpatched version: restart it patched.
        Stop-Discord
        if (Repair-Version $latest.FullName) { Start-Discord }
        exit 0
    }
    Repair-Version $latest.FullName | Out-Null
}

# -- 2. Start Discord ----------------------------------------------------------------
if ($Mode -eq "launch") { Start-Discord }

# -- 3. Watch for an update that lands during startup --------------------------------
$known = if ($latest) { $latest.Name } else { "" }
$deadline = (Get-Date).AddSeconds($WatchSeconds)
while ((Get-Date) -lt $deadline) {
    Start-Sleep -Seconds 2
    $now = Get-Latest
    if (-not $now -or $now.Name -eq $known) { continue }
    $known = $now.Name
    # Give the updater a moment to finish writing the new version.
    for ($i = 0; $i -lt 30 -and -not (Test-Path (Join-Path $now.FullName "resources\app.asar")); $i++) { Start-Sleep -Seconds 1 }
    Start-Sleep -Seconds 3
    if (Test-Patched $now.FullName) { Write-Log "update $($now.Name) already patched by Vencord"; continue }
    Write-Log "update $($now.Name) arrived unpatched; restarting Discord with Discord+"
    $wasRunning = [bool](Get-DiscordProcesses)
    Stop-Discord
    if ((Repair-Version $now.FullName) -and ($wasRunning -or $Mode -eq "launch")) { Start-Discord }
}
Save-Loader
