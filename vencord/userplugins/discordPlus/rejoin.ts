/*
 * Discord+ Refined Dark — "Rejoin the call?" after Discord restarts while you were in a call.
 * SPDX-License-Identifier: CC-BY-NC-4.0
 *
 * Discord doesn't reconnect you to voice after it closes (restart, update, crash, quit). While you're in a call
 * Discord+ remembers which one (saved about once a minute); leaving a call yourself forgets it. When Discord next
 * connects, within 30 minutes, Discord+ offers to rejoin. It never joins anything without your click.
 */
import { Alerts, ChannelStore, GuildStore, SelectedChannelStore, UserStore } from "@webpack/common";

import { displayName } from "./data";
import { joinVoice, safe } from "./discordApi";
import { settings } from "./settings";

/** Offer to rejoin only if Discord was in the call this recently. */
const FRESH_MS = 30 * 60_000;
const HEARTBEAT_MS = 60_000;
/** Give Discord a moment after connecting so channels and guilds are loaded. */
const ASK_DELAY_MS = 1500;

export interface LastCall {
    channelId: string;
    at: number;
}

let heartbeat: ReturnType<typeof setInterval> | undefined;
/** Until the startup offer is decided, a "left the call" from Discord starting up must not forget the call. */
let decided = false;
let unloading = false;

const currentVoice = () => safe(() => SelectedChannelStore.getVoiceChannelId() ?? null, null as string | null);
const remember = (channelId: string) => { settings.store.lastCall = { channelId, at: Date.now() }; };
const forget = () => { if (settings.store.lastCall) settings.store.lastCall = null; };
const onUnload = () => { unloading = true; };

export function startRejoin() {
    stopRejoin();
    // Turned on mid-session (already logged in): nothing to offer, just start remembering.
    decided = !!safe(() => UserStore.getCurrentUser(), undefined);
    unloading = false;
    window.addEventListener("beforeunload", onUnload);
    heartbeat = setInterval(() => {
        const id = currentVoice();
        if (id) remember(id);
    }, HEARTBEAT_MS);
}

export function stopRejoin() {
    clearInterval(heartbeat);
    heartbeat = undefined;
    window.removeEventListener("beforeunload", onUnload);
}

/** Flux VOICE_CHANNEL_SELECT: joining remembers the call, leaving it yourself forgets it. */
export function onVoiceChannelSelect(channelId: string | null | undefined) {
    if (channelId) {
        remember(channelId);
    } else if (decided && !unloading) {
        forget();
    }
}

/** Flux CONNECTION_OPEN: the first one after Discord starts decides whether to offer the rejoin. */
export function onConnectionOpen() {
    if (decided) return;
    decided = true;
    setTimeout(offerRejoin, ASK_DELAY_MS);
}

function placeName(channel: any) {
    if (channel.guild_id) {
        const guild = safe(() => GuildStore.getGuild(channel.guild_id)?.name, undefined);
        return `🔊 ${channel.name}${guild ? ` in ${guild}` : ""}`;
    }
    const me = safe(() => UserStore.getCurrentUser()?.id, undefined);
    const others = (channel.recipients ?? []).filter((id: string) => id !== me).map(displayName);
    return channel.name || (others.length ? `your call with ${others.join(", ")}` : "your call");
}

function offerRejoin() {
    const last = settings.store.lastCall as LastCall | null;
    if (!last?.channelId || !settings.store.rejoinPrompt) return;
    if (Date.now() - last.at > FRESH_MS) { forget(); return; }
    const now = currentVoice();
    if (now) { remember(now); return; } // already in a call
    const channel = safe(() => ChannelStore.getChannel(last.channelId), undefined);
    if (!channel) { forget(); return; } // channel gone or no longer visible
    try {
        Alerts.show({
            title: "Rejoin the call?",
            body: `You were in ${placeName(channel)} when Discord closed.`,
            confirmText: "Rejoin",
            cancelText: "Not now",
            onConfirm: () => joinVoice(last.channelId),
            onCancel: forget
        });
    } catch (e) {
        console.warn("[Discord+] rejoin offer failed", e);
    }
}
