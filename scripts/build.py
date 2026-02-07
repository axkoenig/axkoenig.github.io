#!/usr/bin/env python3
"""
Pre-render the whole site: index carousel, art/research grids, about bio (and optionally publications).
Run after changing content; dev.py and the pre-commit hook call this script.
"""

import json
import re
from pathlib import Path
from typing import Any


def parse_frontmatter(content: str) -> dict[str, Any]:
    """Extract top-level frontmatter key: value (no nested parsing)."""
    match = re.match(r"^---\s*\n([\s\S]*?)\n---\s*\n", content)
    if not match:
        return {}
    meta: dict[str, Any] = {}
    for line in match.group(1).split("\n"):
        if line.startswith((" ", "\t")):
            continue
        stripped = line.strip()
        if not stripped or stripped.startswith("-"):
            continue
        if ":" not in stripped:
            continue
        key, _, value = line.partition(":")
        key = key.strip()
        value = value.strip()
        if key in (
            "title", "cover_image", "short_description", "date", "start_date", "end_date", "year",
            "location", "gallery", "dimensions", "copyright", "artist", "item_name",
        ):
            meta[key] = value.strip('"\'')
        elif key == "highlight":
            meta[key] = value.lower() in ("true", "yes", "1")
    return meta


def year_label(meta: dict[str, Any]) -> str:
    start = meta.get("start_date") or meta.get("date") or meta.get("year") or ""
    end = meta.get("end_date") or meta.get("date") or meta.get("year") or ""
    if not start and not end:
        return ""
    try:
        y1 = int(start[:4]) if start else None
        y2 = int(end[:4]) if end else None
    except (ValueError, TypeError):
        return start or end
    if y1 and y2:
        return str(y1) if y1 == y2 else f"{y1}–{y2}"
    return str(y1 or y2)


def _sort_ts(meta: dict[str, Any]) -> int:
    for k in ("start_date", "end_date", "date", "year"):
        v = meta.get(k)
        if not v:
            continue
        try:
            return int(str(v)[:4]) * 10000
        except (ValueError, TypeError):
            pass
    return 0


def project_tile_html(project: dict[str, Any], base_path: str) -> str:
    cover = (project.get("cover_image") or "").strip()
    if cover and not (cover.startswith("http://") or cover.startswith("https://")):
        cover = f"{base_path}/{project['path']}/{cover}"
    else:
        cover = ""
    year_label_val = project.get("year_label") or project.get("year") or ""
    location = project.get("location") or project.get("gallery") or ""
    dimensions = project.get("dimensions") or ""
    gallery = project.get("gallery") or project.get("location") or ""
    copyright_val = project.get("copyright") or project.get("artist") or ""
    item_name = project.get("item_name") or project.get("title") or ""
    description = (project.get("short_description") or "").strip()
    title = (project.get("title") or "Untitled").replace('"', "&quot;")

    cover_block = (
        f'<div class="project-cover">\n                <img src="{cover}" alt="{title}" loading="lazy" />\n            </div>'
        if cover
        else '<div class="project-cover"></div>'
    )
    return f'''        <div class="project-tile" data-project-id="{project["id"]}" data-project-slug="{project["slug"]}" data-year="{project.get("year") or ""}">
            {cover_block}
            <div class="project-content">
                <h3 class="project-title">{project.get("title") or "Untitled"}</h3>
                {f'<div class="project-year">{year_label_val}</div>' if year_label_val else ""}
                {f'<div class="project-description">{description}</div>' if description else ""}
                {f'<div class="project-location">{location}</div>' if location else ""}
                {f'<div class="project-item-name">{item_name}</div>' if item_name and item_name != (project.get("title") or "") else ""}
                {f'<div class="project-dimensions">{dimensions}</div>' if dimensions else ""}
                {f'<div class="project-gallery">{gallery}</div>' if gallery else ""}
                {f'<div class="project-copyright">© {copyright_val}</div>' if copyright_val else ""}
            </div>
        </div>'''


