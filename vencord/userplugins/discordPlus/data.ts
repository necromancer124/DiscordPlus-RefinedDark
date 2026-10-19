/*
 * Discord+ Refined Dark — read-only views over Discord's stores.
 * SPDX-License-Identifier: CC-BY-NC-4.0
 */
import { ActivityType, RelationshipType } from "@vencord/discord-types/enums";
import {
    ChannelStore, MessageStore, PresenceStore, PrivateChannelSortStore, ReadStateStore,
    RelationshipStore, useEffect, UserStore, useState
} from "@webpack/common";

import { safe, snowflakeTime } from "./discordApi";
import { isFavorite } from "./settings";

export type Status = "online" | "idle" | "dnd" | "offline";
export type RelationKind = "friend" | "incoming" | "outgoing" | "blocked";

export const STATUS_LABEL: Record<Status, string> = { online: "Online", idle: "Idle", dnd: "Do Not Disturb", offline: "Offline" };
export const STATUS_ORDER: Status[] = ["online", "idle", "dnd", "offline"];

const ACTIVITY_VERB: Partial<Record<ActivityType, string>> = {
    [ActivityType.PLAYING]: "Playing",
    [ActivityType.STREAMING]: "Streaming",
    [ActivityType.LISTENING]: "Listening to",
    [ActivityType.WATCHING]: "Watching",
    [ActivityType.COMPETING]: "Competing in"
};

export interface FriendRow {
    id: string;
    name: string;
    username: string;
    avatar: string | null;
    status: Status;
    activity: string;
    kind: RelationKind;
    dmId: string | null;
    unread: number;
    preview: string;
    lastAt: number;
    /** When a message arrived live in this DM (0 if none this session); drives the card flash. */
    liveAt: number;
    favorite: boolean;
}

export interface ConversationRow {
    id: string;
    name: string;
    avatar: string | null;
    userId: string | null;
    status: Status;
    group: boolean;
    friend: boolean;
    members: number;
    unread: number;
    preview: string;
    lastAt: number;
}

/**
 * Re-render whenever any of the given Flux stores change, coalesced to one render per ~frame.
 * Used instead of polling so the UI follows Discord live. A timer (not requestAnimationFrame)
 * so updates still land while Discord is in the background, e.g. during a call.
 */
export function useStoreTick(stores: any[]) {
    const [tick, setTick] = useState(0);
    useEffect(() => {
        let timer: ReturnType<typeof setTimeout> | undefined;
        const bump = () => {
            if (timer !== undefined) return;
            timer = setTimeout(() => {
                timer = undefined;
                setTick(t => t + 1);
            }, 16);
        };
        const live = stores.filter(s => s && typeof s.addChangeListener === "function");
        live.forEach(s => s.addChangeListener(bump));
        return () => {
            live.forEach(s => s.removeChangeListener(bump));
            clearTimeout(timer);
        };
    }, []);
    return tick;
}

/** When the current voice call was joined (this session); shared by the header pill and the call manager. */
let callStart: { channelId: string; at: number; } | null = null;
export function callStartedAt(channelId: string | null): number {
    if (!channelId) {
        callStart = null;
        return 0;
    }
    if (callStart?.channelId !== channelId) callStart = { channelId, at: Date.now() };
    return callStart.at;
}

