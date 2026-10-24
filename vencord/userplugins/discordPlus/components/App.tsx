/*
 * Discord+ Refined Dark — root component rendered into its own React root on document.body.
 * SPDX-License-Identifier: CC-BY-NC-4.0
 */
import ErrorBoundary from "@components/ErrorBoundary";
import { useEffect, useState } from "@webpack/common";

import { HEADER_HEIGHT, LayoutInfo, markNativeToolbar, measure, setBodyClass, setDmColumnHidden, setPushed, tidyPanels } from "../layout";
import { go, ROUTES } from "../discordApi";
import { settings } from "../settings";
import { clearUpdate, startUpdateChecks, stopUpdateChecks } from "../updates";
import { CallManager } from "./CallManager";
import { Header, HomePage } from "./Header";
import { Home } from "./Home";
import { Icon } from "./Icons";
import { UserDock } from "./UserDock";

// Each feature has its own boundary: if one breaks after a Discord update it renders nothing,
// its effects clean up, and the native UI it replaced comes back. The rest keeps working.
const SafeHeader = ErrorBoundary.wrap(Header, { noop: true });
const SafeHome = ErrorBoundary.wrap(Home, { noop: true });
const SafeDock = ErrorBoundary.wrap(UserDock, { noop: true });
const SafeCall = ErrorBoundary.wrap(CallManager, { noop: true });
// Declared below; a function declaration is hoisted, so wrapping it here is fine.
const SafeClassicBar = ErrorBoundary.wrap(ClassicBar, { noop: true });

const ANIMATIONS = ["wave", "pop", "slide", "flip", "fade", "off"];
const SPEEDS = ["normal", "fast", "slow"];

function useLayout(): LayoutInfo {
    const [info, setInfo] = useState<LayoutInfo>(measure);
    useEffect(() => {
        // Discord's router doesn't emit an event we can rely on across versions; a cheap
        // check every 300ms plus resize/popstate keeps us in sync.
        const update = () => setInfo(prev => {
            const next = measure();
            return prev.route === next.route && prev.left === next.left && prev.top === next.top && prev.canPush === next.canPush ? prev : next;
        });
        const t = setInterval(update, 300);
        window.addEventListener("resize", update);
        window.addEventListener("popstate", update);
        return () => {
            clearInterval(t);
            window.removeEventListener("resize", update);
            window.removeEventListener("popstate", update);
        };
    }, []);
    return info;
}

/**
 * Discord's own Friends page (opened by Add Friend or the header's classic button) loses its native toolbar;
 * this bar takes its exact place with a single way back to Discord+ Home.
 */
function ClassicBar({ onBack }: { onBack(): void; }) {
    const [rect, setRect] = useState<DOMRect | null>(null);
    useEffect(() => {
        const update = () => setRect(prev => {
            const r = markNativeToolbar(true)?.getBoundingClientRect() ?? null;
            return prev && r && prev.top === r.top && prev.left === r.left && prev.width === r.width && prev.height === r.height ? prev : r;
        });
        update();
        const t = setInterval(update, 300);
        return () => { clearInterval(t); markNativeToolbar(false); };
    }, []);
    if (!rect) return null;
    return (
        <div className="dp-classic-bar" style={{ top: rect.top, left: rect.left, width: rect.width, height: rect.height }}>
            <button type="button" className="dp-classic-back" onClick={onBack}>
                <Icon name="back" size={18} />
                Back to Friends
            </button>
        </div>
    );
}

function QuestChip() {
    return (
        <div className="dp-quest-chip">
            <button type="button" className="dp-quest-open" onClick={() => go(ROUTES.quests)}>
                <Icon name="quests" />
                <span><strong>Quests</strong><small>See active quests</small></span>
            </button>
            <button type="button" className="dp-icon-btn" aria-label="Dismiss" onClick={() => { settings.store.showQuestChip = false; }}>
                <Icon name="close" size={14} />
            </button>
        </div>
    );
}

