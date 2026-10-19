/*
 * Discord+ Refined Dark — one icon family: 24px grid, 1.8 stroke, round caps.
 * SPDX-License-Identifier: CC-BY-NC-4.0
 */
import { useRef } from "@webpack/common";

const PATHS = {
    friends: "M16 19v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 17.5V19M10 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm10 8v-1.5a3.5 3.5 0 0 0-2.5-3.35M15.5 4.15a3.5 3.5 0 0 1 0 6.7",
    message: "M20 12a7.5 7.5 0 0 1-11 6.6L4.5 20l1.4-4.2A7.5 7.5 0 1 1 20 12Z",
    inbox: "M4 13h4l1.5 2.5h5L16 13h4M5.5 5h13L20 13v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-5l1.5-8Z",
    nitro: "M12 3.5 14.4 9l5.6.5-4.3 3.7 1.3 5.5L12 15.8l-5 2.9 1.3-5.5L4 9.5 9.6 9 12 3.5Z",
    shop: "M5 8h14l-1 11.5H6L5 8Zm4 0V6.5a3 3 0 0 1 6 0V8",
    family: "M12 20s-7-4.3-7-9.5A4 4 0 0 1 12 8a4 4 0 0 1 7 2.5C19 15.7 12 20 12 20Z",
    quests: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm3.5-12.5-2 5-5 2 2-5 5-2Z",
    search: "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14Zm9 2-4-4",
    mic: "M12 15a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3Zm6-3a6 6 0 0 1-12 0m6 6v3",
    micOff: "M15 10V6a3 3 0 0 0-5.7-1.3M9 9v3a3 3 0 0 0 4.6 2.5M18 12a6 6 0 0 1-.9 3.1M6 12a6 6 0 0 0 9.4 4.9M12 18v3M4 4l16 16",
    headphones: "M4 15v-3a8 8 0 0 1 16 0v3M4 15a2 2 0 0 1 2-2h1v6H6a2 2 0 0 1-2-2v-2Zm16 0a2 2 0 0 0-2-2h-1v6h1a2 2 0 0 0 2-2v-2Z",
    headphonesOff: "M4 15v-3a8 8 0 0 1 12.7-6.5M20 12v3M4 15a2 2 0 0 1 2-2h1v6H6a2 2 0 0 1-2-2v-2Zm16 0a2 2 0 0 0-2-2h-1v6h1a2 2 0 0 0 2-2v-2ZM4 4l16 16",
    settings: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm7.4-3a7.4 7.4 0 0 0-.1-1.3l2-1.5-2-3.4-2.3 1a7.5 7.5 0 0 0-2.2-1.3L14.5 3h-5l-.3 2.5A7.5 7.5 0 0 0 7 6.8l-2.3-1-2 3.4 2 1.5a7.4 7.4 0 0 0 0 2.6l-2 1.5 2 3.4 2.3-1a7.5 7.5 0 0 0 2.2 1.3l.3 2.5h5l.3-2.5a7.5 7.5 0 0 0 2.2-1.3l2.3 1 2-3.4-2-1.5c.1-.4.1-.9.1-1.3Z",
    hangup: "M3.5 13.5c4.7-4 12.3-4 17 0l-1.8 2.6-3.3-1.2v-2.4a12 12 0 0 0-6.8 0v2.4l-3.3 1.2-1.8-2.6Z",
    minimize: "M6 15l6-6 6 6",
    expand: "M6 9l6 6 6-6",
    more: "M12 6.5h.01M12 12h.01M12 17.5h.01",
    grip: "M9 6h.01M15 6h.01M9 12h.01M15 12h.01M9 18h.01M15 18h.01",
    star: "M12 4.5 14 9l4.8.4-3.6 3.2 1.1 4.8L12 15l-4.3 2.4 1.1-4.8-3.6-3.2L10 9l2-4.5Z",
    screen: "M4 5h16v11H4zM9 20h6M12 16v4",
    returnCall: "M9 14 4 9l5-5M4 9h10.5a5.5 5.5 0 0 1 0 11H11",
    classic: "M4 5h16v14H4zM9 5v14",
    plus: "M12 5v14M5 12h14",
    check: "M5 12.5l4.5 4.5L19 7",
    eyeOff: "M3 3l18 18M10.6 6.1A9.8 9.8 0 0 1 12 6c5 0 9 6 9 6a17 17 0 0 1-3 3.5M6.5 6.6C4.3 8 3 12 3 12s4 6 9 6a9 9 0 0 0 4.4-1.1M9.9 9.9a3 3 0 0 0 4.2 4.2",
    popout: "M14 4h6v6M20 4l-8 8M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5",
    close: "M6 6l12 12M18 6 6 18",
    speaker: "M5 9.5h3L12 6v12l-4-3.5H5v-5Zm11 0a3.5 3.5 0 0 1 0 5m2.5-8a7 7 0 0 1 0 11",
    sliders: "M5 7h9M18 7h1M5 17h1M10 17h9M14 5v4M6 15v4"
} as const;

