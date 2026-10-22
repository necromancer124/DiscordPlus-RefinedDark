/*
 * Discord+ Refined Dark — the Home view that replaces the native Friends page.
 * SPDX-License-Identifier: CC-BY-NC-4.0
 */
import { ContextMenuApi, Menu, PrivateChannelSortStore, useMemo, useRef, useState } from "@webpack/common";

import {
    ConversationRow, friendStores, FriendRow, readConversations, readRelationships, refreshAll,
    STATUS_LABEL, STATUS_ORDER, useClock, useStoreTick
} from "../data";
import {
    acceptFriendRequest, blockUser, ignoreUser, openChannel, openNativeAddFriend, openDm, openProfile, relativeTime, removeFriend, removeFriendRequest,
    unblockUser, unignoreUser
} from "../discordApi";
import { FriendFilter, settings, toggleFavorite } from "../settings";
import { Avatar, useEntrance } from "./common";
import type { HomePage } from "./Header";
import { Icon } from "./Icons";

type Sort = "smart" | "recent" | "name" | "status";

const FILTERS: { id: FriendFilter; label: string; }[] = [
    { id: "all", label: "All" },
    { id: "online", label: "Online" },
    { id: "recent", label: "Recent" },
    { id: "unread", label: "Unread" },
    { id: "favorites", label: "Favorites" },
    { id: "pending", label: "Pending" },
    { id: "blocked", label: "Blocked" },
    { id: "ignored", label: "Ignored" }
];

const WEEK = 7 * 86400_000;

function matches(row: { name: string; username?: string; activity?: string; preview: string; }, q: string) {
    return !q || `${row.name} ${row.username ?? ""} ${row.activity ?? ""} ${row.preview}`.toLowerCase().includes(q);
}

function sortRows(rows: FriendRow[], sort: Sort) {
    const byName = (a: FriendRow, b: FriendRow) => a.name.localeCompare(b.name);
    const byStatus = (a: FriendRow, b: FriendRow) => STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status);
    return [...rows].sort((a, b) => {
        switch (sort) {
            case "recent": return b.lastAt - a.lastAt || byName(a, b);
            case "name": return byName(a, b);
            case "status": return byStatus(a, b) || byName(a, b);
            default:
                return Number(b.favorite) - Number(a.favorite)
                    || Number(b.unread > 0) - Number(a.unread > 0)
                    || byStatus(a, b)
                    || b.lastAt - a.lastAt
                    || byName(a, b);
        }
    });
}

function openFriendMenu(e: React.MouseEvent, row: FriendRow) {
    e.preventDefault();
    e.stopPropagation();
    ContextMenuApi.openContextMenu(e, () => (
        <Menu.Menu navId="dp-friend-menu" onClose={ContextMenuApi.closeContextMenu}>
            {row.kind !== "blocked" && <Menu.MenuItem id="dp-message" label="Message" action={() => openDm(row.id)} />}
            <Menu.MenuItem id="dp-profile" label="View profile" action={() => openProfile(row.id)} />
            {row.kind === "friend" && (
                <Menu.MenuItem
                    id="dp-favorite"
                    label={row.favorite ? "Remove from favorites" : "Add to favorites"}
                    action={() => toggleFavorite(row.id)}
                />
            )}
            <Menu.MenuSeparator />
            {row.kind === "friend" && <>
                <Menu.MenuItem id="dp-remove" label="Remove friend" color="danger" action={() => removeFriend(row.id, row.name)} />
                <Menu.MenuItem id="dp-block" label="Block" color="danger" action={() => blockUser(row.id, row.name)} />
            </>}
            {row.kind === "incoming" && <>
                <Menu.MenuItem id="dp-accept" label="Accept request" action={() => acceptFriendRequest(row.id)} />
                <Menu.MenuItem id="dp-ignore" label="Ignore request" action={() => removeFriendRequest(row.id)} />
                <Menu.MenuItem id="dp-block" label="Block" color="danger" action={() => blockUser(row.id, row.name)} />
            </>}
            {row.kind === "outgoing" && <>
                <Menu.MenuItem id="dp-cancel" label="Cancel request" action={() => removeFriendRequest(row.id)} />
                <Menu.MenuItem id="dp-block" label="Block" color="danger" action={() => blockUser(row.id, row.name)} />
            </>}
            {row.kind === "ignored" && <Menu.MenuItem id="dp-block" label="Block" color="danger" action={() => blockUser(row.id, row.name)} />}
            {row.kind === "blocked" && <Menu.MenuItem id="dp-unblock" label="Unblock" action={() => unblockUser(row.id)} />}
            {row.kind !== "blocked" && (row.ignored
                ? <Menu.MenuItem id="dp-unignore" label="Unignore" action={() => unignoreUser(row.id)} />
                : <Menu.MenuItem id="dp-ignore" label="Ignore" action={() => ignoreUser(row.id)} />)}
        </Menu.Menu>
    ));
}

