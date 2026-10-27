# boerenbridge v2 — design

| field | value |
|---|---|
| status | ready for build (stage 2 gate) |
| issue | SOOT-35, stage 2 of 8 under SOOT-33 |
| branch | `soot-33-pwa-v2` |
| spec | `docs/spec-v2.md` §3.2 B1–B11, §3.3, §3.5, §4.2 |
| normative tokens | `docs/design/prototype/styles.css` → `:root` |
| prototype | `docs/design/prototype/{spellen,nieuw-spel,biedingen,slagen,scorebord,afgelopen}.html` |
| contrast pairs | `docs/design/contrast-pairs.json` |
| rendered measurements | `docs/design/evidence/measurements.json`, `docs/design/evidence/measurements-360.md` |
| screenshots | `docs/design/shots/*.png` (34 PNGs: 360, 768, 1280) |
| browser | Chromium 141.0.7390.37 via Playwright 1.56.0, headless on the build sandbox |

## 0. What this is, and what it is not

This is the art direction and the executable token set for the six screens in §3.3, plus proof that the design was rendered and measured in a real browser. The prototype is static HTML/CSS: it carries layout, typography, colour, states and the three motion events. It does **not** carry scoring logic, storage, routing or PWA code; that is stage 3. The only script in the prototype is a ~10-line `?state=` switcher so all states can be photographed.

### 0.1 The idea in one line

> On this app, a game at the kitchen table becomes a **paper scorecard**: four suit pips, a round ribbon, and chunky tabular numerals on calm sage paper.

The playfulness is rationed into four carriers, exactly as §3.2 B5 asks: the **card-suit motif** (wordmark, seat badges, empty state, matrix marks), the **chunky tabular numerals** (24 / 28 / 32 / 40 px, `tnum` on every score), the **round ribbon** (the one accent-filled shape on a round screen), and **one confirmation animation** (the score delta settling after a round is submitted). Everything else is a surface step, a border and space.

### 0.2 Conflicts and corrections against the work order

- **No game title in the data model.** §3.3 has players but no title, so the games list identifies a game by its players ("Sanne, Mauro, Joost en Lotte") with the round progress or the winner as the secondary line. A title field would be an unasked-for schema change.
- **The spec's budget is not violated.** The complete prototype stylesheet is 39.7 KB raw / **6.8 KB gzipped** — below the 25 KB gzipped `app.css` budget before dead prototype rules are removed. No font, icon pack, image or CDN was added. The two new inline assets are a suit sprite (**1,265 B raw / 530 B gzipped**) and the empty-state card fan (**769 B / 289 B gzipped**).
- **`/s/{id}` is not drawn here.** The share page is a server-rendered exception (§4.1). Afgelopen designs the *share action* and its confirmation; the read-only page itself is stage 3.4/3.3 work, not a sixth app screen.
- **"Where relevant" states are stated, not faked.** Biedingen and Nieuw spel have no persisted "finished" screen (see §4.0); inventing one would contradict the router in §3.5. The state that follows is shown instead.
- **Spec rev 2 (clean slate) was checked mid-run.** Rev 2 removes the migration plan, the `legacy` field and the legacy importer. None of the six screens depended on them: the Spellen list is local IndexedDB only (spec Q3), there is no import affordance, and the empty state says a game appears when you start one. No screen, token or measurement changed. The only design statement that would have differed under a migration design is the games list’s empty state, which is why it is written as a first-run state, not a "no games yet — import" state.
- **Nothing else in §3.2 B1–B11 is contradicted.** The palette, copy, target sizes, bottom-third action, stepper + keypad, single accent and motion budget are all implemented below and measured in §8.

## 1. Direction

### 1.1 The table, not the casino

The app is used by four to eight people talking over a phone in poor light. The design is a **light paper scorecard on a sage table**, not a dark casino. The ground is `#f2f5ef` (a green-tinted paper), cards are white, structure is a 1.3:1 border. The only accent in the interface chrome is the deep emerald `#0b5f3c` on the primary action, the round ribbon, the leader mark and the positive delta; the eight saturated player badges are identity, not action.

The identity is a **card-suit motif**:

- the wordmark is four pips in a 26 px square;
- every player gets a fixed seat colour and a suit pip in a 40 px badge — colour is never the only marker, because the suit is a second cue and the name is a third;
- the empty state is a drawn fan of three cards, not an illustration of a table or a stock icon;
- the scoreboard matrix uses a 12 px suit pip in front of each name, so a row is findable without reading.

### 1.2 Copy

Dutch, informal, table-side. "Je" not "u". The product words are kept exactly: **biedingen**, **slagen**, **blinde regel**, **piramide**. Examples that are in the prototype:

- "Hoeveel slagen belooft iedereen deze ronde?"
- "Samen bieden jullie 4 slagen. De biedingen mogen niet samen precies 5 zijn."
- "Samen bieden jullie 5 slagen. Dat mag niet: de biedingen mogen niet samen exact 5 zijn (blinde regel). Pas één bod aan."
- "Nog 1 slag te verdelen." / "Je hebt 6 van 5 slagen ingevuld. Haal er één slag af."
- "Nog geen spel op tafel" → "Zodra je een potje begint, staat het hier — ook als je de app sluit."
- "De tafel is leeg" → "De tussenstand verschijnt zodra de eerste ronde binnen is."
- "Ronde 5 afgerond" → "De scores zijn bijgewerkt. Ronde 6 staat klaar."
- "Knap gespeeld, allemaal."

No emoji, no exclamation marks, no English UI words. "Read-only" was removed from the share hint; it says "Delen geeft een pagina die iedereen kan bekijken zonder de app."

### 1.3 Rejected directions

| Rejected | Why |
|---|---|
| Dark green felt + cream + gold, "casino" | Poor light favours a light sheet; gold would be a second accent and every contrast pair would need a second audit. |
| A spreadsheet table with green header | Faster to build, but it hides the one-handed primary action and the round-state on a 360 px phone; it also makes eight players a wall of numbers. |
| A cartoon table with people and cards | It would be the app's only picture, would need a custom illustration and would not survive offline budgets; the drawn card fan carries the same idea in 769 B. |
| A gradient/hero treatment | B5 bans decoration as a substitute for hierarchy; gradients are banned on app screens. Flat surfaces and scale do the work. |

## 2. Tokens

The `:root` block in `docs/design/prototype/styles.css` is the normative set. The values below are copied from it. The Implementer should copy the `:root` block into `web/src/styles/tokens.css` and keep the names.

### 2.1 Colour — surfaces and ink

