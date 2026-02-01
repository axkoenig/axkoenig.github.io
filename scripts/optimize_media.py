#!/usr/bin/env python3
"""
Media Optimization Script for Website

This script:
1. Parses markdown files to find all media references
2. Renames files with semantic names from alt text
3. Backs up originals to media/originals/
4. Compresses images to under a target size
5. Converts MOV to MP4 for cross-browser compatibility
6. Updates markdown references
7. Warns about dangling (unreferenced) files
"""

import argparse
import os
import re
import shutil
import subprocess
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

try:
    from PIL import Image
except ImportError:
    print("Error: Pillow is required. Install with: pip install Pillow")
    sys.exit(1)


@dataclass
class MediaReference:
    """Represents a media file reference found in markdown."""
    file_path: Path
    alt_text: str
    markdown_file: Path
    is_cover_image: bool = False


@dataclass
class RenameMapping:
    """Mapping from old path to new path with metadata."""
    old_path: Path
    new_path: Path
    alt_text: str
    markdown_files: list = field(default_factory=list)


def slugify(text: str) -> str:
    """Convert text to a URL-friendly slug."""
    # Remove parenthetical content like (2018), (USA), etc.
    text = re.sub(r'\([^)]*\)', '', text)
    # Convert to lowercase
    text = text.lower()
    # Replace special characters and spaces with hyphens
    text = re.sub(r'[àáâãäå]', 'a', text)
    text = re.sub(r'[èéêë]', 'e', text)
    text = re.sub(r'[ìíîï]', 'i', text)
    text = re.sub(r'[òóôõö]', 'o', text)
    text = re.sub(r'[ùúûü]', 'u', text)
    text = re.sub(r'[ñ]', 'n', text)
    text = re.sub(r'[ç]', 'c', text)
    text = re.sub(r'[æ]', 'ae', text)
    # Replace non-alphanumeric with hyphens
    text = re.sub(r'[^a-z0-9]+', '-', text)
    # Remove leading/trailing hyphens
    text = text.strip('-')
    # Collapse multiple hyphens
    text = re.sub(r'-+', '-', text)
    return text


