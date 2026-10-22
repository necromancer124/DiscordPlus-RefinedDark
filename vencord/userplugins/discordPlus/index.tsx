/*
 * Discord+ Refined Dark — Vencord userplugin, v1.11
 * SPDX-License-Identifier: CC-BY-NC-4.0
 *
 * "Just Discord, but substantially better." See MASTER_PROMPT.md / DESIGN.md in the project root.
 *
 * Safety rules this plugin follows:
 * - No webpack patches: it only reads Discord's stores and calls the same action creators
 *   Discord's own buttons use (open DM, profile, mute, deafen, disconnect, navigation).
 * - No tokens, no REST calls, no message sending, no data export.
 * - Every change to Discord's DOM is a `dp-*` class; stop() removes all of them.
 *
 * APIs were checked against Vencord source at commit 32c9063 (2026-10-14).
 */
import ErrorBoundary from "@components/ErrorBoundary";
import definePlugin from "@utils/types";
import { createRoot } from "@webpack/common";
import type { Root } from "react-dom/client";

import { App } from "./components/App";
import { clearLiveMessages, recordLiveMessage } from "./data";
import { cleanupDom } from "./layout";
import { go, ROUTES } from "./discordApi";
import { settings } from "./settings";
// `?managed`: Vencord injects this CSS on start and removes it on stop.
import managedStyle from "./style.css?managed";

const ROOT_ID = "vc-discordplus-root";
let root: Root | null = null;

const SafeApp = ErrorBoundary.wrap(App, {
    noop: true,
    onError: ({ error }) => console.error("[Discord+] crashed; native Discord UI restored", error)
});

export default definePlugin({
    name: "DiscordPlus",
    description: "Discord+ Refined Dark: a premium, native-feeling Discord. Friends grid home, top navigation, movable user dock, floating call manager and the Refined Dark theme.",
    // Replace with your own name / Discord user ID if you publish this.
    authors: [{ name: "Discord+", id: 0n }],
    enabledByDefault: true,
    settings,
    managedStyle,

    // New messages update Discord+ Home / Messages live (previews, order, flash).
    flux: {
        MESSAGE_CREATE({ message, optimistic }: { message: any; optimistic?: boolean; }) {
            if (!optimistic) recordLiveMessage(message);
        }
    },

    toolboxActions: {
        "Discord+ home": () => go(ROUTES.friends),
        "Reset Discord+ window positions": () => {
            settings.store.dockPlacement = null;
            settings.store.callPlacement = null;
            stopRoot();
            startRoot();
        }
    },

    start() {
        startRoot();
        console.log("[Discord+] v1.11.0 started");
    },

    stop() {
        stopRoot();
        cleanupDom();
        clearLiveMessages();
    }
});

function startRoot() {
    if (root) return;
    let container = document.getElementById(ROOT_ID);
    if (!container) {
        container = document.createElement("div");
        container.id = ROOT_ID;
        // Inside #app-mount we share Discord's stacking context, so its modals, popouts and
        // context menus (z-index ~1000) always stay above Discord+ (z-index 80-90).
        (document.getElementById("app-mount") ?? document.body).appendChild(container);
    }
    const r: Root = createRoot(container);
    r.render(<SafeApp />);
    root = r;
}

function stopRoot() {
    root?.unmount();
    root = null;
    document.getElementById(ROOT_ID)?.remove();
}
