#!/usr/bin/env python3
"""
Link Checker for Website

Checks for broken links in the website:
- Media references in markdown (images, videos)
- Cover images and resources in frontmatter
- Internal page links
- Optionally checks external URLs
"""

import argparse
import re
import sys
from pathlib import Path
from typing import Optional
from urllib.parse import urlparse

try:
    import requests
    HAS_REQUESTS = True
except ImportError:
    HAS_REQUESTS = False


def is_external_url(url: str) -> bool:
    """Check if URL is external (http/https)."""
    return url.startswith('http://') or url.startswith('https://')


def is_anchor_link(url: str) -> bool:
    """Check if URL is an anchor link."""
    return url.startswith('#')


def is_skip_url(url: str) -> bool:
    """Skip data:, javascript:, mailto:, tel:."""
    u = url.strip().lower()
    return u.startswith('data:') or u.startswith('javascript:') or u.startswith('mailto:') or u.startswith('tel:')


def is_skip_external_check(url: str) -> bool:
    """Skip external URLs that often block HEAD or return non-2xx for bots (preconnect, CDN roots)."""
    u = url.strip().lower()
    if not u.startswith('http'):
        return False
    parsed = urlparse(u)
    host = (parsed.netloc or '').split(':')[0].lower()
    # Preconnect/stylesheet hosts: HEAD to domain root often 404; link works in browser
    if host in ('fonts.googleapis.com', 'fonts.gstatic.com', 'cdnjs.cloudflare.com'):
        return True
    return False


def check_external_url(url: str, timeout: int = 5) -> tuple[bool, str]:
    """Check if external URL is reachable. Treats 403/429/418 as OK (sites often block bots)."""
    if not HAS_REQUESTS:
        return True, "skipped (requests not installed)"
    if is_skip_external_check(url):
        return True, "skipped (preconnect/CDN)"
    try:
        response = requests.head(url, timeout=timeout, allow_redirects=True)
        if response.status_code < 400:
            return True, f"OK ({response.status_code})"
        if response.status_code in (403, 418, 429):
            return True, f"assumed OK ({response.status_code}, often bot-block)"
        return False, f"HTTP {response.status_code}"
    except requests.exceptions.Timeout:
        return False, "timeout"
    except requests.exceptions.ConnectionError:
        return False, "connection error"
    except Exception as e:
        return False, str(e)[:50]


def extract_links_from_markdown(file_path: Path) -> list[dict]:
    """Extract all links from a markdown file."""
    links = []
    
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Split frontmatter and body
    frontmatter = ""
    body = content
    if content.startswith('---'):
        parts = content.split('---', 2)
        if len(parts) >= 3:
            frontmatter = parts[1]
            body = parts[2]
    
    # Extract cover_image from frontmatter
    cover_match = re.search(r'cover_image:\s*["\']?([^"\'\n]+)["\']?', frontmatter)
    if cover_match:
        links.append({
            'url': cover_match.group(1).strip(),
            'type': 'cover_image',
            'line': content[:content.find(cover_match.group(0))].count('\n') + 1
        })
    
    # Extract resource URLs from frontmatter
    resource_pattern = re.compile(r'url:\s*["\']?([^"\'\n]+)["\']?')
    for match in resource_pattern.finditer(frontmatter):
        url = match.group(1).strip()
        links.append({
            'url': url,
            'type': 'resource',
            'line': content[:content.find(match.group(0))].count('\n') + 1
        })
    
    # Extract markdown image/video links: ![alt](url)
    image_pattern = re.compile(r'!\[([^\]]*)\]\(([^)]+)\)')
    for match in image_pattern.finditer(body):
        url = match.group(2).strip()
        # Remove title if present: ![alt](url "title")
        if ' "' in url:
            url = url.split(' "')[0]
        links.append({
            'url': url,
            'type': 'media',
            'alt': match.group(1),
            'line': content[:content.find(match.group(0))].count('\n') + 1
        })
    
    # Extract markdown links: [text](url)
    link_pattern = re.compile(r'(?<!!)\[([^\]]+)\]\(([^)]+)\)')
    for match in link_pattern.finditer(body):
        url = match.group(2).strip()
        if ' "' in url:
            url = url.split(' "')[0]
        links.append({
            'url': url,
            'type': 'link',
            'text': match.group(1),
            'line': content[:content.find(match.group(0))].count('\n') + 1
        })
    
    # Extract HTML src attributes
    src_pattern = re.compile(r'src=["\']([^"\']+)["\']')
    for match in src_pattern.finditer(body):
        links.append({
            'url': match.group(1),
            'type': 'html_src',
            'line': content[:content.find(match.group(0))].count('\n') + 1
        })
    
    # Extract HTML href attributes (in body, not frontmatter)
    href_pattern = re.compile(r'href=["\']([^"\']+)["\']')
    for match in href_pattern.finditer(body):
        links.append({
            'url': match.group(1),
            'type': 'html_href',
            'line': content[:content.find(match.group(0))].count('\n') + 1
        })
    
    return links


def resolve_relative_path(base_path: Path, url: str, content_dir: Path, repo_root: Optional[Path] = None) -> Optional[Path]:
    """Resolve a relative URL to an absolute file path. base_path is the file containing the link."""
    if is_external_url(url) or is_anchor_link(url) or is_skip_url(url):
        return None
    url = url.split("#", 1)[0].split("?", 1)[0].strip()
    if not url:
        return None
    root = repo_root or content_dir.parent
    if url.startswith("../") or url.startswith("./"):
        resolved = (base_path.parent / url).resolve()
    elif url.startswith("/"):
        resolved = (root / url.lstrip("/")).resolve()
    elif url.startswith("content/"):
        resolved = (root / url).resolve()
    else:
        resolved = (base_path.parent / url).resolve()
    return resolved


