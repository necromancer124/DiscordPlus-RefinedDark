# Discord+ — Refined Dark design system v0.1

## Intent
Make the current Discord desktop interface feel like a premium, native, space-efficient Discord+, **not** a generic AI dashboard. The original reference image (a private screenshot, not published) is the key visual anchor; `screenshots/` shows the result. Preserve the leftmost server rail, use a compact horizontal header, remove redundant panels where technically safe, and make the central Friends grid the central homepage.

## Tokens
| Role | Token | Value |
|---|---|---|
| Base | `--bg` | `#101116` |
| Rail | `--rail` | `#0d0e13` |
| Surface | `--surface` | `#15161c` |
| Raised surface | `--surface2` | `#1b1c24` |
| Hover | `--hover` | `#252630` |
| Border | `--line` | `#292b35` |
| Text | `--text` | `#f1f1f5` |
| Secondary | `--secondary` | `#a1a3b2` |
| Muted | `--muted` | `#737685` |
| Accent | `--accent` | `#7478f8` |
| Online | `--green` | `#43b581` |
| Idle | `--yellow` | `#f0b74a` |
| DND / disconnect | `--red` | `#f04755` |
| Small radius | `--radius` | `11px` |
| Motion | `--duration` | `160ms` |

## Layout and geometry
- Server rail: 72px wide desktop / 56px on small viewports. Keep server icon semantics and notifications.
- Global header: 52px high in the plugin (64px in the preview), compact text + line icons, overflow menu on narrow widths.
- Central Friends view: responsive `auto-fill` cards, nominal 270px minimum (230px in Compact mode). Approximately 4 columns at 1440px wide.
- Friends cards: 103px high in Comfortable mode, compact ~75px, matte flat fill, hairline borders, avatar 38px, recent message preview.
- User dock: 60px minimum tall, draggable via explicit grip, stored locally.
- Call widget: 386px default width, resizable to 275px, participant grid 3→2→active remote speaker. Never highlight the local user as the selected remote speaker.
- Content uses 29px/34px comfortable top/side margins; tighter on narrow windows.

## Components
**ServerRail** native-looking vertical rail; **Header** compact global navigation; **FriendsGrid** non-masonry cards and filters; **Chat** traditional Discord message flow, no bubble-heavy messenger clone; **VoicePanel** functional controls in future real-client work, only simulated offline today; **UserDock** draggable, with visible mute/deafen/settings; **SettingsPanel** small functional settings, not a permanent sidebar.

## Visual rules
1. Mostly solid matte surfaces with subtle borders, no giant glass gradients.
2. Use violet as selected/active emphasis only; not every card.
3. Status colors convey actual state, not decoration.
4. Minimize whitespace but preserve readability; maintain hierarchy through type weight and contrast.
5. Icons share the same outline/round cap style, 17–18px, never random emoji placeholders in finished UI.
6. Transitions 120–200ms and reduced-motion support.
7. Floating widgets must serve real use cases and avoid obstructing chat composer / other controls.
8. Desktop readability: avoid body text smaller than 11px except dense metadata (10px).
9. Never hide native affordances until the replacement is tested and feature-complete.

## Accessibility expectations
Keyboard focus outlines, search inputs with labels, operable buttons, escape to dismiss dialogs, status badges with text where practical, responsive breakpoints and reduced-motion. Full ARIA and keyboard navigation validation remains on the roadmap.

## Fidelity and limitations
`preview/` represents the current visual prototype. The live Vencord theme currently changes selected colors only; it does NOT faithfully rebuild the layout yet. Any serious Discord refactor must be validated against actual Discord runtime internals.
