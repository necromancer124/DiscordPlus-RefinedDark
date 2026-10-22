/*
 * Discord+ Refined Dark — movable user-control dock.
 * SPDX-License-Identifier: CC-BY-NC-4.0
 */
import { MediaEngineStore, SelfPresenceStore, useEffect, UserStore, useRef } from "@webpack/common";

import { avatarOf, selfStatus, useStoreTick } from "../data";
import { openProfile, openUserSettings, safe, toggleDeafen, toggleMute } from "../discordApi";
import { settings } from "../settings";
import { Avatar, useFloating } from "./common";
import { Icon } from "./Icons";

export function UserDock({ onMounted }: { onMounted(active: boolean): void; }) {
    useStoreTick(() => [UserStore, MediaEngineStore, SelfPresenceStore]);
    const { snapDock } = settings.use(["snapDock"]);
    const ref = useRef<HTMLDivElement>(null);
    const grip = useRef<HTMLDivElement>(null);
    const me = safe(() => UserStore.getCurrentUser(), undefined);
    useFloating(ref, grip, "dockPlacement", { snap: snapDock, mode: !!me });

    // Tell the app the dock really rendered; only then may Discord's own panel be hidden.
    useEffect(() => {
        onMounted(!!me);
        return () => onMounted(false);
    }, [!!me]);

    const muted = safe(() => MediaEngineStore.isSelfMute(), false);
    const deafened = safe(() => MediaEngineStore.isSelfDeaf(), false);
    const raw = safe(() => SelfPresenceStore.getStatus(), "online" as string);
    const status = selfStatus(raw);
    if (!me) return null;
    const name = me.globalName || me.username;

    return (
        <div ref={ref} className="dp-dock" role="toolbar" aria-label="User controls">
            <div ref={grip} className="dp-grip" title="Drag to move">
                <Icon name="grip" size={14} />
            </div>
            <button type="button" className="dp-dock-user" title="View your profile" onClick={() => openProfile(me.id)}>
                <Avatar src={avatarOf(me.id)} name={name} status={status} size={34} />
                <span className="dp-dock-names">
                    <span className="dp-dock-name">{name}</span>
                    <span className="dp-dock-tag">@{me.username}</span>
                </span>
            </button>
            <button
                type="button"
                className={"dp-icon-btn" + (muted ? " dp-danger" : "")}
                aria-pressed={muted}
                title={muted ? "Unmute" : "Mute"}
                onClick={toggleMute}
            >
                <Icon name={muted ? "micOff" : "mic"} />
            </button>
            <button
                type="button"
                className={"dp-icon-btn" + (deafened ? " dp-danger" : "")}
                aria-pressed={deafened}
                title={deafened ? "Undeafen" : "Deafen"}
                onClick={toggleDeafen}
            >
                <Icon name={deafened ? "headphonesOff" : "headphones"} />
            </button>
            <button type="button" className="dp-icon-btn" title="User settings" onClick={openUserSettings}>
                <Icon name="settings" />
            </button>
        </div>
    );
}
