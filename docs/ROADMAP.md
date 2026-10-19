# Roadmap

## Done
- [x] Design system, reference analysis, offline preview (v0.1).
- [x] Plugin APIs verified against Vencord source; CSS loading fix; live store updates (v0.2).
- [x] Discord+ Home: friends grid, filters incl. Pending/Blocked, sorting, previews, unread, favorites, menus (v1.0).
- [x] Messages page with group DMs and non-friends (v1.0).
- [x] Global header with overflow; DM view with native DM list hidden (v1.0).
- [x] Movable user dock with native mute/deafen/settings (v1.0).
- [x] Floating call manager with speaker focus, minimize, resize, native controls (v1.0).
- [x] Theme, settings, reduced motion, classic view, cleanup on disable (v1.0).
- [x] Installer + revert scripts (v1.0).
- [x] Mock harness for testing the real plugin code without Discord (v1.0).

## Next
- [ ] **First real run:** `INSTALL.bat`, then work through the checklist in `docs/TESTING.md`. Fix any build
      errors and any Discord class names / routes that differ (`layout.ts`, `discordApi.ts` `ROUTES`).
- [ ] Screen-share button in the call manager (needs Discord's stream actions verified).
- [ ] Native user context menu on friend cards (currently a Discord+ menu with Message / Profile / Favorite).
- [ ] Accept / ignore friend requests directly from the Pending filter (currently via Classic view).
- [ ] Virtualise the grid for very large friend lists.
- [ ] Screenshots of the real client next to the reference.
