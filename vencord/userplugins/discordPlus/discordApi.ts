/*
 * Discord+ Refined Dark — thin, failure-tolerant wrappers around Discord internals.
 * SPDX-License-Identifier: CC-BY-NC-4.0
 *
 * Everything that touches a Discord module goes through here, so a Discord update that breaks
 * one lookup only disables that one control instead of crashing the whole plugin.
 *
 * NOTE: never name a file `native.ts` (or `native/index.ts`) in this folder. Vencord loads those into
 * Discord's main process and registers every export as an IPC handler; a non-function export crashes
 * Discord on startup ("Expected handler to be a function").
 */
import { openUserProfile } from "@utils/discord";
import { findByPropsLazy, findStoreLazy } from "@webpack";
import { ApplicationStreamingStore, ChannelStore, NavigationRouter, SettingsRouter, showToast } from "@webpack/common";

import { cls, PIP_SELECTOR } from "./layout";

const log = (what: string, error: unknown) => console.warn(`[Discord+] ${what} failed`, error);

export function safe<T>(fn: () => T, fallback: T): T {
    try {
        return fn();
    } catch {
        return fallback;
    }
}

// Discord's own voice action creators (same functions its mute/deafen/disconnect buttons call).
const MediaActions: { toggleSelfMute(): void; toggleSelfDeaf(): void; } = findByPropsLazy("toggleSelfMute", "toggleSelfDeaf");
const VoiceActions: { selectVoiceChannel(channelId: string | null): void; } = findByPropsLazy("selectVoiceChannel", "selectChannel");

export interface SpeakingStoreLike {
    isSpeaking(userId: string): boolean;
    addChangeListener(cb: () => void): void;
    removeChangeListener(cb: () => void): void;
}
export const SpeakingStore: SpeakingStoreLike = findStoreLazy("SpeakingStore");

/** Discord routes used by the header. Unverified ones fall back to the native page if Discord renames them. */
export const ROUTES = {
    friends: "/channels/@me",
    requests: "/message-requests",
    nitro: "/store",
    shop: "/shop",
    family: "/family-center",
    quests: "/quest-home"
} as const;

export function go(path: string) {
    try {
        NavigationRouter.transitionTo(path);
    } catch (e) {
        log(`navigate to ${path}`, e);
    }
}

export const openChannel = (channelId: string) => go(`/channels/@me/${channelId}`);
export const openCallPage = (guildId: string | null | undefined, channelId: string) => go(`/channels/${guildId ?? "@me"}/${channelId}`);

/**
 * Open the DM with a user. Discord changed the signature of its openPrivateChannel action and calling it
 * with a user id now creates an empty group DM, so we never call it: an existing DM is opened directly,
 * otherwise the native profile opens and its own "Message" button creates the DM the normal way.
 */
export function openDm(userId: string) {
    const dmId = safe(() => ChannelStore.getDMFromUserId(userId), undefined);
    if (dmId) openChannel(dmId);
    else openProfile(userId);
}

// Friend requests: the same action creators Discord's own Accept / Ignore / Cancel buttons call.
// removeRelationship(userId, context) is positional (Vencord's RelationshipNotifier patches it);
// addRelationship takes an options object in current Discord.
const RelationshipActions: {
    addRelationship(options: { userId: string; context?: unknown; }): Promise<unknown> | void;
    removeRelationship(userId: string, context?: unknown): Promise<unknown> | void;
} = findByPropsLazy("addRelationship", "removeRelationship");
const FRIENDS_CONTEXT = { location: "Friends" };

async function relationshipAction(what: string, userId: string, run: () => Promise<unknown> | void) {
    try {
        await run();
    } catch (e) {
        log(what, e);
        safe(() => showToast({ text: `Couldn't ${what}. Opening their profile instead.`, variant: "critical" }), undefined);
        openProfile(userId);
    }
}

export const acceptFriendRequest = (userId: string) =>
    relationshipAction("accept the friend request", userId, () => RelationshipActions.addRelationship({ userId, context: FRIENDS_CONTEXT }));

/** Ignore an incoming request, or cancel one you sent. */
export const removeFriendRequest = (userId: string) =>
    relationshipAction("remove the friend request", userId, () => RelationshipActions.removeRelationship(userId, FRIENDS_CONTEXT));

