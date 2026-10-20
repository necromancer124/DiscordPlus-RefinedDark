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
    possible even after Discord has deleted every older (patched) version folder.
    Log: %LOCALAPPDATA%\DiscordPlus\launcher.log
#>
param(
    [ValidateSet("Discord", "DiscordPTB", "DiscordCanary")]
    [string]$Flavor = "Discord",
    [ValidateSet("launch", "check")]
    [string]$Mode = "launch",
    # Testing only: a fake Discord folder; no processes are started or stopped.
    [string]$DiscordRoot,
    [int]$WatchSeconds = 180
)

$ErrorActionPreference = "Continue"
$Testing = [bool]$DiscordRoot
$Base = if ($DiscordRoot) { $DiscordRoot } else { Join-Path $env:LOCALAPPDATA $Flavor }
$StateDir = Join-Path $env:LOCALAPPDATA "DiscordPlus"
if ($Testing) { $StateDir = Join-Path $DiscordRoot "_state" }
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

function Get-DiscordProcesses {
    if ($Testing) { return @() }
    return @(Get-Process -Name $Flavor -ErrorAction SilentlyContinue)
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
