/*
 * Discord+ Refined Dark — finding Discord's layout regions and toggling Discord+ classes.
 * SPDX-License-Identifier: CC-BY-NC-4.0
 *
 * Discord's class names are hashed (e.g. `sidebar_c48ade`), so we match the stable prefix.
 * Every structural change is a class we add and remove ourselves: turning a feature off,
 * disabling the plugin, or a failed lookup always leaves Discord's native layout intact.
 */

/** Selector matching a Discord CSS-module class by its readable prefix. */
export const cls = (name: string, tag = "") => `${tag}[class^="${name}_"],${tag}[class*=" ${name}_"]`;

export const SEL = {
    rail: cls("guilds", "nav"),
    dmList: cls("privateChannels", "nav"),
    sidebar: cls("sidebar"),
    panels: cls("panels", "section")
};

/** Discord's quest promo card inside the bottom-left panel ("request" excluded: stage request-to-speak). */
export const QUEST_PROMO_SELECTOR = `${cls("panels", "section")
    .split(",").map(p => `${p} [class*="quest" i]:not([class*="request" i])`).join(",")}`;

/** Discord's picture-in-picture stream window. */
export const PIP_SELECTOR = cls("pictureInPictureWindow");

export const PUSHED_CLASS = "dp-pushed";
export const DM_COLUMN_CLASS = "dp-dm-column";
export const PANEL_HIDDEN_CLASS = "dp-panel-hidden";
export const HEADER_HEIGHT = 52;

export type RouteKind = "home" | "dm" | "guild" | "other";

export interface LayoutInfo {
    route: string;
    kind: RouteKind;
    /** Left edge of the content region (right edge of the server rail). */
    left: number;
    /** Top edge of the content region (below Discord's title bar). */
    top: number;
    /** Whether the global header could push Discord's content down safely. */
    canPush: boolean;
}

export function routeKind(path: string): RouteKind {
    if (/^\/channels\/@me\/?$/.test(path)) return "home";
    if (/^\/channels\/@me\/[^/]+/.test(path)) return "dm";
    if (/^\/channels\/\d+/.test(path)) return "guild";
    return "other";
}

/** The element holding Discord's sidebar + page (and, in some Discord versions, the server rail). */
function findRegion(): HTMLElement | null {
    const sidebar = document.querySelector<HTMLElement>(SEL.sidebar);
    const region = sidebar?.parentElement;
    if (!region || region === document.body) return null;
    return region;
}

/**
 * The parts of `el` that don't contain the server rail. In current Discord the rail can sit inside the
 * same container as the channel/DM list (and even inside a `sidebar_` element), so we descend into any
 * element holding the rail and only ever touch its other children. The rail itself is never returned.
 */
function partsWithoutRail(el: Element, rail: Element | null): HTMLElement[] {
    if (el === rail) return [];
    if (!rail || !el.contains(rail)) {
        return el instanceof HTMLElement && !el.matches(SEL.panels) ? [el] : [];
    }
    return [...el.children].flatMap(child => partsWithoutRail(child, rail));
}

/** The elements to move below our header: everything in the region except the server rail (and the user panel). */
function findPushTargets(): HTMLElement[] {
    const region = findRegion();
    if (!region) return [];
    return partsWithoutRail(region, document.querySelector(SEL.rail));
}

/**
 * The Friends / DM column: the highest ancestor of the DM list that does NOT contain the server rail.
 * Returns null unless the rail is found, so hiding can never take the server list with it.
 */
function findDmColumn(): HTMLElement | null {
    const rail = document.querySelector(SEL.rail);
    const dm = document.querySelector<HTMLElement>(SEL.dmList);
    if (!rail || !dm || dm.contains(rail) || rail.contains(dm)) return null;
    let col: HTMLElement = dm;
    while (col.parentElement && col.parentElement !== document.body && !col.parentElement.contains(rail))
        col = col.parentElement;
    return col;
}

