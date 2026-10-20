# Testing and verification

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
