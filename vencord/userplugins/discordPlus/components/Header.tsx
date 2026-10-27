/*
 * Discord+ Refined Dark — compact horizontal navigation header.
 * SPDX-License-Identifier: CC-BY-NC-4.0
 */
import { plugins } from "@api/PluginManager";
import { openPluginModal } from "@components/settings";
import { copyWithToast } from "@utils/discord";
import {
    ChannelStore, ContextMenuApi, MediaEngineStore, Menu, PrivateChannelSortStore, ReadStateStore, SelectedChannelStore,
    SelfPresenceStore, useEffect, UserStore, useRef, useState
} from "@webpack/common";

import {
    avatarOf, callStartedAt, displayName, formatDuration, selfStatus, totalDmUnread, useClock, useStoreTick
} from "../data";
import { go, openCallPage, openProfile, openUserSettings, ROUTES, safe, toggleDeafen, toggleMute } from "../discordApi";
import { isInsideCall } from "./CallManager";
import { HEADER_HEIGHT, LayoutInfo, QUEST_PROMO_SELECTOR } from "../layout";
import { settings } from "../settings";
import { UpdateStore } from "../updates";
import { VERSION } from "../version";
import { Avatar } from "./common";
import { Icon, IconName } from "./Icons";

export type HomePage = "friends" | "favorites" | "messages";

interface NavItem {
    id: string;
    label: string;
    icon: IconName;
    route?: string;
    page?: HomePage;
}

const NAV: NavItem[] = [
    { id: "friends", label: "Friends", icon: "friends", page: "friends" },
    { id: "favorites", label: "Favorites", icon: "star", page: "favorites" },
    { id: "messages", label: "Messages", icon: "message", page: "messages" },
    { id: "requests", label: "Message Requests", icon: "inbox", route: ROUTES.requests },
    { id: "nitro", label: "Nitro", icon: "nitro", route: ROUTES.nitro },
    { id: "shop", label: "Shop", icon: "shop", route: ROUTES.shop },
    { id: "family", label: "Family Centre", icon: "family", route: ROUTES.family },
    { id: "quests", label: "Quests", icon: "quests", route: ROUTES.quests }
];

/**
 * Shown only while you are in a voice call: channel name + timer, which shows / hides the floating call
 * manager, and a button that returns to the call.
 */
function CallPill({ route, forceShow, setForceShow }: { route: string; forceShow: boolean; setForceShow(v: boolean): void; }) {
    useStoreTick(() => [SelectedChannelStore, ChannelStore, UserStore]);
    const { callHidden } = settings.use(["callHidden"]);
    const now = useClock(1000);
    const channelId = safe(() => SelectedChannelStore.getVoiceChannelId() ?? null, null);
    const channel = channelId ? safe(() => ChannelStore.getChannel(channelId), undefined) : undefined;
    const started = callStartedAt(channelId);
    if (!channelId || !channel) return null;

    const inside = isInsideCall(route, channelId, channel.guild_id);
    const shown = !callHidden && (forceShow || !inside);
    const toggle = () => {
        if (shown) {
            settings.store.callHidden = true;
            setForceShow(false);
        } else {
            settings.store.callHidden = false;
            // Inside the call's own server it normally steps aside; showing it from here overrides that.
            setForceShow(inside);
        }
    };

    const me = safe(() => UserStore.getCurrentUser()?.id, undefined);
    const name = channel.name || (channel.recipients ?? []).filter(id => id !== me).map(displayName).join(", ") || "Voice call";

    return (
        <div className={"dp-call-pill" + (shown ? " dp-active" : "")}>
            <button
                type="button"
                className="dp-call-pill-main"
                title={shown ? "Hide the call window" : "Show the call window"}
                aria-pressed={shown}
                onClick={toggle}
            >
                <span className="dp-call-pill-icon"><Icon name="speaker" size={15} /></span>
                <span className="dp-call-pill-name">{name}</span>
                <span className="dp-call-pill-time">{formatDuration(now - (started || now))}</span>
            </button>
            <button
                type="button"
                className="dp-call-pill-return"
                title="Return to call"
                onClick={() => openCallPage(channel.guild_id, channelId)}
            >
                <Icon name="returnCall" size={15} />
            </button>
        </div>
    );
}

