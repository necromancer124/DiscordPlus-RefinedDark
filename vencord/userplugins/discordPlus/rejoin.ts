/*
 * Discord+ Refined Dark — ask before Discord puts you back in a call when it starts.
 * SPDX-License-Identifier: CC-BY-NC-4.0
 *
 * After a restart Discord reconnects you to the voice channel you were in. Stopping that before it happens would
 * need a patch of Discord's code, which Discord+ doesn't do; so while Discord is starting, a join you didn't click
 * is left at once and Discord+ asks "Rejoin?". At worst the others see you join and leave for a moment.
 */
import { Alerts, ChannelStore, GuildStore, SelectedChannelStore, UserStore } from "@webpack/common";

import { displayName } from "./data";
import { disconnectVoice, joinVoice, safe } from "./discordApi";
import { settings } from "./settings";

/** How long after Discord has connected an automatic rejoin can still happen. */
const STARTUP_MS = 20_000;
/** Never arm longer than this after the plugin starts (e.g. if the connection event is missed). */
const MAX_ARMED_MS = 120_000;
/** A join this soon after your own click or key press is yours, not Discord's. */
const USER_INPUT_MS = 2_500;

let armedAt = 0;
let connectedAt = 0;
let lastInput = 0;
let handled = false;
let poll: ReturnType<typeof setInterval> | undefined;

const onInput = (e: Event) => { if (e.isTrusted) lastInput = Date.now(); };

/** Called on plugin start. Only arms when Discord itself is starting (no user logged in yet). */
export function startRejoinGuard() {
    stopRejoinGuard();
    if (safe(() => UserStore.getCurrentUser(), undefined)) return; // plugin turned on mid-session
    armedAt = Date.now();
    connectedAt = 0;
    handled = false;
    window.addEventListener("pointerdown", onInput, true);
    window.addEventListener("keydown", onInput, true);
}

export function stopRejoinGuard() {
    armedAt = 0;
    clearInterval(poll);
    poll = undefined;
    window.removeEventListener("pointerdown", onInput, true);
    window.removeEventListener("keydown", onInput, true);
}

function armed() {
    if (!armedAt || handled) return false;
    const now = Date.now();
    if (now - armedAt > MAX_ARMED_MS) return false;
    return !connectedAt || now - connectedAt < STARTUP_MS;
}

/** Flux CONNECTION_OPEN: watch for the automatic rejoin during the next seconds. */
export function onConnectionOpen() {
    if (!armed() || connectedAt) return;
    connectedAt = Date.now();
    // Discord's own action may not be named the same in every version, so the store is watched as well.
    poll = setInterval(() => {
        if (!armed()) { stopRejoinGuard(); return; }
        check(safe(() => SelectedChannelStore.getVoiceChannelId() ?? null, null));
    }, 400);
}

/** Flux VOICE_CHANNEL_SELECT. Deferred: Discord can't take another action in the middle of this one. */
export function onVoiceChannelSelect(channelId: string | null | undefined) {
    if (channelId && armed()) setTimeout(() => check(channelId), 0);
}

function placeName(channelId: string) {
    const channel = safe(() => ChannelStore.getChannel(channelId), undefined);
    if (!channel) return "the call you were in";
    if (channel.guild_id) {
        const guild = safe(() => GuildStore.getGuild(channel.guild_id)?.name, undefined);
        return `🔊 ${channel.name}${guild ? ` in ${guild}` : ""}`;
    }
    const me = safe(() => UserStore.getCurrentUser()?.id, undefined);
    const others = (channel.recipients ?? []).filter((id: string) => id !== me).map(displayName);
    return channel.name || (others.length ? `your call with ${others.join(", ")}` : "your call");
}

function check(channelId: string | null) {
    if (!channelId || !armed() || !settings.store.askBeforeRejoin) return;
    if (Date.now() - lastInput < USER_INPUT_MS) return; // you joined it yourself
    handled = true;
    stopRejoinGuard();
    disconnectVoice();
    const place = placeName(channelId);
    try {
        Alerts.show({
            title: "Rejoin the call?",
            body: `Discord was putting you back in ${place} after it started. Discord+ left the call so you can choose.`,
            confirmText: "Rejoin",
            cancelText: "Stay out",
            onConfirm: () => joinVoice(channelId)
        });
    } catch (e) {
        console.warn("[Discord+] rejoin prompt failed", e);
    }
}