def carousel_item_html(project: dict[str, Any]) -> str:
    base = "content/art" if project["category"] == "art" else "content/research"
    cover = (project.get("cover_image") or "").strip()
    if cover and not (cover.startswith("http://") or cover.startswith("https://")):
        cover = f"{base}/{project['path']}/{cover}"
    else:
        cover = "https://via.placeholder.com/300x200/cccccc/999999?text="
    year_label_val = project.get("year_label") or ""
    short = (project.get("short_description") or "").strip()
    title = (project.get("title") or "Untitled").replace('"', "&quot;")
    return (
        f'<div class="carousel-item" data-project-slug="{project["slug"]}" data-project-category="{project["category"]}">'
        f'<img src="{cover}" alt="{title}" loading="lazy" />'
        '<div class="carousel-overlay">'
        f"<h3>{project.get('title') or 'Untitled'}</h3>"
        + (f'<div class="carousel-year">{year_label_val}</div>' if year_label_val else "")
        + (f"<p>{short}</p>" if short else "")
        + "</div></div>"
    )


def minimal_md_to_html(text: str) -> str:
    """Minimal markdown for about bio: paragraphs, links."""
    if not text.strip():
        return ""
    # Links: [text](url)
    text = re.sub(r"\[([^\]]+)\]\(([^)]+)\)", r'<a href="\2" class="link">\1</a>', text)
    # Paragraphs
    blocks = re.split(r"\n\s*\n", text.strip())
    out = []
    for b in blocks:
        b = b.strip()
        if not b:
            continue
        out.append(f"<p>{b}</p>")
    return "\n".join(out)


def extract_bio_html(bio_md_path: Path) -> str:
    raw = bio_md_path.read_text(encoding="utf-8")
    raw = re.sub(r"^#\s+About\s*\n\n?", "", raw, flags=re.IGNORECASE)
    match = re.search(r"##\s+Bio\s*\n\n?([\s\S]*)$", raw, re.IGNORECASE)
    if match:
        body = match.group(1).strip()
    else:
        body = raw.strip()
    return minimal_md_to_html(body)


def extract_papers_from_frontmatter(fm_text: str) -> list[dict[str, Any]]:
    """Extract papers list from frontmatter (papers: then - authors: ... with indented key: value)."""
    papers: list[dict[str, Any]] = []
    in_papers = False
    current: dict[str, Any] = {}
    lines = fm_text.split("\n")
    i = 0
    while i < len(lines):
        line = lines[i]
        stripped = line.strip()
        if stripped == "papers:":
            in_papers = True
            i += 1
            continue
        if not in_papers:
            i += 1
            continue
        # New paper: "  - authors: [...]" or "  - " at start of item
        if re.match(r"^\s{2}-\s+", line):
            if current:
                papers.append(current)
            current = {}
            rest = line.lstrip()[2:].lstrip()  # after "  - "
            if ":" in rest:
                k, _, v = rest.partition(":")
                k, v = k.strip(), v.strip().strip('"\'')
                if k == "authors" and "[" in v:
                    v = re.findall(r'"([^"]*)"', v)
                current[k] = v
            i += 1
            continue
        # Indented key: value (4+ spaces)
        if re.match(r"^\s{4}\w", line) and ":" in line:
            k, _, v = line.strip().partition(":")
            k, v = k.strip(), v.strip().strip('"\'')
            if k == "authors" and "[" in v:
                v = re.findall(r'"([^"]*)"', v)
                current[k] = v
            elif k == "resources":
                # Parse nested resources list (items at 6-space indent)
                res_list, next_i = _parse_resources_list(lines, i + 1, 6)
                current["resources"] = res_list
                i = next_i
                continue
            else:
                current[k] = v
        i += 1
    if current:
        papers.append(current)
    return papers


