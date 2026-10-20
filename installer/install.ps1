<#
.SYNOPSIS
    Installs (or updates) Discord+ Refined Dark into the Discord desktop app via Vencord.

.DESCRIPTION
    1. Checks Git, Node.js 18+ and pnpm.
    2. Clones Vencord (or reuses an existing checkout).
    3. Copies the Discord+ plugin into Vencord's src\userplugins.
    4. Builds Vencord.
    5. Closes Discord (asks first) and, the first time, injects Vencord with the official Vencord installer.
    6. Turns DiscordPlus on in Vencord's settings (backup kept as settings.json.discordplus-backup).
    7. Installs the Discord+ launcher: "Discord+" shortcuts (desktop + Start menu) and a check at Windows
       login. They re-patch Discord when an update arrives unpatched, so Discord+ survives updates.
    8. Writes %LOCALAPPDATA%\DiscordPlus\install-state.json so UNINSTALL.bat knows what to revert.
    9. Starts Discord again (the same Stable / PTB / Canary that was running) with Discord+ enabled.

    Re-running it updates Discord+ (copy + rebuild). Inject only runs the first time, or with -Reinject
    (needed after a Discord update removes Vencord).

.PARAMETER VencordDir
    Where the Vencord source lives. Default: %LOCALAPPDATA%\DiscordPlus\Vencord.
    Point it at your own checkout if you already build Vencord yourself.

.PARAMETER UpdateVencord
    Also pull the latest Vencord source before building.

.PARAMETER Reinject
    Run the Vencord injector again even if it ran before.

.PARAMETER SkipInject
    Only build; don't touch the Discord installation.

.PARAMETER NoStart
    Don't start Discord at the end.

.PARAMETER NoLauncher
    Don't install the "Discord+" shortcuts and login check that keep Discord+ working after Discord updates.
#>
[CmdletBinding()]
param(
    [string]$VencordDir = (Join-Path $env:LOCALAPPDATA "DiscordPlus\Vencord"),
    [switch]$UpdateVencord,
    [switch]$Reinject,
    [switch]$SkipInject,
    [switch]$NoStart,
    [switch]$NoLauncher
)

$ErrorActionPreference = "Stop"
$StateDir = Join-Path $env:LOCALAPPDATA "DiscordPlus"
$StateFile = Join-Path $StateDir "install-state.json"
$PluginSource = Join-Path $PSScriptRoot "..\vencord\userplugins\discordPlus"
$VencordRepo = "https://github.com/Vendicated/Vencord.git"

function Write-Step([string]$text) { Write-Host ""; Write-Host "==> $text" -ForegroundColor Cyan }
function Write-Ok([string]$text) { Write-Host "    $text" -ForegroundColor Green }
function Write-Note([string]$text) { Write-Host "    $text" -ForegroundColor DarkGray }
function Fail([string]$text) {
    Write-Host ""
    Write-Host "ERROR: $text" -ForegroundColor Red
    Write-Host "Nothing in Discord was changed by the failed step. Fix the problem above and run INSTALL.bat again."
    exit 1
}
function Test-Command([string]$name) { return [bool](Get-Command $name -ErrorAction SilentlyContinue) }
function Invoke-Native([string]$what, [scriptblock]$cmd) {
    & $cmd
    if ($LASTEXITCODE -ne 0) { Fail "$what failed (exit code $LASTEXITCODE)." }
}
function Read-State {
    if (Test-Path $StateFile) { return Get-Content $StateFile -Raw | ConvertFrom-Json }
    return $null
}

Write-Host "Discord+ Refined Dark installer" -ForegroundColor White
Write-Host "Discord client mods are unofficial and may break Discord's Terms of Service. You use this at your own risk." -ForegroundColor Yellow

if (-not (Test-Path (Join-Path $PluginSource "index.tsx"))) {
    Fail "Couldn't find the plugin at $PluginSource. Run this from the extracted Discord+ folder."
}
# Vencord runs a plugin's native.ts in Discord's main process; Discord+ has none, and a stray one crashes Discord.
if ((Test-Path (Join-Path $PluginSource "native.ts")) -or (Test-Path (Join-Path $PluginSource "native"))) {
    Fail "The plugin folder contains native.ts, which Vencord would load into Discord's main process. Remove it and try again."
}

