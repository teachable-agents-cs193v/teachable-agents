# Design

## The style tile

![The Pip style tile](pip-style-tile.png)

`pip-style-tile.png` is the visual direction for the whole app: a friendly, hand-drawn, collegiate look for Pip, a student you teach, who learns and grows over time. Everything in the interface should be traceable to it.

- **Palette, all greens plus one highlight.** Deep green `#204F3E` (headings, primary actions, the brand), leaf green `#4D8B6A` (accents, underlines, ticks), sage `#DDE9DF` (cards, selected states, marker bands), mint `#EEF6EF` (quiet panels), paper `#F8F7F2` (the page), butter `#EADF9B` (the only highlight: in-progress states, sticky notes), charcoal `#222222` (text and every illustration outline).
- **Type.** Space Grotesk for headlines (bold, modern, friendly), Inter for body text, UI and labels, IBM Plex Mono for small labels, metadata and code.
- **Components.** A deep-green primary button, an outlined secondary, a butter "in progress" chip; lesson cards with a progress bar; sticky-note callouts ("Pip learned something new!"); 12 to 16px corners; no gradients.
- **Doodle toolkit.** Lightbulb, sprout, open book, bars, star, checkbox, arrows and ticks, drawn as loose strokes with fills limited to the palette. The books, laptop and speech bubbles in the illustration examples use the same strokes.
- **Pip.** A student with a soft D-shaped bob (a dome on top, a straight hem at the jaw, a bowl fringe), a round face and a sage collar, drawn with one 2-unit line weight throughout; moods change only the brows, eyes and mouth. Approved in the Nov 2026 review after four rounds (curls, a long bob and a sharper D were rejected). In the app Pip appears at avatar size (chat rows, cards, empty states, the About page); the landing hero is composed from the toolkit instead of a large character drawing.

The tokens that implement this live in `src/app/globals.css`; the README's "Design system" section lists them.

## Redesign PRs

Each redesign PR adds its screenshots here so the review has them next to the tile.

- **PR 1, design system and public landing page:** [`pr1-landing-desktop.png`](pr1-landing-desktop.png) (1360px) and [`pr1-landing-phone.png`](pr1-landing-phone.png) (390px).
- **PR 2, the logged-in dashboard and profile:** [`pr2-dashboard-desktop.png`](pr2-dashboard-desktop.png) and [`pr2-dashboard-phone.png`](pr2-dashboard-phone.png) for a returning student with saved sessions, and [`pr2-dashboard-first-time-desktop.png`](pr2-dashboard-first-time-desktop.png) for a first-time student. The data in them was created through the real API on a throwaway database.
