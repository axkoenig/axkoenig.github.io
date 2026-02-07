#!/usr/bin/env python3
"""
Check that displayed media (images and videos referenced in content) stay under size limits.
Fails if any image exceeds --max-image-mb or any video exceeds --max-video-mb.

Common practice: images often kept under 500 KB–1 MB for fast load; 2 MB is a generous max.
Videos: 10 MB is reasonable for short clips; longer content often 10–50 MB.
"""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path
from typing import Optional


def _strip_quotes(s: str) -> str:
    s = s.strip()
    if len(s) >= 2 and s[0] in "'\"" and s[-1] == s[0]:
        return s[1:-1].strip()
    return s


def _strip_title(url: str) -> str:
    if ' "' in url:
        return url.split(' "', 1)[0].strip()
    if " '" in url:
        return url.split(" '", 1)[0].strip()
    return url.strip()


def collect_media_paths(content_dir: Path, repo_root: Path) -> set[Path]:
    """Resolve all image/video paths referenced in content markdown (including content/about/)."""
    seen: set[Path] = set()
    image_ext = {".jpg", ".jpeg", ".png", ".gif", ".webp", ".avif", ".svg"}
    video_ext = {".mp4", ".webm", ".mov", ".m4v", ".ogv"}

    for md_path in content_dir.glob("**/*.md"):
        content = md_path.read_text(encoding="utf-8")
        frontmatter, body = "", content
        if content.startswith("---"):
            parts = content.split("---", 2)
            if len(parts) >= 3:
                frontmatter, body = parts[1], parts[2]

        base = md_path.parent

        # cover_image
        m = re.search(r"cover_image:\s*([^\n]+)", frontmatter)
        if m:
            url = _strip_quotes(m.group(1))
            if not url.startswith(("http://", "https://")):
                p = (base / url).resolve()
                if p.exists():
                    seen.add(p)

        # url: in frontmatter (resources)
        for m in re.finditer(r"url:\s*([^\n]+)", frontmatter):
            url = _strip_quotes(m.group(1))
            if not url.startswith(("http://", "https://")):
                p = (base / url).resolve()
                if p.exists():
                    seen.add(p)

        # ![alt](path)
        for m in re.finditer(r"!\[[^\]]*\]\(([^)]+)\)", body):
            url = _strip_title(m.group(1))
            if not url.startswith(("http://", "https://")):
                p = (base / url).resolve()
                if p.exists():
                    seen.add(p)

    # Only paths under repo and under content (exclude originals/full_res if we want only "displayed")
    # We include all resolved refs; the actual served file is the one referenced (often not in originals/).
    result = set()
    for p in seen:
        try:
            p.relative_to(repo_root)
        except ValueError:
            continue
        if p.is_file():
            result.add(p)
    return result


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Check displayed media file sizes (images and videos)."
    )
    parser.add_argument(
        "--content-dir",
        type=str,
        default=None,
        help="Content directory (default: <repo>/content).",
    )
    parser.add_argument(
        "--max-image-mb",
        type=float,
        default=2.0,
        help="Max size for images in MB (default: 2).",
    )
    parser.add_argument(
        "--max-video-mb",
        type=float,
        default=10.0,
        help="Max size for videos in MB (default: 10).",
    )
    args = parser.parse_args()

    repo_root = Path(__file__).resolve().parents[1]
    content_dir = Path(args.content_dir).resolve() if args.content_dir else (repo_root / "content")
    if not content_dir.exists():
        print(f"Error: content dir not found: {content_dir}", file=sys.stderr)
        return 2

    max_image_bytes = int(args.max_image_mb * 1024 * 1024)
    max_video_bytes = int(args.max_video_mb * 1024 * 1024)
    image_ext = {".jpg", ".jpeg", ".png", ".gif", ".webp", ".avif", ".svg"}
    video_ext = {".mp4", ".webm", ".mov", ".m4v", ".ogv"}

    paths = collect_media_paths(content_dir, repo_root)
    over: list[tuple[Path, int, int]] = []  # (path, size, limit)

    for p in paths:
        try:
            size = p.stat().st_size
        except OSError:
            continue
        ext = p.suffix.lower()
        if ext in image_ext:
            if size > max_image_bytes:
                over.append((p, size, max_image_bytes))
        elif ext in video_ext:
            if size > max_video_bytes:
                over.append((p, size, max_video_bytes))

    if not over:
        print("OK: all displayed media within size limits.")
        return 0

    print(f"Media over limit: {len(over)} file(s)")
    for p, size, limit in sorted(over, key=lambda x: -x[1]):
        try:
            rel = p.relative_to(repo_root)
        except ValueError:
            rel = p
        mb = size / (1024 * 1024)
        limit_mb = limit / (1024 * 1024)
        print(f"  {rel}: {mb:.2f} MB (limit {limit_mb:.1f} MB)")
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
