/**
 * Markdown Loader - Parses markdown files with frontmatter and renders projects
 */

// Parse frontmatter from markdown content
function parseFrontmatter(content) {
    const frontmatterRegex = /^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/;
    const match = content.match(frontmatterRegex);
    
    if (!match) {
        return { metadata: {}, content: content };
    }
    
    const metadata = {};
    const frontmatter = match[1];
    const body = match[2];
    
    // Enhanced YAML parser that handles nested objects and arrays
    const lines = frontmatter.split('\n');
    const stack = [{ obj: metadata, indent: -1 }]; // Stack to track nested objects
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmedLine = line.trim();
        
        // Skip empty lines
        if (!trimmedLine) continue;
        
        // Calculate indentation (spaces before first non-space char)
        const indent = line.length - line.trimStart().length;
        
        // Pop stack until we find the right parent level
        while (stack.length > 1 && stack[stack.length - 1].indent >= indent) {
            stack.pop();
        }
        
        const currentContext = stack[stack.length - 1];
        const currentObj = currentContext.obj;
        
        // Check if this is an array item (starts with -)
        if (trimmedLine.startsWith('- ')) {
            const itemContent = trimmedLine.substring(2).trim();
            
            // Ensure current context is an array
            if (!Array.isArray(currentObj)) {
                // Need to convert current context to array
                const parentContext = stack[stack.length - 2];
                if (parentContext) {
                    const parentKey = Object.keys(parentContext.obj).find(k => parentContext.obj[k] === currentObj);
                    if (parentKey) {
                        parentContext.obj[parentKey] = [];
                        currentContext.obj = parentContext.obj[parentKey];
                        currentObj = currentContext.obj;
                    }
                }
            }
            
            // Check if it's an object (has colon and next line might be indented)
            if (itemContent.includes(':')) {
                // It's an object item - create new object in array
                const newObj = {};
                currentObj.push(newObj);
                stack.push({ obj: newObj, indent: indent });
                
                // Parse the key-value from the same line
                const colonIdx = itemContent.indexOf(':');
                if (colonIdx > 0) {
                    const key = itemContent.substring(0, colonIdx).trim();
                    let value = itemContent.substring(colonIdx + 1).trim();
                    
                    // Handle array format [item1, item2] on same line
                    if (value.startsWith('[') && value.endsWith(']')) {
                        value = value.slice(1, -1).split(',').map(item => item.trim().replace(/^["']|["']$/g, ''));
                        newObj[key] = value;
                    }
                    // Handle quoted strings
                    else if ((value.startsWith('"') && value.endsWith('"')) || 
                             (value.startsWith("'") && value.endsWith("'"))) {
                        value = value.slice(1, -1);
                        newObj[key] = value;
                    }
                    // Handle numeric values
                    else if (/^-?\d+$/.test(value)) {
                        newObj[key] = parseInt(value, 10);
                    }
                    else if (/^-?\d+\.\d+$/.test(value)) {
                        newObj[key] = parseFloat(value);
                    }
                    // Check if next line is more indented (nested object/array)
                    else if (i + 1 < lines.length) {
                        const nextLine = lines[i + 1];
                        const nextIndent = nextLine.length - nextLine.trimStart().length;
                        const nextTrimmed = nextLine.trim();
                        
                        if (nextIndent > indent) {
                            if (nextTrimmed.startsWith('- ')) {
                                newObj[key] = [];
                                stack.push({ obj: newObj[key], indent: indent });
                            } else {
                                newObj[key] = {};
                                stack.push({ obj: newObj[key], indent: indent });
                            }
                        } else {
                            newObj[key] = value;
                        }
                    } else {
                        newObj[key] = value;
                    }
                }
            } else {
                // Simple array item (string)
                const unquoted = itemContent.replace(/^["']|["']$/g, '');
                currentObj.push(unquoted);
            }
            continue;
        }
        
        // Check if this is a key-value pair
        const colonIndex = trimmedLine.indexOf(':');
        if (colonIndex > 0) {
            const key = trimmedLine.substring(0, colonIndex).trim();
            let value = trimmedLine.substring(colonIndex + 1).trim();
            
            // Handle array format [item1, item2] on same line
            if (value.startsWith('[') && value.endsWith(']')) {
                value = value.slice(1, -1).split(',').map(item => item.trim().replace(/^["']|["']$/g, ''));
                currentObj[key] = value;
            }
            // Handle array declaration (starts with empty or just colon)
            // Only treat as array if next line is indented and starts with -
            else if (value === '' || value === '[]') {
                // Check if next non-empty line is indented and starts with array item
                // Skip empty lines when looking ahead
                let nextNonEmptyLineIndex = i + 1;
                while (nextNonEmptyLineIndex < lines.length && !lines[nextNonEmptyLineIndex].trim()) {
                    nextNonEmptyLineIndex++;
                }
                
                if (nextNonEmptyLineIndex < lines.length) {
                    const nextLine = lines[nextNonEmptyLineIndex];
                    const nextIndent = nextLine.length - nextLine.trimStart().length;
                    const nextTrimmed = nextLine.trim();
                    
                    if (nextIndent > indent && nextTrimmed.startsWith('- ')) {
                        // It's an array
                        currentObj[key] = [];
                        stack.push({ obj: currentObj[key], indent: indent });
                    } else {
                        // Empty value, not an array
                        currentObj[key] = '';
                    }
                } else {
                    // Last line, empty value
                    currentObj[key] = '';
                }
            }
            // Handle quoted strings
            else if ((value.startsWith('"') && value.endsWith('"')) || 
                     (value.startsWith("'") && value.endsWith("'"))) {
                value = value.slice(1, -1);
                currentObj[key] = value;
            }
            // Handle boolean values
            else if (value === 'true' || value === 'True') {
                currentObj[key] = true;
            }
            else if (value === 'false' || value === 'False') {
                currentObj[key] = false;
            }
            // Handle numeric values
            else if (/^-?\d+$/.test(value)) {
                currentObj[key] = parseInt(value, 10);
            }
            else if (/^-?\d+\.\d+$/.test(value)) {
                currentObj[key] = parseFloat(value);
            }
            // Regular key-value - could be start of nested object or array
            else {
                // Check if next non-empty line is indented
                // Skip empty lines when looking ahead
                let nextNonEmptyLineIndex = i + 1;
                while (nextNonEmptyLineIndex < lines.length && !lines[nextNonEmptyLineIndex].trim()) {
                    nextNonEmptyLineIndex++;
                }
                
                if (nextNonEmptyLineIndex < lines.length) {
                    const nextLine = lines[nextNonEmptyLineIndex];
                    const nextIndent = nextLine.length - nextLine.trimStart().length;
                    const nextTrimmed = nextLine.trim();
                    
                    if (nextIndent > indent) {
                        // Next line is indented - check if it's an array (starts with -) or object
                        if (nextTrimmed.startsWith('- ')) {
                            // It's an array
                            currentObj[key] = [];
                            stack.push({ obj: currentObj[key], indent: indent });
                        } else {
                            // It's a nested object
                            currentObj[key] = {};
                            stack.push({ obj: currentObj[key], indent: indent });
                        }
                    } else {
                        // Regular string value
                        currentObj[key] = value;
                    }
                } else {
                    // Last line, regular string value
                    currentObj[key] = value;
                }
            }
        }
    }
    
    // Debug: log parsed metadata
    console.log('Parsed frontmatter metadata:', metadata);
    
    return { metadata, content: body };
}

// Extract resources from markdown body (## Resources section)
function extractResources(markdown) {
    const resources = [];
    // Match ## Resources followed by markdown list items
    const resourcesRegex = /##\s+Resources\s*\n((?:- \[.*?\]\(.*?\)\s*\n?)+)/i;
    const match = markdown.match(resourcesRegex);
    
    if (match) {
        const linksText = match[1];
        // Extract markdown links: [text](url)
        const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
        let linkMatch;
        while ((linkMatch = linkRegex.exec(linksText)) !== null) {
            resources.push({
                label: linkMatch[1],
                url: linkMatch[2]
            });
        }
    }
    
    return resources;
}

// Remove Resources section from markdown
function removeResourcesSection(markdown) {
    // Remove ## Resources section and everything after it
    return markdown.replace(/##\s+Resources.*$/is, '').trim();
}

// Simple markdown to HTML converter (basic implementation)
function markdownToHTML(markdown) {
    let html = markdown;
    
    // Images - process first, before paragraphs
    // Support: ![alt](url) or ![alt](url "caption")
    // Detect consecutive images (on adjacent lines without blank line) and wrap them side-by-side
    
    // First, handle pairs of consecutive images (no blank line between them)
    // Match two images on consecutive lines
    html = html.replace(/!\[([^\]]*)\]\(([^)]+)(?:\s+"([^"]+)")?\)\n!\[([^\]]*)\]\(([^)]+)(?:\s+"([^"]+)")?\)/g, 
        (match, alt1, url1, title1, alt2, url2, title2) => {
            const caption1 = title1 || alt1;
            const caption2 = title2 || alt2;
            const fig1 = `<figure><img src="${url1}" alt="${alt1}" loading="lazy" />${caption1 ? `<figcaption>${caption1}</figcaption>` : ''}</figure>`;
            const fig2 = `<figure><img src="${url2}" alt="${alt2}" loading="lazy" />${caption2 ? `<figcaption>${caption2}</figcaption>` : ''}</figure>`;
            return `<div class="image-pair">${fig1}${fig2}</div>`;
        });
    
    // Then handle remaining single images
    html = html.replace(/!\[([^\]]*)\]\(([^)]+)(?:\s+"([^"]+)")?\)/g, (match, alt, url, title) => {
        const imgTag = `<img src="${url}" alt="${alt}" loading="lazy" />`;
        const caption = title || alt; // Use title if provided, otherwise use alt text
        if (caption) {
            return `<figure>${imgTag}<figcaption>${caption}</figcaption></figure>`;
        }
        return `<figure>${imgTag}</figure>`;
    });
    
    // Headers
    html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
    html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
    html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');
    
    // Bold
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    
    // Italic
    html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
    
    // Links
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="link">$1</a>');
    
    // Lists - process before paragraphs
    html = html.replace(/^\- (.*$)/gim, '<li>$1</li>');
    html = html.replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>');
    
    // Tables - convert markdown table syntax to HTML
    // Match table rows (including header separator)
    const tableRegex = /(\|.+\|\n)+/g;
    html = html.replace(tableRegex, (match) => {
        const lines = match.trim().split('\n').filter(line => line.trim());
        if (lines.length < 2) return match;
        
        let tableHTML = '<table>';
        let isHeader = true;
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            // Skip separator row (contains only dashes, colons, spaces, and pipes)
            if (/^[\|\s\-:]+$/.test(line)) {
                isHeader = false;
                continue;
            }
            
            const cells = line.split('|').map(cell => cell.trim()).filter(cell => cell);
            if (cells.length === 0) continue;
            
            const rowTag = isHeader ? 'thead><tr>' : 'tbody><tr>';
            const cellTag = isHeader ? 'th' : 'td';
            
            if (isHeader && i === 0) {
                tableHTML += '<thead><tr>';
            } else if (!isHeader && (i === 1 || (i > 1 && !tableHTML.includes('<tbody>')))) {
                tableHTML += '</thead><tbody><tr>';
            } else {
                tableHTML += '<tr>';
            }
            
            cells.forEach(cell => {
                tableHTML += `<${cellTag}>${cell}</${cellTag}>`;
            });
            
            tableHTML += '</tr>';
            isHeader = false;
        }
        
        tableHTML += '</tbody></table>';
        return tableHTML;
    });
    
    // Split by double newlines and process each block
    const blocks = html.split(/\n\s*\n/);
    html = blocks.map(block => {
        block = block.trim();
        if (!block) return '';
        
        // Don't wrap if it's already an HTML tag (header, list, image, iframe, table, figure, etc.)
        if (block.match(/^<(h[1-6]|ul|ol|li|img|p|iframe|table|tr|td|th|figure)/)) {
            return block;
        }
        
        // If block contains HTML tags that shouldn't be wrapped, return as-is
        if (block.includes('<img') || block.includes('<iframe') || block.includes('<table') || block.includes('<tr') || block.includes('<figure')) {
            return block;
        }
        
        // Otherwise wrap in paragraph
        return '<p>' + block + '</p>';
    }).filter(block => block).join('\n\n');
    
    return html;
}

// Load and parse markdown file
async function loadMarkdownFile(path) {
    try {
        console.log('Loading markdown file:', path);
        const response = await fetch(path);
        if (!response.ok) {
            throw new Error(`Failed to load ${path}: ${response.statusText}`);
        }
        const content = await response.text();
        console.log('Markdown loaded successfully:', path);
        return parseFrontmatter(content);
    } catch (error) {
        console.error('Error loading markdown:', error);
        return null;
    }
}

// Get project folders from directory listing (requires server-side support or hardcoded list)
// For static sites, we'll need to manually list projects or use a config file
async function getProjectFolders(basePath) {
    // For now, return empty array - will be populated by manual list or config
    // In production, you'd fetch a directory listing or use a build step
    return [];
}

// Load all projects from a directory
async function loadProjects(basePath, projectList) {
    const projects = [];
    console.log('Loading projects from:', basePath, 'Projects:', projectList);
    
    for (const projectName of projectList) {
        const projectPath = `${basePath}/${projectName}/index.md`;
        const parsed = await loadMarkdownFile(projectPath);
        
        if (parsed) {
            // Determine category from basePath
            const category = basePath.includes('art') ? 'art' : 'research';
            
            // Extract resources from markdown body if not in frontmatter
            let resources = parsed.metadata.resources || [];
            if (!resources || resources.length === 0) {
                resources = extractResources(parsed.content);
            }
            
            // Remove Resources section from body
            const cleanedContent = removeResourcesSection(parsed.content);
            
            const project = {
                id: projectName,
                path: projectName,
                category: category,
                ...parsed.metadata,
                resources: resources,
                body: cleanedContent,
                html: markdownToHTML(cleanedContent)
            };
            
            // Always use folder name as slug (slug field in frontmatter is ignored)
            project.slug = projectName;
            
            // Ensure highlight is a boolean (default to false)
            if (project.highlight === undefined || project.highlight === null) {
                project.highlight = false;
            } else if (typeof project.highlight === 'string') {
                project.highlight = project.highlight.toLowerCase() === 'true';
            }
            
            // Convert date string to year if needed
            if (project.date && !project.year) {
                const date = new Date(project.date);
                project.year = date.getFullYear();
            }
            
            // Ensure tags is an array
            if (typeof project.tags === 'string') {
                project.tags = [project.tags];
            }
            
            // Ensure resources is an array
            if (!Array.isArray(project.resources)) {
                project.resources = [];
            }
            
            console.log('Loaded project:', project.title);
            projects.push(project);
        } else {
            console.warn('Failed to load project:', projectName);
        }
    }
    
    console.log('Total projects loaded:', projects.length);
    return projects;
}

// Render project tile
function renderProjectTile(project, basePath, projectIndex) {
    let coverImage = '';
    
    // Check if cover_image exists and is a non-empty string
    // Also check it's not an empty array (parser might create empty array for empty values)
    if (project.cover_image && 
        typeof project.cover_image === 'string' && 
        project.cover_image.trim() !== '' &&
        !Array.isArray(project.cover_image)) {
        // If it's already a full URL, use it directly
        if (project.cover_image.startsWith('http://') || project.cover_image.startsWith('https://')) {
            coverImage = project.cover_image;
        }
        // If it's a relative path, construct the full path
        else {
            coverImage = `${basePath}/${project.path}/${project.cover_image}`;
        }
    }
    // If cover_image is empty, undefined, or an array, don't use placeholder
    // The CSS should handle missing images gracefully
    
    // Extract metadata for display
    const year = project.year || (project.date ? new Date(project.date).getFullYear() : '');
    const location = project.location || project.gallery || '';
    const dimensions = project.dimensions || '';
    const gallery = project.gallery || project.location || '';
    const copyright = project.copyright || project.artist || '';
    const itemName = project.item_name || project.title || '';
    const description = project.short_description || '';
    
    return `
        <div class="project-tile" data-project-id="${project.id}" data-project-slug="${project.slug || project.id}" data-year="${project.year || ''}" data-tags="${Array.isArray(project.tags) ? project.tags.join(',') : project.tags || ''}">
            ${coverImage ? `<div class="project-cover">
                <img src="${coverImage}" alt="${project.title || ''}" loading="lazy" />
            </div>` : '<div class="project-cover"></div>'}
            <div class="project-content">
                <h3 class="project-title">${project.title || 'Untitled'}</h3>
                ${year ? `<div class="project-year">${year}</div>` : ''}
                ${description ? `<div class="project-description">${description}</div>` : ''}
                ${location ? `<div class="project-location">${location}</div>` : ''}
                ${itemName && itemName !== project.title ? `<div class="project-item-name">${itemName}</div>` : ''}
                ${dimensions ? `<div class="project-dimensions">${dimensions}</div>` : ''}
                ${gallery ? `<div class="project-gallery">${gallery}</div>` : ''}
                ${copyright ? `<div class="project-copyright">© ${copyright}</div>` : ''}
            </div>
        </div>
    `;
}

// Render project detail view
function renderProjectDetail(project, basePath) {
    // Get the current page's base directory to ensure paths work in both file:// and http:// protocols
    const getBaseUrl = () => {
        if (typeof window !== 'undefined' && window.location) {
            const isFileProtocol = window.location.protocol === 'file:';
            const path = window.location.pathname;
            
            if (isFileProtocol) {
                // For file:// protocol, pathname is the full file system path
                // Extract just the directory part relative to the file
                const dir = path.substring(0, path.lastIndexOf('/') + 1);
                // For file://, we want paths relative to the HTML file's directory
                // Since paths are already relative, we just need './' or empty string
                return '';
            } else {
                // For http:// or https://, pathname is relative to the server root
                const dir = path.substring(0, path.lastIndexOf('/') + 1);
                return dir;
            }
        }
        return '';
    };
    
    const pageBaseUrl = getBaseUrl();
    
    const coverImage = (project.cover_image && 
                        typeof project.cover_image === 'string' && 
                        project.cover_image.trim() !== '' &&
                        !Array.isArray(project.cover_image))
        ? (project.cover_image.startsWith('http') 
            ? project.cover_image 
            : `${pageBaseUrl}${basePath}/${project.path}/${project.cover_image}`)
        : '';
    
    const tagsHTML = Array.isArray(project.tags) 
        ? project.tags.map(tag => `<span class="tag">${tag}</span>`).join('')
        : '';
    
    // Process images in HTML to use correct paths
    let processedHTML = project.html;
    
    // Process img tags specifically - handle all variations of img tag structure
    // This regex matches img tags (self-closing or regular) with src attribute in any position
    processedHTML = processedHTML.replace(/<img\s*([^>]*?)\s*\/?>/gi, (match, attributes) => {
        // Extract src attribute from the attributes string
        const srcMatch = attributes.match(/src\s*=\s*["']([^"']+)["']/i);
        if (!srcMatch) {
            // No src attribute found, return as-is
            return match;
        }
        
        let src = srcMatch[1];
        
        // Keep HTTP/HTTPS URLs as-is
        if (src.startsWith('http://') || src.startsWith('https://')) {
            return match;
        }
        // Keep absolute paths (starting with /) as-is
        if (src.startsWith('/')) {
            return match;
        }
        // Check if path already includes basePath (avoid double-processing)
        if (src.includes(basePath)) {
            return match;
        }
        
        // For relative paths, construct the full path relative to the current page
        const fullPath = `${pageBaseUrl}${basePath}/${project.path}/${src}`;
        
        // Replace the src attribute in the original attributes string
        const updatedAttributes = attributes.replace(
            /src\s*=\s*["'][^"']+["']/i,
            `src="${fullPath}"`
        ).trim();
        
        // Preserve self-closing format if original was self-closing
        const isSelfClosing = match.trim().endsWith('/>');
        return `<img ${updatedAttributes}${isSelfClosing ? ' /' : ''}>`;
    });
    
    // Process video tags
    processedHTML = processedHTML.replace(/<video src="([^"]+)"/g, (match, src) => {
        if (src.startsWith('http')) {
            return match;
        }
        if (src.startsWith('/')) {
            return match;
        }
        return `<video src="${pageBaseUrl}${basePath}/${project.path}/${src}"`;
    });
    
    // Build papers section HTML (structured papers)
    let papersHTML = '';
    if (project.papers && Array.isArray(project.papers) && project.papers.length > 0) {
        papersHTML = `
            <div class="papers" style="margin: 0 -30px 30px -30px; padding: 0 0 20px 0; width: calc(100% + 60px); box-sizing: border-box;">
                <h3 style="margin: 0 0 20px 0;">Publications</h3>
                ${project.papers.map(paper => {
                    if (!paper || typeof paper !== 'object') return '';
                    
                    const authors = Array.isArray(paper.authors) ? paper.authors.join(', ') : (paper.authors || '');
                    const title = paper.title || '';
                    const venue = paper.venue || '';
                    const year = paper.year || '';
                    
                    // Format citation: Authors "Title" In: Venue, Year
                    let citationText = '';
                    if (authors) citationText += authors;
                    if (title) citationText += ` "${title}"`;
                    if (venue) citationText += ` In: ${venue}`;
                    if (year) citationText += `, ${year}`;
                    
                    // Build resources HTML
                    let resourcesHTML = '';
                    if (paper.resources && Array.isArray(paper.resources) && paper.resources.length > 0) {
                        resourcesHTML = `
                            <div class="paper-resources">
                                ${paper.resources.map(resource => {
                                    if (typeof resource === 'string') {
                                        // Legacy format - just a URL
                                        return `<a class="resource-link" href="${resource}" target="_blank">Link</a>`;
                                    } else if (resource && resource.url) {
                                        const label = resource.label || 'Link';
                                        return `<a class="resource-link" href="${resource.url}" target="_blank">${label}</a>`;
                                    }
                                    return '';
                                }).filter(html => html).join('')}
                            </div>
                        `;
                    }
                    
                    // Process venue links (if venue contains markdown-style links)
                    let processedCitation = citationText;
                    if (venue) {
                        // Replace markdown links in venue: [text](url)
                        processedCitation = processedCitation.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a class="link" href="$2">$1</a>');
                    }
                    
                    return `
                        <div class="publication-item publication-item-vertical" style="margin-bottom: 20px;">
                            <p>${processedCitation}</p>
                            ${resourcesHTML}
                        </div>
                    `;
                }).filter(html => html).join('')}
            </div>
        `;
    }
    
    // Build citations section HTML (legacy format - for backward compatibility)
    let citationsHTML = '';
    if (project.citations && Array.isArray(project.citations) && project.citations.length > 0) {
        citationsHTML = `
            <div class="citations" style="margin: 0 -30px 30px -30px; padding: 0 0 20px 0; width: calc(100% + 60px); box-sizing: border-box;">
                <h3 style="margin: 0 0 20px 0;">Citations</h3>
                <ul style="margin: 0; padding-left: 20px;">
                    ${project.citations.map(citation => `<li>${citation}</li>`).join('')}
                </ul>
            </div>
        `;
    }
    
    // Build collaborators HTML for display below year
    let collaboratorsHTML = '';
    if (project.collaborators && 
        Array.isArray(project.collaborators) && 
        project.collaborators.length > 0) {
        const collaboratorNames = project.collaborators
            .map(collaborator => {
                // Handle both object format and string format
                if (typeof collaborator === 'object' && collaborator !== null) {
                    if (collaborator.name) {
                        const url = collaborator.url || '';
                        return url 
                            ? `<a href="${url}" class="link" target="_blank">${collaborator.name}</a>`
                            : collaborator.name;
                    }
                } else if (typeof collaborator === 'string' && collaborator.trim()) {
                    // Fallback for string format (only if non-empty)
                    return collaborator.trim();
                }
                return '';
            })
            .filter(name => name && name.trim());
        
        if (collaboratorNames.length > 0) {
            collaboratorsHTML = `<div class="project-collaborators" style="margin-top: 5px; font-size: 0.9em; color: var(--text-color-secondary);">with ${collaboratorNames.join(', ')}</div>`;
        }
    }
    
    // Build resources HTML
    let resourcesHTML = '';
    if (project.resources && Array.isArray(project.resources) && project.resources.length > 0) {
        const resourceLinks = project.resources.map(resource => {
            const label = typeof resource === 'string' ? resource : (resource.label || 'Link');
            const url = typeof resource === 'string' ? resource : (resource.url || '');
            if (!url) return '';
            return `<a href="${url}" class="resource-link" target="_blank" rel="noopener noreferrer">${label}</a>`;
        }).filter(html => html).join('');
        
        if (resourceLinks) {
            resourcesHTML = `
                <div class="paper-resources">
                    ${resourceLinks}
                </div>
            `;
        }
    }
    
    // Build short description HTML
    const shortDescriptionHTML = project.short_description 
        ? `<div class="project-short-description" style="margin: 0 -30px 30px -30px; padding: 0 0 20px 0; border-bottom: 1px solid var(--border-color); width: calc(100% + 60px); box-sizing: border-box;">
            <p style="font-size: 1em; line-height: 1.6; color: var(--text-color-secondary); margin: 0;">${project.short_description}</p>
          </div>`
        : '';
    
    return `
        <div class="project-detail-content">
            <div class="project-detail-buttons">
                <button class="project-close-button" onclick="closeProjectDetail()">← Close (ESC)</button>
            </div>
            <div class="project-detail-inner">
                <div class="project-detail-header">
                    <h1>${project.title}</h1>
                    <div class="project-meta">
                        ${project.year ? `<div><span class="project-year">${project.year}</span>${collaboratorsHTML}</div>` : collaboratorsHTML}
                        <div class="project-tags">${tagsHTML}</div>
                    </div>
                    ${project.short_description ? `<div class="project-short-description-in-header"><p style="font-size: 1em; line-height: 1.6; color: var(--text-color-secondary); margin: 20px 0 0 0;">${project.short_description}</p></div>` : ''}
                </div>
                ${shortDescriptionHTML}
                ${resourcesHTML}
                ${papersHTML}
                ${citationsHTML}
                <div class="project-detail-body">
                    ${processedHTML}
                </div>
            </div>
        </div>
    `;
}

