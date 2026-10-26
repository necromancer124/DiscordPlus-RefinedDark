/*
 * Discord+ Refined Dark — self-check: is every piece of Discord that Discord+ relies on still where it expects it?
 * SPDX-License-Identifier: CC-BY-NC-4.0
 *
 * Shown in the plugin's settings. After a Discord update, a failed row names the part that broke and the feature it
 * affects. The copied report holds only check names, results and versions: no names, IDs, messages or notes.
 */
import { findStoreLazy } from "@webpack";
import {
    Alerts, ApplicationStreamingStore, ChannelStore, GuildStore, MediaEngineStore, NavigationRouter, PresenceStore,
    PrivateChannelSortStore, ReadStateStore, RelationshipStore, RestAPI, SelectedChannelStore, SettingsRouter, UserStore,
    VoiceStateStore
} from "@webpack/common";

import { DiscordModules } from "./discordApi";
import { cls, findNativeAddFriendTab, measure, PIP_SELECTOR, SEL } from "./layout";
import { notesStatus } from "./notes";
import { settings } from "./settings";
import { lastUpdateCheck } from "./updates";
import { VERSION } from "./version";

export type CheckState = "ok" | "fail" | "na";

export interface Check {
    group: string;
    name: string;
    /** What stops working if this fails. */
    feature: string;
    state: CheckState;
    /** Why it's "na" or what failed, in a few words. */
    detail?: string;
}

/** Run `fn` and say whether it returned something truthy, without letting a Discord change throw. */
const works = (fn: () => unknown) => { try { return !!fn(); } catch { return false; } };
const isFn = (fn: () => unknown) => works(() => typeof fn() === "function");

const NoteStore: { getNote?(id: string): unknown; } = findStoreLazy("NoteStore");

