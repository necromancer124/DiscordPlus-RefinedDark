/*
 * Discord+ Refined Dark — Deafen button in the bottom bar of Discord's own call view.
 * SPDX-License-Identifier: CC-BY-NC-4.0
 *
 * Discord's call view has Mute but no Deafen. The button is rendered into a `dp-*` element placed right
 * after Discord's mic button group (layout.ts) and calls the same toggle as Discord's headphone button.
 */
import { MediaEngineStore, ReactDOM, useEffect, useState } from "@webpack/common";

import { useStoreTick } from "../data";
import { safe, toggleDeafen } from "../discordApi";
import { syncCallBarDeafen } from "../layout";

// Discord's call-bar buttons fill every icon inside them, which turns Discord+'s outline icons into blobs.
// So this one is a filled shape like Discord's own icons; the "off" slash is a filled bar, not a line.
const HEADPHONES = "M12 3a9 9 0 0 0-9 9v7a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2v-4a2 2 0 0 0-2-2H5v-1a7 7 0 0 1 14 0v1h-2a2 2 0 0 0-2 2v4a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2v-7a9 9 0 0 0-9-9Z";
const SLASH = "M3.7 2.3 21.7 20.3 20.3 21.7 2.3 3.7Z";

function HeadphonesIcon({ off }: { off: boolean; }) {
    const paint = { fill: "currentColor", stroke: "none" };
    return (
        <svg className="dp-callbar-deafen-icon" width={20} height={20} viewBox="0 0 24 24" aria-hidden="true" style={paint}>
            <path d={HEADPHONES} style={paint} />
            {off && <path d={SLASH} style={paint} />}
        </svg>
    );
}

export function CallBarDeafen() {
    useStoreTick(() => [MediaEngineStore]);
    const [host, setHost] = useState<HTMLElement | null>(null);
    useEffect(() => {
        // Discord re-creates its call bar (opening the call, fullscreen, popout), so the spot is re-checked.
        const sync = () => setHost(syncCallBarDeafen(true));
        sync();
        const t = setInterval(sync, 500);
        return () => { clearInterval(t); syncCallBarDeafen(false); };
    }, []);
    if (!host) return null;

    const deafened = safe(() => MediaEngineStore.isSelfDeaf(), false);
    return ReactDOM.createPortal(
        <button
            type="button"
            className={"dp-callbar-deafen-btn" + (deafened ? " dp-on" : "")}
            role="switch"
            aria-checked={deafened}
            aria-label={deafened ? "Undeafen" : "Deafen"}
            title={deafened ? "Undeafen" : "Deafen"}
            onClick={toggleDeafen}
        >
            <HeadphonesIcon off={deafened} />
        </button>,
        host
    );
}