| token | value | role | contrast |
|---|---|---|---|
| `--color-surface-0` | `#f2f5ef` | page ground, topbar | — |
| `--color-surface-1` | `#ffffff` | cards, sheets, buttons | — |
| `--color-surface-2` | `#f8faf6` | inset wells, stepper keys, disabled key | — |
| `--color-surface-3` | `#e6ede1` | tracks, neutral chips, matrix band | — |
| `--color-surface-4` | `#d6e0d0` | pressed key, grabber, strongest step | — |
| `--color-border` | `#dce4d7` | card and row separation | 1.30:1 (decorative) |
| `--color-border-strong` | `#7c8a76` | input/stepper outline | **3.65:1** vs surface-1, **3.32:1** vs surface-0 |
| `--color-text-primary` | `#141d16` | headings, numbers, names | 15.68 / 17.25 / 16.43 / 14.43 on surfaces 0/1/2/3 |
| `--color-text-secondary` | `#445046` | sublines, meta, hints | 7.69 / 8.46 / 8.06 / 7.08 |
| `--color-text-tertiary` | `#59665a` | tertiary meta, placeholders, disabled labels | 5.49 / 6.05 / 5.76 / 5.06 |
| `--color-text-inverse` | `#ffffff` | text on accent / danger | 7.73:1 on accent |
| `--color-accent` | `#0b5f3c` | primary action, ribbon, leader, positive delta | 7.73:1 on surface-1 |
| `--color-accent-hover` | `#08492d` | pressed primary | 10.49:1 on surface-1 |
| `--color-accent-soft` | `#dbeee2` | selected segment, toast, result banner | — |
| `--color-accent-ink` | `#0b5f3c` | text on accent-soft | **6.38:1** |
| `--color-danger` | `#9e2b21` | destructive outline (only) | 7.44:1 on surface-1 |
| `--color-danger-soft` | `#fbe7e4` | invalid hint background | — |
| `--color-danger-ink` | `#7a1f18` | invalid hint text | **8.67:1** on danger-soft |
| `--color-focus` | `#0b5f3c` | `:focus-visible` outline, 3 px + 2 px offset | — |

Green is the **only interface accent**. It appears on the primary action, the ribbon, the selected segment, the leader marker, the positive delta and focus. It never appears on a player badge (the palette excludes it), never on a heading, never as a gradient.

The danger colour is semantic only. Negative scores are **ink with a minus sign**, not red (red would be a third meaning: a score is not an error). The only red text in the app is a validation message or a destructive confirmation.

### 2.2 Player palette — 8 fixed colours

Seat order is fixed 1..8; the model caps a game at 8 players, so the palette is never reused. The colour is never derived from the name. Each badge is a filled 40×40 (small 28×28) rounded square with a white suit pip; the same colour is used for the 12 px suit mark in the scoreboard matrix.

| seat | token | hex | suit | vs surface-1 (`#fff`) | vs its own text (`#fff`) | pass |
|---:|---|---|---|---:|---:|---|
| 1 | `--player-1` | `#3d4ca8` | ♣ club | 7.51:1 | 7.51:1 | yes |
| 2 | `--player-2` | `#a62b2b` | ♦ diamond | 7.00:1 | 7.00:1 | yes |
| 3 | `--player-3` | `#0b6b6b` | ♠ spade | 6.31:1 | 6.31:1 | yes |
| 4 | `--player-4` | `#8f4a0f` | ♥ heart | 6.66:1 | 6.66:1 | yes |
| 5 | `--player-5` | `#7b2d8e` | ♣ club | 8.05:1 | 8.05:1 | yes |
| 6 | `--player-6` | `#6e5c00` | ♦ diamond | 6.58:1 | 6.58:1 | yes |
| 7 | `--player-7` | `#0b5fa5` | ♠ spade | 6.57:1 | 6.57:1 | yes |
| 8 | `--player-8` | `#a3286b` | ♥ heart | 6.83:1 | 6.83:1 | yes |

Why these eight, in this order: the set alternates cool → warm → cool → warm (indigo, brick, teal, burnt orange, purple, olive, blue, magenta), so seat neighbours never share a hue family and a four-player game uses the four most distinct: indigo, brick, teal, burnt orange. The accent green is deliberately absent, so a player can never be mistaken for an action. The full measured set, including every text pair, is in `docs/design/contrast-pairs.json` and `docs/design/evidence/contrast.md`.

### 2.3 Type

No webfont file. The stack is `ui-rounded, "SF Pro Rounded", "Segoe UI Variable Display", "Segoe UI", system-ui, -apple-system, "Helvetica Neue", Arial, sans-serif`. On iOS this resolves to SF Pro Rounded (the rounded terminals are the playful part); on Android Chrome to Roboto. The Linux sandbox used for the screenshots has no rounded system face, so the screenshots render Liberation Sans. The design does not depend on rounded terminals for legibility: every size, weight and contrast value is measured in the fallback face.

| token | value | where |
|---|---|---|
| `--text-display` | 40 px (44 at ≥1280) | winner score, keypad current value |
| `--text-title` | 26 px (30 at ≥768, 32 at ≥1280) | every `<h1>` |
| `--text-heading` | 20 px | `<h2>`, sheet title, score delta |
| `--text-subhead` | 17 px | wordmark, game-card player line |
| `--text-body` | 16 px | body, inputs, buttons, player names |
| `--text-label` | 14 px | labels, ribbon, chips |
| `--text-meta` | 13 px | secondary meta, sublines, hints |
| `--text-micro` | 11 px | matrix round captions only |
| `--text-numeral-sm` | 24 px | stepper value |
| `--text-numeral-card` | 28 px | card total, round counter |
| `--text-numeral-md` | 32 px | ranking total |
| `--weight-regular` | 400 | body |
| `--weight-medium` | 500 | meta |
| `--weight-semibold` | 620 | labels, names |
| `--weight-bold` | 760 | headings, numerals |
| `--leading-display` / `title` / `heading` / `body` | 1 / 1.12 / 1.25 / 1.45 | |
| numerals | `font-variant-numeric: tabular-nums; font-feature-settings: "tnum" 1` | every score, bid, trick, total, delta |

Numerals are **chunky**: 24 px at weight 760 in the stepper, 32 px for the ranking, 40 px for the winner, always tabular so a +16 → +6 change does not shift the row. A screen uses 5–7 sizes; the matrix's 11 px captions are the only micro text.

### 2.4 Space (4 px base)

| token | value | use |
|---|---|---|
| `--space-1` | 4 px | gap inside a control, dot-to-label |
| `--space-2` | 8 px | **minimum target separation**, stepper gaps, chip gaps |
| `--space-3` | 12 px | card padding at 360, stack gap |
| `--space-4` | 16 px | page pad at 360, field gap |
| `--space-5` | 20 px | block gap |
| `--space-6` | 24 px | section gap, page pad at 768 |
| `--space-7` | 32 px | large block gap, page pad at 1280 |
| `--space-8` | 40 px | empty state breathing |
| `--space-9` | 48 px | full control height |
| `--space-10` | 64 px | rare, result page |
| `--page-pad` | 16 / 24 / 32 px | 360 / 768 / 1280 |
| `--tap` | 44 px | minimum interactive square |
| `--control-height` | 48 px | buttons and inputs |
| `--topbar-height` | 56 / 64 px | 360 / 768+ |
| `--dock-height` | 76 px | fixed action dock at 360 |

The page never uses a gap smaller than 8 px between two targets. The tightest group is the stepper: 44 + 8 + 48 + 8 + 44 = 152 px.

### 2.5 Shape, motion, structure