def parse_markdown_for_media(markdown_path: Path, content_dir: Path) -> list[MediaReference]:
    """Parse a markdown file and extract all media references."""
    references = []
    
    with open(markdown_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    project_dir = markdown_path.parent
    
    # Extract cover_image from frontmatter
    cover_match = re.search(r'cover_image:\s*["\']?([^"\'\n]+)["\']?', content)
    if cover_match:
        cover_path = cover_match.group(1).strip()
        full_path = project_dir / cover_path
        if full_path.exists():
            references.append(MediaReference(
                file_path=full_path,
                alt_text="",  # Cover images typically don't have alt text
                markdown_file=markdown_path,
                is_cover_image=True
            ))
    
    # Extract inline images: ![alt text](path)
    image_pattern = re.compile(r'!\[([^\]]*)\]\(([^)]+)\)')
    for match in image_pattern.finditer(content):
        alt_text = match.group(1)
        image_path = match.group(2)
        
        # Skip external URLs
        if image_path.startswith('http://') or image_path.startswith('https://'):
            continue
        
        full_path = project_dir / image_path
        if full_path.exists():
            references.append(MediaReference(
                file_path=full_path,
                alt_text=alt_text,
                markdown_file=markdown_path,
                is_cover_image=False
            ))
    
    # Extract resources that reference media files
    resource_pattern = re.compile(r'url:\s*["\']?(media/[^"\'\n]+)["\']?')
    for match in resource_pattern.finditer(content):
        resource_path = match.group(1)
        full_path = project_dir / resource_path
        if full_path.exists():
            # Check if it's an image/video (not PDF)
            ext = full_path.suffix.lower()
            if ext in ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.avif', '.mov', '.mp4']:
                references.append(MediaReference(
                    file_path=full_path,
                    alt_text="",
                    markdown_file=markdown_path,
                    is_cover_image=False
                ))
    
    return references


def find_all_media_files(content_dir: Path) -> set[Path]:
    """Find all media files in the content directory."""
    media_extensions = {'.jpg', '.jpeg', '.png', '.gif', '.webp', '.avif', '.mov', '.mp4'}
    media_files = set()
    
    for root, dirs, files in os.walk(content_dir):
        # Skip originals directories
        dirs[:] = [d for d in dirs if d != 'originals']
        
        for file in files:
            ext = Path(file).suffix.lower()
            if ext in media_extensions:
                media_files.add(Path(root) / file)
    
    return media_files


def generate_semantic_name(ref: MediaReference, project_name: str) -> str:
    """Generate a semantic filename from alt text or context (max 2 words)."""
    ext = ref.file_path.suffix.lower()
    original_stem = ref.file_path.stem
    
    # Normalize extension
    if ext == '.jpeg':
        ext = '.jpg'
    elif ext == '.mov':
        ext = '.mp4'  # Will be converted
    
    # Check if original name is already good (descriptive, not generic)
    original_lower = original_stem.lower()
    is_generic = (
        original_lower.startswith('img_') or
        original_lower.startswith('_dsc') or
        original_lower.startswith('dsc') or
        original_lower in ['image', 'image2', 'image3', 'image4'] or
        original_lower.startswith('image ') or
        original_lower.replace('-', '').replace('_', '').isdigit() or
        (len(original_lower) <= 2 and original_lower.isdigit())
    )
    
    def limit_to_two_words(slug: str) -> str:
        """Limit slug to maximum 2 meaningful words (separated by dash)."""
        parts = slug.split('-')
        if len(parts) <= 2:
            return slug
        
        # Skip small/common words when selecting the two meaningful ones
        skip_words = {'of', 'the', 'a', 'an', 'in', 'on', 'at', 'by', 'for', 'to', 'as', 'is', 'it', 'd', 'st'}
        meaningful = [p for p in parts if p not in skip_words and len(p) > 1]
        
        if len(meaningful) >= 2:
            return '-'.join(meaningful[:2])
        elif len(meaningful) == 1:
            return meaningful[0]
        else:
            # Fallback to first two parts
            return '-'.join(parts[:2])
    
    # If original is already descriptive (not generic), keep it normalized
    if not is_generic and len(original_stem) > 3:
        normalized = original_stem.lower().replace(' ', '-').replace('_', '-')
        normalized = limit_to_two_words(normalized)
        return normalized + ext
    
    # Process alt text if we have it
    if ref.alt_text and len(ref.alt_text) > 3:
        alt = ref.alt_text
        
        # Remove "Photo by X" suffix/prefix patterns
        alt = re.sub(r',?\s*Photo by\s+[^,]+$', '', alt, flags=re.IGNORECASE)
        alt = re.sub(r'^Photo by\s+[^,]+,?\s*', '', alt, flags=re.IGNORECASE)
        
        # Skip if alt text is too generic
        generic_patterns = [
            r'^image\s+of\s+',
            r'^photo\s+of\s+',
            r'^picture\s+of\s+',
            r'^screenshot\s+of\s+',
        ]
        for pattern in generic_patterns:
            alt = re.sub(pattern, '', alt, flags=re.IGNORECASE)
        
        # Skip if alt text is just empty or just "Photo by X"
        if alt.lower().startswith('photo by') or len(alt.strip()) < 3:
            pass
        else:
            slug = slugify(alt)
            if slug and len(slug) > 2:
                slug = limit_to_two_words(slug)
                return slug + ext
    
    # Fallback: normalize original or use project prefix
    if is_generic:
        # For generic names, prefix with project name
        normalized = original_stem.lower().replace(' ', '-').replace('_', '-')
        # Remove the original generic part if it's just a number
        if normalized.replace('-', '').isdigit() or normalized in ['image', 'img']:
            return f"{project_name}-{normalized}" + ext
        return limit_to_two_words(f"{project_name}-{normalized}") + ext
    
    return limit_to_two_words(original_stem.lower().replace(' ', '-').replace('_', '-')) + ext


def build_rename_map(
    references: list[MediaReference],
    content_dir: Path
) -> dict[Path, RenameMapping]:
    """Build a mapping of files to rename based on references."""
    rename_map: dict[Path, RenameMapping] = {}
    
    for ref in references:
        # Determine project name from path
        rel_path = ref.file_path.relative_to(content_dir)
        parts = rel_path.parts
        if len(parts) >= 2:
            project_name = parts[1]  # e.g., 'facades', 'blindhaed'
        else:
            project_name = 'unknown'
        
        # Generate new name
        new_name = generate_semantic_name(ref, project_name)
        
        # Determine new path (same directory, new name)
        new_path = ref.file_path.parent / new_name
        
        # Handle duplicates by adding suffix
        if new_path in [m.new_path for m in rename_map.values()] and ref.file_path not in rename_map:
            base = new_path.stem
            ext = new_path.suffix
            counter = 2
            while new_path in [m.new_path for m in rename_map.values()]:
                new_path = ref.file_path.parent / f"{base}-{counter}{ext}"
                counter += 1
        
        if ref.file_path in rename_map:
            rename_map[ref.file_path].markdown_files.append(ref.markdown_file)
        else:
            rename_map[ref.file_path] = RenameMapping(
                old_path=ref.file_path,
                new_path=new_path,
                alt_text=ref.alt_text,
                markdown_files=[ref.markdown_file]
            )
    
    return rename_map


def backup_original(file_path: Path, dry_run: bool = False) -> Optional[Path]:
    """Move original file to originals/ subdirectory."""
    originals_dir = file_path.parent / 'originals'
    backup_path = originals_dir / file_path.name
    
    if dry_run:
        print(f"  [DRY-RUN] Would backup: {file_path.name} -> originals/")
        return backup_path
    
    originals_dir.mkdir(exist_ok=True)
    
    # Copy instead of move so we can work with the original in place
    shutil.copy2(file_path, backup_path)
    print(f"  Backed up: {file_path.name} -> originals/")
    return backup_path


def compress_image(
    file_path: Path,
    max_size_kb: int = 1024,
    max_dimension: int = 2400,
    dry_run: bool = False
) -> tuple[bool, int, int]:
    """
    Compress an image to be under max_size_kb.
    Returns (success, original_size, new_size).
    Preserves ICC color profile to maintain color accuracy.
    """
    original_size = file_path.stat().st_size
    
    if dry_run:
        print(f"  [DRY-RUN] Would compress: {file_path.name} ({original_size // 1024}KB)")
        return True, original_size, original_size
    
    try:
        with Image.open(file_path) as img:
            # Preserve ICC color profile to maintain saturation
            icc_profile = img.info.get('icc_profile')
            exif_data = img.info.get('exif')
            
            # Convert to RGB if necessary (for PNG with transparency)
            if img.mode in ('RGBA', 'P'):
                # Check if image actually uses transparency
                if img.mode == 'RGBA':
                    alpha = img.split()[-1]
                    if alpha.getextrema() == (255, 255):
                        # No transparency used, convert to RGB
                        img = img.convert('RGB')
                    else:
                        # Keep as PNG with transparency
                        pass
                else:
                    img = img.convert('RGB')
            elif img.mode != 'RGB':
                img = img.convert('RGB')
            
            # Resize if too large
            width, height = img.size
            if width > max_dimension or height > max_dimension:
                ratio = min(max_dimension / width, max_dimension / height)
                new_size = (int(width * ratio), int(height * ratio))
                img = img.resize(new_size, Image.Resampling.LANCZOS)
                print(f"  Resized: {width}x{height} -> {new_size[0]}x{new_size[1]}")
            
            # Determine output format
            ext = file_path.suffix.lower()
            if ext in ['.jpg', '.jpeg']:
                output_format = 'JPEG'
            elif ext == '.png':
                # Check if we can convert to JPEG
                if img.mode == 'RGB':
                    output_format = 'JPEG'
                    # Will save as .jpg
                else:
                    output_format = 'PNG'
            else:
                output_format = 'JPEG'
            
            # Build save kwargs with preserved metadata
            save_kwargs = {'optimize': True}
            if icc_profile:
                save_kwargs['icc_profile'] = icc_profile
            
            # Progressive quality reduction for JPEG
            if output_format == 'JPEG':
                qualities = [95, 90, 85, 80, 75, 70, 65]
                for quality in qualities:
                    # Save to temp file to check size
                    temp_path = file_path.with_suffix('.tmp.jpg')
                    img.save(temp_path, format='JPEG', quality=quality, **save_kwargs)
                    new_size_bytes = temp_path.stat().st_size
                    
                    if new_size_bytes <= max_size_kb * 1024:
                        # Move temp to final location
                        output_path = file_path.with_suffix('.jpg')
                        shutil.move(temp_path, output_path)
                        
                        # Remove original if different extension
                        if output_path != file_path:
                            file_path.unlink()
                        
                        print(f"  Compressed: {original_size // 1024}KB -> {new_size_bytes // 1024}KB (q={quality})")
                        return True, original_size, new_size_bytes
                
                # If still too large at lowest quality, use lowest anyway
                if temp_path.exists():
                    output_path = file_path.with_suffix('.jpg')
                    shutil.move(temp_path, output_path)
                    new_size_bytes = output_path.stat().st_size
                    if output_path != file_path:
                        file_path.unlink()
                    print(f"  Compressed (max): {original_size // 1024}KB -> {new_size_bytes // 1024}KB")
                    return True, original_size, new_size_bytes
            else:
                # PNG compression
                img.save(file_path, format='PNG', **save_kwargs)
                new_size_bytes = file_path.stat().st_size
                print(f"  Optimized PNG: {original_size // 1024}KB -> {new_size_bytes // 1024}KB")
                return True, original_size, new_size_bytes
                
    except Exception as e:
        print(f"  Error compressing {file_path.name}: {e}")
        return False, original_size, original_size
    
    return True, original_size, original_size


def convert_mov_to_mp4(
    file_path: Path,
    output_path: Optional[Path] = None,
    dry_run: bool = False
) -> tuple[bool, int, int]:
    """Convert MOV to MP4 using ffmpeg."""
    if output_path is None:
        output_path = file_path.with_suffix('.mp4')
    
    original_size = file_path.stat().st_size
    
    if dry_run:
        print(f"  [DRY-RUN] Would convert MOV->MP4: {file_path.name}")
        return True, original_size, original_size
    
    # Check if ffmpeg is available
    try:
        subprocess.run(['ffmpeg', '-version'], capture_output=True, check=True)
    except (subprocess.CalledProcessError, FileNotFoundError):
        print("  Error: ffmpeg not found. Please install ffmpeg.")
        return False, original_size, original_size
    
    cmd = [
        'ffmpeg', '-y', '-i', str(file_path),
        '-c:v', 'libx264', '-crf', '23', '-preset', 'medium',
        '-c:a', 'aac', '-b:a', '128k',
        '-movflags', '+faststart',
        str(output_path)
    ]
    
    try:
        result = subprocess.run(cmd, capture_output=True, text=True)
        if result.returncode != 0:
            print(f"  Error converting video: {result.stderr[:200]}")
            return False, original_size, original_size
        
        new_size = output_path.stat().st_size
        print(f"  Converted MOV->MP4: {original_size // (1024*1024)}MB -> {new_size // (1024*1024)}MB")
        
        # Remove original MOV
        file_path.unlink()
        
        return True, original_size, new_size
        
    except Exception as e:
        print(f"  Error converting video: {e}")
        return False, original_size, original_size


def update_markdown_references(
    markdown_path: Path,
    rename_map: dict[Path, RenameMapping],
    dry_run: bool = False
) -> bool:
    """Update markdown file with new file references."""
    with open(markdown_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    original_content = content
    
    for old_path, mapping in rename_map.items():
        if markdown_path not in mapping.markdown_files:
            continue
        
        # Get relative paths from markdown file's directory
        try:
            old_rel = old_path.relative_to(markdown_path.parent)
            new_rel = mapping.new_path.relative_to(markdown_path.parent)
        except ValueError:
            continue
        
        # Replace in content
        old_str = str(old_rel)
        new_str = str(new_rel)
        
        if old_str != new_str:
            content = content.replace(old_str, new_str)
    
    if content != original_content:
        if dry_run:
            print(f"  [DRY-RUN] Would update: {markdown_path.name}")
        else:
            with open(markdown_path, 'w', encoding='utf-8') as f:
                f.write(content)
            print(f"  Updated: {markdown_path.name}")
        return True
    
    return False


def rename_file(mapping: RenameMapping, dry_run: bool = False) -> bool:
    """Rename a file according to the mapping."""
    if mapping.old_path == mapping.new_path:
        return False
    
    if dry_run:
        print(f"  [DRY-RUN] Would rename: {mapping.old_path.name} -> {mapping.new_path.name}")
        return True
    
    # Handle case where new path already exists (shouldn't happen but safety check)
    if mapping.new_path.exists() and mapping.new_path != mapping.old_path:
        print(f"  Warning: {mapping.new_path.name} already exists, skipping rename")
        return False
    
    mapping.old_path.rename(mapping.new_path)
    print(f"  Renamed: {mapping.old_path.name} -> {mapping.new_path.name}")
    return True


def main():
    parser = argparse.ArgumentParser(description='Optimize media files for website')
    parser.add_argument('--dry-run', action='store_true', help='Preview changes without applying')
    parser.add_argument('--max-size', type=int, default=1024, help='Max file size in KB (default: 1024)')
    parser.add_argument('--max-dimension', type=int, default=2400, help='Max image dimension (default: 2400)')
    parser.add_argument('--skip-backup', action='store_true', help='Skip backing up originals')
    parser.add_argument('--content-dir', type=str, default=None, help='Content directory path')
    
    args = parser.parse_args()
    
    # Determine content directory
    if args.content_dir:
        content_dir = Path(args.content_dir)
    else:
        script_dir = Path(__file__).parent
        content_dir = script_dir.parent / 'content'
    
    if not content_dir.exists():
        print(f"Error: Content directory not found: {content_dir}")
        sys.exit(1)
    
    print(f"{'=' * 60}")
    print(f"Media Optimization Script")
    print(f"{'=' * 60}")
    print(f"Content directory: {content_dir}")
    print(f"Max size: {args.max_size}KB")
    print(f"Max dimension: {args.max_dimension}px")
    print(f"Dry run: {args.dry_run}")
    print(f"{'=' * 60}\n")
    
    # Step 1: Find all markdown files and parse references
    print("Step 1: Parsing markdown files for media references...")
    all_references: list[MediaReference] = []
    markdown_files = list(content_dir.glob('**/index.md'))
    
    for md_file in markdown_files:
        refs = parse_markdown_for_media(md_file, content_dir)
        all_references.extend(refs)
        if refs:
            print(f"  Found {len(refs)} references in {md_file.relative_to(content_dir)}")
    
    referenced_files = {ref.file_path.resolve() for ref in all_references}
    print(f"\nTotal referenced files: {len(referenced_files)}\n")
    
    # Step 2: Find dangling files
    print("Step 2: Detecting dangling files...")
    all_media_files = find_all_media_files(content_dir)
    dangling_files = []
    
    for media_file in all_media_files:
        if media_file.resolve() not in referenced_files:
            dangling_files.append(media_file)
            size_kb = media_file.stat().st_size // 1024
            print(f"  DANGLING: {media_file.relative_to(content_dir)} ({size_kb}KB)")
    
    if not dangling_files:
        print("  No dangling files found.")
    print()
    
    # Step 3: Build rename map
    print("Step 3: Building rename map...")
    rename_map = build_rename_map(all_references, content_dir)
    
    renames_needed = 0
    for old_path, mapping in rename_map.items():
        if old_path != mapping.new_path:
            renames_needed += 1
            print(f"  {old_path.name} -> {mapping.new_path.name}")
    
    if renames_needed == 0:
        print("  No renames needed.")
    print()
    
    # Step 4: Identify files needing compression (backup happens in step 7)
    print("Step 4: Identifying files needing compression...")
    files_needing_compression = set()
    for mapping in rename_map.values():
        file_path = mapping.old_path
        if file_path.exists():
            ext = file_path.suffix.lower()
            if ext == '.mov':
                files_needing_compression.add(file_path)
                print(f"  Will compress: {file_path.name} (video conversion)")
            elif ext in ['.jpg', '.jpeg', '.png']:
                current_size = file_path.stat().st_size
                if current_size > args.max_size * 1024:
                    files_needing_compression.add(file_path)
                    print(f"  Will compress: {file_path.name} ({current_size // 1024}KB > {args.max_size}KB)")
    
    if not files_needing_compression:
        print("  No files need compression.")
    print()
    
    # Step 5: Rename files
    print("Step 5: Renaming files...")
    for mapping in rename_map.values():
        rename_file(mapping, dry_run=args.dry_run)
    print()
    
    # Step 6: Update markdown references
    print("Step 6: Updating markdown references...")
    updated_files = set()
    for md_file in markdown_files:
        if update_markdown_references(md_file, rename_map, dry_run=args.dry_run):
            updated_files.add(md_file)
    
    if not updated_files:
        print("  No markdown files needed updates.")
    print()
    
    # Step 7: Compress images and convert videos (backup only files being compressed)
    print("Step 7: Compressing images and converting videos...")
    total_original = 0
    total_compressed = 0
    files_processed = 0
    
    for mapping in rename_map.values():
        file_path = mapping.new_path
        if not file_path.exists():
            continue
        
        ext = file_path.suffix.lower()
        
        if ext == '.mov':
            # Backup before conversion
            if not args.skip_backup:
                backup_original(file_path, dry_run=args.dry_run)
            # Convert MOV to MP4
            success, orig, new = convert_mov_to_mp4(file_path, dry_run=args.dry_run)
            if success:
                total_original += orig
                total_compressed += new
                files_processed += 1
                # Update the mapping's new_path to reflect .mp4
                mapping.new_path = file_path.with_suffix('.mp4')
        elif ext in ['.jpg', '.jpeg', '.png']:
            current_size = file_path.stat().st_size
            if current_size > args.max_size * 1024:
                # Backup before compression
                if not args.skip_backup:
                    backup_original(file_path, dry_run=args.dry_run)
                success, orig, new = compress_image(
                    file_path,
                    max_size_kb=args.max_size,
                    max_dimension=args.max_dimension,
                    dry_run=args.dry_run
                )
                if success:
                    total_original += orig
                    total_compressed += new
                    files_processed += 1
            else:
                print(f"  Skipped (already small): {file_path.name} ({current_size // 1024}KB)")
    
    print()
    
    # Step 8: Update markdown for video conversion (MOV -> MP4)
    print("Step 8: Updating markdown for video conversions...")
    for md_file in markdown_files:
        with open(md_file, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Replace .MOV with .mp4
        new_content = re.sub(r'\.MOV\)', '.mp4)', content)
        new_content = re.sub(r'\.mov\)', '.mp4)', new_content)
        
        if new_content != content:
            if args.dry_run:
                print(f"  [DRY-RUN] Would update MOV->MP4 refs in: {md_file.name}")
            else:
                with open(md_file, 'w', encoding='utf-8') as f:
                    f.write(new_content)
                print(f"  Updated MOV->MP4 refs in: {md_file.name}")
    print()
    
    # Summary
    print(f"{'=' * 60}")
    print("SUMMARY")
    print(f"{'=' * 60}")
    print(f"Files processed: {files_processed}")
    print(f"Total original size: {total_original // (1024*1024)}MB")
    print(f"Total compressed size: {total_compressed // (1024*1024)}MB")
    if total_original > 0:
        savings = (total_original - total_compressed) / total_original * 100
        print(f"Space saved: {(total_original - total_compressed) // (1024*1024)}MB ({savings:.1f}%)")
    
    if dangling_files:
        print(f"\n{'=' * 60}")
        print("WARNING: Dangling files (not referenced in any markdown)")
        print(f"{'=' * 60}")
        for df in dangling_files:
            size_kb = df.stat().st_size // 1024
            print(f"  - {df.relative_to(content_dir)} ({size_kb}KB)")
        print("\nThese files were NOT processed. Review and delete if not needed.")
    
    print()


if __name__ == '__main__':
    main()
