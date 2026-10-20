# Changelog

## v1.8.0 — 2026-10-20
- **Survives Discord updates.** New Discord+ launcher (`installer/launcher.ps1`, run hidden via `DiscordPlus.vbs`):
  "Discord+" shortcuts on the desktop and in the Start menu, and a check at Windows login. Before Discord starts it
  patches the newest `app-*` version if an update left it unpatched; for 3 minutes after start it watches for an
  update landing during startup, patches it and restarts Discord once. Patches the same way Vencord's own
  `persistAfterDiscordUpdates` does and keeps a copy of Vencord's loader. Log in `%LOCALAPPDATA%\DiscordPlus`.
- Installer starts Discord through the launcher; new `-NoLauncher` option. `UNINSTALL.bat` removes the shortcuts,
  login check and launcher files in both modes.

## v1.7.1 — 2026-10-20
- **Installer opens Discord with Discord+ enabled.** After building it closes Discord (asks first, also on
  re-runs), turns DiscordPlus on in Vencord's `settings.json` (via `installer/enable-plugin.cjs`: keeps every other
  setting, writes the file like Vencord does, leaves an unreadable file untouched, keeps a backup), then starts the
  same Discord flavour that was running (Stable / PTB / Canary), or Stable. New `-NoStart` option.

## v1.7.0 — 2026-10-20
- **New status icons** (`design/status-icons/`), used on every avatar: friend cards, Messages, the header, the
  floating dock and call-manager tiles. Each status has its own shape as well as colour: online dot, idle crescent,
  do-not-disturb bar, offline ring, and two new ones: **streaming** (purple play) and **online on mobile** (phone).
  Cut-outs are real transparency over a ring in the surface colour.
