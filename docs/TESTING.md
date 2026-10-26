# Testing and verification

## Call from the card menu (branch claude/card-call, 2026-10-26)
Vencord's real `pnpm testTsc`: passes. Harness (stand-in DM header buttons): menu Message / Call / Video call / …;
Call → DM opened, "Start Voice Call" pressed; Video call → "Start Video Call" pressed; friend without a chat → profile
+ hint. **Not yet checked in the real client:** the exact aria-labels of Discord's DM call buttons.

## v1.16.0 — voice and notes on cards (2026-10-26)
Vencord's real `pnpm testTsc`: passes. Harness: friend in another visible channel → "Lounge · Night Shift server" +
Join (joins, profile not opened); streaming friend in your channel → LIVE, "You're here", Watch (watch + call page);
channel you can't see → "In a voice channel", no buttons; notes under the status, search "pizza" → that friend only;
both settings off → no voice rows or notes. **Real client:** Discord's NoteStore only holds notes of profiles you
opened (empty at start, cleared on reconnect), so Discord+ loads `/users/@me/notes` once: 12 notes, 9 on friends,
all 9 shown; searching a word from a note finds that friend. Voice rows: nobody was in voice on any server during the
test; `VoiceStateStore.getVoiceStateForUser` reads without errors, the row itself is covered by the harness.

## v1.15.0 — rejoin offer (2026-10-24 to 10-25)
In the real client Discord did **not** rejoin the call after a restart (user report), so the feature offers the rejoin
instead. Vencord's real `pnpm testTsc`: passes. Harness: joining stores `lastCall`; plugin started before login, a
startup "left the call" doesn't forget it, CONNECTION_OPEN → "Rejoin the call?", Rejoin → in vc1. Leaving yourself
forgets it; older than 30 min, already in a call, setting off, or a later reconnect → no offer.
Real client, first try: no popup, the saved call was still there afterwards, so the offer never ran (it waited for
CONNECTION_OPEN, which most likely fired before the plugin listened). Now it waits until your account and the call's
channel are loaded (plugin started within 90s of the page loading = Discord starting), then 2.5s more. Harness: plugin
started with no user and no channels → nothing; once loaded → offer, Rejoin → in vc1. Console logs `[Discord+] rejoin:`.
Second real-client finding: quitting Discord during a call leaves the call first, which erased the saved call; a
"left the call" now only forgets it if Discord is still open 5s later. **Real client (2026-10-25):** a saved call,
Discord force-closed (like a crash) and started again: "waiting for Discord to load" at 3s, the offer at 7.4s, "Rejoin
the call? You were in 🔊 <channel> in <server> when Discord closed." stayed up 40s with no input; Not now → not in a
call, saved call forgotten.

## v1.14.0 — update check in the real client (2026-10-24)
Installed with `-KeepChoices`, checked over a local DevTools port: Discord's page can reach GitHub's releases API
(200, `v1.13.0`), so Vencord's CSP allows it. Automatic check 15s after start with this build (1.14.0): no chip.
Faked a newer release: "Update" chip, popup with the right text, header lifted to z-index 1001 so the popup is above
the call window (checked during a real call). A real check afterwards removed the chip again.

## Update check (harness, 2026-10-24)
Vencord's real `pnpm testTsc`: passes (it caught an invalid toast variant first). Harness: real GitHub answer →
"v1.13.0 is the newest version", no chip. Faked v1.14.0 → chip "Update", popup text and release link, Copy command,
closes on outside click and Escape, Skip hides it (stored 1.14.0), a manual check brings it back, setting off hides
it, HTTP 403 → "Couldn't reach GitHub". Popup draws above the call window.

## v1.13.0 — in the real client (2026-10-22)
Installed with `INSTALL.bat -KeepChoices` on the author's PC, Discord started with a local DevTools port for checks
(screenshots kept private). Right after start: Discord+ running, 15 friends online at once (the offline bug is
fixed), no errors. `ignoreUser` / `unignoreUser` / `blockUser` exist under those names on the relationship module;
`RelationshipStore.getIgnoredIDs` exists. A profile plus an alert on top: Discord+ Home stays visible. Card menu:
Message / View profile / favourite / Remove friend / Block / Ignore. Add Friend: Discord's Add Friend page (username
input), its toolbar hidden with the Back bar on exactly the same rect, Active Now hidden; Back → Home with the wave
running (diagonal steps 3,4,5,6 / 4,5,6,7, `dp-enter-wave`), cleared after the run. Messages page animates (230
rows). Installer: the pin Discord+ had replaced was recognised, its record and Discord's original pin backup
(`Update.exe --processStart Discord.exe`) restored in the state file.