| token | value | use |
|---|---|---|
| `--radius-card` | 18 px | cards, player rows, sheets (24 top) |
| `--radius-well` | 14 px | hints, matrix frame, toast |
| `--radius-control` | 12 px | buttons, inputs, stepper keys, badges |
| `--radius-chip` | 999 px | round ribbon, chips, status, segments |
| `--motion-ribbon` | 180 ms | ribbon enters a round screen |
| `--motion-delta` | 200 ms | score delta settles after submit |
| `--motion-sheet` | 160 ms | keypad / confirm sheet rises |
| `--ease-out` | `cubic-bezier(.2,.8,.2,1)` | all three |

No shadows at rest. The only shadow is on the transient toast (`0 2px 8px rgba(20,29,22,.12)`), because it floats. No gradients anywhere. Cards are separated by a 1 px `--color-border` and a tone step; interactive outlines use `--color-border-strong` at 3.65:1.

### 2.6 The `:root` block to copy

```css
:root {
  --color-surface-0: #f2f5ef;
  --color-surface-1: #ffffff;
  --color-surface-2: #f8faf6;
  --color-surface-3: #e6ede1;
  --color-surface-4: #d6e0d0;
  --color-border: #dce4d7;
  --color-border-strong: #7c8a76;
  --color-text-primary: #141d16;
  --color-text-secondary: #445046;
  --color-text-tertiary: #59665a;
  --color-text-inverse: #ffffff;
  --color-accent: #0b5f3c;
  --color-accent-hover: #08492d;
  --color-accent-soft: #dbeee2;
  --color-accent-ink: #0b5f3c;
  --color-danger: #9e2b21;
  --color-danger-soft: #fbe7e4;
  --color-danger-ink: #7a1f18;
  --color-focus: #0b5f3c;
  --player-1: #3d4ca8; --player-2: #a62b2b; --player-3: #0b6b6b; --player-4: #8f4a0f;
  --player-5: #7b2d8e; --player-6: #6e5c00; --player-7: #0b5fa5; --player-8: #a3286b;
  --player-ink: #ffffff;
  --font-sans: ui-rounded, "SF Pro Rounded", "Segoe UI Variable Display", "Segoe UI",
    system-ui, -apple-system, "Helvetica Neue", Arial, sans-serif;
  --text-display: 40px; --text-title: 26px; --text-heading: 20px; --text-subhead: 17px;
  --text-body: 16px; --text-label: 14px; --text-meta: 13px; --text-micro: 11px;
  --text-numeral-sm: 24px; --text-numeral-card: 28px; --text-numeral-md: 32px;
  --weight-regular: 400; --weight-medium: 500; --weight-semibold: 620; --weight-bold: 760;
  --space-1: 4px; --space-2: 8px; --space-3: 12px; --space-4: 16px; --space-5: 20px;
  --space-6: 24px; --space-7: 32px; --space-8: 40px; --space-9: 48px; --space-10: 64px;
  --radius-card: 18px; --radius-well: 14px; --radius-control: 12px; --radius-chip: 999px;
  --page-pad: 16px; --control-height: 48px; --tap: 44px; --tap-gap: 8px;
  --topbar-height: 56px; --dock-height: 76px;
  --motion-ribbon: 180ms; --motion-delta: 200ms; --motion-sheet: 160ms;
  --ease-out: cubic-bezier(0.2, 0.8, 0.2, 1);
}
@media (min-width: 768px) { :root { --page-pad: 24px; --text-title: 30px; --topbar-height: 64px; } }
@media (min-width: 1280px) { :root { --page-pad: 32px; --text-title: 32px; --text-display: 44px; } }
```

## 3. Frame and responsive rules

### 3.1 360 px portrait — the design target

- Page padding 16 px. Content width 328 px. One column.
- Topbar 56 px, solid `surface-0`, 1 px bottom border, brand at 26 px, offline chip.
- The **primary action is a fixed bottom dock**: 76 px tall + `env(safe-area-inset-bottom)`, top border, one 48 px button. On a 360×800 viewport its top is at **y = 727** and the button at **y = 740**. That is the bottom 9% of the screen, always under the thumb.
- The last input row is deliberately allowed into the bottom third. Biedingen: the four rows start at y 297, 377, 457, 537; each is 68 px, so the last row is at 537–605 — inside the bottom third — while the primary sits below at 740.
- Every interactive target is ≥44×44. The tightest is the stepper: 44×44 (−), 48×44 (value), 44×44 (+), with 8 px gaps.
- The page scrolls vertically; the document never scrolls horizontally. The only horizontal scroller is the scoreboard matrix inside its own rounded frame.

### 3.2 390 px

Same as 360. The extra 30 px goes to the player name column and the game cards; no new breakpoint, no font change. `scrollWidth == innerWidth == 390` on all screens (measured).

### 3.3 768 px (tablet band)

- Page padding 24 px; topbar 64 px; content 720 px, still one column.
- **The dock releases into the page flow.** The primary action becomes a full-width 48 px button at the end of the content (no fixed overlay), so it never covers a row on a tablet.
- The player rows become **2-up** (`.bid-grid`), 352 px each; the stepper is still 44/48/44 with 8 px gaps.
- The 4-round matrix fits 720 px without scrolling, and the 9-round finished matrix also fits at 768 (718 px). The "veeg" hint is therefore shown only at 360/390, where the 560 px table is wider than the frame.
- The scoreboard is one column: cumulative ranking, then the matrix, then the round list. The primary "Volgende ronde" is at the end.

### 3.4 1280 px (desktop)

- Page max-width 1120 px, padding 32 px; topbar 64 px.
- Biedingen/Slagen: `grid-template-columns: minmax(0, 1.45fr) minmax(300px, 0.9fr)`; the player grid is 2-up (2×2 for four players); the right rail is sticky at `top: topbar + 20`, holding "Deze ronde"/"Biedingen" and the primary button. The primary is always visible without scrolling.
- Scorebord: `minmax(0, 0.85fr) minmax(0, 1.4fr)` — cumulative ranking on the left, matrix + round list on the right; the 9-round matrix fits at 1280 (measured no page overflow).
- Spellen: 2-column card grid; the primary "Nieuw spel" is a 48 px button at the top-right of the title row (not a full-width bottom bar, which would be a website CTA, not an app action).
- Afgelopen: winner card 1.15fr / totals 0.85fr; share + new game in the right column, aligned left with the totals.

## 4. Screens

### 4.0 State coverage

| screen | empty | in progress | finished |
|---|---|---|---|
| Spellen | yes — "Nog geen spel op tafel" | yes — an active card with "Ronde 4 van 9" | yes — winner + total cards |
| Nieuw spel | yes — 2 blank seats, "25 rondes" auto preview | yes — 4 named seats, 9-round preview | **n/a** — the screen creates a game; the next screen is Biedingen (and the created game appears on Spellen/Scorebord). The invalid state fills this column honestly. |
| Biedingen | yes — all 0, "Samen bieden jullie 0 slagen" | yes — 4 of 5, live hint | **n/a** — saving bids routes to Slagen (§3.5); the "after" screen is Slagen in progress. Also shown: blocked (blind rule) and keypad. |
| Slagen | yes — 0 of 5 | yes — 4 of 5, disabled submit | yes — round submitted, per-player deltas, undo + scorebord. Also shown: ready (5 of 5) and blocked (6 of 5). |
| Scorebord | yes — all zeros + "De tafel is leeg" | yes — 4 of 9, ranking + matrix + correct | yes — 9 of 9, winner banner, final totals. Also shown: confirm sheet. |
| Afgelopen | **n/a** — the route is only reachable for a finished game | **n/a** | yes — winner, final totals, share + new game. Also shown: share-confirmation toast. |

