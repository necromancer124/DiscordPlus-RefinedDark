/*
 * Discord+ Refined Dark — "Rejoin the call?" after Discord restarts while you were in a call.
 * SPDX-License-Identifier: CC-BY-NC-4.0
 *
 * Discord doesn't reconnect you to voice after it closes (restart, update, crash, quit). While you're in a call
 * Discord+ remembers which one (saved about once a minute); leaving a call yourself forgets it. When Discord has
 * finished loading again, within 30 minutes, Discord+ offers to rejoin. It never joins anything without your click.
 */
import { Alerts, ChannelStore, GuildStore, SelectedChannelStore, UserStore } from "@webpack/common";

import { displayName } from "./data";
import { joinVoice, safe } from "./discordApi";
import { settings } from "./settings";

/** Offer to rejoin only if Discord was in the call this recently. */
const FRESH_MS = 30 * 60_000;
const HEARTBEAT_MS = 60_000;
/** The plugin starting this soon after the page loaded means Discord itself is starting (not a mid-session toggle). */
const STARTUP_MS = 90_000;
/** How long to wait for Discord to finish loading (your account and the call's channel known). */
const READY_TIMEOUT_MS = 60_000;
/** Once loaded, a moment more so the offer doesn't appear in the middle of Discord's own loading screen. */
const SETTLE_MS = 2_500;
/**
 * Quitting Discord during a call first leaves the call, then closes. So a "left the call" only forgets it if Discord
 * is still open this long afterwards; when Discord closes in between, the call stays saved for the offer.
 */
const FORGET_AFTER_MS = 5_000;

export interface LastCall {
    channelId: string;
    at: number;
}

let heartbeat: ReturnType<typeof setInterval> | undefined;
let waiting: ReturnType<typeof setInterval> | undefined;
let forgetTimer: ReturnType<typeof setTimeout> | undefined;
/** Until the startup offer is decided, a "left the call" from Discord starting up must not forget the call. */
let decided = true;
let unloading = false;

const log = (...a: unknown[]) => console.info("[Discord+] rejoin:", ...a);
const currentVoice = () => safe(() => SelectedChannelStore.getVoiceChannelId() ?? null, null as string | null);
const remember = (channelId: string) => {
    clearTimeout(forgetTimer);
    settings.store.lastCall = { channelId, at: Date.now() };
};
const forget = () => { if (settings.store.lastCall) settings.store.lastCall = null; };
const onUnload = () => { unloading = true; };

export function startRejoin() {
    stopRejoin();
    unloading = false;
    window.addEventListener("beforeunload", onUnload);
    heartbeat = setInterval(() => {
        const id = currentVoice();
        if (id) remember(id);
    }, HEARTBEAT_MS);

    // Only when Discord itself is starting; turning the plugin on later never offers anything.
    decided = performance.now() > STARTUP_MS;
    if (decided) return;
    const last = settings.store.lastCall as LastCall | null;
    if (!last?.channelId) { decided = true; return; }
    log("waiting for Discord to load");
    const since = Date.now();
    waiting = setInterval(() => {
        const ready = !!safe(() => UserStore.getCurrentUser(), undefined)
            && !!safe(() => ChannelStore.getChannel(last.channelId), undefined);
        if (!ready && Date.now() - since < READY_TIMEOUT_MS) return;
        clearInterval(waiting);
        waiting = undefined;
        setTimeout(offerRejoin, ready ? SETTLE_MS : 0);
    }, 500);
}

export function stopRejoin() {
    clearInterval(heartbeat);
    clearInterval(waiting);
    clearTimeout(forgetTimer);
    heartbeat = waiting = forgetTimer = undefined;
    window.removeEventListener("beforeunload", onUnload);
}

/** Flux VOICE_CHANNEL_SELECT: joining remembers the call, leaving it yourself forgets it. */
export function onVoiceChannelSelect(channelId: string | null | undefined) {
    if (channelId) {
        remember(channelId);
    } else if (decided && !unloading) {
        clearTimeout(forgetTimer);
        forgetTimer = setTimeout(() => { if (!unloading && !currentVoice()) forget(); }, FORGET_AFTER_MS);
    }
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
    decided = true;
    const last = settings.store.lastCall as LastCall | null;
    if (!last?.channelId) return log("nothing saved");
    if (!settings.store.rejoinPrompt) return log("setting off");
    if (Date.now() - last.at > FRESH_MS) { forget(); return log("saved call too old"); }
    const now = currentVoice();
    if (now) { remember(now); return log("already in a call"); }
    const channel = safe(() => ChannelStore.getChannel(last.channelId), undefined);
    if (!channel) { forget(); return log("channel not found"); }
    log("offering", last.channelId);
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
