# OpenInfra Logger — Brand Assets

Drop these straight into the repo. Everything below is SVG and theme-aware where it can be.

```
exports/
├── mark/                       The symbol on its own
│   ├── mark.svg                currentColor, signal dot — inline in HTML & themeable via CSS
│   ├── mark-mono.svg           currentColor, no accent — for single-tone contexts
│   ├── mark-ink.svg            INK on transparent
│   ├── mark-paper.svg          PAPER on transparent (for use over dark surfaces)
│   └── mark-on-signal.svg      200×200, SIGNAL bg, INK mark — sticker / hero plate
├── favicon/
│   ├── favicon.svg             default — INK plate, PAPER mark, signal dot
│   ├── favicon-adaptive.svg    auto switches via prefers-color-scheme — RECOMMENDED for <link rel="icon">
│   ├── favicon-light.svg       PAPER plate, INK mark
│   ├── favicon-dark.svg        INK plate, PAPER mark
│   ├── favicon-signal.svg      SIGNAL plate, INK mark — for brand moments
│   ├── favicon-mono-light.svg  no accent dot, light
│   ├── favicon-mono-dark.svg   no accent dot, dark
│   └── apple-touch-icon.svg    180×180 padded, larger corner radius
├── lockup/
│   ├── lockup-horizontal-ink.svg     mark + wordmark side-by-side, ink
│   ├── lockup-horizontal-paper.svg   same, on INK ground
│   ├── lockup-horizontal-mono.svg    currentColor variant (themeable)
│   ├── lockup-stacked-ink.svg        mark above, wordmark below — for centered hero
│   └── lockup-stacked-paper.svg      same, on INK ground
└── social/
    ├── github-social-1280x640.svg    GitHub repo "Social preview" (Settings → Social preview)
    ├── og-image-1200x630.svg         Open Graph / Twitter card (`<meta property="og:image">`)
    └── readme-banner-1600x400.svg    Wide banner for the top of README.md
```

## Recommended HTML
```html
<link rel="icon" type="image/svg+xml" href="/favicon-adaptive.svg" />
<link rel="apple-touch-icon" href="/apple-touch-icon.svg" />
<meta property="og:image" content="https://your.site/og-image-1200x630.png" />
```

## A note on fonts
The lockups and social cards reference **Geist** and **JetBrains Mono**.
- When the SVG is rendered in a browser that has those fonts loaded (or you serve the page with the Google Fonts `<link>` in this project's `index.html`), text renders perfectly.
- When rendered by services that can't load web fonts (e.g. some OG-image scrapers), system sans/mono will be substituted. For pixel-perfect OG embedding, convert `og-image-1200x630.svg` to PNG at the same dimensions — any browser headless screenshot, `resvg`, or `rsvg-convert --keep-image-data` works.

## Tokens (mirrors brand/system.jsx)
| Token  | Hex     | Use |
|--------|---------|-----|
| Ink    | `#0A0C10` | Primary surface on dark, body text on light |
| Paper  | `#F4F2EC` | Primary surface on light, text on dark |
| Signal | `#FF5C28` | The accent. Marks, CTAs, one highlight per surface |
| Mint   | `#00D9A3` | "Shield active" status only — sparingly |
| Steel  | `#6B7280` | Secondary text, meta |

## Typography
- **Geist** — display, UI, body
- **JetBrains Mono** — code, CLI, labels, meta