/** Mark (or unmark) the DM column so CSS can hide it. Idempotent; re-applied periodically like the push. */
export function setDmColumnHidden(on: boolean) {
    const col = on ? findDmColumn() : null;
    document.querySelectorAll(`.${DM_COLUMN_CLASS}`).forEach(el => { if (el !== col) el.classList.remove(DM_COLUMN_CLASS); });
    col?.classList.add(DM_COLUMN_CLASS);
}

export function measure(): LayoutInfo {
    const route = location.pathname;
    const rail = document.querySelector<HTMLElement>(SEL.rail);
    const railRect = rail?.getBoundingClientRect();
    const region = findRegion();
    const regionRect = region?.getBoundingClientRect();

    const left = railRect && railRect.width > 0 ? Math.round(railRect.right) : 72;
    const top = Math.round(regionRect?.top ?? railRect?.top ?? 0);
    return { route, kind: routeKind(route), left, top, canPush: findPushTargets().length > 0 };
}

/**
 * Apply or remove the header push. Idempotent and cheap, so it is re-applied periodically:
 * Discord re-renders its elements (and their className) at any time.
 */
export function setPushed(on: boolean) {
    const targets = on ? findPushTargets() : [];
    document.querySelectorAll(`.${PUSHED_CLASS}`).forEach(el => {
        if (!targets.includes(el as HTMLElement)) el.classList.remove(PUSHED_CLASS);
    });
    targets.forEach(el => el.classList.add(PUSHED_CLASS));
    return targets.length > 0;
}

export function setBodyClass(name: string, on: boolean) {
    document.body.classList.toggle(name, on);
}

const QUEST_IN = '[class*="quest" i]:not([class*="request" i])';
/** The voice-connection section has Discord's Disconnect button; it is always kept. */
const isCallPart = (el: Element) => !!el.querySelector('[aria-label*="disconnect" i]');
/** The user row (avatar, name, mute, deafen, settings) has the User Settings button. */
const isUserPart = (el: Element) => !!el.querySelector('[aria-label*="user settings" i]');
const isQuestPart = (el: Element) => el.matches(QUEST_IN) || !!el.querySelector(QUEST_IN);

/**
 * Tidy Discord's bottom-left panel by removing whole sections (not just their content, which left empty
 * boxes behind): the quest card, and the user row when the header shows your controls. The voice
 * connection section is always kept. Sections that hold several kinds are split one level deeper.
 */
export function tidyPanels(hideUser: boolean, hideQuest: boolean) {
    const hide = new Set<Element>();
    const section = document.querySelector(SEL.panels);
    const walk = (el: Element, depth: number) => {
        for (const child of el.children) {
            const call = isCallPart(child), user = hideUser && isUserPart(child), quest = hideQuest && isQuestPart(child);
            if (call && (user || quest)) {
                if (depth < 6) walk(child, depth + 1);
            } else if (user || quest) {
                hide.add(child);
            } else if (!call && child.children.length === 1 && depth < 6) {
                walk(child, depth + 1);
            }
        }
    };
    if (section && (hideUser || hideQuest)) walk(section, 0);
    document.querySelectorAll(`.${PANEL_HIDDEN_CLASS}`).forEach(el => { if (!hide.has(el)) el.classList.remove(PANEL_HIDDEN_CLASS); });
    hide.forEach(el => el.classList.add(PANEL_HIDDEN_CLASS));
}

/** Remove every trace of Discord+ from Discord's DOM. Called on plugin stop. */
export function cleanupDom() {
    document.querySelectorAll(`.${PUSHED_CLASS}, .${DM_COLUMN_CLASS}, .${PANEL_HIDDEN_CLASS}`)
        .forEach(el => el.classList.remove(PUSHED_CLASS, DM_COLUMN_CLASS, PANEL_HIDDEN_CLASS));
    [...document.body.classList].filter(c => c.startsWith("dp-")).forEach(c => document.body.classList.remove(c));
    document.body.style.removeProperty("--dp-accent");
    document.body.style.removeProperty("--dp-header-h");
    for (const v of ["--dp-pip-x", "--dp-pip-y", "--dp-pip-scale"]) document.body.style.removeProperty(v);
}