function FriendCard({ row }: { row: FriendRow; }) {
    const { messagePreviews } = settings.use(["messagePreviews"]);
    const subtitle = row.kind === "incoming" ? "Incoming friend request"
        : row.kind === "outgoing" ? "Outgoing friend request"
            : row.kind === "blocked" ? "Blocked"
                : row.kind === "ignored" ? "Ignored"
                : row.activity || STATUS_LABEL[row.status];
    // The card opens the profile; the chat button underneath opens the conversation.
    const activate = () => openProfile(row.id);
    const chat = (e: React.MouseEvent | React.KeyboardEvent) => {
        e.stopPropagation();
        openDm(row.id);
    };

    return (
        <div
            role="button"
            tabIndex={0}
            data-dp-enter=""
            className={"dp-card" + (row.status === "offline" ? " dp-offline" : "") + (row.unread ? " dp-has-unread" : "")}
            title={`View ${row.name}'s profile`}
            onClick={activate}
            onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); activate(); } }}
            onContextMenu={e => openFriendMenu(e, row)}
        >
            {/* Re-keyed per message so the flash replays for every new one. */}
            {row.liveAt > 0 && Date.now() - row.liveAt < 10_000 && <span key={row.liveAt} className="dp-card-flash" aria-hidden="true" />}
            <div className="dp-card-top">
                <Avatar src={row.avatar} name={row.name} status={row.kind === "blocked" ? null : row.status} />
                <div className="dp-card-names">
                    <span className="dp-card-name">
                        {row.name}
                        {row.favorite && <Icon name="star" size={12} className="dp-fav" />}
                    </span>
                    <span className="dp-card-sub">{subtitle}</span>
                </div>
                <button
                    type="button"
                    className="dp-card-menu"
                    aria-label={`More options for ${row.name}`}
                    onClick={e => openFriendMenu(e, row)}
                >
                    <Icon name="more" size={16} />
                </button>
            </div>
            {(row.kind === "incoming" || row.kind === "outgoing") && (
                <div className="dp-request-actions">
                    {row.kind === "incoming" && (
                        <button
                            type="button"
                            className="dp-request-btn dp-accept"
                            title={`Accept ${row.name}'s friend request`}
                            onClick={e => { e.stopPropagation(); void acceptFriendRequest(row.id); }}
                        >
                            <Icon name="check" size={15} /> Accept
                        </button>
                    )}
                    <button
                        type="button"
                        className="dp-request-btn dp-deny"
                        title={row.kind === "incoming" ? "Ignore this request" : "Cancel your request"}
                        onClick={e => { e.stopPropagation(); void removeFriendRequest(row.id); }}
                    >
                        <Icon name="close" size={14} /> {row.kind === "incoming" ? "Deny" : "Cancel"}
                    </button>
                </div>
            )}
            {row.kind === "friend" && (
                <button
                    type="button"
                    className="dp-card-preview"
                    title={`Message ${row.name}`}
                    onClick={chat}
                    onKeyDown={e => { if (e.key === "Enter" || e.key === " ") e.stopPropagation(); }}
                >
                    <Icon name="message" size={13} />
                    <span className="dp-card-preview-text">
                        {messagePreviews ? row.preview || "Open chat" : `Message ${row.name}`}
                    </span>
                    {row.unread > 0
                        ? <span className="dp-pill" aria-label={`${row.unread} unread`}>{row.unread > 99 ? "99+" : row.unread}</span>
                        : messagePreviews && <span className="dp-time">{relativeTime(row.lastAt)}</span>}
                </button>
            )}
        </div>
    );
}

