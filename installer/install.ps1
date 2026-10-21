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
    7. Finds every Discord install (also the per-user copy in C:\ProgramData\<user>\Discord) and offers to
       patch the ones Vencord's installer didn't. Then asks, one by one, whether to put Discord+ on the taskbar
       (replacing the Discord pin), the desktop and the Start menu, and whether to check Discord at Windows login.
       The Discord+ launcher re-patches Discord when an update arrives unpatched, so Discord+ survives updates.
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

.PARAMETER Yes
    Don't ask the optional questions; answer every one with its default (yes).
#>
[CmdletBinding()]
param(
    [string]$VencordDir = (Join-Path $env:LOCALAPPDATA "DiscordPlus\Vencord"),
    [switch]$UpdateVencord,
    [switch]$Reinject,
    [switch]$SkipInject,
    [switch]$NoStart,
    [switch]$NoLauncher,
    [switch]$Yes
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
$script:ClosedRoots = @()

function Get-VersionOf($dir) { try { [version]$dir.Name.Substring(4) } catch { [version]"0.0" } }

# Every Discord install: %LOCALAPPDATA%\<flavor>, and the per-user copy Discord's machine-wide installer
# keeps in %ProgramData%\<user>\<flavor>.
function Get-DiscordInstalls {
    foreach ($flavor in $Flavors) {
        foreach ($root in @((Join-Path $env:LOCALAPPDATA $flavor), (Join-Path $env:ProgramData (Join-Path $env:USERNAME $flavor)))) {
            if (-not (Test-Path (Join-Path $root "Update.exe"))) { continue }
            $latest = Get-ChildItem -Path $root -Directory -Filter "app-*" -ErrorAction SilentlyContinue |
                Where-Object { Test-Path (Join-Path $_.FullName "resources\app.asar") } |
                Sort-Object { Get-VersionOf $_ } | Select-Object -Last 1
            [pscustomobject]@{
                Flavor  = $flavor
                Root    = $root
                Latest  = $latest
                Patched = [bool]($latest -and (Test-Path (Join-Path $latest.FullName "resources\_app.asar")))
            }
        }
    }
}


function Get-DiscordProcesses { Get-Process -ErrorAction SilentlyContinue | Where-Object { $Flavors -contains $_.ProcessName } }

function Stop-DiscordNow {
    $running = Get-DiscordProcesses
    if (-not $running) { return }
    $script:ClosedFlavors = @($script:ClosedFlavors + ($running | ForEach-Object { $_.ProcessName }) | Select-Object -Unique)
    # Install folder of each running Discord: ...\<root>\app-x.y.z\Discord.exe
    $script:ClosedRoots = @($script:ClosedRoots + ($running | Where-Object { $_.Path } | ForEach-Object { Split-Path (Split-Path $_.Path) }) | Select-Object -Unique)
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
    # Discord replaces Vencord's patch when it updates; if no install is patched any more, inject again.
    $anyPatched = [bool](Get-DiscordInstalls | Where-Object { $_.Patched })
    if ($alreadyInjected -and -not $anyPatched) {
        Write-Note "No Discord install has Vencord any more (a Discord update or reinstall removed it); injecting again."
    }
    if ($alreadyInjected -and $anyPatched -and -not $Reinject) {
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

# -- 7. Discord+ launcher, shortcuts, taskbar (each one asked) ------------------------
# Each Discord update installs a new app-* folder without Vencord's patch. Vencord re-patches updates that
# happen while it runs; the launcher also covers updates applied while Discord starts.
function Ask([string]$question) {
    if ($Yes) { Write-Note "$question yes"; return $true }
    $answer = Read-Host "    $question [Y/n]"
    return -not ($answer -match "^(n|no)$")
}

$RunKey = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Run"
$PinDir = Join-Path $env:APPDATA "Microsoft\Internet Explorer\Quick Launch\User Pinned\TaskBar"
$launcherShortcuts = @()
$launcherRunValues = @()
$launcherPatchedRoots = @()
$pinPath = $null
$pinBackup = $null
$primary = $null

if ($injected -and -not $SkipInject -and -not $NoLauncher) {
    Write-Step "Discord+ launcher (keeps Discord+ after Discord updates)"
    New-Item -ItemType Directory -Force -Path $StateDir | Out-Null
    Copy-Item -Path (Join-Path $PSScriptRoot "launcher.ps1"), (Join-Path $PSScriptRoot "DiscordPlus.vbs") -Destination $StateDir -Force
    $vbs = Join-Path $StateDir "DiscordPlus.vbs"
    $wscript = Join-Path $env:WINDIR "System32\wscript.exe"
    Add-Type -TypeDefinition (Get-Content -Raw (Join-Path $PSScriptRoot "ShortcutTools.cs")) -Language CSharp

    $installs = @(Get-DiscordInstalls)
    # Keep a copy of Vencord's loader (from the newest patched version anywhere).
    $source = $installs | Where-Object { $_.Patched } | Sort-Object { Get-VersionOf $_.Latest } | Select-Object -Last 1
    $loader = Join-Path $StateDir "vencord-loader.asar"
    if ($source) { Copy-Item -Path (Join-Path $source.Latest.FullName "resources\app.asar") -Destination $loader -Recurse -Force }

    # Discord installs Vencord's installer didn't patch (Discord is closed at this point).
    foreach ($inst in $installs | Where-Object { -not $_.Patched -and $_.Latest }) {
        if (-not (Test-Path $loader)) { break }
        if (Ask "Discord is also installed in $($inst.Root) without Discord+. Add Discord+ there too?") {
            $res = Join-Path $inst.Latest.FullName "resources"
            Rename-Item -Path (Join-Path $res "app.asar") -NewName "_app.asar"
            Copy-Item -Path $loader -Destination (Join-Path $res "app.asar") -Recurse -Force
            $inst.Patched = $true
            $launcherPatchedRoots += $inst.Root
            Write-Ok "Patched $($inst.Root)\$($inst.Latest.Name)"
        }
    }

    # The Discord you actually use: the one pinned to the taskbar, else the one that was running.
    $pin = Get-ChildItem -Path $PinDir -Filter "*.lnk" -ErrorAction SilentlyContinue | Where-Object {
        $target = (New-Object -ComObject WScript.Shell).CreateShortcut($_.FullName).TargetPath
        $installs | Where-Object { $target -like "$($_.Root)\*" }
    } | Select-Object -First 1
    if ($pin) {
        $pinTarget = (New-Object -ComObject WScript.Shell).CreateShortcut($pin.FullName).TargetPath
        $primary = $installs | Where-Object { $pinTarget -like "$($_.Root)\*" } | Select-Object -First 1
    }
    if (-not $primary) { $primary = $installs | Where-Object { $script:ClosedRoots -contains $_.Root -and $_.Patched } | Select-Object -First 1 }
    if (-not $primary) { $primary = $installs | Where-Object { $_.Patched } | Select-Object -First 1 }

    if (-not $primary -or -not $primary.Patched) {
        Write-Note "No patched Discord install found; skipping shortcuts. Run INSTALL.bat -Reinject."
    } else {
        $flavor = $primary.Flavor
        $label = if ($flavor -eq "Discord") { "Discord+" } else { "Discord+ " + $flavor.Substring(7) }
        $launchArgs = "`"$vbs`" -Flavor $flavor -Root `"$($primary.Root)`" -Mode launch"
        $icon = Join-Path $primary.Root "app.ico"
        if (-not (Test-Path $icon)) { $icon = Join-Path $primary.Root "Update.exe" }
        # Discord's own AppUserModelID, so the window groups with a Discord+ pin.
        $appId = if ($pin) { [DiscordPlus.Shortcut]::GetAppId($pin.FullName) } else { "" }
        if (-not $appId) { $appId = "com.squirrel.$flavor.$flavor" }
        $desc = "Open $flavor with Discord+ (re-patches after Discord updates)"
        Write-Note "Using $($primary.Root)"

        if ($pin) {
            if (Ask "Replace Discord on your taskbar with Discord+?") {
                $pinPath = $pin.FullName
                $pinBackup = Join-Path $StateDir ("taskbar-" + $pin.Name + ".original")
                if (-not (Test-Path $pinBackup)) { Copy-Item -Path $pinPath -Destination $pinBackup -Force }
                # Same file, same place on the taskbar; it now opens Discord through Discord+.
                [DiscordPlus.Shortcut]::Write($pinPath, $wscript, $launchArgs, $StateDir, $icon, $desc, $appId)
                Write-Ok "Taskbar: Discord now opens with Discord+"
            }
        } else {
            Write-Note "Discord isn't pinned to your taskbar. Windows doesn't let installers pin apps:"
            Write-Note "right-click Discord+ in the Start menu and choose Pin to taskbar."
        }

        if (Ask "Add a Discord+ shortcut to the desktop?") {
            $lnk = Join-Path ([Environment]::GetFolderPath("Desktop")) "$label.lnk"
            [DiscordPlus.Shortcut]::Write($lnk, $wscript, $launchArgs, $StateDir, $icon, $desc, $appId)
            $launcherShortcuts += $lnk
            Write-Ok "Desktop: $label"
        }

        if (Ask "Add Discord+ to the Start menu?") {
            $menuDir = Join-Path ([Environment]::GetFolderPath("Programs")) "Discord+"
            New-Item -ItemType Directory -Force -Path $menuDir | Out-Null
            $lnk = Join-Path $menuDir "$label.lnk"
            [DiscordPlus.Shortcut]::Write($lnk, $wscript, $launchArgs, $StateDir, $icon, $desc, $appId)
            $launcherShortcuts += $lnk
            Write-Ok "Start menu: $label"
        }

        if (Ask "Check Discord at Windows login, so Discord+ survives updates?") {
            $valueName = "DiscordPlus-$flavor"
            $command = "`"$wscript`" `"$vbs`" -Flavor $flavor -Root `"$($primary.Root)`" -Mode check"
            New-Item -Path $RunKey -Force | Out-Null
            Set-ItemProperty -Path $RunKey -Name $valueName -Value $command
            $launcherRunValues += $valueName
            Write-Ok "Login check on"
        }
    }
}

# -- 8. Remember what we did ----------------------------------------------------
New-Item -ItemType Directory -Force -Path $StateDir | Out-Null
[ordered]@{
    vencordDir        = $VencordDir
    clonedByInstaller = $clonedByUs
    injected          = $injected
    pluginPath        = $pluginTarget
    pluginVersion     = "1.10.0"
    launcherShortcuts = $launcherShortcuts
    launcherRunValues = $launcherRunValues
    launcherPatchedRoots = $launcherPatchedRoots
    pinPath           = $pinPath
    pinBackup         = $pinBackup
    discordRoot       = if ($primary) { $primary.Root } else { $null }
    installedAt       = (Get-Date).ToString("s")
} | ConvertTo-Json | Set-Content -Path $StateFile -Encoding UTF8

Write-Host ""
Write-Host "Discord+ is installed." -ForegroundColor Green
Write-Host "  - Every feature can be switched off in Settings > Vencord > Plugins > DiscordPlus."
Write-Host "  - To undo: disable the plugin in Discord, or run UNINSTALL.bat."

# -- 9. Start Discord with Discord+ ------------------------------------------------
if ($injected -and -not $SkipInject -and -not $NoStart) {
    if (Ask "Start Discord now?") {
        $vbsLauncher = Join-Path $StateDir "DiscordPlus.vbs"
        if ($primary -and $primary.Patched -and (Test-Path $vbsLauncher) -and -not $NoLauncher) {
            # Through the launcher, so an update applied right now is re-patched too.
            Write-Step "Starting $($primary.Flavor) with Discord+"
            Start-Process -FilePath (Join-Path $env:WINDIR "System32\wscript.exe") -ArgumentList "`"$vbsLauncher`"", "-Flavor", $primary.Flavor, "-Root", "`"$($primary.Root)`"", "-Mode", "launch"
        } else {
            $toStart = @($script:ClosedFlavors)
            if (-not $toStart) { $toStart = @($Flavors | Where-Object { Test-Path (Join-Path $env:LOCALAPPDATA "$_\Update.exe") } | Select-Object -First 1) }
            foreach ($flavor in $toStart) {
                $updater = Join-Path $env:LOCALAPPDATA "$flavor\Update.exe"
                if (Test-Path $updater) {
                    Write-Step "Starting $flavor with Discord+"
                    Start-Process $updater -ArgumentList "--processStart", "$flavor.exe"
                }
            }
            if (-not $toStart) { Write-Note "Couldn't find a Discord install to start; open Discord yourself." }
        }
    }
}