export function runSelfCheck(): Check[] {
    const checks: Check[] = [];
    const add = (group: string, name: string, feature: string, state: CheckState | boolean, detail?: string) =>
        checks.push({ group, name, feature, state: state === true ? "ok" : state === false ? "fail" : state, detail });
    const loggedIn = works(() => UserStore.getCurrentUser());

    // ── What Discord+ reads ──
    const data = "Discord data";
    add(data, "Friends list", "Discord+ Home", isFn(() => RelationshipStore.getFriendIDs));
    add(data, "Online status & activities", "Status badges, Online filter", isFn(() => PresenceStore.getStatus) && isFn(() => PresenceStore.getActivities));
    add(data, "Your account", "Header user controls", loggedIn ? true : "na", loggedIn ? undefined : "not logged in yet");
    add(data, "Chats", "Open chat, previews, Messages page", isFn(() => ChannelStore.getDMFromUserId) && isFn(() => PrivateChannelSortStore.getPrivateChannelIds));
    add(data, "Unread counts", "Unread badges", isFn(() => ReadStateStore.getMentionCount));
    add(data, "Voice states", "Call window, voice on friend cards", isFn(() => VoiceStateStore.getVoiceStateForUser) && isFn(() => SelectedChannelStore.getVoiceChannelId));
    add(data, "Who is speaking", "Speaking highlight in the call window", isFn(() => DiscordModules.SpeakingStore.isSpeaking));
    add(data, "Mute / deafen state", "Header and call window buttons", isFn(() => MediaEngineStore.isSelfMute));
    add(data, "Streams", "Watch / LIVE, stream in the call window", isFn(() => ApplicationStreamingStore.getAnyStreamForUser));
    add(data, "Servers", "Server names on voice rows", isFn(() => GuildStore.getGuild));
    add(data, "Notes", "Notes on friend cards", isFn(() => NoteStore.getNote) || isFn(() => RelationshipStore.getNote));

    // ── What Discord+ presses ──
    const actions = "Discord actions";
    add(actions, "Mute / deafen", "Mute and deafen buttons", isFn(() => DiscordModules.MediaActions.toggleSelfMute) && isFn(() => DiscordModules.MediaActions.toggleSelfDeaf));
    add(actions, "Join / leave voice", "Join, Disconnect, Rejoin the call", isFn(() => DiscordModules.VoiceActions.selectVoiceChannel));
    add(actions, "Friend requests, remove, block", "Accept / Deny, Remove friend, Block", isFn(() => DiscordModules.RelationshipActions.addRelationship) && isFn(() => DiscordModules.RelationshipActions.removeRelationship));
    add(actions, "Ignore", "Ignore / Unignore", isFn(() => DiscordModules.RelationshipActions.ignoreUser) && isFn(() => DiscordModules.RelationshipActions.unignoreUser));
    add(actions, "Watch / stop a stream", "Watch, Stop watching", isFn(() => DiscordModules.StreamActions.watchStream));
    add(actions, "Navigation", "Header tabs, Open chat", isFn(() => NavigationRouter.transitionTo));
    add(actions, "User settings", "Settings button", isFn(() => SettingsRouter.openUserSettings));
    add(actions, "Confirm dialogs", "Remove friend / Block / Rejoin questions", isFn(() => Alerts.show));
    add(actions, "Discord's request client", "Loading your notes", isFn(() => RestAPI.get));

    // ── Discord's page that Discord+ adjusts ──
    const page = "Discord layout";
    const layout = (() => { try { return measure(); } catch { return null; } })();
    add(page, "Server list", "Keeping the server list in place", works(() => document.querySelector(SEL.rail)));
    add(page, "Channel / chat area", "Moving Discord's page below the header", !!layout?.canPush);
    add(page, "Bottom-left panel", "Hiding the user panel, voice controls", works(() => document.querySelector(SEL.panels)));
    add(page, "Discord's layers", "Stepping aside for User Settings", works(() => document.querySelector(cls("layers"))));
    const onHome = layout?.kind === "home", inDm = layout?.kind === "dm";
    add(page, "Friends / chats column", "Removing the Friends / DM column",
        onHome || inDm ? works(() => document.querySelector(SEL.dmList)) : "na", onHome || inDm ? undefined : "only on Home or a chat");
    add(page, "Discord's Add Friend tab", "Add Friend button", onHome ? works(() => findNativeAddFriendTab()) : "na", onHome ? undefined : "only on Home");
    add(page, "Chat call buttons", "Call / Video call in the card menu",
        inDm ? works(() => document.querySelector('[aria-label="Start Voice Call"]')) : "na", inDm ? undefined : "only inside a chat");

    // ── What's running right now ──
    const now = "Running now";
    add(now, "Header", "Top navigation", works(() => document.querySelector(".dp-header")) || (!settings.store.globalHeader && !onHome ? "na" : false));
    add(now, "Discord+ Home", "Friends grid", !settings.store.homeOverlay ? "na" : onHome ? works(() => document.querySelector(".dp-home")) : "na",
        !settings.store.homeOverlay ? "turned off" : onHome ? undefined : "only on Home");
    const inCall = works(() => SelectedChannelStore.getVoiceChannelId());
    add(now, "Call window", "Floating call manager", !settings.store.callManager ? "na" : inCall ? works(() => document.querySelector(".dp-call")) || "na" : "na",
        !settings.store.callManager ? "turned off" : inCall ? "hidden or inside the call's server" : "only during a call");
    const pip = works(() => document.querySelector(PIP_SELECTOR));
    add(now, "Stream docking", "Stream inside the call window", pip ? document.body.classList.contains("dp-pip-docked") || "na" : "na",
        pip ? "stream window open but not docked (call window hidden?)" : "only while watching a stream");
    const notes = notesStatus();
    add(now, "Your notes", "Notes on friend cards", !settings.store.showNotes ? "na" : notes.loaded ? true : notes.failed ? false : "na",
        !settings.store.showNotes ? "turned off" : notes.loaded ? `${notes.count} loaded` : notes.failed ? "Discord refused the request" : "not loaded yet");
    const upd = lastUpdateCheck();
    add(now, "Update check", "Update notice", !settings.store.checkUpdates ? "na" : upd.at === 0 ? "na" : upd.ok,
        !settings.store.checkUpdates ? "turned off" : upd.at === 0 ? "not run yet (15s after start)" : upd.ok ? undefined : "couldn't reach GitHub");
    return checks;
}

/** Plain-text report for an issue: versions and results only. */
export function selfCheckReport(checks: Check[]) {
    const discord = navigator.userAgent.match(/discord\/[\d.]+/i)?.[0] ?? "unknown";
    const lines = [`Discord+ ${VERSION} self-check`, `Discord client: ${discord}`, ""];
    for (const c of checks) {
        const mark = c.state === "ok" ? "OK  " : c.state === "fail" ? "FAIL" : "n/a ";
        lines.push(`${mark} ${c.group} / ${c.name}${c.detail ? ` (${c.detail})` : ""}`);
    }
    return lines.join("\n");
}