function FriendsView({ query, showClassic }: { query: string; showClassic(): void; }) {
    const tick = useStoreTick(friendStores);
    const { density, favorites, showActivity } = settings.use(["density", "favorites", "showActivity"]);
    const [filter, setFilter] = useState<FriendFilter>((settings.store.defaultFilter as FriendFilter) ?? "all");
    const [sort, setSort] = useState<Sort>("smart");
    useClock(60_000);

    const data = useMemo(readRelationships, [tick, favorites, showActivity]);
    const q = query.trim().toLowerCase();
    const now = Date.now();

    const pick = (f: FriendFilter): FriendRow[] => {
        switch (f) {
            case "online": return data.friends.filter(r => r.status !== "offline");
            case "recent": return data.friends.filter(r => r.lastAt && now - r.lastAt < WEEK);
            case "unread": return data.friends.filter(r => r.unread > 0);
            case "favorites": return data.friends.filter(r => r.favorite);
            case "pending": return data.pending;
            case "blocked": return data.blocked;
            case "ignored": return data.ignored;
            default: return data.friends;
        }
    };

    const rows = sortRows(pick(filter).filter(r => matches(r, q)), filter === "recent" && sort === "smart" ? "recent" : sort);
    // Entrance on open, on filter / sort change, and once friends first arrive while Discord is still starting.
    const pageRef = useRef<HTMLDivElement>(null);
    useEntrance(pageRef, [filter, sort, rows.length > 0]);
    const sections = filter === "all" && sort !== "name"
        ? [
            { title: "Online", rows: rows.filter(r => r.status !== "offline") },
            { title: "Offline", rows: rows.filter(r => r.status === "offline") }
        ]
        : [{ title: FILTERS.find(f => f.id === filter)!.label, rows }];

    return (
        <div ref={pageRef} className="dp-page">
            <div className="dp-page-head" data-dp-enter="">
                <Icon name="friends" size={22} />
                <h1>Friends</h1>
                <span className="dp-muted">{data.friends.length} friends</span>
                <button type="button" className="dp-icon-btn dp-refresh" title="Refresh" aria-label="Refresh" onClick={refreshAll}>
                    <Icon name="refresh" size={17} />
                </button>
                <button
                    type="button"
                    className="dp-add-friend"
                    title="Add a friend by username (Discord's own Add Friend page)"
                    onClick={() => { showClassic(); openNativeAddFriend(); }}
                >
                    <Icon name="plus" size={16} />
                    Add Friend
                </button>
            </div>
            <div className="dp-toolbar" data-dp-enter="">
                <div className="dp-filters" role="group" aria-label="Filter friends">
                    {FILTERS.map(f => {
                        const count = pick(f.id).length;
                        if ((f.id === "pending" || f.id === "blocked" || f.id === "ignored") && !count && filter !== f.id) return null;
                        return (
                            <button
                                key={f.id}
                                type="button"
                                className={"dp-filter" + (filter === f.id ? " dp-active" : "")}
                                aria-pressed={filter === f.id}
                                onClick={() => setFilter(f.id)}
                            >
                                {f.label}
                                {f.id !== "all" && <span className="dp-count">{count}</span>}
                            </button>
                        );
                    })}
                </div>
                <select className="dp-select" value={sort} aria-label="Sort friends" onChange={e => setSort(e.currentTarget.value as Sort)}>
                    <option value="smart">Smart order</option>
                    <option value="recent">Recent messages</option>
                    <option value="status">Status</option>
                    <option value="name">Name A–Z</option>
                </select>
            </div>

            {data.error && <p className="dp-empty">{data.error}</p>}
            {!data.error && !rows.length && (
                <p className="dp-empty">{q ? `No one matches “${query}”.` : filter === "pending" ? "No pending friend requests." : filter === "blocked" ? "You haven't blocked anyone." : filter === "ignored" ? "You haven't ignored anyone." : "No friends here yet."}</p>
            )}

            <div className={"dp-sections" + (density === "compact" ? " dp-compact" : "")}>
                {sections.filter(s => s.rows.length).map(s => (
                    <section key={s.title} aria-label={s.title}>
                        <h2 className="dp-section-title" data-dp-enter="">{s.title} — {s.rows.length}</h2>
                        <div className="dp-grid">
                            {s.rows.map(r => <FriendCard key={r.id} row={r} />)}
                        </div>
                    </section>
                ))}
            </div>
        </div>
    );
}

function ConversationItem({ row }: { row: ConversationRow; }) {
    return (
        <button type="button" data-dp-enter="" className={"dp-row" + (row.unread ? " dp-has-unread" : "")} onClick={() => openChannel(row.id)}>
            <Avatar src={row.avatar} name={row.name} status={row.group ? null : row.status} size={36} />
            <span className="dp-row-text">
                <span className="dp-row-title">
                    {row.name}
                    {row.group && <span className="dp-tag">{row.members} members</span>}
                    {!row.group && !row.friend && <span className="dp-tag">Not a friend</span>}
                </span>
                <span className="dp-row-sub">{row.preview || "Open conversation"}</span>
            </span>
            {row.unread > 0
                ? <span className="dp-pill">{row.unread > 99 ? "99+" : row.unread}</span>
                : <span className="dp-time">{relativeTime(row.lastAt)}</span>}
        </button>
    );
}

function MessagesView({ query }: { query: string; }) {
    const tick = useStoreTick(() => [...friendStores(), PrivateChannelSortStore]);
    useClock(60_000);
    const rows = useMemo(readConversations, [tick]);
    const q = query.trim().toLowerCase();
    const visible = rows.filter(r => matches(r, q));
    const pageRef = useRef<HTMLDivElement>(null);
    useEntrance(pageRef, [visible.length > 0]);

    return (
        <div ref={pageRef} className="dp-page">
            <div className="dp-page-head" data-dp-enter="">
                <Icon name="message" size={22} />
                <h1>Messages</h1>
                <span className="dp-muted">Direct messages, group DMs and non-friends</span>
            </div>
            {!visible.length && <p className="dp-empty">{q ? `No conversations match “${query}”.` : "No conversations yet."}</p>}
            <div className="dp-list">
                {visible.map(r => <ConversationItem key={r.id} row={r} />)}
            </div>
        </div>
    );
}

export function Home({ left, top, page, query, showClassic }: {
    left: number;
    top: number;
    page: HomePage;
    query: string;
    showClassic(): void;
}) {
    return (
        <main className="dp-home" style={{ left, top }} aria-label="Discord+ home">
            <div className="dp-home-inner">
                {page === "messages" ? <MessagesView query={query} /> : <FriendsView query={query} showClassic={showClassic} />}
            </div>
        </main>
    );
}
