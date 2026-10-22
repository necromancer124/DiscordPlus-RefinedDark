// Mock of @webpack/common backed by sample data (same people as preview/app.js).
const R = window.React;
export const React = R;
export const { useState, useEffect, useMemo, useRef, useCallback, useLayoutEffect } = R;
export const createRoot = el => window.ReactDOM.createRoot(el);

class Store {
    constructor() { this.l = new Set(); }
    addChangeListener(f) { this.l.add(f); }
    removeChangeListener(f) { this.l.delete(f); }
    emit() { this.l.forEach(f => f()); }
}
const people = [
    ["nova", "Nova", "online", [0, "Night Shift"], "such a good run today ngl", 2, "nova.svg", 60e3],
    ["pixel", "Pixel", "online", [0, "Stardew Valley"], "yea this boss is insane…", 3, "pixel.svg", 120e3],
    ["orbit", "Orbit", "online", [0, "ROBLOX"], "join?", 1, "orbit.svg", 240e3],
    ["kestrel", "Kestrel", "online", [0, "Notepad++"], "sent a file", 0, "kestrel.svg", 9e5],
    ["juniper", "Juniper", "online", null, "yo you free later?", 0, "juniper.svg", 19e5],
    ["moss", "Moss", "online", [1, "Speedrun practice"], "", 0, "moss.svg", 36e5],
    ["echo", "Echo", "idle", null, "brb", 0, "echo.svg", 108e5],
    ["harbor", "Harbor", "dnd", [4, "Sweet Harbor Dreams"], "good night", 0, "harbor.svg", 18e6],
    ["comet", "Comet", "idle", null, "can u send that pic again?", 0, "comet.svg", 216e5],
    ["sable", "Sable", "dnd", [4, "Doing homework..."], "", 0, "sable.svg", 864e5],
    ["fern", "Fern", "online", null, "sent a sticker", 0, "fern.svg", 18e4],
    ["basil", "Basil", "offline", null, "", 0, "basil.svg", 288e5],
    ["rune", "Rune", "offline", null, "checking in later", 0, "rune.svg", 864e5],
    ["atlas", "Atlas", "offline", null, "", 0, "atlas.svg", 6e8],
    ["ember", "Ember", "offline", null, "", 0, "ember.svg", 17e7],
    ["maple", "Maple", "offline", null, "", 0, "maple.svg", 26e7],
    ["indigo", "Indigo", "offline", null, "", 0, "indigo.svg", 43e7],
    ["tide", "Tide", "offline", null, "", 0, "tide.svg", 77e7]
];
const now = Date.now();
const snow = ms => String((BigInt(Math.floor(ms)) - 1420070400000n) << 22n);
const users = {}, dms = {}, unread = {}, msgs = {}, statuses = {}, acts = {}, channels = {};
const mkUser = (id, name, avatar) => ({
    id, username: name.toLowerCase().replace(/[^a-z0-9_.]/g, "") || id, globalName: name,
    // The plugin only accepts https URLs; the harness maps this host to ./avatars via a fetch-free <img> rewrite below.
    getAvatarURL: () => avatar ? `https://localhost.avatars/${avatar}` : undefined
});
users.me = mkUser("me", "Sky", "kestrel.svg");
users.me.username = "sky";
for (const [id, name, st, act, last, un, av, ago] of people) {
    users[id] = mkUser(id, name, av);
    statuses[id] = st;
    if (act) acts[id] = [{ type: act[0], name: act[1], state: act[1] }];
    const dm = "dm-" + id;
    dms[id] = dm;
    unread[dm] = un;
    channels[dm] = { id: dm, recipients: [id], lastMessageId: snow(now - ago), isMultiUserDM: () => false, isPrivate: () => true };
    if (last) msgs[dm] = { _array: [{ content: last, author: { id }, attachments: [] }] };
}
users.req1 = mkUser("req1", "orbit_kid", null);
users.req2 = mkUser("req2", "mira.exe", "juniper.svg");
channels.group1 = { id: "group1", name: "Gaming night", recipients: ["nova", "pixel", "orbit"], lastMessageId: snow(now - 7e5), isMultiUserDM: () => true, isPrivate: () => true };
msgs.group1 = { _array: [{ content: "Are we all joining?", author: { id: "orbit" }, attachments: [] }] };
users.stranger = mkUser("stranger", "Support contact", null);
channels["dm-stranger"] = { id: "dm-stranger", recipients: ["stranger"], lastMessageId: snow(now - 9e7), isMultiUserDM: () => false };
channels.vc1 = { id: "vc1", name: "Night Shift", guild_id: "g1" };
delete dms.moss; // a friend without an existing DM