def extract_links_from_html(html_path: Path) -> list[dict]:
    """Extract href and src URLs from an HTML file."""
    links = []
    content = html_path.read_text(encoding="utf-8")
    for pattern, link_type in [
        (re.compile(r'\bhref=["\']([^"\']+)["\']'), 'href'),
        (re.compile(r'\bsrc=["\']([^"\']+)["\']'), 'src'),
    ]:
        for m in pattern.finditer(content):
            url = m.group(1).strip()
            line = content[: m.start()].count('\n') + 1
            links.append({'url': url, 'type': link_type, 'line': line})
    return links


def _check_links_list(
    file_path: Path,
    links: list[dict],
    content_dir: Path,
    repo_root: Path,
    base_path: Path,
    check_external: bool,
    verbose: bool,
) -> list[dict]:
    broken = []
    for link in links:
        url = link['url']
        if is_anchor_link(url) or is_skip_url(url):
            continue
        if url.startswith("$") or "${" in url:
            continue
        if is_external_url(url):
            if check_external:
                ok, msg = check_external_url(url)
                if not ok:
                    broken.append({
                        'file': file_path,
                        'url': url,
                        'type': link['type'],
                        'line': link.get('line', 0),
                        'reason': msg,
                    })
                elif verbose:
                    print(f"  OK: {url}")
            continue
        resolved = resolve_relative_path(base_path, url, content_dir, repo_root)
        if resolved and not resolved.exists():
            broken.append({
                'file': file_path,
                'url': url,
                'type': link['type'],
                'line': link.get('line', 0),
                'reason': 'file not found',
            })
        elif verbose and resolved:
            print(f"  OK: {url}")
    return broken


def check_file(
    file_path: Path,
    content_dir: Path,
    repo_root: Path,
    check_external: bool = False,
    verbose: bool = False,
) -> list[dict]:
    """Check all links in a markdown file and return broken ones."""
    links = extract_links_from_markdown(file_path)
    return _check_links_list(
        file_path, links, content_dir, repo_root, file_path, check_external, verbose
    )


def check_html_file(
    html_path: Path,
    content_dir: Path,
    repo_root: Path,
    check_external: bool = False,
    verbose: bool = False,
) -> list[dict]:
    """Check all links in an HTML file (href/src) and return broken ones."""
    links = extract_links_from_html(html_path)
    return _check_links_list(
        html_path, links, content_dir, repo_root, html_path, check_external, verbose
    )


def main():
    parser = argparse.ArgumentParser(description='Check for broken links in website')
    parser.add_argument('--check-external', action='store_true', 
                        help='Also check external URLs (slow)')
    parser.add_argument('--verbose', '-v', action='store_true',
                        help='Show all links, not just broken ones')
    parser.add_argument('--content-dir', type=str, default=None,
                        help='Content directory path')
    
    args = parser.parse_args()
    
    # Determine content directory
    if args.content_dir:
        content_dir = Path(args.content_dir)
    else:
        script_dir = Path(__file__).parent
        content_dir = script_dir.parent / 'content'
    
    repo_root = content_dir.parent
    if not content_dir.exists():
        print(f"Error: Content directory not found: {content_dir}", file=sys.stderr)
        sys.exit(1)
    if args.check_external and not HAS_REQUESTS:
        print("Error: --check-external requires 'requests'. Install with: pip install requests", file=sys.stderr)
        sys.exit(1)

    print(f"{'=' * 60}")
    print("Link Checker")
    print(f"{'=' * 60}")
    print(f"Content directory: {content_dir}")
    print(f"Check external URLs: {args.check_external}")
    print(f"{'=' * 60}\n")

    all_broken = []

    markdown_files = list(content_dir.glob("**/*.md"))
    print(f"Checking {len(markdown_files)} markdown files")
    for md_file in sorted(markdown_files):
        if args.verbose:
            print(f"  {md_file.relative_to(repo_root)}")
        broken = check_file(md_file, content_dir, repo_root, args.check_external, args.verbose)
        all_broken.extend(broken)

    html_files = [repo_root / n for n in ("index.html", "art.html", "research.html", "about.html") if (repo_root / n).exists()]
    print(f"Checking {len(html_files)} HTML files")
    for html_path in html_files:
        if args.verbose:
            print(f"  {html_path.name}")
        broken = check_html_file(html_path, content_dir, repo_root, args.check_external, args.verbose)
        all_broken.extend(broken)

    print(f"\n{'=' * 60}")
    if all_broken:
        print(f"BROKEN LINKS FOUND: {len(all_broken)}")
        print(f"{'=' * 60}\n")
        by_file: dict[Path, list] = {}
        for b in all_broken:
            if b["file"] not in by_file:
                by_file[b["file"]] = []
            by_file[b["file"]].append(b)
        for file_path, broken_list in sorted(by_file.items()):
            try:
                rel = file_path.relative_to(repo_root)
            except ValueError:
                rel = file_path
            print(f"{rel}:")
            for b in broken_list:
                print(f"  Line {b['line']}: [{b['type']}] {b['url']}")
                print(f"           -> {b['reason']}")
            print()
        sys.exit(1)
    print("NO BROKEN LINKS FOUND")
    print(f"{'=' * 60}")
    sys.exit(0)


if __name__ == '__main__':
    main()
