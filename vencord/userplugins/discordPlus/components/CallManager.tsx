/*
 * Discord+ Refined Dark — floating voice-call manager.
 * SPDX-License-Identifier: CC-BY-NC-4.0
 *
 * Appears while you're connected to voice but somewhere else: another server, Home, or a different DM.
 * Inside the call's own server or DM it steps aside so Discord's native call UI is used. Disappears on disconnect.
 * Expanded and minimized are two states of ONE window, never shown together.
 */
import {
    ApplicationStreamingStore, ChannelStore, GuildStore, MediaEngineStore, PresenceStore,
    SelectedChannelStore, SelfPresenceStore, useEffect, UserStore, useRef, useState, VoiceStateStore
} from "@webpack/common";

import { avatarOf, callStartedAt, displayName, formatDuration, selfStatus, Status, statusOf, useClock, useStoreTick } from "../data";
import {
    disconnectVoice, isSpeaking, openCallPage, openProfile, safe, SpeakingStore, stopWatching, toggleDeafen, toggleMute,
    toggleScreenShare, watchStream
} from "../discordApi";
import { PIP_SELECTOR } from "../layout";
import { settings } from "../settings";
import { Avatar, useFloating } from "./common";
import { Icon } from "./Icons";

interface Participant {
    id: string;
    name: string;
    avatar: string | null;
    muted: boolean;
    deafened: boolean;
    streaming: boolean;
    speaking: boolean;
    self: boolean;
    status: Status;
}

interface VoiceStateLike {
    userId: string;
    mute: boolean;
    deaf: boolean;
    selfMute: boolean;
    selfDeaf: boolean;
    selfStream?: boolean;
}

/** Below this width participants are shown as a list (one row each) instead of a grid of tiles. */
const LIST_MODE_WIDTH = 420;

/** Whether the current page belongs to the call: its server (any channel) or, for DM calls, that DM. */
export function isInsideCall(route: string, channelId: string, guildId: string | null | undefined) {
    return guildId
        ? route.startsWith(`/channels/${guildId}/`) || route === `/channels/${guildId}`
        : route.endsWith(`/${channelId}`);
}

/**
 * Live stream slot, shown only while you are watching a stream. Discord then shows its own floating
 * picture-in-picture window; Discord+ docks that window exactly over this slot, so the real live video
 * plays inside the call manager. When you aren't watching, the streamer's tile shows a Watch icon instead.
 */
function StreamCard({ streamer, docked, slotRef, onOpen, onStop, membersHidden, onToggleMembers }: {
    streamer: Participant;
    docked: boolean;
    slotRef: { current: HTMLDivElement | null; };
    onOpen(): void;
    onStop(): void;
    membersHidden: boolean;
    onToggleMembers(): void;
}) {
    return (
        <>
            <div className="dp-stream-head">
                <span className="dp-live">LIVE</span>
                <span className="dp-stream-name">{streamer.name}</span>
                <button
                    type="button"
                    className={"dp-stream-open dp-members-toggle" + (membersHidden ? " dp-active" : "")}
                    aria-pressed={!membersHidden}
                    title={membersHidden ? "Show call members" : "Hide call members (bigger stream)"}
                    onClick={onToggleMembers}
                >
                    <Icon name="friends" size={14} />
                </button>
                <button type="button" className="dp-stream-open" title="Open the call" onClick={onOpen}>
                    <Icon name="returnCall" size={13} /> Open
                </button>
                <button type="button" className="dp-stream-open dp-stream-stop" title="Stop watching" onClick={onStop}>
                    <Icon name="close" size={13} /> Stop
                </button>
            </div>
            <div ref={slotRef} className={"dp-stream" + (docked ? " dp-docked" : "")}>
                <span className="dp-stream-empty"><Icon name="screen" size={26} /></span>
            </div>
        </>
    );
}