All states are rendered at 360; the primary state of each screen is also rendered at 768 and 1280. The filenames are in §8.4 and `docs/design/evidence/renders.md`.

### 4.1 Spellen (games list)

**Question:** what's in progress, what's done, what's the one next action? A game that is active comes first, then finished games, newest first. The card identity is the player names (no game title exists).

**360 layout (measured):**

- `h1` "Spellen" at y 77, 26/29 px; subline at y 114.
- Cards at y 173, 360, 547, 734 — 328 px wide, ~175 px tall, 12 px gaps. Each card: status chip (24 px) + date, player line (17/620), round progress or winner line, avatar row + text action.
- The fixed primary "Nieuw spel" is at y 740 (328×48).
- With four cards, the fourth starts behind the dock at the initial scroll; the page's bottom padding lets it scroll clear. The card list is not capped, because that would hide an in-progress game.

**768:** single column of 720 px cards; the primary "Nieuw spel" is a full-width 48 px button at the end of the list. **1280:** 2×2 grid of 520 px cards; "Nieuw spel" is a 48 px button at the top-right of the title row.

**States:** empty (card fan + "Nog geen spel op tafel"), in-progress ("Bezig" chip + round N of M + progress track + "Verder spelen"), finished ("Afgelopen" chip + "Sanne wint 120 punten" + date). The in-progress card is first; finished cards are newer first.

### 4.2 Nieuw spel (setup)

**Question:** how many players, which direction, how high — with a live round count.

**360 layout (measured):**

- Title at 77; a compact live preview line at 142: "9 rondes · 1 → 5 → 1 kaarten per speler" (state-aware; "25 rondes · 1 → 13 → 1" at auto).
- Player card at y 218, 322 px tall: 4 rows. Each row: seat number 30 px, suit badge 40 px, input 156×48, remove 44×44. "Speler toevoegen" 294×48.
- Direction card at 564: two 143×78 segmented buttons (Piramide / Alleen omhoog), 8 px gap.
- Max-card card at 737; the auto value shows "Auto" (0), otherwise 5. The stepper is 44/48/44.
- The fixed primary "Spel starten" at 740; it is **disabled until at least two non-empty names** and the reason is inline ("Vul minstens twee namen in." / "Vul een naam in voor elke speler."). Disabled is not a dead end: the reason is adjacent and `aria-describedby` points at it.
- The full preview card (9 bars rising to a green peak, "1 → 5 → 1") and the blind-rule explanation sit after the form on mobile; the compact line in the header gives the essential number without scrolling.

**768:** the setup keeps one row per player (names need the width), with the page still one column at 720 px; the preview sits after the form and the header line carries the live round count. **1280:** split 1.45/.9, the preview + blind-rule hint + start button form a sticky right rail; the form is 632 px.

**States:** empty (2 blank seats, 25-round auto preview), in progress (4 named, 9 rounds, start enabled), invalid (one blank name, error + disabled start). "Finished" is n/a: on submit the app routes to Biedingen.

### 4.3 Biedingen (bids)

**Question:** how many tricks does each player promise this round?

**360 layout (measured):**

- Title 77; ribbon at 160 (36 px tall, full pill, spade pip, "Ronde 5 | 5 kaarten p.p."); "Ronde 5 van 9" beside it; progress track 4 px at 205.
- Live hint at 222 (63 px): "Samen bieden jullie 4 slagen. De biedingen mogen niet samen precies 5 zijn." The hint is `role="status" aria-live="polite"`; it is always visible, not an error after the fact.
- Player rows at 297 / 377 / 457 / 537, each 68 px: badge 40, name 16/600, stepper − 44 / value 48 / + 44 with 8 px gaps. The value is a button that opens the keypad; the accessible name is "Bod van Sanne: 2. Open het toetsenbord."
- "Biedingen vastleggen" is the fixed primary at 740. It is enabled when the blind rule passes; in the blocked state it is disabled and `aria-describedby` points at the specific message.
- The keypad sheet (state `keypad`) is a bottom sheet: 0..5 as 3×2 keys 103×52, current key accent-filled, Wis 132×48, Klaar 185×48; 160 ms rise. On ≥900 it becomes a 440 px centred dialog.

**768:** 2-up player rows (354 px); primary in the flow at the end. **1280:** 2-up rows (310 px) in the left column, sticky "Deze ronde" summary + primary in the right rail; the summary shows cards-per-player, bids sum, rounds left.

**States:** empty (0 bids, all values 0, minus disabled), in progress (4 of 5, hint live), blocked (5 of 5, danger hint + disabled submit). Finished is n/a by router; the next screen is Slagen.

### 4.4 Slagen (tricks)

**Question:** how many tricks did each player actually win, and does the total match?

**360 layout (measured):**

- Title 77; ribbon 160; track 4 px.
- Total card at 222, 132 px tall: "Slagen ingevuld" + "5 kaarten p.p.", the live total "4 / 5 slagen" (28/760; green when matched, danger when over), a 5-segment bar (8 px segments), and a one-line hint "Nog 1 slag te verdelen." The total has `aria-live="polite"`.
- Player rows at 366 / 446 / 526 / 606, 68 px: badge, name, a 13 px subline with the bid ("bood 2"), and the same 44/48/44 stepper. The bid subline is the context B7 asks for.
- "Ronde afronden" at 740 is **disabled until the total equals the cards-per-player**. In the blocked state the total turns danger and the message is specific ("Je hebt 6 van 5 slagen ingevuld. Haal er één slag af.").
- On submit (state `finished`) the form is replaced by a green result banner "Ronde 5 afgerond", four rows with the per-player delta (+16, +13, +13, −3; positive in accent, negative in ink), and a two-button dock: "Ondedaan maken" (secondary) + "Scorebord" (primary). The deltas are the only animated confirmation (`delta-settle`, 200 ms).

**768:** 2-up rows; primary in the flow. **1280:** left column total + 2-up rows; right rail lists the bids per player and the primary. The primary is disabled in progress; the reason is the total card.

**States:** empty (0/5), in progress (4/5), ready (5/5, submit enabled), blocked (6/5, specific error), finished (deltas + undo).

### 4.5 Scorebord (scoreboard)

**Question:** who is ahead, and how did each round make that total?

**360 layout (measured):**

