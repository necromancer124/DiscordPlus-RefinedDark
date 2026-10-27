/*
 * Discord+ Refined Dark — "Edit Friend Nickname": Discord's own friend nicknames, with the editor back.
 * SPDX-License-Identifier: CC-BY-NC-4.0
 *
 * Discord keeps a nickname per friend (RelationshipStore.getNickname) and shows it in place of their name, but
 * no longer shows the option to set it. Discord+ adds it to the user right-click menu, the profile's ⋯ menu and
 * the friend card menu. Saving sends the same request Discord's own editor sent (the friend relationship's
 * `nickname`), so the name follows your account like before. Nothing is stored by Discord+ itself.
 */
import type { NavContextMenuPatchCallback } from "@api/ContextMenu";
import { Alerts, Menu, RelationshipStore, showToast, TextInput, useState } from "@webpack/common";

import { safe, setFriendNickname } from "./discordApi";

/** Discord's limit for a friend nickname. */
const MAX_LENGTH = 32;

function NicknameField({ initial, placeholder, onChange }: { initial: string; placeholder: string; onChange(value: string): void; }) {
    const [value, setValue] = useState(initial);
    return (
        <TextInput
            value={value}
            placeholder={placeholder}
            maxLength={MAX_LENGTH}
            autoFocus
            onChange={(v: string) => { setValue(v); onChange(v); }}
        />
    );
}

async function save(userId: string, nickname: string) {
    const name = nickname.trim();
    try {
        await setFriendNickname(userId, name || null);
        safe(() => showToast({ text: name ? `Nickname set to ${name}` : "Nickname removed", variant: "success" }), undefined);
    } catch (e) {
        console.warn("[Discord+] set friend nickname failed", e);
        safe(() => showToast({ text: "Couldn't save the nickname.", variant: "critical" }), undefined);
    }
}

/** Ask for a nickname (empty removes it) and save it. `name` is their name without a nickname. */
export function editFriendNickname(userId: string, name: string) {
    const current = safe(() => RelationshipStore.getNickname?.(userId) ?? "", "");
    let value = current;
    Alerts.show({
        title: "Edit Friend Nickname",
        body: (
            <>
                <p style={{ marginBottom: 12 }}>Only you see it. It shows instead of {name} wherever Discord shows friend nicknames. Leave it empty to remove it.</p>
                <NicknameField initial={current} placeholder={name} onChange={v => { value = v; }} />
            </>
        ),
        confirmText: "Save",
        cancelText: "Cancel",
        onConfirm: () => { if (value.trim() !== current) save(userId, value); }
    });
}

export const hasFriendNickname = (userId: string) => !!safe(() => RelationshipStore.getNickname?.(userId), undefined);

export function removeFriendNickname(userId: string) {
    save(userId, "");
}

/** "Edit Friend Nickname" in Discord's own user menus, for friends only. */
export const nicknameMenuPatch: NavContextMenuPatchCallback = (children, { user }: { user?: { id: string; globalName?: string | null; username: string; }; }) => {
    if (!user || !safe(() => RelationshipStore.isFriend(user.id), false)) return;
    children.push(
        <Menu.MenuItem
            id="dp-friend-nickname"
            label="Edit Friend Nickname"
            action={() => editFriendNickname(user.id, user.globalName || user.username)}
        />
    );
};
