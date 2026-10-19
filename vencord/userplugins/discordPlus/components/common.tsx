/*
 * Discord+ Refined Dark — shared bits: avatar, floating-window behaviour.
 * SPDX-License-Identifier: CC-BY-NC-4.0
 */
import { useEffect, useRef } from "@webpack/common";

import { STATUS_LABEL, type Status } from "../data";
import { Placement, settings } from "../settings";
import { StatusIcon } from "./Icons";

export function Avatar({ src, name, status, size = 40, speaking }: {
    src: string | null;
    name: string;
    status?: Status | null;
    size?: number;
    speaking?: boolean;
}) {
    return (
        <span
            className={"dp-avatar" + (speaking ? " dp-speaking" : "")}
            style={{ width: size, height: size, fontSize: Math.round(size * 0.42) }}
        >
            {src
                ? <img src={src} alt="" loading="lazy" draggable={false} />
                : <span className="dp-avatar-fallback">{(name || "?").slice(0, 1).toUpperCase()}</span>}
            {status && (
                <span className={`dp-status dp-status-${status}`} role="img" aria-label={STATUS_LABEL[status]} title={STATUS_LABEL[status]}>
                    <StatusIcon status={status} size={Math.max(9, Math.round(size * 0.3))} />
                </span>
            )}
        </span>
    );
}

type PlacementKey = "dockPlacement" | "callPlacement";

function clamp(el: HTMLElement) {
    const r = el.getBoundingClientRect();
    const x = Math.max(0, Math.min(window.innerWidth - r.width, r.left));
    const y = Math.max(0, Math.min(window.innerHeight - r.height, r.top));
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    return { x, y, r };
}

/**
 * Makes `ref` a floating window: drag via `handleRef`, optional edge snapping,
 * clamped to the viewport, position (and size, if `resizable`) persisted in plugin settings.
 */
export function useFloating(
    ref: { current: HTMLElement | null; },
    handleRef: { current: HTMLElement | null; },
    key: PlacementKey,
    opts: { snap?: boolean; resizable?: boolean; enabled?: boolean; /** re-bind when the handle element changes */ mode?: unknown; } = {}
) {
    const snapRef = useRef(opts.snap);
    snapRef.current = opts.snap;

    useEffect(() => {
        const el = ref.current, handle = handleRef.current;
        if (!el || !handle || opts.enabled === false) return;

        const saved = settings.store[key];
        if (saved) {
            el.style.left = `${saved.x}px`;
            el.style.top = `${saved.y}px`;
            el.style.right = "auto";
            el.style.bottom = "auto";
            if (opts.resizable && saved.w) el.style.width = `${saved.w}px`;
            if (opts.resizable && saved.h) el.style.height = `${saved.h}px`;
            requestAnimationFrame(() => clamp(el));
        }

        const persist = () => {
            const r = el.getBoundingClientRect();
            const p: Placement = { x: Math.round(r.left), y: Math.round(r.top) };
            if (opts.resizable) { p.w = Math.round(r.width); p.h = Math.round(r.height); }
            settings.store[key] = p;
        };

        const onDown = (e: PointerEvent) => {
            if (e.button !== 0 || (e.target as Element).closest("button,input,a")) return;
            e.preventDefault();
            const start = el.getBoundingClientRect();
            const sx = e.clientX, sy = e.clientY;
            el.style.left = `${start.left}px`;
            el.style.top = `${start.top}px`;
            el.style.right = "auto";
            el.style.bottom = "auto";
            el.classList.add("dp-dragging");
            handle.setPointerCapture(e.pointerId);

            const move = (ev: PointerEvent) => {
                el.style.left = `${start.left + ev.clientX - sx}px`;
                el.style.top = `${start.top + ev.clientY - sy}px`;
                clamp(el);
            };
            const up = () => {
                handle.removeEventListener("pointermove", move);
                handle.removeEventListener("pointerup", up);
                handle.removeEventListener("pointercancel", up);
                el.classList.remove("dp-dragging");
                const { x, y, r } = clamp(el);
                if (snapRef.current) {
                    const SNAP = 24, M = 12;
                    if (x < SNAP) el.style.left = `${M}px`;
                    if (window.innerWidth - (x + r.width) < SNAP) el.style.left = `${window.innerWidth - r.width - M}px`;
                    if (y < SNAP) el.style.top = `${M}px`;
                    if (window.innerHeight - (y + r.height) < SNAP) el.style.top = `${window.innerHeight - r.height - M}px`;
                }
                persist();
            };
            handle.addEventListener("pointermove", move);
            handle.addEventListener("pointerup", up);
            handle.addEventListener("pointercancel", up);
        };

        const onResize = () => { if (el.style.left && el.style.left !== "auto") clamp(el); };
        handle.addEventListener("pointerdown", onDown);
        window.addEventListener("resize", onResize);

        // Persist user resizes (CSS `resize: both`) after they settle.
        let ro: ResizeObserver | undefined, timer: ReturnType<typeof setTimeout> | undefined;
        if (opts.resizable) {
            ro = new ResizeObserver(() => {
                clearTimeout(timer);
                timer = setTimeout(() => { if (el.style.left && el.style.left !== "auto") persist(); }, 400);
            });
            ro.observe(el);
        }

        return () => {
            handle.removeEventListener("pointerdown", onDown);
            window.removeEventListener("resize", onResize);
            ro?.disconnect();
            clearTimeout(timer);
        };
    }, [opts.enabled, opts.mode]);
}
