# DESIGN.md — Talent Scout UI

> Read this file before building any UI. The tokens here are the visual contract. If you need a new color, size, or radius, add it here first.
> Labels: **[src]** means the value is taken directly from the Refero reference. **[adapted]** means the value was adjusted for Talent Scout's needs (accessibility, node status, dense dashboard), and the reason is written down.

## 1. Chosen Style: **Relate** — "cool dawn over product canvas"

- Source: https://styles.refero.design/style/337ade6a-4bae-49ba-b4aa-8994ac805a81 (original site: https://www.relate.so)
- Reference assets (in the repo): `docs/design-refs/`
  - `relate-preview.jpg`: main screenshot (1440×900)
  - `relate-og.jpg`: main image of the Refero page
  - `relate-preview-video-poster.jpg`, `relate-detail-video-poster.jpg`: preview video posters
  - `relate-DESIGN.source.md`: the original DESIGN.md from Refero (the "Download DESIGN.md" button), unmodified
  - `relate-tokens.source.css`: the original CSS variables + Tailwind v4 `@theme` block from Refero, unmodified
  - The preview videos (`relate-preview.mp4`, `relate-detail.mp4`, ±5 MB) are **not** committed. They are kept in the master folder: `talent-scout/design-refs/relate-videos/`

**Why Relate:**
1. **It's product UI, not a marketing page.** CRM pipeline/deal cards, compact density (8–12px gaps, 12px card padding), and hairline borders fit dense applicant tables and session reviews. A CRM pipeline also resembles a recruiting pipeline.
2. **It already has a built-in status palette.** The *Status Dot* component uses blue/orange/green/red (`#3b82f6`/`#ffa64d`/`#16ca2e`/`#f26052`), so it maps directly onto graph node statuses (running/retry/passed/failed) without inventing a new palette.
3. **Free fonts and high contrast.** One family, Inter, plus Roboto Mono, both free. Body text `#14141e` on `#fcfcfc` gives 17.8:1 contrast. A single blue accent `#145aff` feels calm and trustworthy, which also suits the applicant chat page.

**Why not the others:**
- **Seline Analytics:** calm and editorial, but its rules forbid any accent color beyond the single accent. That clashes directly with the node status colors (green/red/orange). Its main font (Roobert) is paid.
- **Column:** feels institutional and trustworthy, but it's a fintech-landing language with many decorative colors. Its font (SuisseIntl) is paid and too heavy for a dashboard built in 1 week.
- **Calendly:** runner-up for the applicant pages because of its calm feel. But its font (Gilroy) is paid, the headings are oversized marketing style, it has decorative blobs, and there's no status palette.
- Previews of all three are in the master folder, not in the repo: `talent-scout/design-refs/` (`1-seline-analytics.jpg`, `2-column.jpg`, `4-calendly.jpg`).

## 2. Design Tokens

### 2.1 Colors

| Token (Tailwind) | Hex | Role | Origin |
|---|---|---|---|
| `canvas` | `#fcfcfc` | Page background | [src] Snow Canvas |
| `wash` | `#f0f4fe` | Soft background band (session header, graph area) | [src] Lavender Wash |
| `card` | `#ffffff` | Cards, tables, panels | [src] Surface Card |
| `subtle` | `#f1f5f9` | Input background, disabled, row groups, table zebra | [src] Fog Surface |
| `line` | `#e2e8f0` | Hairline borders, dividers | [src] Stone Divider |
| `ink` | `#020520` | Headings | [src] Midnight Ink |
| `body` | `#14141e` | Body text, UI labels | [src] Graphite Body |
| `muted` | `#374151` | Secondary text, nav, table headers | [src] Slate Caption |
| `helper` | `#6b7280` | Metadata, timestamps, placeholders. Only on `card`/`canvas` (4.83:1 and 4.71:1). On `wash`/`subtle` use `muted` (`helper` is 4.39:1 and 4.41:1 there, which fails AA) | [src] Ash Helper |
| `brand` | `#145aff` | Single accent: links, primary button, running node, highlight (5.34:1 on white) | [src] Royal Signal |
| `brand-soft` | `#3b82f6` | Decorative wash/glow, "potential" dot. **Not for text** (3.68:1) | [src] Cobalt Glow |
| `focus` | `#0099ff` | Focus ring | [src] Azure Focus |
| `success` | `#16ca2e` | "passed" dot, border. **Not for text or icons** (2.21:1) | [src] Mint Win |
| `danger` | `#f26052` | "failed" dot, border. **Not for small text or icons** (3.20:1) | [src] Coral Lost |
| `warning` | `#ffa64d` | "retry" dot, border. **Not for text or icons** (1.94:1) | [src] Amber Pending |
| `success-text` | `#15803d` | Success status text, labels, icons (5.02:1) | [adapted]: Mint Win fails AA for text |
| `danger-text` | `#b91c1c` | Error text, failed labels, icons (6.47:1) | [adapted]: Coral Lost fails AA for text |
| `warning-text` | `#b45309` | retry/needs_manual label text, icons (5.02:1) | [adapted]: Amber Pending fails AA for text |
| status tint | status color @ 10% opacity (`bg-success/10`, etc.) | Badge/node background, always over an opaque `card` base (`warning-text` is 4.70:1 there, but 4.30:1 directly over `wash`) | [adapted] |

