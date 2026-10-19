# DISCORD+ — Refined Dark
## Complete Visual Design and UI Overhaul Specification

### Role

You are an expert UI/UX designer and Discord client modification developer specializing in Vencord, React, TypeScript, CSS, desktop application design, and custom component development.

Your task is to create a custom Discord interface called **Discord+**, based directly on the attached reference image.

The reference image is the primary visual source of truth.

The objective is to make Discord look and feel like a professionally designed, premium version of its existing desktop application.

**Think of Discord+, not Discord reinvented.**

---

# 1. Design Identity

The interface must feel like an enhanced version of Discord that could plausibly have been designed by Discord's own product design team.

The overall style is:

- Premium Discord dark theme
- Matte charcoal backgrounds
- Subtle bluish-black surfaces
- Soft, restrained purple and indigo accents
- Compact, thoughtfully organized interface elements
- Carefully controlled spacing
- Slightly rounded cards and panels
- Minimal but meaningful shadows
- Clear typography
- Excellent visual hierarchy
- Consistent iconography
- A polished native desktop application aesthetic

The design should feel modern, sophisticated, and familiar without looking overly futuristic.

Take inspiration from Discord's existing visual language, premium desktop application design, and the restrained visual hierarchy of modern fintech interfaces such as HyperLend.

Use the attached reference image to establish the actual appearance, rather than interpreting these influences too loosely.

## Most important design principle

**Avoid generic AI-generated dashboard aesthetics.**

Specifically, avoid:

- Excessive glassmorphism
- Strong neon glows around every element
- Giant rounded rectangles
- Unnecessarily large cards
- Random gradients
- Oversized typography
- Excessive whitespace
- Decorative charts or meaningless statistics
- Floating panels without a functional purpose
- Repetitive pill-shaped controls everywhere
- Huge shadows and bright borders
- Background illustrations that distract from communication

Visual quality should come from alignment, proportions, typography, restrained colors, deliberate contrast, and component consistency.

Every UI element should look as though it belongs in Discord.

---

# 2. Color and Surface System

Use the reference image as the primary color reference.

Suggested starting palette:

| Element | Color |
|---|---|
| Application background | `#101116` |
| Primary content surface | `#15161C` |
| Sidebar background | `#111218` |
| Elevated panels | `#1B1C24` |
| Hovered surfaces | `#252630` |
| Primary text | `#F1F1F5` |
| Secondary text | `#A1A3B2` |
| Muted text | `#737685` |
| Borders | `#2A2B35` |
| Primary accent | `#7478F8` |
| Accent hover | `#898CFF` |
| Active status | `#43B581` |
| Idle status | `#F0B74A` |
| Danger/disconnect | `#F04755` |

These are starting design tokens, not an instruction to replace the colors visible in the reference indiscriminately.

## Surface treatment

Prefer solid matte surfaces with subtle tonal separation.

Use very thin borders and minimal elevation.

Floating elements may have slightly stronger shadows to distinguish them from the content behind them.

Avoid gradients except where they subtly improve depth or indicate a selected control.

Purple should function as an accent, not as the main background color.

---

# 3. Overall Application Layout

Follow the reference image closely.

The application should have five major elements:

1. Existing vertical Discord server rail on the far left
2. Custom horizontal navigation header across the top
3. Spacious central application area
4. Movable user-control dock
5. Optional floating voice-call manager

## Server sidebar

Preserve Discord's familiar vertical server rail.

Keep existing server icons, folders, unread indicators, server selection behavior, and server navigation.

Do not redesign these elements beyond minor visual refinements such as hover states or spacing.

## Horizontal header

Move the main navigation items into a compact top header.

The header contains:

- Friends
- Messages
- Message Requests
- Nitro
- Shop
- Family Centre
- Quests
- Search
- Relevant window and application controls

The selected item uses a subtle purple background or border treatment.

Icons should be simple, monochromatic, and consistent.

Avoid oversized buttons.

The header should be no taller than necessary and adapt to narrower windows through an overflow menu.

---

# 4. Friends Grid Design

The Friends grid is one of the most important features of Discord+.

Use the reference image's compact friend cards as the visual foundation.

## Card appearance

Every friend is represented by a low-profile rectangular card.

A friend card contains:

- Circular avatar on the left
- Username in medium-weight text
- Presence indicator attached to the avatar
- Short status or activity underneath
- Optional unread-message indicator
- Optional latest-message preview
- Context menu access

The cards should have:

- Dark matte surfaces
- Very subtle borders
- Approximately 10–12px corner radius
- Compact internal spacing
- Small, consistent avatars
- Restrained hover treatment

**Do not turn friends into oversized profile cards.**

The design should maximize information density without sacrificing readability.

## Grid behavior

Arrange friends in a responsive grid with approximately four columns on a typical desktop window, depending on available space.

All friends must remain accessible, including offline users.

Use All Friends as the default filter.

Provide compact sorting/filter controls for:

- All
- Online
- Recent
- Unread
- Favorites
- Pending and Blocked where appropriate

Users with unread DMs should receive a clear but subtle badge.

Recent messages should be visible where possible without increasing card height excessively.

Clicking a card opens the native Discord conversation.

Accessing profiles and context menus must preserve Discord's existing behavior.

## Visual hierarchy

Online friends should be distinguishable from offline friends primarily through their presence indicators and subtle text treatment.

Avoid making offline cards so transparent that their content becomes difficult to read.

The main Friends grid should occupy nearly all available horizontal space.

There should be no permanent right-side Active Now panel and no redundant DM list beside the grid.

---

# 5. Direct Message View

When opening a friend card, transition naturally into the conversation.

Preserve the horizontal application header and the far-left server rail.