export interface HeaderProps {
    layout: LayoutInfo;
    page: HomePage;
    setPage(p: HomePage): void;
    query: string;
    setQuery(q: string): void;
    classic: boolean;
    setClassic(v: boolean): void;
    forceShowCall: boolean;
    setForceShowCall(v: boolean): void;
}

/** Your avatar, mute, deafen and settings: Discord's user panel, moved up into the header. */
function HeaderUser() {
    useStoreTick(() => [UserStore, MediaEngineStore, SelfPresenceStore]);
    const me = safe(() => UserStore.getCurrentUser(), undefined);
    if (!me) return null;
    const muted = safe(() => MediaEngineStore.isSelfMute(), false);
    const deafened = safe(() => MediaEngineStore.isSelfDeaf(), false);
    const raw = safe(() => SelfPresenceStore.getStatus(), "online" as string);
    const status = selfStatus(raw);
    const name = me.globalName || me.username;

    return (
        <div className="dp-header-user" role="group" aria-label="User controls">
            <button type="button" className="dp-header-me" title={`${name} (@${me.username})`} onClick={() => openProfile(me.id)}>
                <Avatar src={avatarOf(me.id)} name={name} status={status} size={28} />
            </button>
            <button type="button" className={"dp-icon-btn" + (muted ? " dp-danger" : "")} aria-pressed={muted} title={muted ? "Unmute" : "Mute"} onClick={toggleMute}>
                <Icon name={muted ? "micOff" : "mic"} />
            </button>
            <button type="button" className={"dp-icon-btn" + (deafened ? " dp-danger" : "")} aria-pressed={deafened} title={deafened ? "Undeafen" : "Deafen"} onClick={toggleDeafen}>
                <Icon name={deafened ? "headphonesOff" : "headphones"} />
            </button>
            <button type="button" className="dp-icon-btn" title="User settings" onClick={openUserSettings}>
                <Icon name="settings" />
            </button>
        </div>
    );
}