function Tile({ p, row, onWatch }: { p: Participant; row?: boolean; onWatch?(): void; }) {
    return (
        <div
            role="button"
            tabIndex={0}
            className={"dp-tile" + (p.speaking ? " dp-talking" : "") + (row ? " dp-tile-row" : "")}
            title={`View ${p.name}'s profile`}
            onClick={() => openProfile(p.id)}
            onKeyDown={e => { if (e.key === "Enter") openProfile(p.id); }}
        >
            <Avatar src={p.avatar} name={p.name} size={row ? 32 : 48} speaking={p.speaking} status={p.status} />
            <span className="dp-tile-name">{p.name}{p.self ? " (you)" : ""}</span>
            {p.streaming && <span className="dp-live dp-live-tile">LIVE</span>}
            {p.streaming && onWatch && (
                <button
                    type="button"
                    className="dp-tile-watch"
                    title={`Watch ${p.name}'s stream`}
                    onClick={e => { e.stopPropagation(); onWatch(); }}
                >
                    <Icon name="screen" size={14} />
                </button>
            )}
            {(p.muted || p.deafened) && (
                <span className="dp-tile-state" aria-label={p.deafened ? "Deafened" : "Muted"}>
                    <Icon name={p.deafened ? "headphonesOff" : "micOff"} size={12} />
                </span>
            )}
        </div>
    );
}

/**
 * The floating call window. Hidden when the user hid it (header call pill / eye button), and inside the
 * call's own server unless the user showed it there from the header (`forceShow`).
 */