Use the remaining horizontal space for the actual conversation.

The appearance should closely follow Discord's native message design, with minor refinements to:

- Padding
- Header spacing
- Text alignment
- Message grouping
- Input field appearance
- Attachment presentation
- Hover controls

Do not replace the entire conversation with large chat bubbles resembling a mobile messaging app.

Maintain Discord's recognizable desktop chat style.

Include convenient navigation back to the Friends grid and to Recent Conversations.

Group DMs and conversations with non-friends must remain accessible.

---

# 6. Floating Voice Call Manager

Use the floating voice-call panel in the reference image as the primary inspiration.

It should resemble a small native Discord window rather than a separate application.

## Visual design

The widget consists of:

**Header:**
- Voice channel or call name
- Participant count
- Optional call duration
- Minimize/expand controls

**Participant area:**
- Compact participant tiles
- Circular profile avatars
- Display names
- Microphone status indicators
- Active-speaker highlight

**Controls:**
- Mute
- Deafen
- Screen sharing where supported
- Disconnect
- Return to Call

The widget should have a matte charcoal background, thin borders, subtle shadow, and restrained rounded corners.

Use Discord's familiar red disconnect button.

## Behavior

The widget must be draggable and resizable.

When expanded, show as many participants as space allows.

When compact, prioritize the currently speaking remote participant.

Do not select the local user as the automatic focused speaker.

Allow clicking a participant to open the native Discord profile interface.

Support minimizing the widget into a single compact call-control bar.

The widget appears when the user navigates away from an active call and disappears when disconnected.

Never show both the full expanded call manager and the minimized call bar simultaneously as separate redundant controls.

Do not obstruct important message content or controls unnecessarily.

---

# 7. Movable User Dock

Recreate the compact floating user controls visible in the bottom-left of the reference.

The dock should contain:

- User avatar
- Username or abbreviated display name
- Presence indicator
- Microphone button
- Deafen button
- Settings button

The dock must be draggable, optionally snap to edges, and remember its position.

Maintain compact proportions and the same matte dark appearance as the rest of the application.

Do not use excessive shadows or glowing borders.

## Quests

Quests must remain accessible from the top header.

Remove intrusive permanent promotional panels.

If a quest shortcut or notification is displayed, it should be compact, dismissible, and visually consistent with the theme.

---

# 8. Typography and Iconography

Typography should be close to Discord's existing UI.

Use modern, readable sans-serif fonts.

Prioritize:

- Clear display names
- Readable message content
- Muted secondary descriptions
- Small but legible timestamps
- Consistent font weights

Avoid unnecessarily bold headings.

Use one consistent icon family aligned with Discord's native icon style.

Do not mix multiple unrelated icon styles.

Icons must be recognizable at small sizes.

---

# 9. Interaction and Animation

Discord+ should feel responsive and polished.

Use subtle, purposeful animations:

- Quick hover transitions
- Soft selection changes
- Smooth panel expansion
- Natural dock dragging
- Smooth resizing of the call widget
- Subtle speaking indicators
- Lightweight notification updates

Keep animation durations generally around 120–200ms for small interactions.

Avoid bouncing cards, exaggerated scaling, constant glowing effects, and decorative motion.

Offer reduced-motion support.

---

# 10. Design Consistency

Every part of the interface must belong to the same design system.

The Friends grid, header, user dock, settings panel, DM interface, and floating call manager must use consistent:

- Corner radii
- Spacing increments
- Border colors
- Text styles
- Icon sizes
- Hover states
- Elevation rules
- Accent treatments

Do not design each component independently with different visual conventions.

The interface must look like a coherent, native Discord redesign.

---

# 11. Technical Implementation

The design must ultimately be implemented as a modification of the existing Discord desktop client using Vencord and compatible custom plugins.

It must preserve the user's existing Discord account, friends, servers, messages, and voice functionality.

Do not create an independent Discord clone.

Use the actual existing Discord interface and its supported or discovered internal components where feasible.

The visual reference establishes the desired appearance, not proof that every feature is already technically supported.

Investigate each required modification before implementing it.

Separate CSS-based styling from features requiring React components, state subscriptions, or native Discord control integration.

Maintain modularity, reversibility, and compatibility wherever possible.

---

# 12. Reference Image Fidelity

**The attached reference image is mandatory.**

Before implementing the design, analyze its visual characteristics:

1. Overall proportions
2. Server rail width
3. Header height
4. Friend-card density
5. Card corner radii
6. Dark-surface hierarchy
7. Purple accent usage
8. Floating call panel styling
9. Compact user dock
10. Typography and spacing

Use those observations to establish design tokens and component specifications.

Do not substitute a completely different interpretation of "premium Discord."

The finished interface should look noticeably similar to the reference image while being cleaner, more consistent, and fully functional.

---

# 13. Required Deliverables

Provide:

1. A reusable `DESIGN.md` design system.
2. Theme CSS with configurable variables.
3. React/TypeScript components where necessary.
4. Complete Vencord integration files.
5. A configurable Friends grid.
6. The horizontal navigation header.
7. The movable user dock.
8. The floating voice-call manager.
9. Settings for appearance and layout.
10. Installation and build instructions.
11. Screenshots comparing the implementation against the reference.
12. A compatibility and functionality test report.

Start by reproducing the overall visual style and basic layout as faithfully as possible.

Then incrementally implement functionality without compromising the established appearance.

## Final Design Goal

Create **Discord+ — Refined Dark**.

A Discord desktop interface that feels familiar, efficient, elegant, carefully designed, and premium.

Not futuristic for the sake of looking futuristic.

Not a generic dashboard.

Not an AI-generated collection of floating cards.

**Just Discord, but substantially better.**
