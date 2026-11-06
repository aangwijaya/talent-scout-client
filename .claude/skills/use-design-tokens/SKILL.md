---
name: use-design-tokens
description: Rules for using the DESIGN.md design system (Relate style) through Tailwind v4 @theme tokens in src/app.css. Use whenever writing or changing markup/Tailwind classes.
---

# Use Design Tokens

Source of truth: `DESIGN.md` (§2 tokens, §3 components, §4 layout, §6 accessibility, §7 do/don't). Tokens are defined once in the `@theme` block of `src/app.css`, exactly as in `DESIGN.md` §2.5.

## Rules
- Colors only from tokens: `bg-canvas`, `bg-wash`, `bg-card`, `bg-subtle`, `border-line`, `text-ink`, `text-body`, `text-muted`, `text-helper`, `bg-brand`/`text-brand`, `brand-soft`, `ring-focus`, `success`/`danger`/`warning` (+ `*-text` for text on light backgrounds).
- **Forbidden:** Tailwind's default palette (`blue-500`, `gray-*`, `slate-*`, …) and raw hex/rgb in components.
- Typography: `text-caption`, `text-body-sm`, `text-base` (`text-body` is a color), `text-subheading`, `text-heading-sm`, `text-heading`; `font-sans` (Inter) for UI, `font-mono` for IDs/tokens/code/technical numbers.
- Radius: `rounded-card`, `rounded-input`, `rounded-panel`; buttons always `rounded-full`.
- Shadow: `shadow-card`, `shadow-card-strong`, `shadow-brand-sm`, `shadow-glow`, `shadow-panel`.
- Graph node status & domain status: use the mapping in `DESIGN.md` §2.2; don't create new status colors.
- Components (Button primary/secondary/neutral, card, input, badge, etc.) follow `DESIGN.md` §3; at most 1 primary button per screen.
- Light mode only (dark mode = post-MVP).
- Accessibility per `DESIGN.md` §6: visible focus (`ring-focus`), form labels, contrast as noted in the doc.

## A11y checks (WCAG 2.1 AA)
A11y checks adapted from addyosmani/agent-skills (frontend-ui-engineering), MIT.
- **Keyboard:** every interactive element is reachable with Tab in a logical order; no positive `tabindex`; Enter/Space activate, Escape closes.
- **Focus ring:** `focus-visible:ring-2 ring-focus ring-offset-2` on all interactive elements; never `outline-none` without it.
- **Semantic elements:** `<button>`/`<a href>`/`<form>`, not `<div onclick>`; real headings and lists (the graph's event timeline is an `<ol>`).
- **Labels:** every input has a `<label for>` (placeholder is not a label); icon-only buttons get `aria-label`.
- **Contrast:** AA (4.5:1 text, 3:1 large text/UI); text and status icons use the `*-text` variants (#15803d/#b91c1c/#b45309), never `success`/`warning`/`brand-soft`/`focus` as text. `helper` only on `card`/`canvas`; use `muted` on `wash`/`subtle`.
- **Live regions:** finished chat replies (not each streamed chunk) and SSE graph updates in `aria-live="polite"`; errors in `role="alert"`.
- **Focus management:** after a route change move focus to the page `<h1>` (`tabindex="-1"`); modals trap focus and return it to the trigger on close.
- **Not color alone:** statuses always show a text label or icon next to the color (badges, graph nodes, ScoreCard).

## Quick check before a PR
```bash
rg -n "(bg|text|border|ring|fill|stroke)-(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-[0-9]" src/
rg -n "#[0-9a-fA-F]{3,8}\b" src/ --glob '!src/app.css'
```
Both must be empty. Missing a token → add it to `DESIGN.md` **and** `src/app.css` in the same PR (explain in the PR); never hardcode.
