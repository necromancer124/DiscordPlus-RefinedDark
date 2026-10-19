<#
.SYNOPSIS
    Reverts Discord+ Refined Dark.

.DESCRIPTION
    Three levels of undo, from lightest to complete:

      (no script)  Discord > Settings > Vencord > Plugins > DiscordPlus > off
                   Instant. Every Discord+ change is removed live; turn it back on any time.

      PluginOnly   Removes the Discord+ plugin from the Vencord build and rebuilds.
                   Discord keeps plain Vencord.

      Full         Uninjects Vencord with the official Vencord installer, so Discord is back to the
                   original, unmodified app. If this installer downloaded the Vencord source, it is deleted.

.PARAMETER Mode
    PluginOnly or Full. Without it you get a menu.
#>
[CmdletBinding()]
param(
    [ValidateSet("PluginOnly", "Full")]
    [string]$Mode
)

$ErrorActionPreference = "Stop"
$StateDir = Join-Path $env:LOCALAPPDATA "DiscordPlus"
$StateFile = Join-Path $StateDir "install-state.json"

function Write-Step([string]$text) { Write-Host ""; Write-Host "==> $text" -ForegroundColor Cyan }
function Write-Ok([string]$text) { Write-Host "    $text" -ForegroundColor Green }
function Fail([string]$text) { Write-Host ""; Write-Host "ERROR: $text" -ForegroundColor Red; exit 1 }
function Invoke-Native([string]$what, [scriptblock]$cmd) {
    & $cmd
    if ($LASTEXITCODE -ne 0) { Fail "$what failed (exit code $LASTEXITCODE)." }
}
function Stop-Discord {
    $running = Get-Process -Name "Discord*" -ErrorAction SilentlyContinue
    if (-not $running) { return }
    $answer = Read-Host "    Discord must be closed for this. Close it now? [Y/n]"
    if ($answer -match "^(n|no)$") { Fail "Discord is still running. Close it and run UNINSTALL.bat again." }
    $running | Stop-Process -Force
    Start-Sleep -Seconds 2
}

Write-Host "Discord+ Refined Dark - revert" -ForegroundColor White

$state = $null
if (Test-Path $StateFile) { $state = Get-Content $StateFile -Raw | ConvertFrom-Json }
if (-not $state) {
    Write-Host "No install record found at $StateFile." -ForegroundColor Yellow
    $dir = Read-Host "Path to the Vencord folder Discord+ was built in (leave empty to cancel)"
    if (-not $dir) { exit 0 }
    $state = [pscustomobject]@{ vencordDir = $dir; clonedByInstaller = $false; injected = $true }
}
$VencordDir = $state.vencordDir
if (-not (Test-Path (Join-Path $VencordDir "package.json"))) { Fail "$VencordDir doesn't look like a Vencord checkout." }

if (-not $Mode) {
    Write-Host ""
    Write-Host "Tip: for a quick, temporary revert just turn DiscordPlus off in Discord > Settings > Vencord > Plugins."
    Write-Host ""
    Write-Host "  [1] Remove Discord+ only (keep Vencord)"
    Write-Host "  [2] Restore original Discord (remove Vencord and Discord+)"
    Write-Host "  [3] Cancel"
    switch (Read-Host "Choose 1, 2 or 3") {
        "1" { $Mode = "PluginOnly" }
        "2" { $Mode = "Full" }
        default { Write-Host "Cancelled. Nothing changed."; exit 0 }
    }
}

if ($Mode -eq "PluginOnly") {
    Write-Step "Removing the Discord+ plugin from $VencordDir"
    $pluginTarget = Join-Path $VencordDir "src\userplugins\discordPlus"
    if (Test-Path $pluginTarget) { Remove-Item -Recurse -Force $pluginTarget; Write-Ok "Plugin folder removed" }
    else { Write-Ok "Plugin folder was already gone" }

    Write-Step "Rebuilding Vencord without Discord+"
    Push-Location $VencordDir
    try { Invoke-Native "pnpm build" { pnpm build } } finally { Pop-Location }
    Stop-Discord
    Remove-Item -Force $StateFile -ErrorAction SilentlyContinue
    Write-Host ""
    Write-Host "Discord+ removed. Start Discord again; Vencord stays installed." -ForegroundColor Green
    Write-Host "Your Vencord settings keep a harmless 'DiscordPlus' entry; delete it from Vencord's settings if you like."
    exit 0
}

# Full restore
Write-Step "Restoring the original Discord app"
Stop-Discord
Write-Host "    The official Vencord installer opens next. Pick the same Discord install and choose Uninstall." -ForegroundColor DarkGray
Push-Location $VencordDir
try { Invoke-Native "Vencord uninject" { pnpm uninject } } finally { Pop-Location }
Write-Ok "Vencord removed from Discord"

if ($state.clonedByInstaller) {
    Write-Step "Deleting the Vencord source the installer downloaded ($VencordDir)"
    Remove-Item -Recurse -Force $VencordDir
    Write-Ok "Deleted"
} else {
    Write-Host "    Kept your own Vencord checkout at $VencordDir (the installer didn't create it)." -ForegroundColor DarkGray
    $pluginTarget = Join-Path $VencordDir "src\userplugins\discordPlus"
    if (Test-Path $pluginTarget) { Remove-Item -Recurse -Force $pluginTarget; Write-Ok "Removed the Discord+ plugin from it" }
}

Remove-Item -Force $StateFile -ErrorAction SilentlyContinue
if ((Test-Path $StateDir) -and -not (Get-ChildItem $StateDir -Force | Select-Object -First 1)) { Remove-Item -Force $StateDir }

Write-Host ""
Write-Host "Done. Discord is back to the original app. Start it normally." -ForegroundColor Green
