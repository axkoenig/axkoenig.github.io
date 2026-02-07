# Alexander Koenig

Personal site (art, research, about). Pre-rendered static HTML from markdown in `content/`; built files are committed.

## Setup

```bash
./scripts/install-hooks.sh   # optional: build + format + checks on every commit
```

## Dev

```bash
python3 scripts/dev.py
```

Serves http://localhost:8000, watches `content/` and `scripts/build.py`, rebuilds on save. Edit → save → refresh.

## Commit

- **With hook:** `git add` + `git commit`. Hook runs: build → Prettier (HTML format) → stage HTML → check case, links, media size.
- **Without hook:** `python3 scripts/build.py` then `git add index.html art.html research.html about.html`.

## Scripts

| Script | Purpose |
|--------|--------|
| `build.py` | Pre-render index carousel, art/research grids, about bio+publications into HTML. |
| `check_case.py` | Asset path case matches filesystem (avoids break on GitHub Pages). |
| `check_links.py` | Internal links exist; with `--check-external`, external URLs must return OK. Needs `pip install requests` for external. |
| `check_media_size.py` | Images ≤2 MB, videos ≤10 MB (displayed media only). |
| `optimize_media.py` | Compress/rename media (run manually). |

HTML formatting uses Prettier (`npx prettier --write ...`); skipped if Node not installed.
