# Plugin harness (development only)

Runs the **real** plugin source from `vencord/userplugins/discordPlus` in a normal browser, with mocked Discord stores
(the same sample friends as `preview/`), a fake call in progress, and a fake Discord page layout using the
same class-name shapes the plugin looks for. Nothing connects to Discord.

Use it to check rendering and behaviour after changing the plugin, before building Vencord.

```powershell
node dev\harness\build.cjs     # transpile the plugin into dev\harness\plugin (needs TypeScript or VS Code)
python dev\harness\serve.py    # then open http://127.0.0.1:8766/channels/@me
```

Useful in the browser console:

| Command | Effect |
|---|---|
| `__speaking.set(["pixel"])` | make a call participant "speak" |
| `__dp.SelectedChannelStore.voice = "vc1"; __dp.SelectedChannelStore.emit()` | rejoin the fake call |
| `__settings.callManager = false` | flip any plugin setting live |
| `__plugin.stop()` / `__plugin.start()` | disable / enable the plugin (checks cleanup) |
| `__dpLog`, `__dpErrors` | actions the plugin called, errors caught |

What it can't tell you: whether Discord's real class names, routes and internal modules still match.
Only a real Vencord build inside Discord can confirm that (see `docs/TESTING.md`).
React is loaded from unpkg, so the harness needs internet the first time.
