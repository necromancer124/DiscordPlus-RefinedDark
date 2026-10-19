# Architecture v1.0

## Tracks
- `preview/`: standalone HTML/CSS/JS design prototype with sample data. Never touches Discord.
- `vencord/userplugins/discordPlus/`: the real plugin (TypeScript + React via Vencord).
- `dev/harness/`: runs the real plugin source in a browser against mocked Discord stores.
- `installer/`: PowerShell install / revert scripts behind `INSTALL.bat` / `UNINSTALL.bat`.

## Plugin structure
```
index.tsx    definePlugin: settings, managed CSS, toolbox actions. start() mounts <App/> in its own React
             root (a div inside #app-mount); stop() unmounts it and calls cleanupDom().
settings.ts  definePluginSettings (17 visible options + stored favorites/positions/minimized state).
discordApi.ts Every Discord action in one place, each wrapped so a failed lookup only disables that control:
             openPrivateChannel, openUserProfile, NavigationRouter.transitionTo, SettingsRouter.openUserSettings,
             findByPropsLazy("toggleSelfMute","toggleSelfDeaf"), findByPropsLazy("selectVoiceChannel","selectChannel"),
             findStoreLazy("SpeakingStore").
data.ts      Read-only selectors over RelationshipStore, PresenceStore, UserStore, ChannelStore, ReadStateStore,
             MessageStore (cache only), PrivateChannelSortStore. useStoreTick() re-renders on store change events.
layout.ts    Route classification (home / dm / guild / other), measuring the server rail, and the dp-* classes.
components/  App (route + layout loop, body classes), Header, Home (FriendsView, MessagesView), UserDock,
             CallManager, Icons, common (Avatar, useFloating drag/snap/resize/persist).
```

## How it sits on top of Discord
- **Home** is a fixed overlay covering the content region right of the server rail, only on `/channels/@me`.
  Discord's Friends page keeps running underneath; Classic view hides the overlay.
- **Header** is fixed at the top of the content region. On other routes it adds `dp-pushed` (padding-top) to the
  parent of Discord's `sidebar_*` element, so the sidebar and page move below it. If that element can't be found,
  the header isn't shown there, so it never covers native controls.
- **Hiding native UI** is done only with body classes + CSS: `dp-hide-dm-sidebar` (sidebar containing
  `nav.privateChannels_*`, DM routes only) and `dp-hide-native-panel` (`section.panels_*`). Both are set only after
  the dock reports it rendered.
- While a second full-screen Discord layer (User Settings) is open, header and home step aside via `:has()`.
- Discord's hashed class names are matched by prefix: `[class^="name_"],[class*=" name_"]`.

## Failure model
Each feature is wrapped in Vencord's `ErrorBoundary` with `noop`. A crash renders nothing and runs effect
cleanups, which remove the body classes that hid native UI, so Discord's own UI returns. Disabling the plugin
removes the React root, all `dp-*` classes, inline variables and the managed stylesheet.

## Security and API boundaries
No webpack patches, no private REST calls, no tokens, no message sending, no voice packet access, no data export.