def aggregate_publications_html(content_dir: Path, research_list: list[str], base_path: str) -> str:
    papers: list[dict[str, Any]] = []
    for slug in research_list:
        md_path = content_dir / "research" / slug / "index.md"
        if not md_path.exists():
            continue
        raw = md_path.read_text(encoding="utf-8")
        match = re.match(r"^---\s*\n([\s\S]*?)\n---\s*\n", raw)
        if not match:
            continue
        fm = match.group(1)
        for p in extract_papers_from_frontmatter(fm):
            p["projectSlug"] = slug
            p["projectTitle"] = parse_frontmatter(raw).get("title") or slug
            papers.append(p)
    def _year_key(p: dict[str, Any]) -> int:
        y = p.get("year")
        if y is None:
            return 0
        try:
            return int(y) if isinstance(y, (int, float)) else int(str(y).strip())
        except (ValueError, TypeError):
            return 0
    papers.sort(key=lambda p: -_year_key(p))
    out = []
    for paper in papers:
        authors = paper.get("authors") or ""
        if isinstance(authors, list):
            authors = ", ".join(authors)
        title = paper.get("title") or ""
        venue = paper.get("venue") or ""
        year = paper.get("year") or ""
        project_slug = paper.get("projectSlug") or ""
        venue = re.sub(r"\[([^\]]+)\]\(([^)]+)\)", r'<a class="link" href="\2">\1</a>', venue)
        citation = f'{authors} "{title}" In: {venue}, {year}' if authors else f'"{title}" In: {venue}, {year}'
        project_link = f'<a class="resource-link" href="research.html#{project_slug}">→ Project</a>' if project_slug else ""
        resources = paper.get("resources") or []
        if isinstance(resources, list):
            def _resource_href(url: str) -> str:
                if not url or url.startswith("http://") or url.startswith("https://"):
                    return url
                return f"{base_path}/{project_slug}/{url}"

            res_html = "".join(
                f'<a class="resource-link" href="{_resource_href(r.get("url", r) if isinstance(r, dict) else r)}" target="_blank">{r.get("label", "Link") if isinstance(r, dict) else "Link"}</a>'
                for r in resources if (r.get("url") if isinstance(r, dict) else r)
            )
        else:
            res_html = ""
        all_links = f'<div class="paper-resources">{project_link}{res_html}</div>'
        out.append(
            f'<div class="three-column-layout"><div class="column-1"></div><div class="column-2"><p>{citation}</p></div><div class="column-3">{all_links}</div></div>'
        )
    return "\n".join(out) if out else "<p>No publications found.</p>"


def _yaml_value(s: str) -> str:
    """Extract value from YAML-like string; handle quoted values containing colons."""
    s = s.strip()
    if not s:
        return s
    if s[0] in "\"'" and len(s) > 1:
        end = s[0]
        i = 1
        while i < len(s):
            if s[i] == "\\" and i + 1 < len(s):
                i += 2
                continue
            if s[i] == end:
                return s[1:i].replace("\\\"", '"').replace("\\'", "'")
            i += 1
    return s.strip('"\'') if s else s


def _parse_resources_list(lines: list[str], start_i: int, indent: int) -> tuple[list[dict[str, str]], int]:
    """Parse YAML-like resources list; return (list of {label, url}, index after list)."""
    resources: list[dict[str, str]] = []
    i = start_i
    item: dict[str, str] = {}
    while i < len(lines):
        line = lines[i]
        strip = line.strip()
        if not strip:
            i += 1
            continue
        line_indent = len(line) - len(line.lstrip())
        if line_indent < indent and strip:
            break
        if strip.startswith("- ") and line_indent >= indent:
            if item:
                resources.append(item)
            item = {}
            rest = strip[2:].strip()
            if ":" in rest:
                k, _, v = rest.partition(":")
                current_key = k.strip()
                item[current_key] = _yaml_value(v)
        elif line_indent >= indent + 2 and ":" in strip and item:
            k, _, v = strip.partition(":")
            item[k.strip()] = _yaml_value(v)
        i += 1
    if item:
        resources.append(item)
    return resources, i