## Animations (branch claude/animations, 2026-10-22)
Harness: filter change → page gets `dp-enter`, cards get diagonal steps (3,4,5 / 4,5,6 …), animation
`dp-enter-wave`, card 5 delayed 0.19s; class and steps removed after the run. Pop / Slide / Flip / Fade switch the
keyframes; Off → no animation; Relaxed → 60ms step, 620ms duration. Screenshot mid-run shows the wave.

## v1.12.0 — Add Friend, Ignore (2026-10-22)
Late stores: plugin started with PresenceStore unavailable and no presences → 0 online; store appears, presences
arrive and emit → 11 online without reload. Refresh button: silent data change → shown after pressing it.
Harness: Ignore on a friend calls `ignoreUser(id, "Friends")`; Ignored filter (2) lists an ignored friend (normal
card, menu says Unignore) and an ignored non-friend ("Ignored", menu: Message / View profile / Block / Unignore);
Unignore calls `unignoreUser`. Add Friend button switches to the classic page and clicks the native "Add Friend" tab.
**Unverified in the real client:** the names `ignoreUser` / `unignoreUser` (if missing, a toast appears and their
profile opens, where Discord's own Ignore is) and the native Add Friend tab selector.
Add Friend: native toolbar (`section` holding the tab) hidden, Back bar exactly on its rect (82,92,912×49); Back →
Discord+ Home, toolbar unmarked; plugin stop restores it. `nowPlayingColumn_` hidden on Home and in classic view; shown again with the setting off and after plugin stop.

## v1.11.0 — card menu, stacked popups (2026-10-22)
Harness: two modal layers in a `layerContainer_` → Discord+ Home stays visible; a second `layer_` in `layers_`
(User Settings) → Home steps aside; removed → back. Friend menu: Message / View profile / favourite, separator,
Remove friend + Block (danger); confirming logs the alert then `removeRelationship` / `addRelationship({type: 2})`;
cancelling the alert does nothing. Incoming: Accept / Ignore / Block; outgoing: Cancel / Block.
**Unverified in the real client:** `addRelationship` with `type: 2` blocking, and `Alerts.show` styling.

## v1.10.0 — theme colours and transparent themes (2026-10-21, issue #1)
Harness: theme on → unchanged values (Home `#15161c`, header `#0d0e13`, inline accent `#7478f8`). Theme off →
Home/header/text take the page's Discord variables, inline accent removed, `--brand-500` drives the accent
(checked with transitions off; a hidden browser pane doesn't advance CSS transitions). Simulated transparent theme
(theme variables `transparent`, gradient background): header and Home transparent, native page and DM list
pushed and hidden, nothing native shows through.

## v1.9.0 — installer questions, taskbar, multiple installs (2026-10-20)
- Install discovery (read-only, on the author's PC): found `%LOCALAPPDATA%\Discord` (patched) and
  `C:\ProgramData\<user>\Discord` (not patched); the taskbar pin points to the ProgramData one, which was chosen.
- `ShortcutTools.cs` in PowerShell 5.1 and 7: read the real pin's AppUserModelID (`com.squirrel.Discord.Discord`);
  rewrote a *copy* of the pin to the launcher with that ID kept and Discord's icon; restoring the backup gave a
  byte-identical file.
- Launcher `-Root` with a path containing spaces, through `DiscordPlus.vbs`: patched as expected.
- `Remove-AllPatches` on a fake folder restored the original `app.asar` and left a vanilla version untouched.
  **Mistake while testing:** the function also walks the real install folders, and the test wasn't isolated, so it
  un-patched the real `%LOCALAPPDATA%\Discord` (9262, 9264). Running `INSTALL.bat` re-injects (it now does so by
  itself when nothing is patched). Lesson: test functions that know real paths only with those paths overridden.

## v1.8.0 — launcher (2026-10-20)
`launcher.ps1 -DiscordRoot <fake folder>` (test mode: no processes touched), PowerShell 7 and 5.1:
vanilla newest version patched before start (`app.asar`→`_app.asar`, loader copied in); an update created mid-watch
patched + "restart"; all old versions deleted → patched from the saved loader; no loader anywhere → nothing changed,
logged. `DiscordPlus.vbs` runs it hidden with arguments passed through. Shortcut creation verified in a scratch
folder (wscript target, arguments, Discord icon). Not run against the real Discord install.

## v1.7.1 — installer enable step (2026-10-20)
`installer/enable-plugin.cjs` on sample files: disabled → enabled (other plugins and DiscordPlus settings kept,
4-space JSON, backup written); already enabled → untouched, no backup; BOM file → enabled, BOM removed; no
`plugins` key → added; corrupt JSON → left untouched; missing file → skipped. PowerShell 5.1 reads its result.
`install.ps1` parses in PowerShell 7 and 5.1 (not run end to end here; it would close Discord).

## v1.6.0 — first real Vencord build (GitHub Actions, 2026-10-19)
`pnpm build` with Discord+ inside the latest Vencord: **passed**. `pnpm testTsc` found two real errors, both fixed:
`showToast` now takes `{ text, variant }` instead of a string.

## v1.5.1 — harness checks (2026-10-19)
Pill: hide → window gone + `callHidden`; show → back, pill lit. Inside the call's server: hidden, pill shows it,
pill hides it again. Stop: section gone immediately, PiP `display:none`, watch icon back,
`closeStream("guild:g1:vc1:nova")` called; after Discord removes the window the stopped state clears.
**Unverified in the real client:** the PiP "Stop Watching" aria-label and `closeStream`/`stopStream` names.

## v1.5 — harness checks (2026-10-19)
Hide → floating window gone, `callHidden` saved, pill still in header ("Night Shift 0:09"). Pill → popup
right-aligned under the pill with "Show as floating window" + Close; outside mousedown and Escape close it;
pop-out restores the floating window; return button → call route; disconnect removes pill and manager.
Popup with stream: 4 member rows, no overlap, all inside the list, controls below (627px, max 640).

## v1.4.2 — harness checks (2026-10-19)
385×415 with stream: members toggle hides the list, stream grows 200→258px, PiP stays docked, setting saved;
min height 250px hidden / 330px list / 410px grid, with the first tile/row fully visible when squeezed.

## v1.4.1 — harness checks (2026-10-19)
Call manager at 385×760 with a docked stream: list mode, 4 rows of 46px (avatar, name, LIVE + watch / muted icon),
member area fills down to the controls, controls 1px from the bottom edge.

## v1.4 — harness checks (2026-10-19)
`flux.MESSAGE_CREATE` for a never-opened DM: preview "Open chat" → message text, unread pill, flash, card moves to
the top of its section; own message → "You: …"; optimistic and server-channel messages ignored; Messages page
lists the newest conversation first.

## v1.3 — harness checks (2026-10-19)
Pending: incoming shows Accept/Deny, outgoing Cancel; clicks call addRelationship({userId}) / removeRelationship(userId).
Call manager forced to 150px tall stays at 330px with controls inside. Without a PiP window there is no stream
section and the streamer's tile shows a watch icon (click → watchStream + open call); with it, the stream docks.
**Unverified in the real client:** addRelationship's options-object signature.

## v1.2.2 — harness checks (2026-10-19)
Panel mock = wrapper with quest, voice-connection (Disconnect) and user (User Settings) sections: quest and user
sections hidden, voice section kept; user row returns when header controls are off; stop restores all.
Docked stream window scaled to exactly the slot rect at 360px and 594px wide.

## v1.2.1 — harness checks (2026-10-19)
With the rail nested inside the `sidebar_` container (as in the real client): rail visible at the same position on
Home, DM and server routes; only the DM list is hidden; pushed elements are the list and page, never the rail;
plugin stop leaves no `dp-dm-column` / `dp-pushed` classes.

## v1.2 — harness checks (2026-10-19)
Harness has a stand-in for Discord's picture-in-picture window (`pictureInPictureWindow_*`) and a quest promo.
- Stream window docks exactly onto the call manager's slot (same x/y/w/h) and follows into the minimized bar;
  removing the window undocks cleanly.
- Friends / DM column hidden on Home and DM routes; DM page spans the full width under the header.
- Header user controls render and mute works; quest promo hidden and the Quests tab shows a dot.
- **Unverified in the real client:** the class name of Discord's PiP window, the quest promo class, and whether the
  PiP window draws above the call manager.

## v1.1 — harness checks (2026-10-19)
Harness now mirrors the real client's layout (server rail inside the same container as sidebar + page).
- No floating dock by default; Discord's own user panel stays visible.
- Card click → profile; chat row → existing DM opens; a friend with no DM → profile (no group DM created).
- Call manager: stream preview + LIVE + Watch (calls `watchStream`, then opens the call); Share button presses the
  native "Share Your Screen" button; minimized bar shows a LIVE thumbnail.
- Inside the call's server (any channel) the call manager hides; in another server it returns.
- Header push moves sidebar + page only; the server rail stays at the top (no gap). Call manager z-index 1000.

## v1.0 — in the real client (user report)
Loads in Discord after the `native.ts` rename. Reported and fixed in v1.1: empty group DM on click, server rail gap,
channel header over the call manager, floating dock in the way, call manager shown inside the call's server.

## v1.0 — what was verified (2026-10-19)

**Against Vencord source** (commit `32c9063`, 2026-10-14), by reading the code and type definitions:
`definePluginSettings`/`OptionType`/`settings.use`, `managedStyle` + `?managed` CSS, `toolboxActions`,
`enabledByDefault`, `createRoot`, `ErrorBoundary.wrap`, `openPrivateChannel`, `openUserProfile`, `openPluginModal`,
`plugins`, `NavigationRouter.transitionTo`, `SettingsRouter.openUserSettings`, `ContextMenuApi` + `Menu`,
`findByPropsLazy`, `findStoreLazy`, and the store methods in `data.ts` (Relationship, Presence, User, Channel,
ReadState, Message, PrivateChannelSort, MediaEngine, SelfPresence, SelectedChannel, VoiceState, Guild).
`ActivityType` / `RelationshipType` enum values. Vencord's `pnpm inject` / `pnpm uninject` scripts.

**Type check**: all 12 plugin files compiled with TypeScript (strict) against stubbed Vencord modules: no errors
in the plugin's own code. (Full `pnpm testTsc` inside Vencord not run; see below.)

**Installer scripts**: parse cleanly in PowerShell 7 and Windows PowerShell 5.1. Not executed end to end.

**Mock harness** (`dev/harness`, real plugin code, mocked stores, 1440×900 and 900×700), all passing, no errors:
- Home renders 18 friend cards in Online / Offline sections; header, dock and call manager render.
- Messages page: 20 conversations incl. group DM ("4 members") and a non-friend ("Not a friend").
- Right-click menu → Message / View profile / Add to favorites; favorite moves to the top and Favorites = 1.
- Pending filter shows incoming + outgoing requests; search "choco" → only pixel.
- Dock mute → dock, call controls and your call tile all show muted.
- Speaking: remote speaker highlighted; minimized bar shows the speaking remote; when only *you* speak the
  focus does not move to you.
- Minimize ↔ expand; narrowing the call below 335px → speaker mode with only the focused remote.
- Clicking a card opens the DM: home overlay leaves, header pushes the page down, native DM list hidden,
  native user panel hidden (dock + call active).
- Header → Nitro navigates to `/store` and marks Nitro active; Friends returns home.
- Classic view hides Discord+ home and shows the native Friends page under the header; toggles back.
- Narrow window: Nitro / Shop / Family Centre / Quests move into the ⋯ menu.
- Dock drag to the corner snaps 12px from the edges and saves its position.
- Disconnect hides the call manager.
- `stop()` removes the React root, every `dp-*` class, the header push and inline variables; `start()` restores.

## Not verified yet

- [ ] `pnpm install && pnpm build` with the plugin inside Vencord (the install step was not allowed in the
      session that wrote v1.0). **Run `INSTALL.bat` first; it does exactly this.**
- [ ] Anything inside a real Discord client: real class names (`guilds_`, `sidebar_`, `privateChannels_`,
      `panels_`, `layer_`), routes (`/store`, `/shop`, `/family-center`, `/quest-home`, `/message-requests`),
      Discord's `toggleSelfMute` / `selectVoiceChannel` / `SpeakingStore` modules.
- [ ] Installer and uninstaller end to end on a clean machine.

## First real run checklist

1. `INSTALL.bat` → build succeeds → Vencord installer → Install. Start Discord.
2. Settings → Vencord → Plugins: **DiscordPlus** is on. Open Ctrl+Shift+I console, check for `[Discord+]` warnings.
3. Home: grid shows your friends with avatars/status; unread badges match Discord's; click opens the DM.
4. Header: each tab opens the right page; if one lands on a blank page, fix its path in `discordApi.ts` `ROUTES`.
5. DM view: DM list hidden, chat not covered by the header (if covered, the push target in `layout.ts` needs updating).
6. Dock: mute/deafen match Discord's own state; settings opens User Settings; drag + restart keeps position.
7. Join a voice channel, go to another page: call manager appears; speaking highlight follows real speakers;
   mute/deafen/disconnect work; Return to call opens the channel.
8. Open User Settings: Discord+ header/home step aside.
9. Disable DiscordPlus: everything returns to stock Discord without a reload. Re-enable.
10. `UNINSTALL.bat` → 1, then `INSTALL.bat` again; finally `UNINSTALL.bat` → 2 restores the original Discord.

## Offline preview checks (v0.2)

`node --check preview/app.js`; preview driven in a browser: badge 6 → 5 after reading Orbit, message send, back,
Offline = 7, call minimize, Pending (2 → accept → 1), Blocked empty state, dock clamped on-screen after resize.
