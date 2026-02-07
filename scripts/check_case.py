#!/usr/bin/env python3
"""
Case-sensitivity checker for local asset references.

This catches the common "works on macOS, breaks on GitHub Pages" issue where a referenced
path differs only by letter case (e.g. `media/hand.jpg` vs file `media/hand.JPG`).

It scans markdown files in `content/` for:
- frontmatter `cover_image: ...`
- frontmatter resource `url: ...`
- markdown images `![alt](path)`
- markdown links `[text](path)`
- inline HTML `src="..."` / `href="..."`

Usage:
  python3 scripts/check_case.py
  python3 scripts/check_case.py --content-dir content
"""

from __future__ import annotations

import argparse
import re
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable, Optional


ASSET_EXTENSIONS: tuple[str, ...] = (
    ".jpg",
    ".jpeg",
    ".png",
    ".gif",
    ".webp",
    ".avif",
    ".svg",
    ".mp4",
    ".webm",
    ".mov",
    ".m4v",
    ".ogv",
    ".pdf",
)


@dataclass(frozen=True)
class Ref:
    md_file: Path
    line: int
    kind: str
    url: str


@dataclass(frozen=True)
class CaseIssue:
    md_file: Path
    line: int
    kind: str
    url: str
    resolved_path: Path
    issue: str
    suggestion: Optional[str]


def _is_external(url: str) -> bool:
    return bool(re.match(r"^[a-zA-Z][a-zA-Z0-9+.-]*://", url))


def _is_anchor(url: str) -> bool:
    return url.startswith("#")


def _strip_wrapping_quotes(s: str) -> str:
    s = s.strip()
    if len(s) >= 2 and ((s[0] == s[-1] == '"') or (s[0] == s[-1] == "'")):
        return s[1:-1].strip()
    return s


def _strip_query_and_fragment(url: str) -> str:
    # GitHub Pages serves files by path only; strip ?query and #fragment for filesystem checks.
    url = url.split("#", 1)[0]
    url = url.split("?", 1)[0]
    return url


def _remove_md_title(url: str) -> str:
    # Handle: ![alt](path "title") and [text](path "title")
    # We only care about the path portion for filesystem resolution.
    if ' "' in url:
        return url.split(' "', 1)[0].strip()
    if " '" in url:
        return url.split(" '", 1)[0].strip()
    return url.strip()


def extract_refs_from_markdown(md_file: Path) -> list[Ref]:
    content = md_file.read_text(encoding="utf-8")

    frontmatter = ""
    body = content
    if content.startswith("---"):
        parts = content.split("---", 2)
        if len(parts) >= 3:
            frontmatter = parts[1]
            body = parts[2]

    refs: list[Ref] = []

    def line_of(snippet: str) -> int:
        idx = content.find(snippet)
        if idx < 0:
            return 0
        return content[:idx].count("\n") + 1

    cover_match = re.search(r"cover_image:\s*([^\n]+)", frontmatter)
    if cover_match:
        raw = _strip_wrapping_quotes(cover_match.group(1))
        refs.append(Ref(md_file=md_file, line=line_of(cover_match.group(0)), kind="cover_image", url=raw))

    for match in re.finditer(r"url:\s*([^\n]+)", frontmatter):
        raw = _strip_wrapping_quotes(match.group(1))
        refs.append(Ref(md_file=md_file, line=line_of(match.group(0)), kind="resource", url=raw))

    for match in re.finditer(r"!\[([^\]]*)\]\(([^)]+)\)", body):
        raw = _remove_md_title(match.group(2))
        refs.append(Ref(md_file=md_file, line=line_of(match.group(0)), kind="media", url=raw))

    for match in re.finditer(r"(?<!!)\[([^\]]+)\]\(([^)]+)\)", body):
        raw = _remove_md_title(match.group(2))
        refs.append(Ref(md_file=md_file, line=line_of(match.group(0)), kind="link", url=raw))

    for match in re.finditer(r'src=["\']([^"\']+)["\']', body):
        refs.append(Ref(md_file=md_file, line=line_of(match.group(0)), kind="html_src", url=match.group(1)))

    for match in re.finditer(r'href=["\']([^"\']+)["\']', body):
        refs.append(Ref(md_file=md_file, line=line_of(match.group(0)), kind="html_href", url=match.group(1)))

    return refs