- Title 77; "Ongedaan maken" 164.8×44 at the same y, first-class in the header (B8), disabled on the empty state.
- Subline 129: "Na 4 van 9 rondes. Sanne staat aan kop."
- Cumulative ranking first: card at 223, 256 px, four 64 px rows: rank (13), suit badge 40, name 14/600 + "Aan kop" in accent under the leader, total 32/760 right-aligned. The leader total is accent; every other total is ink. The ranking card carries `aria-live="polite"` so the totals are announced after a round.
- Per-round matrix second: section head at 516; "Veeg zijwaarts voor alle rondes." at 553; matrix frame at 579, 226 px for 4 rounds. The first column is sticky; the frame scrolls horizontally inside its own rounded border. There is no page-level horizontal scroll.
- The round list follows: each row is a 60 px row with "Ronde 4 · 5 kaarten", a short summary, and a 77.1×44 "Corrigeer" button. Undo is in the header; correcting an earlier round opens the confirm sheet.
- "Volgende ronde" is the fixed primary at 740.

**768:** one column; the 4-round and 9-round matrices both fit 720 px (718 px measured); the primary is in the flow at the end. **1280:** ranking 0.85fr / matrix 1.4fr; the matrix shows all 4 (or all 9) rounds and the total without scrolling; the round list sits under the matrix; primary bottom-right.

**States:** empty (zeros + "De tafel is leeg"), in progress (4/9), finished (9/9 + "Spel afgelopen" + "Winnaar: Sanne" + "Bekijk uitslag"), confirm ("Ronde 3 corrigeren?" sheet, 160 ms rise, cancel / correct, names the round and says later rounds stay).

### 4.6 Afgelopen (game over)

**Question:** who won, what are the final totals, and what now?

**360 layout (measured):**

- Title 77; "9 rondes · zondag 27 oktober".
- Winner card at 154, 275 px: an accent "Winnaar" band (48 px, spade pip) — the ribbon as a full-width band — then the seat badge, "9 rondes gespeeld", the winner name at 26/760, the total at 40/760 ("120 punten"), and one line: "28 punten voor nummer twee Joost. Knap gespeeld, allemaal."
- Final totals card at 499, 208 px: four 52 px rows, rank + suit + name + total (24/760). The final totals are the same data as the scoreboard ranking, so they do not disagree.
- The dock at 740 has two buttons: "Deel scorebord" (201.6×48, primary, share icon) and "Nieuw spel" (118.4×48, secondary). Tapping share copies the `/s/{id}` link and shows a toast above the dock: "Link gekopieerd. Iedereen kan het scorebord nu bekijken." The toast is 48 px + padding and is the only shadow in the design; it sits on a transient floating element.
- A one-line hint under the actions: "Delen geeft een pagina die iedereen kan bekijken zonder de app."

**768:** one column, primary in flow. **1280:** winner 1.15fr / totals 0.85fr; share + new game under the totals, aligned left.

**States:** finished and shared (toast). Empty/in-progress are n/a: the route is only reachable when `phase === 'finished'`.

## 5. Components

| component | spec | states |
|---|---|---|
| **Round ribbon** | pill, 36 px min-height, `radius-chip`, accent fill, 14/620 white, 14 px suit, 1 px 42%-white divider. Variant `--quiet` uses surface-3 + secondary for a non-current context. | enters with `ribbon-enter` 180 ms; static under reduced motion |
| **Stepper** | − 44×44 (surface-2, strong outline), value 48×44 (surface-1, accent outline, 24/760 tabular), + 44×44 (surface-1, strong outline). Gaps 8. Minus disabled at 0. Value is a button with an accessible name including the current value and "Open het toetsenbord". | default, disabled minus, zero (strong border, tertiary numeral), open keypad |
| **Keypad sheet** | bottom sheet, 24 px top radius, grabber 40×4, scrim `rgba(20,29,22,.34)`, 3-column grid for 0..8 / 4-column for 9..13, keys ≥52 px, current key accent, Wis + Klaar. Max-height 92dvh. ≥900: 440 px centred dialog. | closed, open, selected key |
| **Suit badge** | 40×40, radius 12, fixed seat colour, white suit pip 20 px. Small 28×28 / 14 px for lists. The suit repeats every four seats; the colour does not. | normal, leader (marker is text, not a badge change) |
| **Chips** | 24 px min-height, 999 radius, 13/620, surface-3 + secondary, or accent-soft + accent-ink, or danger-soft + danger-ink. Never above a heading. | neutral, accent, danger |
| **Status chip** | 28 px, ring dot 8 px in tertiary for offline, filled accent for synced, surface-1 + border, 13/500; "Offline" on 360, "Offline · opgeslagen" ≥520. Never a banner, never a gate. | offline, wacht op sync, gesynchroniseerd |
| **Matrix** | sticky first column, min-width 560, 13 px cells, right-aligned tabular numbers, 10 px 12 vertical, 1 px row rules, header surface-2 with round capacity captions at 11 px. Scrolls inside `.matrix-wrap`; page never scrolls sideways. | 4-round progress, 9-round finished |
| **Confirm sheet** | same sheet shell as keypad; title names the round; body says later rounds stay; Annuleren (secondary) + Corrigeren (primary). Used only when `round < rounds.length`; correcting the last round does not confirm (spec §3.4). | confirm round 3 |
| **Toast** | fixed above the dock on 360 (dock 76 + 12), bottom-right on ≥768, accent-soft, 48 px, check glyph, 14/620; the only resting shadow. | link copied |
| **Primary button** | 48 px min-height, radius 12, accent fill, white 16/620. Full width in the dock and the rail; auto width in a header/inline action. Pressed = accent-hover (no transition). Focus = 3 px accent outline + 2 px offset. Disabled = surface-3 + tertiary + reason adjacent. | enabled, disabled, pressed, focus |

No component uses a gradient, backdrop blur, a shadow at rest, or an icon in a coloured circle. The stepper keys are filled squares, not icon buttons; the only icons are the suit pips, +/−, chevron, check, alert, undo, close, share and copy, all inline SVG.

## 6. Motion — exactly three events

| # | name | trigger | properties | duration | reduced motion |
|---:|---|---|---|---:|---|
| 1 | `ribbon-enter` | a round screen opens (Biedingen / Slagen / Scorebord / result) | opacity 0→1, `translateY(6px)`→0 | **180 ms** | none |
| 2 | `delta-settle` | a round is submitted and the per-player deltas appear | opacity 0→1, `scale(.94)`→1 | **200 ms** | none |
| 3 | `sheet-rise` | the number pad or the confirm sheet opens | opacity 0→1, `translateY(24px)`→0 | **160 ms** | none |

All three are transform/opacity only. There are **no CSS transitions** anywhere else: pressed and hover states are immediate colour changes, and the toast appears instantly. `grep -c '@keyframes' docs/design/prototype/styles.css` → **3**.

```css
@media (prefers-reduced-motion: no-preference) {
  .ribbon { animation: ribbon-enter var(--motion-ribbon) var(--ease-out) both; }
  .delta  { animation: delta-settle var(--motion-delta) var(--ease-out) both; }
  .sheet  { animation: sheet-rise var(--motion-sheet) var(--ease-out) both; }
}
@media (prefers-reduced-motion: reduce) {
  .ribbon, .delta, .sheet { animation: none !important; }
  *, *::before, *::after {
    transition: none !important;
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    scroll-behavior: auto !important;
  }
}
```

The max duration is 200 ms (B6). There is no spinner, no skeleton and no loading animation for local operations; they are instant.

## 7. Contrast