All contrast ratios use the WCAG 2.x formula, against `#ffffff` unless another background is named.

### 2.2 Graph Node Status Colors & Domain Statuses

| Status | Used for | Border/dot | Fill | Text label | Icon (lucide) | Effect |
|---|---|---|---|---|---|---|
| **idle** (`pending`) | node not yet run | `line` | `card` | `helper` "Idle" | `circle` | — |
| **running** | node `running` | `brand` 2px | `wash` | `brand` "Running" | `loader` (spin) | glow `shadow-glow` [src xl-2]; `animate-pulse` disabled under `prefers-reduced-motion` |
| **passed** (`succeeded`, `check.passed`) | node finished/valid | `success` | `success/10` | `success-text` "Passed" | `check` | — |
| **failed** (`failed`, `check.failed`) | node failed | `danger` | `danger/10` | `danger-text` "Failed" | `x` | — |
| **retry** (`loop.retry`) | node retried | `warning` 2px dashed | `warning/10` | `warning-text` "Retry 2/3" | `rotate-ccw` | attempt badge in the corner |
| **skipped** | node `skipped` | `helper` 1px dashed | `subtle` | `muted` "Skipped" | `minus` | No opacity on the label (`helper` on `subtle` fails AA). [adapted 2026-11-11]: a `line` dashed border on `subtle` vanishes on the `wash` canvas |

The color-to-status mapping above is [adapted], derived from the *Status Dot* component [src]. Domain statuses use the same scheme:
- Application: `review`, `in_session` = brand; `shortlisted` = success; `rejected`, `failed` = danger; `scoring` = warning; `applied`, `invited` = idle.
- Score `needs_manual` = warning.

**Statuses must never be distinguished by color alone.** Every status must have an icon + a text label. Status icons use the `-text` variant of their color (`brand` for running). Borders and dots may use the lighter colors because the icon and label carry the meaning.

### 2.3 Typography

- Sans: **Inter** [src] (400/500/600, never above 600). Load via `@fontsource-variable/inter`.
- Mono: **Roboto Mono** [src] for IDs, model names, token counts, cost, and event `seq`. The reference only has 500/700. Sizes 12–14px for UI [adapted] (reference: 12px and 22px). Load weight 500 via `@fontsource/roboto-mono`.
- Pretendard and Font Awesome, detected in the reference, are **not used**. Icons use `@lucide/svelte` (the Svelte 5 package) [adapted].

| Token | Size / line-height / tracking | Weight | Used for | Origin |
|---|---|---|---|---|
| `text-caption` | 12px / 1.2 → **1.5** | 400–500 | metadata, uppercase table headers, badges | [src] size; line-height [adapted] for readability |
| `text-body-sm` | 14px / 1.43 / 0 | 400 | default dashboard text, table cells | [src] |
| `text-base` | 16px / 1.63 | 400 | chat bubbles, transcript, applicant form | [src] |
| `text-subheading` | 20px / 1.4 / -0.16px | 500–600 | card/section titles | [src] |
| `text-heading-sm` | 22px / 1.4 / -0.2px | 600 | dashboard page titles | [src] |
| `text-heading` | 40px / 1.05 / -1.48px | 600 | applicant intro & thank-you screen titles, landing | [src] |
| `text-heading-lg` 56px, `text-display` 80px | — | 600 | only the `/` landing (optional) | [src] |

### 2.4 Spacing, Radius, Shadow

