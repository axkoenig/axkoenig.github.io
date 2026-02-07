#!/usr/bin/env python3
"""
Local dev: serve the site and rebuild when content or build script changes.
Run from repo root: python3 scripts/dev.py
Then open http://localhost:8000 and refresh after editing markdown.
"""

import http.server
import os
import subprocess
import sys
import threading
import time
from pathlib import Path


def repo_root() -> Path:
    return Path(__file__).resolve().parent.parent


def build() -> bool:
    """Run build.py. Return True if successful."""
    root = repo_root()
    result = subprocess.run(
        [sys.executable, str(root / "scripts" / "build.py")],
        cwd=root,
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        print(result.stderr or result.stdout, file=sys.stderr)
        return False
    if result.stdout.strip():
        print(result.stdout.strip())
    return True


def last_mtime_tree(path: Path) -> float:
    """Max mtime of path and all descendants (files only)."""
    if not path.exists():
        return 0.0
    if path.is_file():
        return path.stat().st_mtime
    return max(
        (p.stat().st_mtime for p in path.rglob("*") if p.is_file()),
        default=0.0,
    )


def watch_and_build(interval: float = 1.5) -> None:
    root = repo_root()
    content_dir = root / "content"
    projects_json = root / "content" / "projects.json"
    build_script = root / "scripts" / "build.py"
    last = 0.0

    while True:
        try:
            t = max(
                last_mtime_tree(content_dir),
                projects_json.stat().st_mtime if projects_json.exists() else 0.0,
                build_script.stat().st_mtime if build_script.exists() else 0.0,
            )
            if last == 0:
                last = t  # skip build on first tick (already built at startup)
            elif t > last:
                print("[dev] change detected, rebuilding...")
                if build():
                    pass
                else:
                    print("[dev] build failed", file=sys.stderr)
                last = t
            time.sleep(interval)
        except KeyboardInterrupt:
            return
        except Exception as e:
            print(f"[dev] watch error: {e}", file=sys.stderr)
            time.sleep(interval)


def main() -> None:
    root = repo_root()
    os.chdir(root)

    # Build once so the served site is up to date
    build()

    port = 8000
    server = http.server.HTTPServer(
        ("", port),
        http.server.SimpleHTTPRequestHandler,
    )

    def serve() -> None:
        server.serve_forever()

    thread = threading.Thread(target=serve, daemon=True)
    thread.start()

    print(f"Serving at http://localhost:{port}/")
    print("Watching content/ and build script; rebuilds on change. Ctrl+C to stop.")
    watch_and_build()


if __name__ == "__main__":
    main()
