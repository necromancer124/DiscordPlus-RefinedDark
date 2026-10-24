/*
 * Discord+ Refined Dark — "is there a newer Discord+?" check against GitHub releases.
 * SPDX-License-Identifier: CC-BY-NC-4.0
 *
 * The only request Discord+ makes outside Discord: GitHub's public releases API, no account or token
 * (Vencord's CSP already allows api.github.com, it checks its own updates there). Once shortly after start,
 * then every 6 hours; off with the "Check for updates" setting. It only tells you; installing stays INSTALL.bat.
 */
import { showToast } from "@webpack/common";

import { settings } from "./settings";
import { REPO, VERSION } from "./version";

export interface UpdateInfo {
    version: string;
    url: string;
}

const FIRST_CHECK_MS = 15_000;
const EVERY_MS = 6 * 3600_000;

let latest: UpdateInfo | null = null;
const listeners = new Set<() => void>();

/** Flux-store-like, so components can follow it with useStoreTick. */
export const UpdateStore = {
    addChangeListener: (cb: () => void) => void listeners.add(cb),
    removeChangeListener: (cb: () => void) => void listeners.delete(cb),
    get: () => latest
};

/** True when version `a` (e.g. "1.14.0") is newer than `b`. */
export function isNewer(a: string, b: string) {
    const pa = a.split(".").map(n => parseInt(n, 10) || 0), pb = b.split(".").map(n => parseInt(n, 10) || 0);
    for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
        if ((pa[i] ?? 0) !== (pb[i] ?? 0)) return (pa[i] ?? 0) > (pb[i] ?? 0);
    }
    return false;
}

/** Ask GitHub for the newest release. Returns the update, null when up to date, or "error". */
export async function checkForUpdate(): Promise<UpdateInfo | null | "error"> {
    try {
        const res = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
            headers: { Accept: "application/vnd.github+json" }
        });
        if (!res.ok) throw new Error(`GitHub answered ${res.status}`);
        const data = await res.json();
        const version = String(data?.tag_name ?? "").replace(/^v/, "");
        const url = typeof data?.html_url === "string" && data.html_url.startsWith("https://github.com/")
            ? data.html_url
            : `https://github.com/${REPO}/releases/latest`;
        latest = version && isNewer(version, VERSION) ? { version, url } : null;
        listeners.forEach(cb => cb());
        return latest;
    } catch (e) {
        console.warn("[Discord+] update check failed", e);
        return "error";
    }
}

/** Toolbox action: check now and say the result. */
export async function checkForUpdateNow() {
    const result = await checkForUpdate();
    const text = result === "error" ? "Couldn't reach GitHub to check for Discord+ updates."
        : result ? `Discord+ v${result.version} is available (you have v${VERSION}).`
            : `Discord+ v${VERSION} is the newest version.`;
    try { showToast({ text, variant: result === "error" ? "critical" : result ? "default" : "success" }); } catch { }
    // A manual check brings back a version you skipped earlier.
    if (result && result !== "error" && settings.store.dismissedUpdate === result.version) settings.store.dismissedUpdate = "";
}

let first: ReturnType<typeof setTimeout> | undefined;
let every: ReturnType<typeof setInterval> | undefined;

export function startUpdateChecks() {
    stopUpdateChecks();
    if (!settings.store.checkUpdates) return;
    first = setTimeout(checkForUpdate, FIRST_CHECK_MS);
    every = setInterval(checkForUpdate, EVERY_MS);
}

export function stopUpdateChecks() {
    clearTimeout(first);
    clearInterval(every);
    first = every = undefined;
}

/** Turning the setting off hides the notice at once. */
export function clearUpdate() {
    latest = null;
    listeners.forEach(cb => cb());
}