def _parse_list_from_frontmatter(fm_text: str, list_key: str) -> list[dict[str, Any]]:
    """Parse a top-level list (e.g. talks: or media:) with optional nested resources."""
    items: list[dict[str, Any]] = []
    lines = fm_text.split("\n")
    in_list = False
    list_indent = 0
    current: dict[str, Any] = {}
    i = 0
    while i < len(lines):
        line = lines[i]
        stripped = line.strip()
        if stripped == list_key + ":":
            in_list = True
            list_indent = len(line) - len(line.lstrip())
            i += 1
            continue
        if not in_list:
            i += 1
            continue
        line_indent = len(line) - len(line.lstrip())
        if line_indent <= list_indent and stripped:
            break
        if re.match(r"^\s{2}-\s+", line) and line_indent == list_indent + 2:
            if current:
                items.append(current)
            current = {}
            rest = line.lstrip()[2:].lstrip()
            if ":" in rest:
                k, _, v = rest.partition(":")
                current[k.strip()] = _yaml_value(v)
        elif stripped.startswith("resources:") and line_indent == list_indent + 4:
            res_list, next_i = _parse_resources_list(lines, i + 1, line_indent + 2)
            current["resources"] = res_list
            i = next_i
            continue
        elif line_indent == list_indent + 4 and ":" in stripped and stripped.split(":")[0].strip() != "resources":
            k, _, v = stripped.partition(":")
            current[k.strip()] = _yaml_value(v)
        i += 1
    if current:
        items.append(current)
    return items


def load_talks_html(content_dir: Path) -> str:
    """Load content/about/talks.md and return three-column HTML for the Talks section."""
    path = content_dir / "about" / "talks.md"
    if not path.exists():
        return ""
    raw = path.read_text(encoding="utf-8")
    match = re.match(r"^---\s*\n([\s\S]*?)\n---\s*\n", raw)
    if not match:
        return ""
    talks = _parse_list_from_frontmatter(match.group(1), "talks")
    out = []
    for t in talks:
        title = (t.get("title") or "").replace('"', "&quot;")
        venue = (t.get("venue") or "").replace('"', "&quot;")
        venue_url = (t.get("venue_url") or "").strip()
        year = (t.get("year") or "").replace('"', "&quot;")
        venue_html = f'<a class="link" href="{venue_url}">{venue}</a>' if venue_url else venue
        text = f'"{title}" at {venue_html}, {year}'
        resources = t.get("resources") or []
        res_html = "".join(
            f'<a class="resource-link" href="{r.get("url", "")}" target="_blank">{r.get("label", "Link")}</a>'
            for r in resources if r.get("url")
        )
        out.append(
            f'<div class="three-column-layout"><div class="column-1"></div><div class="column-2"><p>{text}</p></div><div class="column-3"><div class="paper-resources">{res_html}</div></div></div>'
        )
    return "\n".join(out) if out else ""


def load_media_html(content_dir: Path) -> str:
    """Load content/about/media.md and return three-column HTML for the Media Coverage section."""
    path = content_dir / "about" / "media.md"
    if not path.exists():
        return ""
    raw = path.read_text(encoding="utf-8")
    match = re.match(r"^---\s*\n([\s\S]*?)\n---\s*\n", raw)
    if not match:
        return ""
    items = _parse_list_from_frontmatter(match.group(1), "media")
    out = []
    for m in items:
        desc = (m.get("description") or "").replace("<", "&lt;").replace(">", "&gt;").replace('"', "&quot;")
        outlet_name = (m.get("outlet_name") or "").replace('"', "&quot;")
        outlet_url = (m.get("outlet_url") or "").strip()
        outlet_html = f'<a class="link" href="{outlet_url}" target="_blank">{outlet_name}</a>' if outlet_url else outlet_name
        text = f"{desc} with {outlet_html}"
        date_str = (m.get("date") or "").strip()
        if date_str:
            text += f", {date_str}"
        text = f"<p>{text}</p>"
        resources = m.get("resources") or []
        res_html = "".join(
            f'<a class="resource-link" href="{r.get("url", "")}" target="_blank">{r.get("label", "Link")}</a>'
            for r in resources if r.get("url")
        )
        out.append(
            f'<div class="three-column-layout"><div class="column-1"></div><div class="column-2">{text}</div><div class="column-3"><div class="paper-resources">{res_html}</div></div></div>'
        )
    return "\n".join(out) if out else ""