export function App() {
    const s = settings.use([
        "homeOverlay", "globalHeader", "fullWidthDms", "floatingDock", "callManager", "hideNativeUserPanel",
        "applyTheme", "accent", "reduceMotion", "showQuestChip", "hideDmColumn", "headerUserControls", "hideQuestPromo", "hideActiveNow", "animation", "animationSpeed", "checkUpdates"
    ]);
    const layout = useLayout();
    const [page, setPage] = useState<HomePage>("friends");
    const [query, setQuery] = useState("");
    const [classic, setClassic] = useState(false);
    const [dockActive, setDockActive] = useState(false);
    // Set when the call window is shown from the header while inside the call's own server.
    const [forceShowCall, setForceShowCall] = useState(false);
    // The header slides in only right after Discord+ starts, not every time it reappears.
    const [intro, setIntro] = useState(true);
    useEffect(() => { const t = setTimeout(() => setIntro(false), 1500); return () => clearTimeout(t); }, []);

    const onHome = layout.kind === "home";
    const showHome = s.homeOverlay && onHome && !classic;
    // The header is always part of Discord+ home (and stays in classic view so you can switch back);
    // elsewhere it's only shown if we can push Discord's content down below it.
    const showHeader = showHome || (onHome && classic) || (s.globalHeader && layout.canPush);
    // Discord's native content always moves below the header, also under Discord+ Home: with a transparent
    // theme nothing native may sit behind the header or the Home overlay.
    const pushNative = showHeader;
    // The Friends / DM column only goes away while the header (with your user controls) replaces it.
    const hideDmColumn = s.hideDmColumn && showHeader && s.headerUserControls;
    // Outside servers the native user/voice panel is redundant: header has your controls, the call manager has the call.
    const hideMePanel = hideDmColumn && layout.kind !== "guild" && s.callManager;

    useEffect(() => { if (!onHome) setClassic(false); }, [onHome]);

    // Update check runs while Discord+ runs and the setting is on.
    useEffect(() => {
        if (!s.checkUpdates) { clearUpdate(); return; }
        startUpdateChecks();
        return stopUpdateChecks;
    }, [s.checkUpdates]);

    // Header push (moves Discord's sidebar + page below our header). Re-applied periodically
    // because Discord re-creates those elements and rewrites their className when it re-renders.
    useEffect(() => {
        const apply = () => {
            setPushed(pushNative);
            setDmColumnHidden(hideDmColumn || (s.fullWidthDms && dockActive && layout.kind === "dm"));
            tidyPanels(showHeader && s.headerUserControls, s.hideQuestPromo);
        };
        apply();
        const t = setInterval(apply, 500);
        return () => {
            clearInterval(t);
            setPushed(false);
            setDmColumnHidden(false);
            tidyPanels(false, false);
        };
    }, [pushNative, hideDmColumn, s.fullWidthDms, dockActive, layout.kind, layout.route, showHeader, s.headerUserControls, s.hideQuestPromo]);

    useEffect(() => {
        // With "Apply theme" off the accent comes from the user's theme (--brand-500, see style.css).
        const accent = /^#[\da-f]{6}$/i.test(s.accent) ? s.accent : "#7478f8";
        if (s.applyTheme) document.body.style.setProperty("--dp-accent", accent);
        else document.body.style.removeProperty("--dp-accent");
        document.body.style.setProperty("--dp-header-h", `${HEADER_HEIGHT}px`);
        setBodyClass("dp-theme", s.applyTheme);
        setBodyClass("dp-reduce-motion", s.reduceMotion);
        setBodyClass("dp-home-active", showHome);
        setBodyClass("dp-hide-dm-sidebar", s.fullWidthDms && dockActive && layout.kind === "dm");
        setBodyClass("dp-hide-native-panel", (s.hideNativeUserPanel && dockActive && s.callManager) || hideMePanel);
        setBodyClass("dp-hide-dm-column", hideDmColumn);
        setBodyClass("dp-hide-quest-promo", s.hideQuestPromo);
        setBodyClass("dp-hide-active-now", s.hideActiveNow);
        for (const a of ANIMATIONS) setBodyClass(`dp-anim-${a}`, s.animation === a);
        for (const sp of SPEEDS) setBodyClass(`dp-anim-speed-${sp}`, s.animationSpeed === sp);
        setBodyClass("dp-intro", intro);
        setBodyClass("dp-header-active", showHeader);
    }, [s.accent, s.applyTheme, s.reduceMotion, showHome, s.fullWidthDms, s.hideNativeUserPanel, s.callManager, dockActive, layout.kind, hideDmColumn, hideMePanel, s.hideQuestPromo, s.hideActiveNow, s.animation, s.animationSpeed, intro, showHeader]);

    useEffect(() => () => {
        for (const c of ["dp-theme", "dp-reduce-motion", "dp-home-active", "dp-hide-dm-sidebar", "dp-hide-native-panel", "dp-hide-dm-column", "dp-hide-quest-promo", "dp-hide-active-now", "dp-header-active", "dp-intro",
            ...ANIMATIONS.map(a => `dp-anim-${a}`), ...SPEEDS.map(sp => `dp-anim-speed-${sp}`)])
            setBodyClass(c, false);
    }, []);

    const homeTop = layout.top + HEADER_HEIGHT;

    return (
        <>
            {showHeader && (
                <SafeHeader
                    layout={layout}
                    page={page}
                    setPage={setPage}
                    query={query}
                    setQuery={setQuery}
                    classic={classic}
                    setClassic={setClassic}
                    forceShowCall={forceShowCall}
                    setForceShowCall={setForceShowCall}
                />
            )}
            {showHome && (
                <SafeHome left={layout.left} top={homeTop} page={page} query={query} showClassic={() => setClassic(true)} />
            )}
            {onHome && classic && <SafeClassicBar onBack={() => setClassic(false)} />}
            {s.floatingDock && <SafeDock onMounted={setDockActive} />}
            {s.callManager && <SafeCall route={layout.route} forceShow={forceShowCall} />}
            {s.showQuestChip && <QuestChip />}
        </>
    );
}