def resolve_ref_to_path(repo_root: Path, md_file: Path, url: str, content_dir: Path) -> Optional[Path]:
    url = _strip_query_and_fragment(url.strip())

    if not url:
        return None
    if _is_external(url) or _is_anchor(url):
        return None

    # Only check "asset-like" paths. This avoids noise from page links like `research.html#slug`.
    lower = url.lower()
    if not any(lower.endswith(ext) for ext in ASSET_EXTENSIONS):
        return None

    if url.startswith("/"):
        return (repo_root / url.lstrip("/")).resolve()
    # Paths starting with content/ are repo-root-relative (e.g. in content/about/talks.md).
    if url.startswith("content/"):
        return (repo_root / url).resolve()

    # Resolve relative paths from the markdown file location.
    return (md_file.parent / url).resolve()


def _within(child: Path, parent: Path) -> bool:
    try:
        child.resolve().relative_to(parent.resolve())
        return True
    except ValueError:
        return False


def resolve_actual_case(repo_root: Path, target: Path) -> tuple[Optional[Path], Optional[str]]:
    """
    Return (actual_path, issue) where:
    - actual_path is the path with the real casing if it can be resolved
    - issue is None if exact-case match, else a short description
    """
    if not _within(target, repo_root):
        return None, "outside repo"

    rel = target.resolve().relative_to(repo_root.resolve())
    current = repo_root.resolve()
    corrected_parts: list[str] = []
    mismatch_found = False

    for part in rel.parts:
        if not current.is_dir():
            return None, "missing parent directory"

        entries = list(current.iterdir())
        names = [p.name for p in entries]

        if part in names:
            corrected_parts.append(part)
            current = current / part
            continue

        ci_matches = [n for n in names if n.lower() == part.lower()]
        if not ci_matches:
            return None, "file not found"
        if len(ci_matches) > 1:
            return None, "ambiguous case-insensitive match"

        mismatch_found = True
        corrected = ci_matches[0]
        corrected_parts.append(corrected)
        current = current / corrected

    actual = repo_root.resolve().joinpath(*corrected_parts)
    if mismatch_found:
        return actual, "case mismatch"
    return actual, None


def iter_markdown_files(content_dir: Path) -> Iterable[Path]:
    yield from content_dir.glob("**/*.md")


def main() -> int:
    parser = argparse.ArgumentParser(description="Check markdown asset links for case mismatches.")
    parser.add_argument(
        "--content-dir",
        type=str,
        default=None,
        help="Content directory (default: <repo>/content).",
    )
    args = parser.parse_args()

    repo_root = Path(__file__).resolve().parents[1]
    content_dir = Path(args.content_dir).resolve() if args.content_dir else (repo_root / "content").resolve()

    if not content_dir.exists():
        print(f"Error: content dir not found: {content_dir}", file=sys.stderr)
        return 2

    issues: list[CaseIssue] = []
    md_files = sorted(iter_markdown_files(content_dir))

    for md in md_files:
        for ref in extract_refs_from_markdown(md):
            target = resolve_ref_to_path(repo_root=repo_root, md_file=md, url=ref.url, content_dir=content_dir)
            if target is None:
                continue

            actual, issue = resolve_actual_case(repo_root=repo_root, target=target)
            if issue is None:
                continue

            suggestion: Optional[str] = None
            if actual is not None and _within(actual, md.parent):
                # Suggest a relative path fix (keeps markdown portable).
                suggestion = str(actual.relative_to(md.parent))
            elif actual is not None and _within(actual, repo_root):
                suggestion = str(actual.relative_to(repo_root))

            issues.append(
                CaseIssue(
                    md_file=md,
                    line=ref.line,
                    kind=ref.kind,
                    url=ref.url,
                    resolved_path=target,
                    issue=issue,
                    suggestion=suggestion,
                )
            )

    if not issues:
        print("OK: no case-sensitive asset path issues found.")
        return 0

    print(f"FOUND {len(issues)} case-sensitive issue(s):")
    for it in issues:
        rel_md = it.md_file.relative_to(repo_root)
        print(f"- {rel_md}:{it.line} [{it.kind}] {it.url}")
        print(f"    -> {it.issue}: {it.resolved_path.relative_to(repo_root) if _within(it.resolved_path, repo_root) else it.resolved_path}")
        if it.suggestion:
            print(f"    -> suggested fix: {it.suggestion}")
    return 1


if __name__ == "__main__":
    raise SystemExit(main())