export const UserStore = Object.assign(new Store(), { getUser: id => users[id], getCurrentUser: () => users.me });
export const RelationshipStore = Object.assign(new Store(), {
    getFriendIDs: () => people.map(p => p[0]), getNickname: () => undefined, isFriend: id => !!statuses[id],
    getMutableRelationships: () => new Map([["req1", 3], ["req2", 4]]), getBlockedIDs: () => []
});
export const PresenceStore = Object.assign(new Store(), { getStatus: id => statuses[id] ?? "offline", getActivities: id => acts[id] ?? [], isMobileOnline: id => id === "juniper" });
export const ChannelStore = Object.assign(new Store(), { getDMFromUserId: id => dms[id], getChannel: id => channels[id] });
export const ReadStateStore = Object.assign(new Store(), { getMentionCount: id => unread[id] ?? 0 });
export const MessageStore = Object.assign(new Store(), { getMessages: id => msgs[id] });
export const PrivateChannelSortStore = Object.assign(new Store(), { getPrivateChannelIds: () => Object.keys(channels).filter(c => c !== "vc1") });
const media = { mute: false, deaf: false };
export const MediaEngineStore = Object.assign(new Store(), { isSelfMute: () => media.mute, isSelfDeaf: () => media.deaf });
export const SelfPresenceStore = Object.assign(new Store(), { getStatus: () => "online" });
export const SelectedChannelStore = Object.assign(new Store(), { voice: "vc1", getVoiceChannelId() { return this.voice; } });
export const VoiceStateStore = Object.assign(new Store(), {
    getVoiceStatesForChannel: id => id !== "vc1" ? {} : {
        nova: { userId: "nova", selfStream: true },
        pixel: { userId: "pixel", selfMute: true },
        basil: { userId: "basil", selfMute: true },
        me: { userId: "me", selfMute: media.mute, selfDeaf: media.deaf }
    }
});
export const GuildStore = Object.assign(new Store(), { getGuild: () => ({ name: "Night Shift server" }) });
export const ApplicationStreamingStore = Object.assign(new Store(), { getAnyStreamForUser: id => id === "nova" ? { ownerId: id, guildId: "g1", channelId: "vc1" } : null });
export const ApplicationStreamPreviewStore = Object.assign(new Store(), { getPreviewURL: async (g, c, owner) => "/avatars/" + owner + ".svg" });
// Discord's alert dialog: auto-confirms unless window.__alertCancel is set; logged as "alert <title>".
export const Alerts = { show: a => { window.__dpLog.push("alert " + a.title); if (!window.__alertCancel) a.onConfirm?.(); } };
export const showToast = data => window.__dpLog.push("toast " + (data?.text ?? data));
window.__dp = { media, MediaEngineStore, SelectedChannelStore, VoiceStateStore, ReadStateStore, unread };

export const NavigationRouter = { transitionTo: p => { history.pushState({}, "", p); window.__dpLog.push("nav " + p); } };
export const SettingsRouter = { openUserSettings: () => { window.__dpLog.push("user settings"); return Promise.resolve(); } };

// Look-alikes of Discord's Menu components and ContextMenuApi
export const Menu = {
    Menu: ({ children }) => R.createElement("div", { className: "mock-menu" }, children),
    MenuItem: ({ label, action, color }) => R.createElement("button", { className: "mock-menu-item" + (color ? " mock-" + color : ""), onClick: e => { action?.(e); ContextMenuApi.closeContextMenu(); } }, label),
    MenuSeparator: () => R.createElement("hr")
};
let menuRoot;
export const ContextMenuApi = {
    openContextMenu(e, render) {
        const el = document.getElementById("mock-layer");
        el.style.left = e.clientX + "px";
        el.style.top = e.clientY + "px";
        el.hidden = false;
        menuRoot ??= window.ReactDOM.createRoot(el);
        menuRoot.render(R.createElement(render));
    },
    closeContextMenu() { document.getElementById("mock-layer").hidden = true; }
};
