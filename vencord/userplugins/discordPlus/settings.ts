/*
 * Discord+ Refined Dark
 * SPDX-License-Identifier: CC-BY-NC-4.0
 */
import { definePluginSettings } from "@api/Settings";
import { OptionType } from "@utils/types";

export interface Placement {
    x: number;
    y: number;
    w?: number;
    h?: number;
}

export type FriendFilter = "all" | "online" | "recent" | "unread" | "favorites" | "pending" | "blocked" | "ignored";

export const settings = definePluginSettings({
    // ── Layout ──────────────────────────────────────────────────────────
    homeOverlay: {
        type: OptionType.BOOLEAN,
        description: "Replace the Friends page with the Discord+ home (friends grid + messages)",
        default: true
    },
    globalHeader: {
        type: OptionType.BOOLEAN,
        description: "Show the Discord+ navigation header on every page",
        default: true
    },
    hideDmColumn: {
        type: OptionType.BOOLEAN,
        description: "Remove Discord's Friends / DM column on Home and in DMs (navigation lives in the Discord+ header)",
        default: true
    },
    headerUserControls: {
        type: OptionType.BOOLEAN,
        description: "Show your avatar, mute, deafen and settings in the Discord+ header",
        default: true
    },
    hideQuestPromo: {
        type: OptionType.BOOLEAN,
        description: "Replace Discord's quest promo card with a small dot on the Quests tab",
        default: true
    },
    hideActiveNow: {
        type: OptionType.BOOLEAN,
        description: "Hide the \"Active Now\" column on Discord's own Friends / Add Friend page",
        default: true
    },
    dockStreamVideo: {
        type: OptionType.BOOLEAN,
        description: "Show Discord's live stream window inside the call manager instead of floating separately",
        default: true
    },
    // v1.1 renamed these (with new defaults) so values saved by v1.0 don't keep them switched on.
    fullWidthDms: {
        type: OptionType.BOOLEAN,
        description: "Hide the native DM list while a conversation is open (only with the floating dock)",
        default: false
    },
    floatingDock: {
        type: OptionType.BOOLEAN,
        description: "Replace Discord's bottom-left user panel with a movable floating dock (off = Discord's own panel)",
        default: false
    },
    snapDock: {
        type: OptionType.BOOLEAN,
        description: "Snap the user dock to screen edges when dragged close",
        default: true
    },
    callManager: {
        type: OptionType.BOOLEAN,
        description: "Show the floating voice-call manager when you leave an active call's page",
        default: true
    },
    hideNativeUserPanel: {
        type: OptionType.BOOLEAN,
        description: "With the floating dock on, also hide Discord's bottom-left user/voice panel",
        default: true
    },
    // ── Appearance ──────────────────────────────────────────────────────
    applyTheme: {
        type: OptionType.BOOLEAN,
        description: "Apply the Refined Dark colours to the whole client (off: Discord+ uses your own theme's colours)",
        default: true
    },
    accent: {
        type: OptionType.STRING,
        description: "Accent colour with the Refined Dark theme (hex, e.g. #7478f8); off: your theme's accent",
        default: "#7478f8",
        isValid: (v: string) => /^#[\da-f]{6}$/i.test(v) || "Use a 6-digit hex colour like #7478f8"
    },
    density: {
        type: OptionType.SELECT,
        description: "Friend card density",
        options: [
            { label: "Comfortable", value: "comfortable", default: true },
            { label: "Compact", value: "compact" }
        ]
    },
    messagePreviews: {
        type: OptionType.BOOLEAN,
        description: "Show the latest cached message on friend cards",
        default: true
    },
    showActivity: {
        type: OptionType.BOOLEAN,
        description: "Show games / custom status on friend cards",
        default: true
    },
    defaultFilter: {
        type: OptionType.SELECT,
        description: "Friends filter selected when you open Discord+ home",
        options: [
            { label: "All", value: "all", default: true },
            { label: "Online", value: "online" },
            { label: "Recent", value: "recent" },
            { label: "Unread", value: "unread" },
            { label: "Favorites", value: "favorites" }
        ]
    },
    showQuestChip: {
        type: OptionType.BOOLEAN,
        description: "Show a small dismissible Quests shortcut in the bottom-right corner",
        default: false
    },
    animation: {
        type: OptionType.SELECT,
        description: "How your friends (and conversations) appear when Discord+ Home opens",
        options: [
            { label: "Wave: cards rise in a diagonal wave", value: "wave", default: true },
            { label: "Pop: cards pop in with a little bounce", value: "pop" },
            { label: "Slide: cards slide in from the left", value: "slide" },
            { label: "Flip: cards flip down into place", value: "flip" },
            { label: "Fade: cards fade in", value: "fade" },
            { label: "Off: no entrance, hover or intro animations", value: "off" }
        ]
    },
    animationSpeed: {
        type: OptionType.SELECT,
        description: "Speed of the entrance animation",
        options: [
            { label: "Normal", value: "normal", default: true },
            { label: "Fast", value: "fast" },
            { label: "Relaxed", value: "slow" }
        ]
    },
    checkUpdates: {
        type: OptionType.BOOLEAN,
        description: "Check GitHub for a newer Discord+ and show it in the header (asks GitHub's public releases page every 6 hours, no account)",
        default: true
    },
    reduceMotion: {
        type: OptionType.BOOLEAN,
        description: "Turn off Discord+ animations (system reduced-motion is always respected)",
        default: false
    },
    // ── Stored state (not shown in the settings UI) ─────────────────────
    favorites: {
        type: OptionType.CUSTOM,
        default: [] as string[]
    },
    dockPlacement: {
        type: OptionType.CUSTOM,
        default: null as Placement | null
    },
    callPlacement: {
        type: OptionType.CUSTOM,
        default: null as Placement | null
    },
    /** Members hidden while a stream is shown in the call manager (the stream takes their space). */
    callMembersHidden: {
        type: OptionType.CUSTOM,
        default: false
    },
    /** Floating call manager hidden; the call stays reachable from the header's call pill. */
    callHidden: {
        type: OptionType.CUSTOM,
        default: false
    },
    callMinimized: {
        type: OptionType.CUSTOM,
        default: false
    },
    /** A release you chose to skip ("Skip this version"). */
    dismissedUpdate: {
        type: OptionType.CUSTOM,
        default: ""
    }
});

export function isFavorite(id: string) {
    return settings.store.favorites.includes(id);
}

export function toggleFavorite(id: string) {
    const favs = settings.store.favorites;
    settings.store.favorites = favs.includes(id) ? favs.filter(f => f !== id) : [...favs, id];
}