Method: WCAG 2.1 relative luminance on the hex values in the token block. Threshold: **4.5:1 for all text** (including 13 px meta and placeholders), 3:1 for control outlines. The complete machine-readable set is `docs/design/contrast-pairs.json` (text pairs + 8 player colours + non-text), and a readable table is `docs/design/evidence/contrast.md`.

The player table is in §2.2. The key interface pairs:

| pair | ratio | threshold |
|---|---:|---:|
| primary on surface-0 / 1 / 2 / 3 | 15.68 / 17.25 / 16.43 / 14.43 | 4.5 |
| secondary on surface-0 / 1 / 2 / 3 | 7.69 / 8.46 / 8.06 / 7.08 | 4.5 |
| tertiary on surface-0 / 1 / 2 / 3 | 5.49 / 6.05 / 5.76 / 5.06 | 4.5 |
| accent on surface-0 / 1 / 2 / 3 | 7.03 / 7.73 / 7.36 / 6.47 | 4.5 |
| white on accent (button, ribbon, band) | 7.73 | 4.5 |
| accent-ink on accent-soft (toast, banner, selected) | 6.38 | 4.5 |
| danger-ink on danger-soft (validation) | 8.67 | 4.5 |
| white on danger (not used on a filled control in v2) | 7.44 | 4.5 |
| border-strong outline vs surface-1 / surface-0 | 3.65 / 3.32 | 3 (UI) |

`--color-text-tertiary` is **4.44:1 on `--color-surface-4`**, just below 4.5, so it is not used there. That is why disabled keys use tertiary on surface-2 (5.76) and the pressed key changes only the fill, not the text. The matrix's 11 px captions use tertiary on surface-1 (6.05) or surface-2 (5.76); they never sit on surface-3.

## 8. Rendered evidence

### 8.1 Environment and command

- Chromium **141.0.7390.37** via **Playwright 1.56.0**, headless, Linux build sandbox (`ssh -p 2222 … agent@127.0.0.1`).
- Screenshots at **360×800 CSS px, DPR 2** (viewport shots, so the fixed dock is where the user sees it), **768×1024** full-page, **1280×900** full-page.
- Command (from the repo root, inside the sandbox):

```bash
cd docs/design/prototype
NODE_PATH=/usr/local/lib/node_modules PLAYWRIGHT_BROWSERS_PATH=/opt/ms-playwright node measure.mjs
```

The script does three things: renders every state at 360/390/768/1280, screenshots the primary states at 360/768/1280 plus the extra 360 states, and writes `docs/design/evidence/measurements.json` (84 runs).

### 8.2 Measurement summary — 360 px, required screens

| screen | state rendered | `scrollWidth` | `innerWidth` | overflow | interactive elements | min width / min height | min neighbour gap | `<h1>` |
|---|---|---:|---:|---|---:|---|---:|---|
| Spellen | progress | 360 | 360 | no | 7 | 128 / 44 | 8 | Spellen |
| Nieuw spel | progress | 360 | 360 | no | 16 | 44 / 44 | 8 | Nieuw spel |
| Biedingen | progress | 360 | 360 | no | 15 | 44 / 44 | 8 | Biedingen |
| Slagen | progress | 360 | 360 | no | 15 | 44 / 44 | 8 | Slagen |
| Scorebord | progress | 360 | 360 | no | 8 | 77.1 / 44 | 8 | Scorebord |
| Afgelopen | finished | 360 | 360 | no | 4 | 118.4 / 44 | 8 | Afgelopen |

Every state at 360, 390, 768 and 1280 was checked for page overflow: **0 overflows in 84 runs**. The smallest interactive target in the layout is **44×44**; the smallest edge-to-edge gap between two controls in the same group is **8 px** (the stepper trio and the dock pair). The skip link is 138.7×47.2 at `y=-60` until focused.

### 8.3 Computed sizes of every control relied on (360 px)

| screen / group | controls (count × size) |
|---|---|
| all screens | skip link 138.7×47.2; brand link 128×44; offline chip is not interactive |
| Spellen | 4 game cards 328×174.7–174.9; "Nieuw spel" 328×48 |
| Nieuw spel | name inputs 4×156×48; remove 4×44×44; "Speler toevoegen" 294×48; direction 2×143×78; max stepper 2×44×44; "Spel starten" 328×48 |
| Biedingen | per row 4× (44×44, 48×44, 44×44); "Biedingen vastleggen" 328×48; keypad: close 44×44, keys 6×103.3×52, Wis 132.5×48, Klaar 185.5×48 |
| Slagen | per row 4× (44×44, 48×44, 44×44); "Ronde afronden" 328×48 (disabled at 4/5); finished: "Ongedaan maken" + "Scorebord" 48 tall |
| Scorebord | "Ongedaan maken" 164.8×44; 4× "Corrigeer" 77.1×44; "Volgende ronde" 328×48; confirm: close 44×44, Annuleren 132.5×48, Corrigeren 185.5×48 |
| Afgelopen | "Deel scorebord" 201.6×48; "Nieuw spel" 118.4×48 |

The full per-element table (label, tag, width, height, y, disabled, in-viewport) is pasted in `docs/design/evidence/measurements-360.md` and the raw values are in `measurements.json`.

### 8.4 Screenshots

The 34 PNGs are in `docs/design/shots/`; the full list with pixel dimensions is `docs/design/evidence/renders.md`. Required set:

| screen | 360 primary | 360 states | 768 | 1280 |
|---|---|---|---|---|
| Spellen | `spellen-360.png` | `spellen-empty-360.png`, `spellen-finished-360.png` | `spellen-768.png` | `spellen-1280.png` |
| Nieuw spel | `nieuw-spel-360.png` | `nieuw-spel-empty-360.png`, `nieuw-spel-invalid-360.png` | `nieuw-spel-768.png` | `nieuw-spel-1280.png` |
| Biedingen | `biedingen-360.png` | `biedingen-empty-360.png`, `biedingen-blocked-360.png`, `biedingen-keypad-360.png` | `biedingen-768.png` | `biedingen-1280.png` |
| Slagen | `slagen-360.png` | `slagen-empty-360.png`, `slagen-ready-360.png`, `slagen-blocked-360.png`, `slagen-finished-360.png` | `slagen-768.png` | `slagen-1280.png` |
| Scorebord | `scorebord-360.png` | `scorebord-empty-360.png`, `scorebord-finished-360.png`, `scorebord-confirm-360.png` | `scorebord-768.png` | `scorebord-1280.png` |
| Afgelopen | `afgelopen-360.png` | `afgelopen-shared-360.png` | `afgelopen-768.png` | `afgelopen-1280.png` |

The 360 set is attached to SOOT-35. `scorebord-finished-1280.png` is included as extra proof that the 9-round matrix fits at 1280 (635 px client / 635 px scroll width).

### 8.5 Look-and-fix log — what the screenshots changed

The design was not approved from the code. These are the things the rendered look caught and the fixes:

1. **Scorebord horizontal overflow at 360/390** (`scrollWidth 578 > innerWidth 360`): the matrix's `min-width: 560px` forced its grid column wider because grid items default to `min-width: auto`. Fixed with `min-width: 0` on `.split > *`, `.stack > *`, `.stack--4 > *`; the matrix now scrolls only inside `.matrix-wrap`. Re-measured: 360/360.
2. **Keypad and confirm sheets photographed half-transparent**: the screenshot ran while `sheet-rise` was still at opacity <1. Fixed by waiting 400 ms for the motion to settle before every shot. The sheet is opaque; the scrim darkens the page.
3. **Scorebord sections touching**: `.stack--4` set only `gap`, not `display: grid`, so the sections stacked with no gap. Fixed; the "Rondes" heading now has 24 px above it.
4. **Scorebord matrix clipped at 1280**: the 0.9fr right column was 394 px, narrower than the 560 px table. Fixed with a scoreboard-specific 0.85fr / 1.4fr split; the 4-round matrix fits, and the 9-round matrix fits at 768 (718 px) and 1280 (635 px), scrolling only at 360/390.
5. **Orphan card in the 4-card games grid**: 3 cards in a 2-column grid left an empty cell. Added a fourth finished game so the grid closes.
6. **Full-width "Nieuw spel" bar at 1280**: the inline dock still had `flex: 1`. Fixed; the action is a 48 px button top-right on desktop and a full-width dock on mobile.
7. **Dock covering the round list at 768**: the fixed dock was released into the flow at ≥768 (not ≥900), so a tablet never has a bar over its content.
8. **Biedingen rows at 1280 were 780 px wide with the stepper at the far right**: a long eye/hand travel. Fixed with a 2-up player grid at ≥1200 (and at 768–999), leaving 1-up between 1000–1199 where the left column is narrow.
9. **Unreadable zero-minus affordance**: the empty state's − is 44×44 but disabled; the disabled state is now a tone step with tertiary text, not a faded-out target. The empty Nieuw spel rows got their seat badges so the inputs align with the filled state.
10. **Share confirmation was below the fold**: the toast is fixed above the dock on 360 and bottom-right on desktop, so tapping "Deel scorebord" produces visible feedback without scrolling.

### 8.6 What the render does not prove

- **iOS Safari was not tested.** This is a stage-2 design prototype, not the app; the layout uses standard CSS grid/flex, `dvh`, `env(safe-area-inset-bottom)` and system fonts, all iOS 16-supportable. Stage 8 must document what it actually tests, per AC-16.
- **No real device, no WebKit run.** Chromium 141 mobile emulation is not an iOS test.
- **The rounded face is a platform font.** On iOS the stack resolves to SF Pro Rounded; the sandbox rendered Liberation Sans. The measurements and contrast are from the fallback face. The design does not require the rounded terminals.
- **No focus trap / keyboard sheet behaviour** in the prototype: the sheet is a static mock, not a wired dialog. Stage 4 owns focus management, `inert`, Escape and return focus; the design deliberately uses a real `<button>` close and a 44 px target for it.
- **No Lighthouse / installability run**: there is no service worker in the prototype, and that is stage 3.3/5.

## 9. Rationale — the choices that could have gone the other way

**Why this type scale (26 title, 16 body, 24/32/40 numerals, 13 meta).** The primary constraint is a phone at arm's length in poor light, held by one hand, with a score that must be read across a table. The title only needs to say which screen you are on, so it stays at 26 px on a phone and grows to 32 at desktop; it is not a landing-page hero. Body and player names are 16 px, the iOS default text size, because 14 px at arm's length is a squint. The numbers are the exception: 24 px in the stepper, 32 px in the ranking, 40 px for the winner. That is the one place where scale is allowed to shout, and it is the app's job. A 48 px figure (the app-screen tell) was rejected: it makes a phone screen read like a marketing page and it steals space from the next row. `tabular-nums` is non-negotiable because a scoreboard updates in place; without it, +16 → +6 shifts a whole column.

**Why this palette order.** Seat 1–4 are the four most separated hues (indigo, brick, teal, burnt orange) so the common four-player game never has two similar badges. Seats 5–8 are the second ring (purple, olive, blue, magenta). The order alternates warm/cool so adjacent seats differ. Green is absent from the player set because green is the action colour: a green player badge next to a green button would make the button look like it belongs to that player. All eight are dark enough for white text and for their own use as a 12 px mark on white (6.31–8.05:1). There is no hash and no random: the same seat gets the same colour on every device, which is what makes "the blue player" usable at a table. The suit pip repeats every four seats; it is the non-colour cue that keeps the palette usable for a colour-blind player, and the name is always present.

**Why the round ribbon is a full pill, not a notched ribbon.** The brief calls it a ribbon. A notched banner needs a `clip-path` or extra pseudo-elements, loses its rounded target silhouette at 36 px, and reads as a coupon. A full-radius pill at 36 px reads as a physical tab on a scorecard, is one DOM element with a 14 px suit and one accent fill, and can be reused as the full-width winner band on Afgelopen. It is the single place where accent fills a large shape on a round screen, which is why the rest of the screen can stay flat. The "quiet" variant (surface-3) exists for context that is not current, so the accent always means "now".