export function formatDuration(ms: number) {
    const s = Math.max(0, Math.floor(ms / 1000));
    const h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60, sec = s % 60;
    const mm = String(m).padStart(h ? 2 : 1, "0"), ss = String(sec).padStart(2, "0");
    return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

/** Ticks every `ms` so relative times and call durations stay fresh. */
export function useClock(ms: number) {
    const [now, setNow] = useState(Date.now());
    useEffect(() => {
        const t = setInterval(() => setNow(Date.now()), ms);
        return () => clearInterval(t);
    }, [ms]);
    return now;
}

// ── Live messages ──────────────────────────────────────────────────────────
// Discord's MessageStore only holds messages for chats you have opened, so previews of other DMs would stay
// stale. The plugin's MESSAGE_CREATE handler records the newest message of every private channel here.
interface LiveMessage { text: string; authorId: string; at: number; }
const liveMessages = new Map<string, LiveMessage>();
const liveListeners = new Set<() => void>();

/** Flux-store-shaped emitter, so components can subscribe with useStoreTick like any Discord store. */
export const LiveMessageStore = {
    addChangeListener: (cb: () => void) => void liveListeners.add(cb),
    removeChangeListener: (cb: () => void) => void liveListeners.delete(cb),
    get: (channelId: string) => liveMessages.get(channelId)
};

function messageText(m: any): string {
    const text = (m?.content ?? "").trim();
    if (text) return text;
    if (m?.attachments?.length) return "sent an attachment";
    if (m?.sticker_items?.length || m?.stickerItems?.length) return "sent a sticker";
    if (m?.embeds?.length) return "sent an embed";
    return "";
}

/** Called from the plugin's flux handler for every MESSAGE_CREATE. Only DMs and group DMs are kept. */
export function recordLiveMessage(message: any) {
    const channelId: string | undefined = message?.channel_id ?? message?.channelId;
    if (!channelId) return;
    if (!safe(() => ChannelStore.getChannel(channelId)?.isPrivate(), false)) return;
    const text = messageText(message);
    if (!text) return;
    liveMessages.set(channelId, { text, authorId: message.author?.id ?? "", at: Date.now() });
    liveListeners.forEach(cb => cb());
}

export function clearLiveMessages() {
    liveMessages.clear();
}

export const FRIEND_STORES = [RelationshipStore, PresenceStore, UserStore, ReadStateStore, ChannelStore, MessageStore, LiveMessageStore];

export function statusOf(userId: string): Status {
    const s = safe(() => PresenceStore.getStatus(userId), "offline" as string);
    if (s === "streaming") return "online";
    return STATUS_ORDER.includes(s as Status) ? s as Status : "offline";
}

export function avatarOf(userId: string, size = 64): string | null {
    const user = safe(() => UserStore.getUser(userId), undefined);
    const url = safe(() => user?.getAvatarURL?.(undefined, size), undefined);
    return typeof url === "string" && /^https:\/\//.test(url) ? url : null;
}

export function displayName(userId: string) {
    const user = safe(() => UserStore.getUser(userId), undefined);
    return user ? (RelationshipStore.getNickname?.(userId) || user.globalName || user.username) : "Unknown user";
}

export function activityText(userId: string): string {
    return safe(() => {
        const activities = PresenceStore.getActivities(userId) ?? [];
        const main = activities.find(a => a.type !== ActivityType.CUSTOM_STATUS && a.type !== ActivityType.HANG_STATUS);
        if (main) {
            const verb = ACTIVITY_VERB[main.type];
            return verb ? `${verb} ${main.name}` : main.name;
        }
        return activities.find(a => a.type === ActivityType.CUSTOM_STATUS)?.state ?? "";
    }, "");
}

/** Latest message in a channel, only if Discord already has it cached (no network requests). */
function cachedPreview(channelId: string | null): string {
    if (!channelId) return "";
    // A message that arrived live is always the newest one.
    const live = liveMessages.get(channelId);
    if (live) {
        const mine = live.authorId === safe(() => UserStore.getCurrentUser()?.id, undefined);
        return `${mine ? "You: " : ""}${live.text}`;
    }
    return safe(() => {
        const msgs = MessageStore.getMessages(channelId)?._array;
        const last = msgs?.[msgs.length - 1];
        if (!last) return "";
        const mine = last.author?.id === UserStore.getCurrentUser()?.id;
        const text = last.content?.trim() || (last.attachments?.length ? "sent an attachment" : last.stickerItems?.length ? "sent a sticker" : "");
        return text ? `${mine ? "You: " : ""}${text}` : "";
    }, "");
}

function unreadIn(channelId: string | null) {
    // In DMs every message counts as a mention, so the mention count is the unread badge.
    return channelId ? safe(() => ReadStateStore.getMentionCount(channelId), 0) : 0;
}

function friendRow(id: string, kind: RelationKind): FriendRow | null {
    const user = safe(() => UserStore.getUser(id), undefined);
    if (!user) return null;
    const dmId = safe(() => ChannelStore.getDMFromUserId(id) ?? null, null);
    const dm = dmId ? safe(() => ChannelStore.getChannel(dmId), undefined) : undefined;
    return {
        id,
        name: RelationshipStore.getNickname?.(id) || user.globalName || user.username,
        username: user.username,
        avatar: avatarOf(id),
        status: kind === "blocked" ? "offline" : statusOf(id),
        activity: kind === "friend" ? activityText(id) : "",
        kind,
        dmId,
        unread: unreadIn(dmId),
        preview: cachedPreview(dmId),
        lastAt: Math.max(snowflakeTime(dm?.lastMessageId), dmId ? liveMessages.get(dmId)?.at ?? 0 : 0),
        liveAt: dmId ? liveMessages.get(dmId)?.at ?? 0 : 0,
        favorite: isFavorite(id)
    };
}

export function readRelationships(): { friends: FriendRow[]; pending: FriendRow[]; blocked: FriendRow[]; error?: string; } {
    const empty = { friends: [], pending: [], blocked: [] };
    let friendIds: string[];
    try {
        friendIds = RelationshipStore.getFriendIDs();
    } catch (e) {
        console.warn("[Discord+] RelationshipStore error", e);
        return { ...empty, error: "Couldn't read friends from Discord. The plugin may need an update for this Discord version." };
    }
    const friends = friendIds.map(id => friendRow(id, "friend")).filter(Boolean) as FriendRow[];

    const pending: FriendRow[] = [];
    safe(() => {
        for (const [id, type] of RelationshipStore.getMutableRelationships()) {
            const kind = type === RelationshipType.INCOMING_REQUEST ? "incoming" : type === RelationshipType.OUTGOING_REQUEST ? "outgoing" : null;
            const row = kind && friendRow(id, kind);
            if (row) pending.push(row);
        }
    }, undefined);

    const blocked = safe(() => RelationshipStore.getBlockedIDs(), [] as string[])
        .map(id => friendRow(id, "blocked")).filter(Boolean) as FriendRow[];

    return { friends, pending, blocked };
}

export function readConversations(): ConversationRow[] {
    const me = safe(() => UserStore.getCurrentUser()?.id, undefined);
    const ids = safe(() => PrivateChannelSortStore.getPrivateChannelIds(), [] as string[]);
    const rows: ConversationRow[] = [];
    for (const id of ids) {
        const channel = safe(() => ChannelStore.getChannel(id), undefined);
        if (!channel) continue;
        const group = safe(() => channel.isMultiUserDM(), false);
        const others = (channel.recipients ?? []).filter(r => r !== me);
        const userId = group ? null : others[0] ?? null;
        const name = group
            ? channel.name || others.map(displayName).join(", ") || "Group DM"
            : userId ? displayName(userId) : "Direct message";
        rows.push({
            id,
            name,
            avatar: userId ? avatarOf(userId) : null,
            userId,
            status: userId ? statusOf(userId) : "offline",
            group,
            friend: userId ? safe(() => RelationshipStore.isFriend(userId), false) : true,
            members: others.length + 1,
            unread: unreadIn(id),
            preview: cachedPreview(id),
            lastAt: Math.max(snowflakeTime(channel.lastMessageId), liveMessages.get(id)?.at ?? 0)
        });
    }
    return rows.sort((a, b) => b.lastAt - a.lastAt);
}

export function totalDmUnread() {
    return safe(() => PrivateChannelSortStore.getPrivateChannelIds().reduce((sum, id) => sum + unreadIn(id), 0), 0);
}