def metadata_only(project: dict[str, Any]) -> dict[str, Any]:
    """Strip body/html/resources for embedding; keep what the grid and detail header need."""
    return {
        "id": project.get("id"),
        "slug": project.get("slug"),
        "path": project.get("path"),
        "category": project.get("category"),
        "title": project.get("title"),
        "cover_image": project.get("cover_image"),
        "year_label": project.get("year_label"),
        "year": project.get("year"),
        "short_description": project.get("short_description"),
        "location": project.get("location"),
        "gallery": project.get("gallery"),
        "dimensions": project.get("dimensions"),
        "copyright": project.get("copyright"),
        "artist": project.get("artist"),
        "item_name": project.get("item_name"),
    }


def load_projects(content_dir: Path, base_path: str, slugs: list[str], category: str) -> list[dict[str, Any]]:
    projects = []
    for slug in slugs:
        md_path = content_dir / base_path / slug / "index.md"
        if not md_path.exists():
            continue
        raw = md_path.read_text(encoding="utf-8")
        meta = parse_frontmatter(raw)
        meta["slug"] = slug
        meta["id"] = slug
        meta["path"] = slug
        meta["category"] = category
        meta["year_label"] = year_label(meta)
        projects.append(meta)
    projects.sort(key=lambda p: (-_sort_ts(p), (p.get("title") or p.get("slug") or "")))
    return projects


def build_index(repo: Path, content_dir: Path, art_list: list[str], research_list: list[str]) -> None:
    highlighted = [
        p for p in load_projects(content_dir, "art", art_list, "art") if p.get("highlight")
    ] + [p for p in load_projects(content_dir, "research", research_list, "research") if p.get("highlight")]
    highlighted.sort(key=lambda p: (-_sort_ts(p), (p.get("title") or p.get("slug") or "")))

    carousel_inner = "".join(carousel_item_html(p) for p in highlighted) * 3
    block = f"<!-- CAROUSEL_START -->\n            {carousel_inner}\n            <!-- CAROUSEL_END -->"
    index_path = repo / "index.html"
    html = index_path.read_text(encoding="utf-8")
    pattern = re.compile(r"<!-- CAROUSEL_START -->[\s\S]*?<!-- CAROUSEL_END -->", re.DOTALL)
    new_html = pattern.sub(block, html, count=1)
    if new_html == html and "<!-- CAROUSEL_START -->" not in html:
        new_html, n = re.subn(
            r'(<div class="carousel-track">)\s*<!-- Carousel items will be dynamically loaded here -->\s*(</div>)',
            rf"\1\n            {block}\n        \2",
            html,
            count=1,
        )
        if n != 1:
            raise SystemExit("Could not find .carousel-track placeholder in index.html")
    if new_html != html:
        index_path.write_text(new_html, encoding="utf-8")
    print(f"  index: carousel ({len(highlighted)} highlighted)")


def build_art(repo: Path, content_dir: Path, art_list: list[str]) -> None:
    base_path = "content/art"
    projects = load_projects(content_dir, "art", art_list, "art")
    grid_html = "\n".join(project_tile_html(p, base_path) for p in projects)
    data_json = json.dumps([metadata_only(p) for p in projects], ensure_ascii=False)

    art_path = repo / "art.html"
    html = art_path.read_text(encoding="utf-8")
    # Replace grid placeholder or existing pre-rendered grid
    if 'id="projects-data"' in html:
        html = re.sub(
            r'(<div id="projects-grid" class="projects-grid">)\s*[\s\S]*?(\s*</div>\s*<script type="application/json" id="projects-data">)[\s\S]*?(</script>)',
            rf'\1\n{grid_html}\n        \2\n{data_json}\n        \3',
            html,
            count=1,
            flags=re.DOTALL,
        )
    else:
        html = re.sub(
            r'(<div id="projects-grid" class="projects-grid">)\s*<!-- Project tiles will be dynamically loaded here -->\s*</div>',
            rf'\1\n{grid_html}\n                </div>\n                <script type="application/json" id="projects-data">\n{data_json}\n                </script>',
            html,
            count=1,
        )
    art_path.write_text(html, encoding="utf-8")
    print(f"  art: grid ({len(projects)} projects)")


