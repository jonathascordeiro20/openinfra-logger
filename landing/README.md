# OpenInfra Logger — Landing page

Static, dependency-free landing page for the OIL project. Single HTML file + one CSS file + ~50 lines of vanilla JS. Same zero-dependency philosophy as the library itself.

## File layout

```
landing/
├── index.html      hero, runtimes, pillars, code showcase, integrations, AI analyzer, numbers, CTA, footer
├── styles.css      brand tokens (Ink / Paper / Signal / Mint / Steel) + Geist + JetBrains Mono
├── script.js       tab switching + copy-install command + smooth scroll
└── README.md       this file
```

The page references brand assets from `../brand/` (favicons, OG image). Everything resolves with relative paths so the whole `landing/` folder is portable.

## Preview locally

```bash
# Any static server works — pick one:
python -m http.server -d landing 8080
# or:
npx serve landing
```

Then open <http://localhost:8080>.

## Deploy options

### GitHub Pages (recommended — zero config)

1. Push to `main`.
2. Repo → **Settings → Pages**.
3. Source: **Deploy from a branch** → branch `main`, folder `/landing`. Save.
4. Live at `https://jonathascordeiro20.github.io/openinfra-logger/`.

Because the page references `../brand/`, GitHub Pages must serve the **repo root**, not just `landing/`. Two options:

- **Option A — serve from repo root.** Move `index.html`, `styles.css`, `script.js` to the root (rename `index.html` to something other than `README.md`). Quick but mixes site and library.
- **Option B — keep landing/ isolated and embed brand assets.** Copy the needed SVGs into `landing/_assets/` and update the paths. The shell script below does it:

```bash
mkdir -p landing/_assets/{favicon,social}
cp brand/favicon/favicon-adaptive.svg brand/favicon/apple-touch-icon.svg landing/_assets/favicon/
cp brand/social/og-image-1200x630.svg landing/_assets/social/
# Then rewrite the <link> / <meta> hrefs in landing/index.html from ../brand/... to _assets/...
```

### Vercel / Netlify / Cloudflare Pages

Drop the `landing/` folder. No build command. Output directory: `landing` (or root if you split).

### Custom domain

For `oil.openinfra.dev` or similar: configure a CNAME at your DNS provider, then set the custom domain in your host's settings.

## What's on the page

| Section | Anchor | Notes |
|---------|--------|-------|
| Hero | `#top` | Brand mark · install command (copyable) · pill with version |
| Runtimes strip | `#runtimes` | Node · Python · Go · Rust with native commands |
| Pillars | `#features` | Data Shield · Remote Batching · AI Root-Cause |
| Code showcase | — | Tabs across 4 runtimes, all rendering the same Datadog JSON |
| Integrations | `#integrations` | Datadog · ECS · OTel · Loki · Plain JSON · Custom |
| AI Analyzer | `#analyzer` | Terminal demo + 3 features + privacy note |
| Numbers | — | `0` deps · `4` runtimes · `69` tests passing · `MIT` |
| CTA | — | Quickstart + GitHub buttons |
| Footer | — | Library / Capabilities / Project / Community columns |

## Editing

Everything is plain HTML. Open `index.html` in any editor — no framework, no build step. Brand colors and typography are CSS variables in `styles.css:1-25`; change one token and the entire page updates.

## License

Same as the parent project — MIT.