/** A newer Discord+ on GitHub: a small chip with a popup that says how to update. */
function UpdateChip() {
    useStoreTick(() => [UpdateStore]);
    const { checkUpdates, dismissedUpdate, autoUpdate } = settings.use(["checkUpdates", "dismissedUpdate", "autoUpdate"]);
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (!open) return;
        const down = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
        const key = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
        document.addEventListener("mousedown", down);
        document.addEventListener("keydown", key);
        return () => {
            document.removeEventListener("mousedown", down);
            document.removeEventListener("keydown", key);
        };
    }, [open]);

    const info = UpdateStore.get();
    if (!checkUpdates || !info || dismissedUpdate === info.version) return null;
    return (
        <div ref={ref} className="dp-update">
            <button
                type="button"
                className="dp-update-chip"
                title={`Discord+ v${info.version} is available`}
                aria-expanded={open}
                onClick={() => setOpen(!open)}
            >
                <Icon name="download" size={15} />
                <span>Update</span>
            </button>
            {open && (
                <div className="dp-update-pop" role="dialog" aria-label="Discord+ update">
                    <strong>Discord+ v{info.version} is out</strong>
                    {autoUpdate ? (
                        <p>
                            You have v{VERSION}. It installs itself: close Discord completely (tray icon → Quit) and open it
                            again with the Discord+ shortcut or taskbar pin. Or run <code>INSTALL.bat -KeepChoices</code>.
                        </p>
                    ) : (
                        <p>
                            You have v{VERSION}. To update, run <code>INSTALL.bat -KeepChoices</code> in your Discord+ folder,
                            or download the new release first.
                        </p>
                    )}
                    <div className="dp-update-actions">
                        <a className="dp-update-primary" href={info.url} target="_blank" rel="noreferrer noopener">What's new</a>
                        <button type="button" onClick={() => copyWithToast("INSTALL.bat -KeepChoices", "Command copied")}>Copy command</button>
                        <button
                            type="button"
                            className="dp-update-skip"
                            onClick={() => { settings.store.dismissedUpdate = info.version; setOpen(false); }}
                        >
                            Skip this version
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

/** True while Discord shows a quest promo card (we hide the card and show a dot instead). */
function useQuestAvailable() {
    const [available, setAvailable] = useState(false);
    useEffect(() => {
        const check = () => setAvailable(!!document.querySelector(QUEST_PROMO_SELECTOR));
        check();
        const t = setInterval(check, 3000);
        return () => clearInterval(t);
    }, []);
    return available;
}

export function Header({ layout, page, setPage, query, setQuery, classic, setClassic, forceShowCall, setForceShowCall }: HeaderProps) {
    useStoreTick(() => [ReadStateStore, PrivateChannelSortStore, SelectedChannelStore]);
    const inCall = !!safe(() => SelectedChannelStore.getVoiceChannelId(), undefined);
    const { headerUserControls, hideQuestPromo } = settings.use(["headerUserControls", "hideQuestPromo"]);
    const questDot = useQuestAvailable() && hideQuestPromo;
    const unread = totalDmUnread();
    const onHome = layout.kind === "home";

    const width = window.innerWidth - layout.left;
    // Each tab is ~112px; search + right-side buttons need ~400px (~560px with user controls).
    const reserved = (headerUserControls ? 560 : 400) + (inCall ? 230 : 0);
    const fit = Math.max(2, Math.min(NAV.length, Math.floor((width - reserved) / 112)));
    const visible = NAV.slice(0, fit);
    const overflow = NAV.slice(fit);

    const isActive = (item: NavItem) =>
        item.page ? onHome && !classic && page === item.page : !!item.route && layout.route.startsWith(item.route);

    const activate = (item: NavItem) => {
        if (item.page) {
            setPage(item.page);
            setClassic(false);
            if (!onHome) go(ROUTES.friends);
        } else if (item.route) {
            go(item.route);
        }
    };

    const openMore = (e: React.MouseEvent) =>
        ContextMenuApi.openContextMenu(e, () => (
            <Menu.Menu navId="dp-header-more" onClose={ContextMenuApi.closeContextMenu}>
                {overflow.map(item => (
                    <Menu.MenuItem key={item.id} id={`dp-more-${item.id}`} label={item.label} action={() => activate(item)} />
                ))}
            </Menu.Menu>
        ));

    const openPluginSettings = () => {
        const self = plugins.DiscordPlus;
        if (self) openPluginModal(self);
    };

    return (
        <header
            className="dp-header"
            style={{ left: layout.left, top: layout.top, height: HEADER_HEIGHT }}
            aria-label="Discord+ navigation"
        >
            <nav className="dp-nav">
                {visible.map(item => (
                    <button
                        key={item.id}
                        type="button"
                        className={"dp-nav-item" + (isActive(item) ? " dp-active" : "")}
                        aria-current={isActive(item) ? "page" : undefined}
                        onClick={() => activate(item)}
                    >
                        <Icon name={item.icon} />
                        <span>{item.label}</span>
                        {item.id === "messages" && unread > 0 && <span className="dp-nav-badge">{unread > 99 ? "99+" : unread}</span>}
                        {item.id === "quests" && questDot && <span className="dp-nav-dot" title="A quest is available" />}
                    </button>
                ))}
                {overflow.length > 0 && (
                    <button type="button" className="dp-nav-item dp-nav-more" onClick={openMore} aria-label="More pages">
                        <Icon name="more" />
                    </button>
                )}
            </nav>
            <label className="dp-header-search">
                <Icon name="search" size={16} />
                <input
                    type="search"
                    value={query}
                    placeholder="Search friends and conversations…"
                    aria-label="Search friends and conversations"
                    onChange={e => {
                        setQuery(e.currentTarget.value);
                        if (!onHome || classic) { setClassic(false); go(ROUTES.friends); }
                    }}
                />
            </label>
            <CallPill route={layout.route} forceShow={forceShowCall} setForceShow={setForceShowCall} />
            <div className="dp-header-actions">
                <UpdateChip />
                {onHome && (
                    <button
                        type="button"
                        className={"dp-icon-btn" + (classic ? " dp-active" : "")}
                        title={classic ? "Back to Discord+ home" : "Show Discord's classic Friends page"}
                        aria-pressed={classic}
                        onClick={() => setClassic(!classic)}
                    >
                        <Icon name="classic" />
                    </button>
                )}
                <button type="button" className="dp-icon-btn" title="Discord+ settings" onClick={openPluginSettings}>
                    <Icon name="sliders" />
                </button>
            </div>
            {headerUserControls && <HeaderUser />}
        </header>
    );
}
