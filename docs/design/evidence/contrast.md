# Contrast pairs

Source: `docs/design/prototype/styles.css :root`. Method: WCAG 2.1 relative luminance; ratio = (L1+0.05)/(L2+0.05). Threshold: 4.5:1 for all text; 3:1 for control outlines; 3:1 large text.

## Text pairs

| Foreground | Background | Hex | Hex | Ratio | Min | Pass | Use |
|---|---|---|---|---:|---:|---|---|
| `color-text-primary` | `color-surface-0` | #141d16 | #f2f5ef | 15.68:1 | 4.5:1 | yes | body, headings, numerals |
| `color-text-secondary` | `color-surface-0` | #445046 | #f2f5ef | 7.69:1 | 4.5:1 | yes | subline, meta, hints |
| `color-text-tertiary` | `color-surface-0` | #59665a | #f2f5ef | 5.49:1 | 4.5:1 | yes | tertiary meta, placeholders, disabled labels |
| `color-accent` | `color-surface-0` | #0b5f3c | #f2f5ef | 7.03:1 | 4.5:1 | yes | links, leader mark, positive delta |
| `color-text-primary` | `color-surface-1` | #141d16 | #ffffff | 17.25:1 | 4.5:1 | yes | body, headings, numerals |
| `color-text-secondary` | `color-surface-1` | #445046 | #ffffff | 8.46:1 | 4.5:1 | yes | subline, meta, hints |
| `color-text-tertiary` | `color-surface-1` | #59665a | #ffffff | 6.05:1 | 4.5:1 | yes | tertiary meta, placeholders, disabled labels |
| `color-accent` | `color-surface-1` | #0b5f3c | #ffffff | 7.73:1 | 4.5:1 | yes | links, leader mark, positive delta |
| `color-text-primary` | `color-surface-2` | #141d16 | #f8faf6 | 16.43:1 | 4.5:1 | yes | body, headings, numerals |
| `color-text-secondary` | `color-surface-2` | #445046 | #f8faf6 | 8.06:1 | 4.5:1 | yes | subline, meta, hints |
| `color-text-tertiary` | `color-surface-2` | #59665a | #f8faf6 | 5.76:1 | 4.5:1 | yes | tertiary meta, placeholders, disabled labels |
| `color-accent` | `color-surface-2` | #0b5f3c | #f8faf6 | 7.36:1 | 4.5:1 | yes | links, leader mark, positive delta |
| `color-text-primary` | `color-surface-3` | #141d16 | #e6ede1 | 14.43:1 | 4.5:1 | yes | body, headings, numerals |
| `color-text-secondary` | `color-surface-3` | #445046 | #e6ede1 | 7.08:1 | 4.5:1 | yes | subline, meta, hints |
| `color-text-tertiary` | `color-surface-3` | #59665a | #e6ede1 | 5.06:1 | 4.5:1 | yes | tertiary meta, placeholders, disabled labels |
| `color-accent` | `color-surface-3` | #0b5f3c | #e6ede1 | 6.47:1 | 4.5:1 | yes | links, leader mark, positive delta |
| `color-text-inverse` | `color-accent` | #ffffff | #0b5f3c | 7.73:1 | 4.5:1 | yes | primary button label, round ribbon, winner band |
| `color-accent-ink` | `color-accent-soft` | #0b5f3c | #dbeee2 | 6.38:1 | 4.5:1 | yes | toast, result banner, selected segment |
| `color-text-inverse` | `color-danger` | #ffffff | #9e2b21 | 7.44:1 | 4.5:1 | yes | destructive filled control (not used in v2) |
| `color-danger-ink` | `color-danger-soft` | #7a1f18 | #fbe7e4 | 8.67:1 | 4.5:1 | yes | inline error hint, alert |
| `color-danger-ink` | `color-surface-1` | #7a1f18 | #ffffff | 10.31:1 | 4.5:1 | yes | error text on a card |

## Player palette — 8 fixed colours

| Seat | Token | Hex | Suit | vs `color-surface-1` (#fff) | vs own text (#fff) | Both ≥4.5 |
|---:|---|---|---|---:|---:|---|
| Sanne / seat 1 | `player-1` | #3d4ca8 | club | 7.51:1 | 7.51:1 | yes |
| seat 2 | `player-2` | #a62b2b | diamond | 7:1 | 7:1 | yes |
| seat 3 | `player-3` | #0b6b6b | spade | 6.31:1 | 6.31:1 | yes |
| seat 4 | `player-4` | #8f4a0f | heart | 6.66:1 | 6.66:1 | yes |
| seat 5 | `player-5` | #7b2d8e | club | 8.05:1 | 8.05:1 | yes |
| seat 6 | `player-6` | #6e5c00 | diamond | 6.58:1 | 6.58:1 | yes |
| seat 7 | `player-7` | #0b5fa5 | spade | 6.57:1 | 6.57:1 | yes |
| seat 8 | `player-8` | #a3286b | heart | 6.83:1 | 6.83:1 | yes |

## Non-text

| Pair | Ratio | Min | Use |
|---|---:|---:|---|
| `color-border-strong` #7c8a76 on #ffffff | 3.65:1 | 3:1 | input and stepper outline (UI component, 3:1) |
| `color-border` #dce4d7 on #ffffff | 1.3:1 | 1.2:1 | card and row separation (decorative, not a control boundary) |

## Notes

- color-text-tertiary is 4.44:1 on color-surface-4 and is therefore never used there.
- Player colours are fixed by seat (1..8), never derived from a name hash.
- The suit glyph is a second, non-colour cue for each player.
