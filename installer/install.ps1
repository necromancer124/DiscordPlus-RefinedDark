<#
.SYNOPSIS
    Installs (or updates) Discord+ Refined Dark into the Discord desktop app via Vencord.

.DESCRIPTION
    1. Checks Git, Node.js 18+ and pnpm.
    2. Clones Vencord (or reuses an existing checkout).
    3. Copies the Discord+ plugin into Vencord's src\userplugins.
    4. Builds Vencord.
    5. Closes Discord (asks first) and injects Vencord with the official Vencord installer.
    6. Writes %LOCALAPPDATA%\DiscordPlus\install-state.json so UNINSTALL.bat knows what to revert.

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
#>
[CmdletBinding()]
param(
    [string]$VencordDir = (Join-Path $env:LOCALAPPDATA "DiscordPlus\Vencord"),
    [switch]$UpdateVencord,
    [switch]$Reinject,
    [switch]$SkipInject
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

# -- 5. Inject ------------------------------------------------------------------
function Close-Discord([string]$why) {
    $running = Get-Process -Name "Discord*" -ErrorAction SilentlyContinue
    if (-not $running) { return }
    $answer = Read-Host "    $why Close it now? [Y/n]"
    if ($answer -match "^(n|no)$") { Fail "Discord is still running. Close it and run INSTALL.bat again." }
    $running | Stop-Process -Force
    Start-Sleep -Seconds 2
}
$alreadyInjected = $state -and [bool]$state.injected -and $state.vencordDir -eq $VencordDir
$injected = [bool]$alreadyInjected
if ($SkipInject) {
    Write-Step "Skipping inject (-SkipInject)"
} elseif ($alreadyInjected -and -not $Reinject) {
    Write-Step "Vencord is already injected from this folder; the rebuild is enough."
    Write-Note "If Discord updated and Discord+ disappeared, run:  INSTALL.bat -Reinject"
    # A running Discord keeps the old build in memory; it must restart to load the new one.
    Close-Discord "Discord has to restart to load the new build."
} else {
    Write-Step "Injecting Vencord into Discord"
    Close-Discord "Discord must be closed to install."
    Write-Note "The official Vencord installer opens next. Pick your Discord install (usually Stable) and choose Install."
    Push-Location $VencordDir
    try { Invoke-Native "Vencord inject" { pnpm inject } } finally { Pop-Location }
    $injected = $true
    Write-Ok "Injected"
}

# -- 6. Remember what we did ----------------------------------------------------
New-Item -ItemType Directory -Force -Path $StateDir | Out-Null
[ordered]@{
    vencordDir        = $VencordDir
    clonedByInstaller = $clonedByUs
    injected          = $injected
    pluginPath        = $pluginTarget
    pluginVersion     = "1.7.0"
    installedAt       = (Get-Date).ToString("s")
} | ConvertTo-Json | Set-Content -Path $StateFile -Encoding UTF8

Write-Host ""
Write-Host "Discord+ is installed." -ForegroundColor Green
Write-Host "  - Start Discord. Discord+ turns on automatically (Settings > Vencord > Plugins > DiscordPlus)."
Write-Host "  - Every feature can be switched off in the plugin's settings."
Write-Host "  - To undo: disable the plugin in Discord, or run UNINSTALL.bat."

$discordUpdater = Join-Path $env:LOCALAPPDATA "Discord\Update.exe"
if ($injected -and (Test-Path $discordUpdater) -and -not (Get-Process -Name "Discord" -ErrorAction SilentlyContinue)) {
    $start = Read-Host "Start Discord now? [Y/n]"
    if ($start -notmatch "^(n|no)$") { Start-Process $discordUpdater -ArgumentList "--processStart", "Discord.exe" }
}