- **Spacing:** 4px base, using Tailwind's default scale (`--spacing: 4px`). Values used: 4, 8, 12, 16, 20, 24, 32, 40, 52, 72 [src]. The odd 9/11 values from the reference are ignored [adapted]. Element gap 8–12px, dashboard card padding 12–16px, section gap 32px on the dashboard [adapted; reference landing 80px], content max-width 1200px [src].
- **Radius** [src]:
  - `rounded-card` 8px: inner cards, rows, ScoreCard
  - `rounded-panel` 16px: main panels/containers, graph nodes
  - `rounded-input` 12px
  - `rounded-full`: buttons, badges, tags
  - No 0px corners.
- **Shadow** [src]:

| Token | Value | Used for |
|---|---|---|
| `shadow-card` | `rgba(0,0,0,0.1) 0px 0px 4px -2px` | cards, idle nodes |
| `shadow-card-strong` | `rgba(0,0,0,0.25) 0px 0px 4px -2px` | card hover |
| `shadow-brand-sm` | `rgba(20,90,255,0.3) 0px 0px 4px -2px` | selected active element |
| `shadow-glow` | `rgba(20,90,255,0.1) 0px 0px 50px -28px, rgba(0,0,0,0.18) 0px 0px 3px -1px` | running node, chat panel |
| `shadow-panel` | `rgba(0,0,0,0.082) 0px 0.36px 1.8px -1.4px, rgba(0,0,0,0.07) 0px 1.37px 6.87px -2.8px, rgba(0,0,0,0.016) 0px 6px 30px -4.25px` | large panels (max 1 per screen) |

### 2.5 Tailwind v4 Theme (contract, in `src/app.css`)

```css
@import "tailwindcss";
@theme {
  --font-sans: "Inter Variable", ui-sans-serif, system-ui, sans-serif;
  --font-mono: "Roboto Mono", ui-monospace, SFMono-Regular, Menlo, monospace;

  --color-canvas: #fcfcfc;   --color-wash: #f0f4fe;   --color-card: #ffffff;
  --color-subtle: #f1f5f9;   --color-line: #e2e8f0;
  --color-ink: #020520;      --color-body: #14141e;   --color-muted: #374151;  --color-helper: #6b7280;
  --color-brand: #145aff;    --color-brand-soft: #3b82f6;  --color-focus: #0099ff;
  --color-success: #16ca2e;  --color-danger: #f26052; --color-warning: #ffa64d;
  --color-success-text: #15803d; --color-danger-text: #b91c1c; --color-warning-text: #b45309; /* adapted */

  --text-caption: 12px;    --text-caption--line-height: 1.5;
  --text-body-sm: 14px;    --text-body-sm--line-height: 1.43;
  --text-base: 16px;       --text-base--line-height: 1.63;
  --text-subheading: 20px; --text-subheading--line-height: 1.4; --text-subheading--letter-spacing: -0.16px;
  --text-heading-sm: 22px; --text-heading-sm--line-height: 1.4; --text-heading-sm--letter-spacing: -0.2px;
  --text-heading: 40px;    --text-heading--line-height: 1.05;   --text-heading--letter-spacing: -1.48px;

  --radius-card: 8px; --radius-input: 12px; --radius-panel: 16px;

  --shadow-card: rgba(0,0,0,0.1) 0px 0px 4px -2px;
  --shadow-card-strong: rgba(0,0,0,0.25) 0px 0px 4px -2px;
  --shadow-brand-sm: rgba(20,90,255,0.3) 0px 0px 4px -2px;
  --shadow-glow: rgba(20,90,255,0.1) 0px 0px 50px -28px, rgba(0,0,0,0.18) 0px 0px 3px -1px;
  --shadow-panel: rgba(0,0,0,0.082) 0px 0.36px 1.8px -1.4px, rgba(0,0,0,0.07) 0px 1.37px 6.87px -2.8px, rgba(0,0,0,0.016) 0px 6px 30px -4.25px;
}
```

Don't use Tailwind's default palette colors (`blue-500`, `gray-*`, etc.) in components. Use only the tokens above. The only exception is `ring-focus`.

The 16px size token is `text-base`, not `text-body`: `text-body` is the color from `--color-body`, and with both tokens Tailwind v4 emits only the color, silently dropping the size.

## 3. Components