// Load highlighted projects from both art and research
async function loadHighlightedProjects(artProjectList, researchProjectList) {
    const artProjects = await loadProjects('content/art', artProjectList);
    const researchProjects = await loadProjects('content/research', researchProjectList);
    
    // Combine and filter for highlighted projects
    const allProjects = [...artProjects, ...researchProjects];
    const highlightedProjects = allProjects.filter(project => project.highlight === true);
    
    return highlightedProjects;
}

// Aggregate all publications from research projects
async function aggregatePublications() {
    try {
        // Load project list from central configuration
        let projectList = [];
        const response = await fetch('content/projects.json');
        if (response.ok) {
            const config = await response.json();
            projectList = config.research || [];
        } else {
            console.error('Failed to load projects.json');
            return [];
        }
        
        // Load all research projects
        const projects = await loadProjects('content/research', projectList);
        
        // Extract all papers from all projects
        const allPapers = [];
        for (const project of projects) {
            if (project.papers && Array.isArray(project.papers) && project.papers.length > 0) {
                for (const paper of project.papers) {
                    if (paper && typeof paper === 'object') {
                        // Get cover image path
                        let coverImagePath = '';
                        if (project.cover_image && 
                            typeof project.cover_image === 'string' && 
                            project.cover_image.trim() !== '' &&
                            !Array.isArray(project.cover_image)) {
                            if (project.cover_image.startsWith('http://') || project.cover_image.startsWith('https://')) {
                                coverImagePath = project.cover_image;
                            } else {
                                coverImagePath = `content/research/${project.slug || project.id}/${project.cover_image}`;
                            }
                        }
                        
                        // Add project reference to each paper
                        allPapers.push({
                            ...paper,
                            projectSlug: project.slug || project.id,
                            projectTitle: project.title || project.id,
                            projectCoverImage: coverImagePath
                        });
                    }
                }
            }
        }
        
        // Sort by year (newest first), then by project title
        allPapers.sort((a, b) => {
            const yearA = a.year || 0;
            const yearB = b.year || 0;
            if (yearB !== yearA) {
                return yearB - yearA; // Newest first
            }
            // If same year, sort by project title
            const titleA = a.projectTitle || '';
            const titleB = b.projectTitle || '';
            return titleA.localeCompare(titleB);
        });
        
        return allPapers;
    } catch (error) {
        console.error('Error aggregating publications:', error);
        return [];
    }
}

// Export functions for use in other scripts
window.markdownLoader = {
    loadMarkdownFile,
    loadProjects,
    loadHighlightedProjects,
    renderProjectTile,
    renderProjectDetail,
    markdownToHTML,
    parseFrontmatter,
    aggregatePublications
};