**Why the bottom dock instead of a button at the end of the form.** At 360, a form that is four to eight rows tall puts an inline submit below the fold; the user has to scroll with the same thumb that is entering numbers, and the primary action disappears. The dock is 76 px and always at y 727–800; it never moves, never covers the row being edited (the form's bottom padding clears it), and it carries the one action the screen exists for. On tablet/desktop the dock releases into the flow so it stops being a mobile overlay. The Spellen screen is the one exception: it is a short list, so on desktop its primary moves to the title row rather than sitting at the bottom of the page as a website CTA.

**Why a stepper *and* a keypad.** A stepper is the fastest reliable way to correct by one (the common case: someone bid 2 and meant 3). A keypad is the fastest way to enter a value from nothing, and it avoids the 0..13-long scroll of a `<select>`. Both are shown in the prototype; the value is a 48×44 button that opens the keypad, and the stepper's +/− are always visible. The keypad is 3 columns for 0..5 (the five-card round) and 4 for 9..13; each key is ≥52 px, and the current key is accent-filled. The `<select>` was rejected explicitly; `grep -c '<select'` on Biedingen and Slagen is 0.

**Why the 2-up player grid at 768 and 1200, but not 1000.** At 768 the full content width is 720, so two 352 px rows keep the name and the stepper within one glance. At 1000–1199 the split gives the left column only ~545 px, so two rows would squeeze the name to ~50 px; one column is better there. At 1200+ the left column is ~780 px and two 384 px rows are comfortable. The breakpoint follows the measured width, not a device name.

**Why the cumulative ranking is first and the matrix second.** The table asks "who is ahead?" far more often than "what did everyone score in round 3?". The ranking is four rows of 64 px with the total at 32 px; the matrix is the audit trail. A chart was rejected: with ≤8 players and ≤51 rounds, a chart adds a second encoding of the same numbers, costs bytes, and cannot show the exact per-round values that a correction needs. B11 allows a chart but does not require one; the matrix is the honest per-round detail, and the 9-round finished matrix fits at 1280.

**Why the matrix scrolls inside its frame instead of becoming a card list at 360.** A player's row must keep its name while the round columns move; a card-per-round list would split one player's history across cards and make the correction flow worse. The sticky first column keeps the identity anchored, the frame has its own horizontal scroll, and the page never scrolls sideways. The "Veeg zijwaarts" hint is above the table on mobile (not below), because a caption under a clipped table is discovered too late.

**Why no dark theme.** The context is poor light and a table, not a dark room; a light sheet with a 15.7:1 ink and a 1.3:1 card edge is the most legible object in that context. A second theme would need a second contrast table (the player palette especially) and a second render at 360/1280, for no asked-for benefit. The emerald identity survives in the accent; the ground is sage paper, not black felt.

**Why no custom font.** A rounded webfont would add a file (30–80 KB for a useful Latin subset), a `@font-face` request, a FOUT risk offline, and an explicit "state the KB cost" question. The system stack gets SF Pro Rounded on iOS and Roboto on Android, both of which have tabular figures and a rounded variant on iOS. The app's distinctiveness comes from the suit motif, the ribbon and the number scale, not from a face that would need to be downloaded.

**Why the empty state is a drawn card fan.** The alternative was an icon or a grey placeholder. The card fan is the subject's own object, drawn in 769 B of inline SVG (289 B gzipped), uses only the token palette, and appears once. It is not a decorative shape: it is the thing the app is about, and it tells a first-run user what this is before they read the sentence.

**Why the status chip is 28 px and not a banner.** Offline is normal for this app, not an error. A banner would be a wall (B9 forbids it) and would push the content down on every screen. The chip is always present, never a gate, and says "Offline · opgeslagen" once there is room; every mutation still works.

## 10. Handoff

### 10.1 Files

| design artifact | production destination | owner |
|---|---|---|
| `:root` in `docs/design/prototype/styles.css` | `web/src/styles/tokens.css` | 3.2 |
| component rules in `docs/design/prototype/styles.css` | `web/src/styles/app.css` | 3.2 |
| six HTML prototypes | the six view functions in `web/src/views/*.ts` | 3.2 |
| suit sprite (1,265 B / 530 B gzip) | one inline `<symbol>` sprite in `web/index.html` or a single same-origin SVG | 3.2 |
| card fan (769 B / 289 B gzip) | same sprite, used only by the Spellen empty state | 3.2 |
| `docs/design/contrast-pairs.json` | `scripts/verify/contrast.mjs` input (AC-20) | 3.2 |
| this document | design reference; no code | — |

### 10.2 Do not change

- The **8 player colours and their seat order**. They are a fixed palette, not a hash; changing the order breaks the measured contrast table and the "seat 1 is indigo" expectation.
- The **three motion events and their durations**. Adding a hover transition, a page fade, a spinner or a fourth keyframe breaks AC-21. Duration is ≤200 ms (180/200/160).
- The **44/48/44 stepper with 8 px gaps**. Shrinking the stepper to fit a long name is the easy mistake; truncate the name instead.
- The **bottom third primary at 360**. The dock is the one control that must never scroll away on a phone.
- The **single green accent**. Player colours are identity, not action; the danger colour is validation, not a score.

### 10.3 KB budget impact

- Suit sprite: 1,265 B raw / **530 B gzip**.
- Card fan: 769 B raw / **289 B gzip**.
- No webfonts, no PNGs, no icon pack, no CDN, no chart library, no new JS.
- The whole prototype stylesheet: 39.4 KB raw / **6.8 KB gzip**; it includes prototype-only state helpers. The production `app.css` should be smaller and must be measured against the 25 KB gzip budget. No design decision depends on a framework or a library.

### 10.4 Open questions for 3.2 / 3.3

1. **Keypad for 13 cards**: the 3-column layout is drawn for 0..5. For 9..13 use 4 columns; every key stays ≥52 px. Confirm the keypad's scroll behaviour at 360 if the max is 13 and the sheet is open.
2. **Sheet focus**: the prototype is a visual mock. The implementation needs `role="dialog"`, `aria-modal`, an initial focus, a focus trap, Escape to close, and focus returned to the value button. Do not use `alert()`.
3. **`aria-live` scope**: the scoreboard total and the tricks counter are live regions in the prototype. On rapid stepper changes, use `aria-live="polite"` on the total only (not the whole list) to avoid reading every row.
4. **Text truncation**: names are capped at 40 chars by the model. At 360 the stepper name gets ~92 px; it truncates with an ellipsis and the aria-label keeps the full name. A name that is only distinguishable by its tail should be shortened by the user, not wrapped into a two-line row.
5. **The "Auto" max**: the prototype shows "Auto" at 0 and 5 at the cap. The model treats 0 as natural (52/players); the Implementer should keep the preview line in sync with `cardsForRound`/`totalRounds`.

### 10.5 What this stage deliberately did not do

- No application logic, no rules port, no storage, no router, no PWA, no service worker, no manifest, no icons beyond the inline SVG.
- No production components; the six HTML files are a rendered prototype, not `web/src/views`.
- No iOS Safari or real-device run; no Lighthouse; no focus-trap implementation; no network log.
- No change to `docs/spec-v2.md`, `internal/game`, or any app file. The only files added are under `docs/design/`.
- No chart (B11 allows one; the matrix is the better per-round detail here).
- No dark theme, no custom font, no icon pack, no external asset.

## Appendix A — the exact state renders

| file | state | what it shows |
|---|---|---|
| `spellen-360.png` | progress | active game + three finished, 4-card grid |
| `spellen-empty-360.png` | empty | card fan + first-run copy |
| `spellen-finished-360.png` | finished | four finished games, no active game |
| `nieuw-spel-360.png` | progress | 4 named players, 9 rounds, start enabled |
| `nieuw-spel-empty-360.png` | empty | 2 blank seats, 25-round auto preview |
| `nieuw-spel-invalid-360.png` | invalid | blank name + specific error + disabled start |
| `biedingen-360.png` | progress | 4 of 5 bids, live blind-rule hint |
| `biedingen-empty-360.png` | empty | 0 bids, 0/5 hint |
| `biedingen-blocked-360.png` | blocked | 5 of 5, danger hint, disabled submit |
| `biedingen-keypad-360.png` | keypad | 0..5 keys, selected 2, Wis/Klaar |
| `slagen-360.png` | progress | 4/5 total, disabled submit |
| `slagen-empty-360.png` | empty | 0/5 total |
| `slagen-ready-360.png` | ready | 5/5, submit enabled |
| `slagen-blocked-360.png` | blocked | 6/5, specific error |
| `slagen-finished-360.png` | finished | deltas + undo + scoreboard |
| `scorebord-360.png` | progress | ranking, matrix, round list, next round |
| `scorebord-empty-360.png` | empty | zeros + "De tafel is leeg" |
| `scorebord-finished-360.png` | finished | 9 rounds, winner banner |
| `scorebord-finished-1280.png` | finished | 9-round matrix fits at desktop width |
| `scorebord-confirm-360.png` | confirm | "Ronde 3 corrigeren?" sheet |
| `afgelopen-360.png` | finished | winner + final totals |
| `afgelopen-shared-360.png` | shared | link-copied toast |

The 360 set is complete; the 768 and 1280 primary renders are `*-768.png` and `*-1280.png`.
