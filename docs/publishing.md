# Publishing the v0.1.0 release

The GitHub release is live. Two package managers still need to be uploaded manually because they require your personal account credentials:

- **PyPI** (Python) — needs an API token from your account
- **crates.io** (Rust) — needs an API token from your account

This file is a one-time runbook. After you do it once, the next releases follow the same shape.

---

## 1. PyPI (Python)

### One-time account setup

1. Create a PyPI account at <https://pypi.org/account/register/>
2. Enable 2FA (PyPI requires it for publishing).
3. Generate a project-scoped API token at <https://pypi.org/manage/account/token/>
   - Scope: "Entire account" for the first upload (so the project gets created).
   - You'll narrow it to "Project: openinfra-logger" right after the first upload succeeds.
4. Store the token (it starts with `pypi-`):
   - Option A (recommended): create `~/.pypirc`:
     ```ini
     [pypi]
       username = __token__
       password = pypi-AgENdGV...
     ```
   - Option B: pass it via `--password` on the upload command (only safe in a shell that doesn't persist history).

### Upload v0.1.0

The wheel and sdist are already built and committed to GitHub Releases. Rebuild fresh from the tag to make sure the artifacts match what's published.

```bash
cd python
python -m pip install --upgrade build twine
python -m build  # produces python/dist/openinfra_logger-0.1.0.tar.gz and .whl
python -m twine check dist/*  # sanity check
python -m twine upload dist/*
```

After it succeeds:

- Visit <https://pypi.org/project/openinfra-logger/> — page should render with the Python README and metadata.
- Replace the broad account token with a project-scoped token from <https://pypi.org/manage/project/openinfra-logger/settings/>.

### Test the package immediately

```bash
python -m pip install openinfra-logger
python -c "from openinfra_logger import log; log('pypi works', 'info', {'ok': True})"
```

---

## 2. crates.io (Rust)

### One-time account setup

1. Sign in at <https://crates.io> with your GitHub account.
2. Visit <https://crates.io/me> → **API Access** → **New Token** → name it `openinfra-logger-publish`.
3. Authenticate Cargo locally (token is stored in `~/.cargo/credentials.toml`):
   ```bash
   cargo login <PASTE_TOKEN_HERE>
   ```

### Upload v0.1.0

```bash
cd rust
cargo package        # dry-run: produces target/package/openinfra-logger-0.1.0.crate
cargo publish        # actual upload to crates.io
```

After it succeeds:

- Visit <https://crates.io/crates/openinfra-logger> — page should appear within a minute.
- <https://docs.rs/openinfra-logger> builds automatically (usually 5–15 min) and serves the rustdoc from the published crate.

### Test the package immediately

```bash
# Anywhere outside the openinfra-logger repo:
cargo new oil-test
cd oil-test
cargo add openinfra-logger
# Replace src/main.rs with a minimal usage example, then:
cargo run
```

---

## 3. Verifying everything is on the air

After both uploads succeed, run this checklist. All four channels should respond with **HTTP 200** and the expected version:

```bash
# Node (already up)
curl -s https://registry.npmjs.org/@jonathascordeiro20/openinfra-logger \
  | python -c "import sys, json; print('npm', json.load(sys.stdin)['dist-tags']['latest'])"

# Python (after step 1)
curl -s https://pypi.org/pypi/openinfra-logger/json \
  | python -c "import sys, json; print('pypi', json.load(sys.stdin)['info']['version'])"

# Rust (after step 2)
curl -s https://crates.io/api/v1/crates/openinfra-logger \
  | python -c "import sys, json; print('crates.io', json.load(sys.stdin)['crate']['max_version'])"

# Go (already up — Go modules resolve from git tags directly)
curl -s "https://proxy.golang.org/github.com/jonathascordeiro20/openinfra-logger/go/@v/list"
```

Expected:

```
npm        0.1.0
pypi       0.1.0
crates.io  0.1.0
v0.1.0
```

If all four print v0.1.0, **the project is fully distributed** and the announcement post can claim "available via every major package manager" without lying.

---

## 4. Next time (v0.2.0 and beyond)

The runbook becomes a single `gh workflow run release.yml v0.2.0` once you wire the secrets `PYPI_API_TOKEN`, `CRATES_IO_TOKEN`, and `NPM_TOKEN` to the existing `.github/workflows/release.yml`. Until that automation lands, the manual steps above are the path.
