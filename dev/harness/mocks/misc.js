const R = window.React;

// @api/Settings: reactive store with defaults (simplified definePluginSettings)
export function definePluginSettings(def) {
    const values = {}, subs = new Set();
    for (const [k, d] of Object.entries(def)) values[k] = "default" in d ? d.default : d.options?.find(o => o.default)?.value;
    const store = new Proxy(values, { set(t, k, v) { t[k] = v; subs.forEach(f => f()); return true; } });
    window.__settings = store;
    return {
        def, store,
        use() {
            const [, set] = R.useState(0);
            R.useEffect(() => { const f = () => set(x => x + 1); subs.add(f); return () => subs.delete(f); }, []);
            return { ...values };
        }
    };
}
// @utils/types
export const OptionType = { STRING: 0, NUMBER: 1, BIGINT: 2, BOOLEAN: 3, SELECT: 4, SLIDER: 5, COMPONENT: 6, CUSTOM: 7 };
export default function definePlugin(p) { return p; }
// @utils/discord
export const openPrivateChannel = id => { window.__dpLog.push("dm " + id); history.pushState({}, "", "/channels/@me/dm-" + id); };
export const openUserProfile = async id => { window.__dpLog.push("profile " + id); };
// @api/PluginManager, @components/settings
export const plugins = { DiscordPlus: {} };
export const openPluginModal = () => window.__dpLog.push("plugin settings");
// @webpack
export const findByPropsLazy = (...props) => props.includes("addRelationship")
    ? {
        addRelationship: async ({ userId, type }) => { window.__dpLog.push((type === 2 ? "block " : "accept ") + userId); },
        removeRelationship: async userId => { window.__dpLog.push("remove " + userId); },
        ignoreUser: async userId => { window.__dpLog.push("ignore " + userId); },
        unignoreUser: async userId => { window.__dpLog.push("unignore " + userId); }
    }
    : props.includes("watchStream")
    ? {
        watchStream: s => window.__dpLog.push("watch " + s.ownerId),
        closeStream: key => { window.__dpLog.push("closeStream " + key); setTimeout(() => document.querySelector(".pictureInPictureWindow_x1")?.remove(), 300); }
    }
    : props.includes("toggleSelfMute")
    ? {
        toggleSelfMute() { const d = window.__dp; d.media.mute = !d.media.mute; d.MediaEngineStore.emit(); d.VoiceStateStore.emit(); },
        toggleSelfDeaf() { const d = window.__dp; d.media.deaf = !d.media.deaf; d.MediaEngineStore.emit(); }
    }
    : { selectVoiceChannel(id) { window.__dpLog.push("disconnect"); window.__dp.SelectedChannelStore.voice = id; window.__dp.SelectedChannelStore.emit(); } };
const speaking = {
    ids: new Set(["nova"]), l: new Set(),
    isSpeaking(id) { return this.ids.has(id); },
    addChangeListener(f) { this.l.add(f); }, removeChangeListener(f) { this.l.delete(f); },
    set(ids) { this.ids = new Set(ids); this.l.forEach(f => f()); }
};
window.__speaking = speaking;
export const findStoreLazy = () => speaking;
// @vencord/discord-types/enums
export const ActivityType = { PLAYING: 0, STREAMING: 1, LISTENING: 2, WATCHING: 3, CUSTOM_STATUS: 4, COMPETING: 5, HANG_STATUS: 6 };
export const RelationshipType = { NONE: 0, FRIEND: 1, BLOCKED: 2, INCOMING_REQUEST: 3, OUTGOING_REQUEST: 4 };
export const copyWithToast = (text, msg) => window.__dpLog.push("copy " + text);
