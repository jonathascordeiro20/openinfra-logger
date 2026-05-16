# OpenInfra Logger — `dist/` build for Hostinger

Self-contained static bundle. Drop the entire contents of this folder into the **public_html** root of your Hostinger account. No build step, no Node, no PHP, nothing else to install.

## What's inside (13 files · ~57 KB total)

```
dist/
├── index.html              22.5 KB   the landing page
├── styles.css              18.6 KB   brand tokens + responsive
├── script.js                2.4 KB   tabs + copy-install + smooth scroll
├── .htaccess                2.0 KB   MIME types, gzip, cache, security headers
├── robots.txt                       crawler hints
├── sitemap.xml                      single-page sitemap
├── favicon/
│   ├── favicon.svg                  default
│   ├── favicon-adaptive.svg         auto light/dark (linked from <head>)
│   ├── favicon-light.svg
│   ├── favicon-dark.svg
│   └── apple-touch-icon.svg         180×180 padded
└── social/
    ├── og-image-1200x630.svg        Open Graph card
    └── github-social-1280x640.svg   GitHub repo social preview (1280×640)
```

External dependencies at runtime: **only Google Fonts** (Geist + JetBrains Mono via CDN). Everything else is local.

---

## 1. Domain

This bundle is already wired to **`openinfralogger.fun`** — meta tags, sitemap, and robots.txt all point to that host. No find-and-replace needed before upload.

If you need to rebuild for a different domain, the only places to edit are:

- `index.html` (lines 16, 19, 26 — og:url, og:image, twitter:image)
- `robots.txt` (line 4 — Sitemap)
- `sitemap.xml` (line 4 — `<loc>`)

PowerShell one-liner from the `dist/` folder:

```powershell
(Get-Content index.html, robots.txt, sitemap.xml) -replace 'openinfralogger.fun', 'NEW-DOMAIN.com' | Set-Content -Encoding UTF8 index.html, robots.txt, sitemap.xml
```

---

## 2. Upload to Hostinger

### Option A — File Manager (hPanel, easiest)

1. Login at <https://hpanel.hostinger.com>.
2. **Hosting → Manage → File Manager**.
3. Open **public_html/**. Delete the placeholder `index.html` / `default.php` if present.
4. Click **Upload Files** → drag the **contents** of `dist/` (not the folder itself).
   - Make sure hidden files are visible (`.htaccess` is hidden by default in some OSes; in Windows: right-click in Explorer → **View → Show hidden items**).
5. Wait for all 13 files to finish uploading. Confirm `.htaccess` and `index.html` are both at the root of `public_html/`.

### Option B — FTP / FileZilla

- Host: `ftp.your-hostinger-server` (find in hPanel → **FTP Accounts**)
- Username/password from the same panel
- Upload the **contents** of `dist/` into `/public_html/`

### Option C — SSH (Business plan and above)

```bash
scp -r dist/* dist/.htaccess YOUR-USER@YOUR-HOST.hostinger.com:~/public_html/
```

---

## 3. After uploading

### Verify the site
- Open `https://openinfralogger.fun/` in incognito.
- Test the **copy install** button.
- Click each of the 4 code tabs (Node / Python / Go / Rust) — the JSON output and runtime label update.
- Resize the window to ~700px to verify the mobile layout.

### Free SSL (auto)
- hPanel → **SSL** → enable **Free SSL** for your domain.
- After SSL provisions (1–10 min), uncomment the HTTPS redirect block at the bottom of `.htaccess`:
  ```apache
  RewriteEngine On
  RewriteCond %{HTTPS} !=on
  RewriteRule ^(.*)$ https://%{HTTP_HOST}/$1 [R=301,L]
  ```

### Search Console
- Submit `https://openinfralogger.fun/sitemap.xml` at <https://search.google.com/search-console>.

### Open Graph preview
- Test the social card at <https://www.opengraph.xyz/url/https%3A%2F%2Fopeninfralogger.fun>.
- **Note:** Some platforms (Facebook, X/Twitter) prefer PNG over SVG for `og:image`. If previews look broken, rasterize:
  ```bash
  # Using ImageMagick or rsvg-convert
  rsvg-convert -w 1200 -h 630 social/og-image-1200x630.svg -o social/og-image-1200x630.png
  # Then update the meta tag href to .png
  ```

---

## 4. Updating the site later

Any time you change `index.html`, `styles.css` or `script.js`:

1. Edit locally.
2. Upload only the changed files (overwrite).
3. Hard-refresh the browser (`Ctrl+Shift+R`) — `.htaccess` already caches CSS/JS for 30 days, so users may need to wait for cache expiry unless you append a version query string (e.g. `styles.css?v=2`).

---

## 5. Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Page loads but no styling | `.htaccess` missing or MIME type wrong | Re-upload `.htaccess` to public_html root (hidden file) |
| 403 Forbidden on `/` | `index.html` not at root, or wrong permissions | Confirm file is at `public_html/index.html`; set perms to `644` |
| Favicon doesn't show | Browser caching old favicon | Hard-refresh; check `/favicon/favicon-adaptive.svg` returns 200 |
| `og:image` shows placeholder | Forgot step 1 (replace `YOUR-DOMAIN`) | Re-edit and re-upload |
| Slow first paint | Google Fonts blocking | Already mitigated with `preconnect`; further: inline a `font-display: swap` rule |

---

## Tech notes

- Pure HTML/CSS/vanilla JS. No bundler, no framework, no build artifacts.
- Total size ~57 KB. With gzip enabled by the included `.htaccess`, served weight is ~18 KB.
- Cache strategy: HTML never cached (so deploys are instant), CSS/JS cached for 30 days.
- Security headers (`X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`) are set by `.htaccess` — verify at <https://securityheaders.com>.