// Streaming: watching uses Discord's stream action creator when present; navigation always follows.
const StreamActions: {
    watchStream?(stream: unknown, options?: unknown): void;
    closeStream?(streamKey: string): void;
    stopStream?(streamKey: string): void;
} = findByPropsLazy("watchStream");

/** Discord's stream key: `guild:<guild>:<channel>:<owner>` for server streams, `call:<channel>:<owner>` in DM calls. */
export function streamKeyFor(ownerId: string, guildId: string | null | undefined, channelId: string) {
    return guildId ? `guild:${guildId}:${channelId}:${ownerId}` : `call:${channelId}:${ownerId}`;
}

const STOP_WATCHING = /stop watching|close stream|leave stream/i;

/**
 * Stop watching a stream, like Discord's own "Stop Watching": first its button on the stream window,
 * then the stream action creators. Returns false if neither was available.
 */
export function stopWatching(ownerId: string, guildId: string | null | undefined, channelId: string): boolean {
    const pip = document.querySelector(PIP_SELECTOR);
    const button = [...pip?.querySelectorAll<HTMLElement>("[aria-label]") ?? []]
        .find(b => STOP_WATCHING.test(b.getAttribute("aria-label") ?? ""));
    if (button) {
        button.click();
        return true;
    }
    const key = streamKeyFor(ownerId, guildId, channelId);
    for (const action of ["closeStream", "stopStream"] as const) {
        try {
            const fn = StreamActions[action];
            if (typeof fn === "function") {
                fn(key);
                return true;
            }
        } catch (e) {
            log(`${action}`, e);
        }
    }
    return false;
}

export function watchStream(ownerId: string, guildId: string | null | undefined, channelId: string) {
    const stream = safe(() => ApplicationStreamingStore.getAnyStreamForUser(ownerId), null);
    if (stream) {
        try { StreamActions.watchStream?.(stream); } catch (e) { log("watch stream", e); }
    }
    openCallPage(guildId, channelId);
}

const SHARE_BUTTON = /share your screen|share screen|stop streaming|screen share/i;

/**
 * Press Discord's own "Share Your Screen" button in the voice panel, so the native source picker,
 * quality options and stop flow are used unchanged. Falls back to opening the call page.
 */
export function toggleScreenShare(guildId: string | null | undefined, channelId: string) {
    const panel = document.querySelector(cls("panels", "section"));
    const button = [...panel?.querySelectorAll<HTMLElement>("[aria-label]") ?? []]
        .find(b => SHARE_BUTTON.test(b.getAttribute("aria-label") ?? ""));
    if (button) {
        button.click();
        return;
    }
    openCallPage(guildId, channelId);
    safe(() => showToast({ text: "Use Discord's Share Your Screen button in the call" }), undefined);
}

export function openProfile(userId: string) {
    openUserProfile(userId).catch(e => log("open profile", e));
}

export function toggleMute() {
    try { MediaActions.toggleSelfMute(); } catch (e) { log("toggle mute", e); }
}

export function toggleDeafen() {
    try { MediaActions.toggleSelfDeaf(); } catch (e) { log("toggle deafen", e); }
}

export function disconnectVoice() {
    try { VoiceActions.selectVoiceChannel(null); } catch (e) { log("disconnect", e); }
}

export function openUserSettings() {
    try {
        void SettingsRouter.openUserSettings();
    } catch (e) {
        log("open user settings", e);
    }
}

export function isSpeaking(userId: string) {
    return safe(() => SpeakingStore.isSpeaking(userId), false);
}

/** Snowflake → epoch ms. */
export function snowflakeTime(id: string | null | undefined) {
    if (!id) return 0;
    return safe(() => Number(BigInt(id) >> 22n) + 1420070400000, 0);
}

export function relativeTime(ms: number) {
    if (!ms) return "";
    const s = Math.max(0, (Date.now() - ms) / 1000);
    if (s < 60) return "now";
    if (s < 3600) return `${Math.floor(s / 60)}m`;
    if (s < 86400) return `${Math.floor(s / 3600)}h`;
    if (s < 86400 * 30) return `${Math.floor(s / 86400)}d`;
    return new Date(ms).toLocaleDateString();
}
