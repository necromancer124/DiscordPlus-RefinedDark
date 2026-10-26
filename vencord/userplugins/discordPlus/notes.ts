/*
 * Discord+ Refined Dark — your private notes about people, for the friend cards.
 * SPDX-License-Identifier: CC-BY-NC-4.0
 *
 * Discord loads a note only when you open that person's profile, and forgets all of them on every reconnect.
 * So Discord+ asks Discord once, after it starts, for all your notes (one read-only request through Discord's own
 * REST client, the same endpoint the app uses), then follows your edits live (USER_NOTE_UPDATE). Only while the
 * "Show your notes on friend cards" setting is on.
 */
import { RestAPI, UserStore } from "@webpack/common";

import { safe } from "./discordApi";
import { settings } from "./settings";

const notes = new Map<string, string>();
const listeners = new Set<() => void>();
const notify = () => listeners.forEach(cb => cb());

/** Flux-store-like, so cards re-render when notes arrive or change. */
export const NotesStore = {
    addChangeListener: (cb: () => void) => void listeners.add(cb),
    removeChangeListener: (cb: () => void) => void listeners.delete(cb),
    get: (userId: string) => notes.get(userId) ?? ""
};

let loadedAt = 0;
let waiting: ReturnType<typeof setInterval> | undefined;
/** Don't ask again for this long (reconnects happen often). */
const RELOAD_MS = 15 * 60_000;

async function load() {
    if (!settings.store.showNotes || Date.now() - loadedAt < RELOAD_MS) return;
    if (!safe(() => UserStore.getCurrentUser(), undefined)) return; // not logged in yet: startNotes() waits
    loadedAt = Date.now();
    try {
        const { body } = await RestAPI.get({ url: "/users/@me/notes" });
        notes.clear();
        if (body && typeof body === "object") {
            for (const [id, note] of Object.entries(body as Record<string, unknown>)) {
                if (typeof note === "string" && note.trim()) notes.set(id, note.trim());
            }
        }
        notify();
    } catch (e) {
        loadedAt = 0;
        console.warn("[Discord+] couldn't load your notes", e);
    }
}

/** Load once Discord is logged in. */
export function startNotes() {
    stopNotes();
    waiting = setInterval(() => {
        if (!safe(() => UserStore.getCurrentUser(), undefined)) return;
        clearInterval(waiting);
        waiting = undefined;
        load();
    }, 1000);
}

export function stopNotes() {
    clearInterval(waiting);
    waiting = undefined;
}

/** Turning the setting on later loads them then. */
export function notesSettingChanged(on: boolean) {
    if (on) load();
}

/** Flux USER_NOTE_UPDATE: you edited a note (in a profile). */
export function onNoteUpdate(userId: string | undefined, note: string | null | undefined) {
    if (!userId) return;
    const text = (note ?? "").trim();
    if (text) notes.set(userId, text);
    else notes.delete(userId);
    notify();
}