- **Button.** All buttons are pills (`rounded-full`), 14px/500, 36px high (`px-4`) [adapted from the reference's 14px 32px padding, made more compact for the dashboard].
  - **Primary:** `brand` fill, white text (5.34:1). [adapted] The Refero tokens say "ghost/frosted, not filled", but the `relate-preview.jpg` screenshot shows a filled blue "Get started free" nav button. Filled was chosen for clarity of the main action. At most 1 per screen.
  - **Secondary/ghost:** `card` + 1px `brand` border + `brand` text [src Ghost Outline Button].
  - **Neutral:** `card` + `line` border + `body` text.
  - **Destructive** (Reject): `danger` border + `danger-text` text, no fill.
  - Disabled: `subtle` + `helper` text.
  - Loading: spinner + the label stays.
- **Input/Textarea/File.** `card`, 1px `line` border, `rounded-input` 12px, 12–15px padding [src 15px], `helper` placeholder.
  - Focus: `ring-2 ring-focus` [src glow].
  - Error: `danger` border, 12px `danger-text` message below, `aria-describedby`.
  - The label is always visible above the field. Placeholders are never used as labels.
- **Table** (jobs, applicants). `card` + `line` border + `rounded-panel`.
  - Header: uppercase `caption` in `muted` on `subtle`. Rows: 44px high, `body-sm` text, `line` divider, `wash` hover.
  - Numeric columns (score, cost) right-aligned, mono font. Statuses use badges.
  - The empty state lives inside the table.
- **Chat bubble.**
  - AI: left, `card` + `line` border, `rounded-panel` (top-left corner 4px).
  - Applicant: right, `wash` fill, `body` text.
  - Text `text-base` 16px, max-width 75ch [adapted].
  - Streaming: a blinking caret at the end. An "AI is typing" indicator with `aria-live="polite"`.
- **ScoreCard + EvidenceQuote.** `rounded-card` card, 16px padding.
  - Header: criterion label (`subheading` 20px) + a large `3/5` score (mono, `ink`) + a 5-segment `brand` bar.
  - Rationale `body-sm` `muted`.
  - Evidence: a `<blockquote>` with a 2px `brand` left border, `wash` fill, `body` text, no italics [adapted, for readability], ending with a "Jump to message →" link. When clicked, it scrolls to the message and highlights it (`bg-warning/10`, `warning` outline for 2 seconds).
  - `needs_manual`: warning badge "Needs manual review", the score is replaced by "—".
- **Graph node** (`@xyflow/svelte` custom node). 200×64px, `rounded-panel` 16px, 1px border, `shadow-card`.
  - Content: status icon + node name (`body-sm` 600) + type (`caption` `muted`: splitter/worker/gate/code/human gate) + model (mono 12px, truncated). Type text is `muted`, not `helper`, because `helper` fails AA on the tinted node fills [adapted 2026-11-11].
  - Colors per §2.2. Code nodes are distinguished by a thin dashed border and a `code` icon. The human gate uses the `user-check` icon.
- **Graph edge.**
  - Default (not taken yet): `helper` 1.5px. `line` is 1.1:1 on `wash` and disappears [adapted 2026-11-11].
  - Taken: `brand-soft` 2px at full strength. At 50% it would be lighter than an untaken edge [adapted 2026-11-11].
  - The latest `edge.traversed`: `brand` 2.5px with the 600ms dash animation (off under reduced motion).
  - Retry paths (`invalid`, both `retry` edges): dashed 6 4, `warning` until taken, then the colours above.
  - Labels (`follow_up`, `retry`, …) are `caption` chips on `card`.
- **Badge.** `rounded-full`, `caption` 12px/500, 4px 8px padding, status tint fill + `-text` variant text + 6px dot [src Status Dot 4–6px].
- **Empty state.** 32px lucide icon in `helper`, `subheading` title, 1 `muted` sentence, 1 action. Example: "No applicants yet. Copy apply link".
- **Loading state.**
  - `subtle` skeleton blocks with pulse (disabled under reduced motion), sized to match the final layout.
  - Buttons use an inline spinner.
  - SSE reconnecting: a small `wash` "Reconnecting…" banner.
- **Error state.**
  - Inline banner: `danger` border, `alert-triangle` icon, `danger-text` text, the message from the API's `error.message` + a "Try again" button.
  - Session 404/410 pages use a friendly applicant screen (see §4).

## 4. Layout per Page

- **Dashboard** (`/dashboard/*`):
  - 56px top bar (`card`, `line` bottom border): logo on the left, Jobs nav, Logout on the right.
  - Content max 1200px, 24px padding, `heading-sm` title, primary action to the right of the title.
  - Jobs and applicants use tables. The status filter is pill tabs.
- **Session review** (`/dashboard/applications/[id]`):
  - Header: name, email, status badge, cost (mono), actions Shortlist (primary), Reject (destructive), Get invite link (ghost).
  - 12-column grid: transcript on the left, 7 columns (scrolls on its own), ScoreCards on the right, 5 columns (sticky), "View graph run" link.
  - Below 1024px, the transcript and scores become tabs.
- **Live graph** (`/dashboard/runs/[runId]`):
  - Full-width page (the 1200px content limit doesn't apply). `wash` canvas. Nodes in a fixed two-row layout at 100% zoom: top row left→right planner → plan_check → interviewer ⇄ judge, bottom row right→left guard → scorer ⇄ evidence_check → recruiter_gate. One row would need about 2000px and shrink 14px labels to about 6px.
  - 360px right panel: event timeline (mono `seq`, status icon, relative time) + selected node detail (model, attempt, tokens, duration, cost).
  - Toolbar: Live/Replay toggle, total cost, run status.
- **Apply form** (`/apply/[jobId]`):
  - Single column, max 640px, `canvas` background with a `wash` band at the top holding the job title (`heading` 40px).
  - The JD in a collapsible card.
  - Form: Name, Email, CV (`rounded-panel` dashed `line` dropzone), primary "Submit application".
  - Success: a card with a `check` icon showing the API's `message` as is, because the delivery channel depends on `EMAIL_MODE`.
- **Applicant chat** (`/s/[token]`). Single column max 720px, calm, no dashboard elements.
  - Intro: `heading` + 3 rule points (±15 min, 3–5 topics, answers are reviewed by a human) + primary "Start".
  - Chat:
    - sticky header with topic progress "Topic 2 of 4" + countdown (mono, switches to `warning-text` when < 2 minutes remain)
    - message area
    - composer at the bottom: textarea + Send button, locked (disabled + "AI is replying…" text) until `message.completed`
  - Done: `check` icon, "Thank you", no score.
  - Mobile-first. Touch targets ≥ 44px.

## 5. Dark Mode

**Light only for the MVP.** The Relate reference theme is "light". Dark mode is not built in 1 week: no `dark:` variants and no toggle. Since all colors already go through tokens, dark mode can be added later by overriding token values.

## 6. Accessibility (mandatory)

- Minimum WCAG AA contrast:
  - normal text ≥ 4.5:1, large text and meaningful graphical elements ≥ 3:1
  - `success`/`warning`/`brand-soft`/`focus` are never used as text colors, and `success`/`warning`/`danger` never as icon colors; use the `-text` variants
- Statuses always have an icon + text, never color alone.
- Focus is visible on all interactive elements (`focus-visible:ring-2 ring-focus ring-offset-2`). Logical tab order.
- Graph: every node is keyboard-focusable and has an `aria-label` (e.g. "Scorer, worker, retry attempt 2 of 3"). The event timeline is the text alternative to the graph (an `<ol>` list).
- Chat: the message list is `role="log"` + `aria-live="polite"`, and a streaming reply stays out of it (`aria-hidden`) until `message.completed`, so a reply is announced once and not chunk by chunk. The countdown is announced only at 5 minutes and 1 minute remaining.
- Animations (pulse, edge dash, typing caret) are disabled under `prefers-reduced-motion: reduce`.
- Forms: explicit `<label>`, errors announced (`aria-invalid`, `aria-describedby`). The 2 MB limit is explained before upload.
- UI language: English, `<html lang="en">`.

## 7. Do / Don't

**Do**
- Use `brand` as the only high-saturation accent besides the status colors [src].
- Use `line` hairlines and two-level radius (8px inner, 16px outer) [src].
- Use mono for machine data: IDs, models, tokens, cost, `seq`.
- Keep compact density on the dashboard, and give the applicant pages more breathing room.

**Don't**
- Don't use more than one high-saturation accent color in one component [src], except meaningful status colors.
- Don't use gradients with more than 2 stops [src]. Gradients are only allowed in the `wash` band of the landing or apply page.
- Don't use Inter above 600 or below 400 [src]. Body text must not go below 14px, except 12px captions [src].
- Don't use glassmorphism or `backdrop-blur` on the dashboard [adapted], because table readability matters more.
- Don't show scores or assessment colors on the applicant pages.
- Don't copy Relate's logo, name, or content. Only its visual language is borrowed.