def build_research(repo: Path, content_dir: Path, research_list: list[str]) -> None:
    base_path = "content/research"
    projects = load_projects(content_dir, "research", research_list, "research")
    grid_html = "\n".join(project_tile_html(p, base_path) for p in projects)
    data_json = json.dumps([metadata_only(p) for p in projects], ensure_ascii=False)

    research_path = repo / "research.html"
    html = research_path.read_text(encoding="utf-8")
    if 'id="projects-data"' in html:
        html = re.sub(
            r'(<div id="projects-grid" class="projects-grid">)\s*[\s\S]*?(\s*</div>\s*<script type="application/json" id="projects-data">)[\s\S]*?(</script>)',
            rf'\1\n{grid_html}\n        \2\n{data_json}\n        \3',
            html,
            count=1,
            flags=re.DOTALL,
        )
    else:
        html = re.sub(
            r'(<div id="projects-grid" class="projects-grid">)\s*<!-- Project tiles will be dynamically loaded here -->\s*</div>',
            rf'\1\n{grid_html}\n                </div>\n                <script type="application/json" id="projects-data">\n{data_json}\n                </script>',
            html,
            count=1,
        )
    research_path.write_text(html, encoding="utf-8")
    print(f"  research: grid ({len(projects)} projects)")


def build_about(repo: Path, content_dir: Path, research_list: list[str]) -> None:
    bio_md = content_dir / "about" / "bio.md"
    about_path = repo / "about.html"
    bio_html = extract_bio_html(bio_md) if bio_md.exists() else "<p></p>"
    pub_html = aggregate_publications_html(content_dir, research_list, "content/research")
    talks_html = load_talks_html(content_dir)
    media_html = load_media_html(content_dir)

    html = about_path.read_text(encoding="utf-8")
    # Bio: replace placeholder or existing content inside #bio-container
    html = re.sub(
        r'(<div id="bio-container">)\s*<!-- Bio will be dynamically loaded here -->\s*</div>',
        rf"\1\n{bio_html}\n                                </div>",
        html,
        count=1,
    )
    if "<!-- Bio will be dynamically loaded here -->" not in html:
        html = re.sub(
            r'(<div id="bio-container">)[\s\S]*?(</div>)',
            rf"\1\n{bio_html}\n                                \2",
            html,
            count=1,
        )
    # Publications: replace placeholder or existing content (match up to next about-section)
    html = re.sub(
        r'(<div class="section-content" id="publications-container">)\s*<!-- Publications will be dynamically loaded here -->\s*</div>',
        rf"\1\n{pub_html}\n                                    </div>",
        html,
        count=1,
    )
    if "<!-- Publications will be dynamically loaded here -->" not in html:
        html = re.sub(
            r'(<div class="section-content" id="publications-container">)[\s\S]*?(</div>\s*</div>\s*<div class="about-section">)',
            rf"\1\n{pub_html}\n                                    \2",
            html,
            count=1,
        )
    # Talks: replace section content
    html = re.sub(
        r'(<div class="about-section">\s*<h2>Talks</h2>\s*<div class="section-content">)[\s\S]*?(</div>\s*</div>\s*<div class="about-section">\s*<h2>Media Coverage</h2>)',
        rf"\1\n{talks_html}\n                                \2",
        html,
        count=1,
    )
    # Media Coverage: replace section content (end pattern = section-content + about-section closers)
    html = re.sub(
        r'(<div class="about-section">\s*<h2>Media Coverage</h2>\s*<div class="section-content">)[\s\S]*?(                                </div>\n                            </div>\n                    </div>)',
        rf"\1\n{media_html}\n\2",
        html,
        count=1,
    )
    about_path.write_text(html, encoding="utf-8")
    print("  about: bio + publications + talks + media")


def main() -> None:
    repo = Path(__file__).resolve().parent.parent
    content_dir = repo / "content"
    with open(content_dir / "projects.json", encoding="utf-8") as f:
        config = json.load(f)
    art_list = config.get("art") or []
    research_list = config.get("research") or []

    print("Pre-rendering site...")
    build_index(repo, content_dir, art_list, research_list)
    build_art(repo, content_dir, art_list)
    build_research(repo, content_dir, research_list)
    build_about(repo, content_dir, research_list)
    print("Done.")


if __name__ == "__main__":
    main()