- Statuses now detect streaming (Discord's streaming status or a streaming activity) and online-on-mobile.
- Call-manager tiles show each participant's status.

## v1.6.0 — 2026-10-19 (first public release)
- **License:** Creative Commons BY-NC 4.0: free for non-commercial use with credit to necromancer124 and a link to
  the original repository; commercial use needs the author's approval.
- **GitHub Actions:** a build check compiles Discord+ inside the latest Vencord and type-checks it on every push;
  pushing a `v*` tag publishes a release with an install zip, a plugin-only zip and the changelog as notes.
- **Screenshots** in the README, captured from the real plugin code in the harness (`dev/harness/screenshots.mjs`).
- **Privacy:** all sample data (preview, harness, docs) now uses made-up people with abstract SVG avatars; real
  usernames, avatars and the private reference screenshots were removed from the repository.

## v1.5.1 — 2026-10-19
- The header call pill now **shows / hides the call window** itself (lit while it's shown) instead of opening a
  second popup; the popup is removed. Inside the call's own server the pill can also show it there.
- **Stop watching** button in the stream's title row: presses Discord's own "Stop Watching" on the stream window
  if present, otherwise calls Discord's stream close action (`closeStream` / `stopStream` with the stream key).
  The stream section disappears at once and the streamer's tile gets its watch icon back; Discord's stream window
  is hidden until Discord removes it.

## v1.5 — 2026-10-19
- **Hide the call manager**: new hide button in its title bar (remembered). The call stays reachable from the header.
- **Call pill in the header**, only while you're in a voice call: channel name + timer, and a **return to call**
  button. Clicking the pill opens the call manager as a **popup** under it (closes on outside click / Escape);
  when the floating window is hidden, the popup has a button to show it as a floating window again.
- Only one call manager at a time: the floating window steps aside while the popup is open.
- Fixed: members squashed together next to a stream when the call manager had no fixed height (popup, or a
  floating window you hadn't resized yet).

## v1.4.2 — 2026-10-19
- **Hide call members** while watching a stream: a people button in the stream's title row hides the member list
  so the stream takes its space (remembered; click again to show them). With members hidden the call manager can
  shrink to 250px.
- When members are shown next to a stream, at least one full tile (grid) or row (list) stays visible; the window
  stops shrinking there (410px grid / 330px list) instead of showing a half-cut sliver.

## v1.4.1 — 2026-10-19
- Fixed: in a narrow call manager with a stream, the members disappeared and the buttons floated mid-window
  with empty space below. Narrow call managers (< 420px) now list members as compact rows (avatar, name,
  LIVE / watch / muted on the right; focused speaker first), wider ones keep the grid. The member area fills the
  free height and the buttons always sit at the bottom.

## v1.4 — 2026-10-19
- **Live messages on Discord+ Home**: the plugin listens to Discord's `MESSAGE_CREATE` events and keeps the newest
  message of every DM / group DM, so a card's preview updates the moment a message arrives, even for chats you
  never opened (Discord's MessageStore only caches opened chats). The card also gets its unread badge, moves up
  (smart order) and flashes briefly. Your own messages from other devices show as "You: …". The Messages page
  updates the same way. Messages still being sent and server messages are ignored; nothing is stored on disk.

## v1.3 — 2026-10-19
- **Accept / Deny** buttons on incoming friend requests and **Cancel** on outgoing ones (Pending filter), using
  Discord's own relationship actions. If an action fails, the profile opens instead.
- Call manager has a **minimum size** (330px with a stream, 220px without; 300px wide): head, stream and controls
  never shrink, participants shrink and scroll first, so the buttons can't be cut off.
- The stream section appears **only while you are watching** a stream (Discord's stream window exists). Otherwise
  the streamer's tile shows a small **watch icon** (and the minimized bar a watch button); the preview image is gone.

## v1.2.2 — 2026-10-19
- Fixed: an empty bar above "Voice Connected" in servers. Hiding the quest card by CSS left its outer box behind.
  `tidyPanels()` now removes whole sections of the bottom-left panel: the quest card, and your user row while the
  header shows your controls. The voice-connection section (the one with Disconnect) is always kept.
- Fixed: the docked stream video stayed small in a corner of a big black box. Discord's window is now scaled
  (not resized) to fit the call manager's slot, so the video and its controls fill it at any call-manager size.

## v1.2.1 — 2026-10-19
- Fixed: removing the DM column also removed the **server list**. In current Discord the server rail sits inside
  the same `sidebar_` container as the DM list. Discord+ now picks the DM column in code: the highest ancestor of
  the DM list that does not contain the server rail. If the rail can't be found, nothing is hidden.
- The header push uses the same rule: it descends into any element holding the rail and never moves the rail.
- Harness now uses Discord's real nesting (rail inside the sidebar container).

## v1.2 — 2026-10-19
- **Live stream inside the call manager**: Discord's own picture-in-picture stream window is docked into the call
  manager's stream slot (follows drag, resize and minimize), so the real live video plays there. Title row with
  LIVE, streamer and Open. Setting `dockStreamVideo`.
- **No more Friends / DM column** on Home, in DMs and on Nitro/Shop/etc. pages; the header is the navigation
  (`hideDmColumn`).
- **Your user controls moved up into the header** (avatar, mute, deafen, settings), so nothing is squeezed or
  covered at the bottom-left. Outside servers Discord's bottom-left panel is hidden (the call manager handles calls).
  Setting `headerUserControls`.
- **Quest promo card** replaced by a small dot on the Quests tab (`hideQuestPromo`).
- Header uses the same surface as Discord's title bar and server list, and Discord+ Home has Discord's rounded
  top-left corner, so the top of the window reads as one bar.

## v1.1 — 2026-10-19 (first feedback from the real client)
- Friend cards: clicking the card opens the person's **profile**; the chat row underneath opens the **chat**.
- Fixed: opening a chat created an empty group DM. Discord changed its `openPrivateChannel` action; Discord+ no
  longer calls it. An existing DM opens directly; without one, the profile opens (its Message button creates the DM).
- Discord's own bottom-left user/voice panel is back by default; the floating dock is now optional
  (`floatingDock`, off). Chats stay fully native: the DM list is no longer hidden by default (`fullWidthDms`, off).
- Call manager steps aside anywhere inside the call's server (or the DM of a DM call), so Discord's native call UI
  is used there. It shows up again in other servers, Home and other DMs.
- Call manager: **Share your screen** button (presses Discord's own button, so the native picker is used),
  live **stream preview** with LIVE badge and **Watch** (expanded and minimized), LIVE badge on streaming tiles.
- Fixed: entering a server moved the server list down and left a gap above the Discord icon. The header now moves
  only the channel sidebar and page.
- Fixed: Discord's channel header could draw over the call manager. Discord+ now sits above page content but below
  Discord's popouts, menus and modals.
- The header push is re-applied continuously, since Discord rewrites its elements when it re-renders.

## v1.0.1 — 2026-10-19
- Fixed: Discord crashed on startup with "A JavaScript error occurred in the main process … Expected handler
  to be a function, but found type 'object'". Vencord loads any plugin file named `native.ts` into Discord's main
  process as IPC handlers; the plugin's renderer helpers lived in `native.ts`. Renamed to `discordApi.ts`, and the
  installer now refuses to build if a `native.ts` appears in the plugin folder.

## v1.0 — 2026-10-19 (branch `claude/improvements`)
The full plugin, following `MASTER_PROMPT.md`. Rewritten as a React app mounted by the Vencord plugin.
- **Discord+ Home** replaces the native Friends page: header + friends grid with Online/Offline sections, presence,
  activities, cached latest message, unread badges, ⋮ / right-click menu (Message, View profile, Favorite),
  filters All/Online/Recent/Unread/Favorites/Pending/Blocked, sorting, density.
- **Messages page**: DMs, group DMs and non-friends sorted by latest message.
- **Global header** on every page (Friends, Messages, Message Requests, Nitro, Shop, Family Centre, Quests, search),
  overflow menu for narrow windows; pushes Discord's sidebar + page below it.
- **DM view**: native DM list hidden while a conversation is open (only when the dock is on).
- **User dock**: real mute/deafen/settings, drag, edge snapping, saved position.
- **Floating call manager**: participants, speaking highlight, remote-only speaker focus, mute/deafen/stream
  indicators, timer, mute/deafen/return/disconnect, drag + resize + minimize, speaker mode when small.
- **Refined Dark theme** applied to Discord's colour variables; configurable accent; reduced motion.
- **Classic view** toggle to reach Discord's original Friends page.
- 17 settings; positions/favorites stored in plugin settings; Vencord toolbox actions.
- Safety: per-feature error boundaries, all DOM changes are removable `dp-*` classes, native panels are only
  hidden after their replacement has rendered, full cleanup on disable.
- **Installer** (`INSTALL.bat`): clones Vencord, copies + builds the plugin, runs the official Vencord injector,
  records what it did. **Revert** (`UNINSTALL.bat`): remove Discord+ only, or restore the original Discord.
- `dev/harness`: runs the real plugin code against mocked Discord stores for UI testing.


## v0.2 — 2026-10-19 (branch `claude/improvements`)
**Vencord plugin**
- Fixed: `import "./style.css"` is not loaded by Vencord's build, so the overlay had no styling. Now uses `./style.css?managed` + `managedStyle`, which Vencord injects on enable and removes on disable.
- Live updates via `addChangeListener` on Discord's Relationship/Presence/ReadState/User stores (coalesced per frame) instead of a 10-second polling timer.
- Friend cards now show real activity (game / streaming / listening / custom status) and unread DM badges from `ReadStateStore`.
- Filters: All / Online / Unread / Favorites / Offline with live counts. Favorites are toggled with middle-click and saved in plugin settings.
- Right-click a card opens the native Discord profile (`openUserProfile`).
- Plugin settings: launcher visibility, hotkey on/off, density, show activity, default filter.
- "Open Friends+ grid" entry in the Vencord toolbox.
- Avatars rendered with `<img>` instead of a CSS `background-image` string; focus returns to where it was when the grid closes; Escape handled in capture phase.
- Stylesheet rewritten, readable, and aligned with `DESIGN.md` tokens (offline cards stay readable, focus outlines, reduced motion).
- All imports and store methods were checked against Vencord source (commit `32c9063`, 2026-10-14). **Still not compiled or run inside Discord.**

**Offline preview**
- Fixed: Messages unread badge was hard-coded to `3` (data has 6) and went *up* after reading a chat. Now computed from data and hidden at 0.
- Fixed: `quill.png` avatar did not exist (404). Uses the initial fallback.
- Fixed: Comet was set to Do Not Disturb but labelled "Idle".
- Fixed: the user dock / call panel could end up off-screen after the window shrank or when a saved position came from a larger screen. They are now clamped on load and on resize.
- Added Pending (accept / ignore / cancel sample requests) and Blocked filters, as asked for in the master prompt.
- Added `.gitignore`; the project is now its own git repository.


## v0.1 — 2026-10-19
- Established Discord+ Refined Dark design tokens, component rules and responsive layout.
- Added interactive local preview: Friends grid, sorting/search/filters, simulated messages and server view, movable user dock, simulated floating voice panel with speaker focus and minimization, dismissible Quests chip, preferences and persistence.
- Included cropped local avatars solely for the offline preview, based on the supplied reference image.
- Added a conservative QuickCSS color theme for Vencord.
- Added an experimental Vencord userplugin Friends+ overlay reading native friends/presence and calling the native DM-open utility (source-only, not live tested).
- Preserved supplied master prompt verbatim in `MASTER_PROMPT.md` and the selected reference screenshot (kept private; not in the public repository).
- Added installation, architecture, testing and roadmap documentation.

## Next
- Compile and inspect v0.1 plugin against an actual Vencord checkout.
- Add supported native header integration and Friends grid mounting rather than modal overlay.
- Verify real message previews / unread state and preserve group/non-friend DM navigation.
- Investigate safe native voice state/player/controls access and then implement the floating call manager.