# -- 1. Prerequisites -----------------------------------------------------------
Write-Step "Checking prerequisites"
if (-not (Test-Command git)) { Fail "Git is not installed. Install it with:  winget install --id Git.Git -e   then reopen this window." }
Write-Ok "Git $((git --version) -replace 'git version ','')"

if (-not (Test-Command node)) { Fail "Node.js is not installed. Install it with:  winget install --id OpenJS.NodeJS.LTS -e   then reopen this window." }
$nodeMajor = [int]((node --version).TrimStart("v").Split(".")[0])
if ($nodeMajor -lt 18) { Fail "Node.js $(node --version) is too old; Vencord needs v18 or newer." }
Write-Ok "Node.js $(node --version)"

if (-not (Test-Command pnpm)) {
    Write-Note "pnpm not found; installing it with npm (npm install -g pnpm)"
    Invoke-Native "Installing pnpm" { npm install -g pnpm }
    $env:Path = [Environment]::GetEnvironmentVariable("Path", "User") + ";" + [Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + $env:Path
    if (-not (Test-Command pnpm)) { Fail "pnpm was installed but isn't on PATH yet. Close this window and run INSTALL.bat again." }
}
Write-Ok "pnpm $(pnpm --version)"

$state = Read-State
$clonedByUs = $false
if ($state -and $state.vencordDir -eq $VencordDir) { $clonedByUs = [bool]$state.clonedByInstaller }

# -- 2. Vencord source ----------------------------------------------------------
Write-Step "Preparing Vencord source in $VencordDir"
if (Test-Path (Join-Path $VencordDir ".git")) {
    Write-Ok "Using existing checkout"
    if ($UpdateVencord) {
        Invoke-Native "Updating Vencord" { git -C $VencordDir pull --ff-only }
        Write-Ok "Updated to latest Vencord"
    }
} else {
    if ((Test-Path $VencordDir) -and (Get-ChildItem $VencordDir -Force | Select-Object -First 1)) {
        Fail "$VencordDir exists but isn't a Vencord git checkout. Choose another folder with -VencordDir."
    }
    New-Item -ItemType Directory -Force -Path (Split-Path $VencordDir) | Out-Null
    Invoke-Native "Cloning Vencord" { git clone --depth 1 $VencordRepo $VencordDir }
    $clonedByUs = $true
    Write-Ok "Cloned Vencord"
}

# -- 3. Plugin ------------------------------------------------------------------
Write-Step "Copying the Discord+ plugin"
$userPlugins = Join-Path $VencordDir "src\userplugins"
$pluginTarget = Join-Path $userPlugins "discordPlus"
New-Item -ItemType Directory -Force -Path $userPlugins | Out-Null
if (Test-Path $pluginTarget) { Remove-Item -Recurse -Force $pluginTarget }
Copy-Item -Recurse -Path $PluginSource -Destination $pluginTarget
Write-Ok "Copied to $pluginTarget"

# -- 4. Build -------------------------------------------------------------------
Write-Step "Installing Vencord dependencies (first run takes a few minutes)"
Push-Location $VencordDir
try {
    Invoke-Native "pnpm install" { pnpm install --frozen-lockfile }
    Write-Step "Building Vencord with Discord+"
    Invoke-Native "pnpm build" { pnpm build }
    Write-Ok "Build finished"
} finally {
    Pop-Location
}

# -- 5. Close Discord, inject ---------------------------------------------------
# Discord flavours: process name = install folder name under %LOCALAPPDATA% = exe started by Update.exe.
$Flavors = @("Discord", "DiscordPTB", "DiscordCanary")
$script:ClosedFlavors = @()

function Get-DiscordProcesses { Get-Process -ErrorAction SilentlyContinue | Where-Object { $Flavors -contains $_.ProcessName } }

function Stop-DiscordNow {
    $running = Get-DiscordProcesses
    if (-not $running) { return }
    $script:ClosedFlavors = @($script:ClosedFlavors + ($running | ForEach-Object { $_.ProcessName }) | Select-Object -Unique)
    $running | Stop-Process -Force
    # Wait until it has really exited: Vencord saves its settings on exit and would overwrite ours.
    for ($i = 0; $i -lt 20 -and (Get-DiscordProcesses); $i++) { Start-Sleep -Milliseconds 500 }
}

function Close-Discord([string]$why) {
    if (-not (Get-DiscordProcesses)) { return }
    $answer = Read-Host "    $why Close it now? [Y/n]"
    if ($answer -match "^(n|no)$") { Fail "Discord is still running. Close it and run INSTALL.bat again." }
    Stop-DiscordNow
}

$alreadyInjected = $state -and [bool]$state.injected -and $state.vencordDir -eq $VencordDir
$injected = [bool]$alreadyInjected
if ($SkipInject) {
    Write-Step "Skipping inject (-SkipInject)"
} else {
    # A running Discord keeps the old build in memory, and its settings must not change under it.
    Close-Discord "Discord has to restart to load Discord+."
    if ($alreadyInjected -and -not $Reinject) {
        Write-Step "Vencord is already injected from this folder; the rebuild is enough."
        Write-Note "If Discord updated and Discord+ disappeared, run:  INSTALL.bat -Reinject"
    } else {
        Write-Step "Injecting Vencord into Discord"
        Write-Note "The official Vencord installer opens next. Pick your Discord install (usually Stable) and choose Install."
        Push-Location $VencordDir
        try { Invoke-Native "Vencord inject" { pnpm inject } } finally { Pop-Location }
        $injected = $true
        Write-Ok "Injected"
    }
}

# -- 6. Turn Discord+ on -----------------------------------------------------------
if ($injected -and -not $SkipInject) {
    Write-Step "Turning Discord+ on in Vencord's settings"
    Stop-DiscordNow  # in case the Vencord installer started it
    # Vencord keeps its settings in %APPDATA%\Vencord; a dev build may use the checkout's own folder.
    $settingsFiles = @(
        (Join-Path $env:APPDATA "Vencord\settings\settings.json"),
        (Join-Path $VencordDir "settings\settings.json")
    ) | Where-Object { Test-Path $_ } | Select-Object -Unique
    if (-not $settingsFiles) {
        Write-Note "No Vencord settings yet (first start); Discord+ turns itself on by default."
    }
    foreach ($file in $settingsFiles) {
        $result = (& node (Join-Path $PSScriptRoot "enable-plugin.cjs") $file) -join ""
        switch ($result) {
            "enabled"         { Write-Ok "Enabled in $file (backup: settings.json.discordplus-backup)" }
            "already-enabled" { Write-Ok "Already enabled in $file" }
            "unreadable"      { Write-Note "Couldn't read $file; left it unchanged. Turn DiscordPlus on in Settings > Vencord > Plugins." }
            default           { Write-Note "Skipped $file ($result)" }
        }
    }
}

# -- 7. Discord+ launcher (survive Discord updates) ---------------------------------
# Each Discord update installs a new app-* folder without Vencord's patch. Vencord re-patches updates that
# happen while it runs; the launcher also covers updates applied while Discord starts.
$RunKey = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Run"
$launcherShortcuts = @()
$launcherRunValues = @()
$patchedFlavors = @($Flavors | Where-Object {
    Get-ChildItem -Path (Join-Path $env:LOCALAPPDATA $_) -Directory -Filter "app-*" -ErrorAction SilentlyContinue |
        Where-Object { Test-Path (Join-Path $_.FullName "resources\_app.asar") }
})
if ($injected -and -not $SkipInject -and -not $NoLauncher -and $patchedFlavors) {
    Write-Step "Installing the Discord+ launcher (keeps Discord+ after Discord updates)"
    New-Item -ItemType Directory -Force -Path $StateDir | Out-Null
    Copy-Item -Path (Join-Path $PSScriptRoot "launcher.ps1"), (Join-Path $PSScriptRoot "DiscordPlus.vbs") -Destination $StateDir -Force
    $vbs = Join-Path $StateDir "DiscordPlus.vbs"
    $shell = New-Object -ComObject WScript.Shell
    $desktop = [Environment]::GetFolderPath("Desktop")
    $startMenu = Join-Path ([Environment]::GetFolderPath("Programs")) "Discord+"
    New-Item -ItemType Directory -Force -Path $startMenu | Out-Null

    foreach ($flavor in $patchedFlavors) {
        # Keep a copy of Vencord's loader, so a repair works even after Discord deletes old versions.
        $patched = Get-ChildItem -Path (Join-Path $env:LOCALAPPDATA $flavor) -Directory -Filter "app-*" |
            Where-Object { Test-Path (Join-Path $_.FullName "resources\_app.asar") } |
            Sort-Object { try { [version]$_.Name.Substring(4) } catch { [version]"0.0" } } | Select-Object -Last 1
        Copy-Item -Path (Join-Path $patched.FullName "resources\app.asar") -Destination (Join-Path $StateDir "vencord-loader.asar") -Recurse -Force

        $label = if ($flavor -eq "Discord") { "Discord+" } else { "Discord+ " + $flavor.Substring(7) }
        $icon = Join-Path $env:LOCALAPPDATA "$flavor\app.ico"
        if (-not (Test-Path $icon)) { $icon = Join-Path $env:LOCALAPPDATA "$flavor\Update.exe" }
        foreach ($dir in @($desktop, $startMenu)) {
            $lnkPath = Join-Path $dir "$label.lnk"
            $lnk = $shell.CreateShortcut($lnkPath)
            $lnk.TargetPath = Join-Path $env:WINDIR "System32\wscript.exe"
            $lnk.Arguments = "`"$vbs`" -Flavor $flavor -Mode launch"
            $lnk.IconLocation = "$icon,0"
            $lnk.Description = "Open $flavor with Discord+ (re-patches after Discord updates)"
            $lnk.WorkingDirectory = $StateDir
            $lnk.Save()
            $launcherShortcuts += $lnkPath
        }

        # At Windows login: check while Discord's own "open on startup" launches it.
        $valueName = "DiscordPlus-$flavor"
        $command = "`"$(Join-Path $env:WINDIR 'System32\wscript.exe')`" `"$vbs`" -Flavor $flavor -Mode check"
        New-Item -Path $RunKey -Force | Out-Null
        Set-ItemProperty -Path $RunKey -Name $valueName -Value $command
        $launcherRunValues += $valueName
        Write-Ok "$label shortcuts (desktop + Start menu) and login check ready"
    }
    Write-Note "Open Discord with the Discord+ shortcut (or pin it to the taskbar) so updates get re-patched."
}

# -- 8. Remember what we did ----------------------------------------------------
New-Item -ItemType Directory -Force -Path $StateDir | Out-Null
[ordered]@{
    vencordDir        = $VencordDir
    clonedByInstaller = $clonedByUs
    injected          = $injected
    pluginPath        = $pluginTarget
    pluginVersion     = "1.8.0"
    launcherShortcuts = $launcherShortcuts
    launcherRunValues = $launcherRunValues
    installedAt       = (Get-Date).ToString("s")
} | ConvertTo-Json | Set-Content -Path $StateFile -Encoding UTF8

Write-Host ""
Write-Host "Discord+ is installed." -ForegroundColor Green
Write-Host "  - Every feature can be switched off in Settings > Vencord > Plugins > DiscordPlus."
Write-Host "  - To undo: disable the plugin in Discord, or run UNINSTALL.bat."

# -- 9. Start Discord with Discord+ ------------------------------------------------
if ($injected -and -not $SkipInject -and -not $NoStart) {
    # Reopen what was running; if nothing was, the first installed of Stable, PTB, Canary.
    $toStart = @($script:ClosedFlavors)
    if (-not $toStart) {
        $toStart = @($Flavors | Where-Object { Test-Path (Join-Path $env:LOCALAPPDATA "$_\Update.exe") } | Select-Object -First 1)
    }
    $vbsLauncher = Join-Path $StateDir "DiscordPlus.vbs"
    foreach ($flavor in $toStart) {
        $updater = Join-Path $env:LOCALAPPDATA "$flavor\Update.exe"
        if ((Test-Path $vbsLauncher) -and ($patchedFlavors -contains $flavor) -and -not $NoLauncher) {
            # Through the launcher, so an update applied right now is re-patched too.
            Write-Step "Starting $flavor with Discord+"
            Start-Process -FilePath (Join-Path $env:WINDIR "System32\wscript.exe") -ArgumentList "`"$vbsLauncher`"", "-Flavor", $flavor, "-Mode", "launch"
        } elseif (Test-Path $updater) {
            Write-Step "Starting $flavor with Discord+"
            Start-Process $updater -ArgumentList "--processStart", "$flavor.exe"
        } else {
            Write-Note "Couldn't find $updater; start $flavor yourself."
        }
    }
    if (-not $toStart) { Write-Note "Couldn't find a Discord install to start; open Discord yourself." }
}