export type IconName = keyof typeof PATHS;

let maskSeq = 0;

/**
 * Status icons (design/status-icons): each status has its own shape, not only its own colour.
 * Cut-outs are real transparency, so the ring colour behind the badge shows through.
 */
export function StatusIcon({ status, size = 12 }: { status: "online" | "streaming" | "mobile" | "idle" | "dnd" | "offline"; size?: number; }) {
    // Unique mask id per instance (several icons share one document).
    const id = useRef<string | null>(null);
    if (!id.current) id.current = `dp-status-${++maskSeq}`;
    const m = id.current;
    const cut = (shape: any) => (
        <defs>
            <mask id={m}>
                <rect width="16" height="16" fill="#fff" />
                {shape}
            </mask>
        </defs>
    );
    let body: any;
    switch (status) {
        case "idle":
            body = <>{cut(<circle cx="11.6" cy="4.4" r="5.2" fill="#000" />)}<circle cx="8" cy="8" r="7" fill="#f0b74a" mask={`url(#${m})`} /></>;
            break;
        case "dnd":
            body = <>{cut(<rect x="3.75" y="6.6" width="8.5" height="2.8" rx="1.4" fill="#000" />)}<circle cx="8" cy="8" r="7" fill="#f04755" mask={`url(#${m})`} /></>;
            break;
        case "offline":
            body = <circle cx="8" cy="8" r="5.4" fill="none" stroke="#80848e" strokeWidth={3.2} />;
            break;
        case "streaming":
            body = <>{cut(<path d="M6.3 4.9v6.2a.6.6 0 0 0 .9.5l4.9-3.1a.6.6 0 0 0 0-1L7.2 4.4a.6.6 0 0 0-.9.5Z" fill="#000" />)}<circle cx="8" cy="8" r="7" fill="#7478f8" mask={`url(#${m})`} /></>;
            break;
        case "mobile":
            body = <>{cut(<><rect x="5.6" y="3.4" width="4.8" height="7.6" rx=".8" fill="#000" /><circle cx="8" cy="12.7" r=".95" fill="#000" /></>)}<rect x="3.6" y="1" width="8.8" height="14" rx="2.6" fill="#43b581" mask={`url(#${m})`} /></>;
            break;
        default:
            body = <circle cx="8" cy="8" r="7" fill="#43b581" />;
    }
    return (
        <svg className="dp-status-icon" viewBox="0 0 16 16" width={size} height={size} aria-hidden="true">
            {body}
        </svg>
    );
}

export function Icon({ name, size = 18, className }: { name: IconName; size?: number; className?: string; }) {
    return (
        <svg
            className={"dp-icon" + (className ? " " + className : "")}
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
        >
            <path d={PATHS[name]} />
        </svg>
    );
}