export function CallManager({ route, forceShow = false }: { route: string; forceShow?: boolean; }) {
    useStoreTick(() => [SelectedChannelStore, VoiceStateStore, SpeakingStore, MediaEngineStore, ChannelStore, UserStore, GuildStore, ApplicationStreamingStore, PresenceStore, SelfPresenceStore]);
    const now = useClock(1000);
    const { callMinimized: savedMinimized, dockStreamVideo, callMembersHidden, callHidden } =
        settings.use(["callMinimized", "dockStreamVideo", "callMembersHidden", "callHidden"]);
    const callMinimized = savedMinimized;
    // Streams you stopped watching from here stay hidden even if Discord keeps its window for a moment.
    const [stopped, setStopped] = useState<string | null>(null);
    const slotRef = useRef<HTMLDivElement>(null);
    const [docked, setDocked] = useState(false);
    // Whether Discord's stream window exists, i.e. you are watching a stream right now.
    const [watching, setWatching] = useState(false);
    const ref = useRef<HTMLDivElement>(null);
    const handle = useRef<HTMLDivElement>(null);
    const focus = useRef<string | null>(null);
    const [listMode, setListMode] = useState(false);

    const channelId = safe(() => SelectedChannelStore.getVoiceChannelId() ?? null, null);
    const channel = channelId ? safe(() => ChannelStore.getChannel(channelId), undefined) : undefined;
    const startedAt = callStartedAt(channelId);
    // Inside the call's own server / DM Discord's native call UI is used, unless shown from the header.
    const visible = !!channelId && !!channel && !callHidden && (forceShow || !isInsideCall(route, channelId, channel.guild_id));

    const me = safe(() => UserStore.getCurrentUser()?.id, undefined);
    const states: VoiceStateLike[] = channelId
        ? Object.values(safe(() => VoiceStateStore.getVoiceStatesForChannel(channelId), {} as Record<string, VoiceStateLike>))
        : [];
    // Prefer the focused remote's stream, else any remote stream. Your own stream isn't previewed.
    const remoteStreamers = states.filter(vs => vs.selfStream && vs.userId !== me).map(vs => vs.userId);
    const streamerId = remoteStreamers.includes(focus.current ?? "") ? focus.current : remoteStreamers[0] ?? null;

    // Dock Discord's picture-in-picture stream window over our stream slot, following drags and resizes.
    useEffect(() => {
        const body = document.body;
        const undock = () => {
            body.classList.remove("dp-pip-docked");
            setDocked(false);
        };
        if (!visible || !streamerId) {
            undock();
            setWatching(false);
            return;
        }
        const tick = () => {
            const pip = document.querySelector(PIP_SELECTOR);
            if (!pip && stopped) setStopped(null);
            body.classList.toggle("dp-pip-stopped", !!pip && stopped === streamerId);
            if (stopped === streamerId) {
                setWatching(false);
                return undock();
            }
            setWatching(!!pip);
            const slot = slotRef.current;
            if (!slot || !pip || !dockStreamVideo) return undock();
            // Scale Discord's window (at its own size) to fit the slot, centred. Resizing it instead left
            // the video at its old size in a corner, because the inner player keeps fixed pixel sizes.
            const r = slot.getBoundingClientRect();
            const w = (pip as HTMLElement).offsetWidth, h = (pip as HTMLElement).offsetHeight;
            if (!w || !h) return undock();
            const scale = Math.min(r.width / w, r.height / h);
            body.style.setProperty("--dp-pip-x", `${Math.round(r.left + (r.width - w * scale) / 2)}px`);
            body.style.setProperty("--dp-pip-y", `${Math.round(r.top + (r.height - h * scale) / 2)}px`);
            body.style.setProperty("--dp-pip-scale", scale.toFixed(4));
            body.classList.add("dp-pip-docked");
            setDocked(true);
        };
        tick();
        const t = setInterval(tick, 50);
        return () => {
            clearInterval(t);
            undock();
        };
    }, [visible, streamerId, dockStreamVideo, callMinimized, stopped]);

    useEffect(() => () => document.body.classList.remove("dp-pip-stopped"), []);

    useFloating(ref, handle, "callPlacement", { resizable: !callMinimized, enabled: visible, mode: callMinimized });

    useEffect(() => {
        const el = ref.current;
        if (!el || callMinimized || !visible) return;
        const ro = new ResizeObserver(() => setListMode(el.getBoundingClientRect().width < LIST_MODE_WIDTH));
        ro.observe(el);
        return () => ro.disconnect();
    }, [callMinimized, visible]);

    if (!visible || !channelId || !channel) return null;

    const people: Participant[] = states.map(vs => ({
        id: vs.userId,
        name: displayName(vs.userId),
        avatar: avatarOf(vs.userId, 80),
        muted: vs.selfMute || vs.mute,
        deafened: vs.selfDeaf || vs.deaf,
        streaming: !!vs.selfStream,
        speaking: isSpeaking(vs.userId),
        status: vs.userId === me ? selfStatus(safe(() => SelfPresenceStore.getStatus(), "online" as string)) : statusOf(vs.userId),
        self: vs.userId === me
    })).sort((a, b) => Number(a.self) - Number(b.self));

    // Focus = the remote participant speaking now, else the last remote speaker, else the first remote.
    // The local user is never auto-focused.
    const remotes = people.filter(p => !p.self);
    const talking = remotes.find(p => p.speaking);
    if (talking) focus.current = talking.id;
    if (!remotes.some(p => p.id === focus.current)) focus.current = remotes[0]?.id ?? null;
    const focused = remotes.find(p => p.id === focus.current) ?? null;

    const guild = channel.guild_id ? safe(() => GuildStore.getGuild(channel.guild_id), undefined) : undefined;
    const title = channel.name || remotes.map(p => p.name).join(", ") || "Voice call";
    const sub = `${people.length} in call · ${formatDuration(now - (startedAt || now))}`;
    const selfMuted = safe(() => MediaEngineStore.isSelfMute(), false);
    const selfDeaf = safe(() => MediaEngineStore.isSelfDeaf(), false);
    const setMinimized = (v: boolean) => { settings.store.callMinimized = v; };
    const selfStreaming = people.some(p => p.self && p.streaming);
    const streamer = people.find(p => p.id === streamerId) ?? null;
    const watchUser = (userId: string) => {
        setStopped(null);
        watchStream(userId, channel.guild_id, channelId);
    };
    const stopUser = (userId: string) => {
        stopWatching(userId, channel.guild_id, channelId);
        setStopped(userId);
    };
    const showStream = !!streamer && watching && dockStreamVideo;
    // Members can only be hidden while a stream fills their space.
    const membersHidden = showStream && callMembersHidden;

    const controls = (
        <>
            <button type="button" className={"dp-icon-btn" + (selfMuted ? " dp-danger" : "")} aria-pressed={selfMuted} title={selfMuted ? "Unmute" : "Mute"} onClick={toggleMute}>
                <Icon name={selfMuted ? "micOff" : "mic"} />
            </button>
            <button type="button" className={"dp-icon-btn" + (selfDeaf ? " dp-danger" : "")} aria-pressed={selfDeaf} title={selfDeaf ? "Undeafen" : "Deafen"} onClick={toggleDeafen}>
                <Icon name={selfDeaf ? "headphonesOff" : "headphones"} />
            </button>
            <button
                type="button"
                className={"dp-icon-btn" + (selfStreaming ? " dp-active" : "")}
                aria-pressed={selfStreaming}
                title={selfStreaming ? "Screen share options / stop sharing" : "Share your screen"}
                onClick={() => toggleScreenShare(channel.guild_id, channelId)}
            >
                <Icon name="screen" />
            </button>
        </>
    );
    const hangup = (
        <button type="button" className="dp-hangup" title="Disconnect" onClick={disconnectVoice}>
            <Icon name="hangup" />
        </button>
    );

    if (callMinimized) {
        return (
            <div ref={ref} className="dp-call dp-call-mini" role="region" aria-label={`Voice call: ${title}`}>
                <div ref={handle} className="dp-call-mini-info" title="Drag to move · double-click to expand" onDoubleClick={() => setMinimized(false)}>
                    <span className="dp-avatar-stack">
                        {(focused ? [focused, ...remotes.filter(p => p !== focused)] : remotes).slice(0, 3).map(p => (
                            <Avatar key={p.id} src={p.avatar} name={p.name} size={28} speaking={p.speaking} />
                        ))}
                    </span>
                    <span className="dp-call-text">
                        <strong>{focused?.speaking ? focused.name : title}</strong>
                        <small>{sub}</small>
                    </span>
                </div>
                {streamer && (showStream
                    ? (
                        <div ref={slotRef} className={"dp-stream-mini" + (docked ? " dp-docked" : "")}>
                            <Icon name="screen" size={16} />
                        </div>
                    )
                    : (
                        <button type="button" className="dp-icon-btn dp-watch-btn" title={`Watch ${streamer.name}'s stream`} onClick={() => watchUser(streamer.id)}>
                            <Icon name="screen" />
                        </button>
                    ))}
                {controls}
                {hangup}
                <button type="button" className="dp-icon-btn" title="Expand" onClick={() => setMinimized(false)}>
                    <Icon name="expand" />
                </button>
            </div>
        );
    }

    return (
        <div
            ref={ref}
            className={"dp-call" + (listMode ? " dp-list-mode" : "") + (membersHidden ? " dp-members-hidden" : "")}
            role="region"
            aria-label={`Voice call: ${title}`}
        >
            <div ref={handle} className="dp-call-head" title="Drag to move">
                <span className="dp-call-icon"><Icon name="speaker" /></span>
                <span className="dp-call-text">
                    <strong>{title}</strong>
                    <small>{guild ? `${guild.name} · ` : ""}{sub}</small>
                </span>
                <button
                    type="button"
                    className="dp-icon-btn"
                    title="Hide (show it again from the call button in the header)"
                    onClick={() => { settings.store.callHidden = true; }}
                >
                    <Icon name="eyeOff" />
                </button>
                <button type="button" className="dp-icon-btn" title="Minimize" onClick={() => setMinimized(true)}>
                    <Icon name="minimize" />
                </button>
            </div>
            {showStream && streamer && (
                <div className="dp-call-stream">
                    <StreamCard
                        streamer={streamer}
                        docked={docked}
                        slotRef={slotRef}
                        onOpen={() => openCallPage(channel.guild_id, channelId)}
                        onStop={() => stopUser(streamer.id)}
                        membersHidden={membersHidden}
                        onToggleMembers={() => { settings.store.callMembersHidden = !callMembersHidden; }}
                    />
                </div>
            )}
            {!membersHidden && (
                <div className={"dp-call-people" + (showStream ? " dp-has-stream" : "")}>
                    {/* In the list the focused remote speaker comes first; you stay last. */}
                    {(listMode && focused ? [focused, ...people.filter(p => p !== focused)] : people).map(p => (
                        <Tile key={p.id} p={p} row={listMode} onWatch={p.self ? undefined : () => watchUser(p.id)} />
                    ))}
                </div>
            )}
            <div className="dp-call-controls">
                {controls}
                <button type="button" className="dp-return" onClick={() => openCallPage(channel.guild_id, channelId)}>
                    <Icon name="returnCall" size={16} /> Return to call
                </button>
                {hangup}
            </div>
        </div>
    );
}
