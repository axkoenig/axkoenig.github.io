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
    
    // Simple YAML parser for basic key-value pairs and arrays
    let currentKey = null;
    let currentArray = null;
    
    const lines = frontmatter.split('\n');
    for (let i = 0; i < lines.length; i++) {
        const trimmedLine = lines[i].trim();
        
        // Skip empty lines
        if (!trimmedLine) continue;
        
        // Check if this is an array item (starts with -)
        if (trimmedLine.startsWith('- ')) {
            if (currentArray !== null) {
                const item = trimmedLine.substring(2).trim();
                // Remove quotes if present
                const unquoted = item.replace(/^["']|["']$/g, '');
                currentArray.push(unquoted);
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
                metadata[key] = value;
                currentKey = null;
                currentArray = null;
            }
            // Handle array declaration (starts with empty or just colon)
            else if (value === '' || value === '[]') {
                metadata[key] = [];
                currentKey = key;
                currentArray = metadata[key];
            }
            // Handle quoted strings
            else if ((value.startsWith('"') && value.endsWith('"')) || 
                     (value.startsWith("'") && value.endsWith("'"))) {
                value = value.slice(1, -1);
                metadata[key] = value;
                currentKey = null;
                currentArray = null;
            }
            // Handle boolean values
            else if (value === 'true' || value === 'True') {
                metadata[key] = true;
                currentKey = null;
                currentArray = null;
            }
            else if (value === 'false' || value === 'False') {
                metadata[key] = false;
                currentKey = null;
                currentArray = null;
            }
            // Regular key-value
            else {
                metadata[key] = value;
                currentKey = null;
                currentArray = null;
            }
        }
    }
    
    // Debug: log parsed metadata
    console.log('Parsed frontmatter metadata:', metadata);
    
    return { metadata, content: body };
}

// Simple markdown to HTML converter (basic implementation)
function markdownToHTML(markdown) {
    let html = markdown;
    
    // Images - process first, before paragraphs (match with optional whitespace)
    html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" loading="lazy" />');
    
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
    
    // Split by double newlines and process each block
    const blocks = html.split(/\n\s*\n/);
    html = blocks.map(block => {
        block = block.trim();
        if (!block) return '';
        
        // Don't wrap if it's already an HTML tag (header, list, image, etc.)
        if (block.match(/^<(h[1-6]|ul|ol|li|img|p)/)) {
            return block;
        }
        
        // If block contains an image tag, return as-is (might be image on its own line)
        if (block.includes('<img')) {
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
            
            const project = {
                id: projectName,
                path: projectName,
                category: category,
                ...parsed.metadata,
                body: parsed.content,
                html: markdownToHTML(parsed.content)
            };
            
            // Set slug (default to project folder name if not provided)
            if (!project.slug) {
                project.slug = projectName;
            }
            
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
            
            // Parse news items if they exist as array of strings
            if (project.news && Array.isArray(project.news)) {
                project.news = project.news.map(item => {
                    if (typeof item === 'string') {
                        // Format: "2024-01-15: News title"
                        const colonIndex = item.indexOf(':');
                        if (colonIndex > 0) {
                            return {
                                date: item.substring(0, colonIndex).trim(),
                                title: item.substring(colonIndex + 1).trim()
                            };
                        }
                        // If no colon, return null to filter out
                        return null;
                    }
                    // If already an object, return as is
                    return item;
                }).filter(item => item && item.date && item.title);
                
                console.log('Parsed news for project:', project.title, project.news);
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
    
    if (project.cover_image) {
        // If it's already a full URL, use it directly
        if (project.cover_image.startsWith('http://') || project.cover_image.startsWith('https://')) {
            coverImage = project.cover_image;
        }
        // If it's a relative path, construct the full path
        else {
            coverImage = `${basePath}/${project.path}/${project.cover_image}`;
        }
    } else {
        // Fallback placeholder
        coverImage = `https://via.placeholder.com/300x225/cccccc/999999?text=`;
    }
    
    // Generate project number (padded with zeros)
    const projectNumber = String(projectIndex + 1).padStart(3, '0');
    
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
            <div class="project-cover">
                <img src="${coverImage}" alt="${project.title || ''}" loading="lazy" onerror="this.src='https://via.placeholder.com/300x225/cccccc/999999?text='" />
            </div>
            <div class="project-content">
                <div class="project-number">${projectNumber}</div>
                <h3 class="project-title">${project.title || 'Untitled'}</h3>
                ${year ? `<div class="project-year">${year}</div>` : ''}
                ${description ? `<div class="project-description">${description}</div>` : ''}
                ${location ? `<div class="project-location">${location}</div>` : ''}
                ${itemName && itemName !== project.title ? `<div class="project-item-name">${itemName}</div>` : ''}
                ${dimensions ? `<div class="project-dimensions">${dimensions}</div>` : ''}
                ${gallery ? `<div class="project-gallery">${gallery}</div>` : ''}
                ${copyright ? `<div class="project-copyright">© ${copyright}</div>` : ''}
                <a href="#" class="project-view-link" onclick="event.preventDefault(); const tile = this.closest('.project-tile'); if (tile) { tile.click(); } return false;">[View...]</a>
            </div>
        </div>
    `;
}

// Render project detail view
function renderProjectDetail(project, basePath) {
    const coverImage = project.cover_image 
        ? (project.cover_image.startsWith('http') 
            ? project.cover_image 
            : `${basePath}/${project.path}/${project.cover_image}`)
        : '';
    
    const tagsHTML = Array.isArray(project.tags) 
        ? project.tags.map(tag => `<span class="tag">${tag}</span>`).join('')
        : '';
    
    // Process images in HTML to use correct paths
    let processedHTML = project.html;
    processedHTML = processedHTML.replace(/src="([^"]+)"/g, (match, src) => {
        // Keep HTTP/HTTPS URLs as-is
        if (src.startsWith('http://') || src.startsWith('https://')) {
            return match;
        }
        // For relative paths, construct the full path
        return `src="${basePath}/${project.path}/${src}"`;
    });
    
    // Also handle images that might not have been converted properly
    processedHTML = processedHTML.replace(/<img([^>]*?)src="([^"]+)"([^>]*?)>/g, (match, before, src, after) => {
        // Check if src already has http/https
        if (src.startsWith('http://') || src.startsWith('https://')) {
            return match;
        }
        // For relative paths, construct the full path
        return `<img${before}src="${basePath}/${project.path}/${src}"${after}>`;
    });
    
    // Process video tags
    processedHTML = processedHTML.replace(/<video src="([^"]+)"/g, (match, src) => {
        if (src.startsWith('http')) {
            return match;
        }
        return `<video src="${basePath}/${project.path}/${src}"`;
    });
    
    // Build news section HTML
    let newsHTML = '';
    if (project.news && Array.isArray(project.news) && project.news.length > 0) {
        // Sort news by date (newest first)
        const sortedNews = [...project.news].sort((a, b) => {
            const dateA = new Date(a.date || a);
            const dateB = new Date(b.date || b);
            return dateB - dateA;
        });
        
        newsHTML = `
            <div class="project-news" style="margin: 0 -30px 30px -30px; padding: 0 30px 20px 30px; border-bottom: 1px solid var(--border-color); width: calc(100% + 60px); box-sizing: border-box;">
                <h3>News</h3>
                <ul style="list-style: none; padding: 0;">
                    ${sortedNews.map(newsItem => {
                        let news = newsItem;
                        // If it's still a string, parse it
                        if (typeof newsItem === 'string') {
                            const colonIndex = newsItem.indexOf(':');
                            if (colonIndex > 0) {
                                news = {
                                    date: newsItem.substring(0, colonIndex).trim(),
                                    title: newsItem.substring(colonIndex + 1).trim()
                                };
                            }
                        }
                        
                        if (news && news.date && news.title) {
                            try {
                                const date = new Date(news.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
                                return `<li style="margin-bottom: 15px;"><strong>${date}</strong>: ${news.title}</li>`;
                            } catch (e) {
                                return `<li style="margin-bottom: 15px;"><strong>${news.date}</strong>: ${news.title}</li>`;
                            }
                        }
                        return '';
                    }).filter(html => html).join('')}
                </ul>
            </div>
        `;
    }
    
    // Build citations section HTML
    let citationsHTML = '';
    if (project.citations && Array.isArray(project.citations) && project.citations.length > 0) {
        citationsHTML = `
            <div class="citations" style="margin: 0 -30px 30px -30px; padding: 0 30px 20px 30px; width: calc(100% + 60px); box-sizing: border-box;">
                <h3>Citations</h3>
                <ul>
                    ${project.citations.map(citation => `<li>${citation}</li>`).join('')}
                </ul>
            </div>
        `;
    }
    
    return `
        <div class="project-detail-content">
            <button class="project-close-button" onclick="closeProjectDetail()">← Close</button>
            <div class="project-detail-inner">
                <div class="project-detail-header">
                    <h1>${project.title}</h1>
                    <div class="project-meta">
                        ${project.year ? `<span class="project-year">${project.year}</span>` : ''}
                        <div class="project-tags">${tagsHTML}</div>
                    </div>
                </div>
                ${coverImage ? `<div style="margin: 0 -30px 30px -30px; padding-bottom: 30px; border-bottom: 1px solid var(--border-color); width: calc(100% + 60px); box-sizing: border-box;"><img src="${coverImage}" alt="${project.title}" style="max-width: 100%; width: 100%; display: block; filter: grayscale(0%); opacity: 1; transition: filter 0.5s ease, opacity 0.5s ease;" class="in-view" loading="lazy" onerror="console.error('Failed to load cover image:', this.src);" /></div>` : ''}
                ${newsHTML}
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

// Export functions for use in other scripts
window.markdownLoader = {
    loadMarkdownFile,
    loadProjects,
    loadHighlightedProjects,
    renderProjectTile,
    renderProjectDetail,
    markdownToHTML,
    parseFrontmatter
};

