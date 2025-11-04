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
    
    // Simple YAML parser for basic key-value pairs
    frontmatter.split('\n').forEach(line => {
        const colonIndex = line.indexOf(':');
        if (colonIndex > 0) {
            const key = line.substring(0, colonIndex).trim();
            let value = line.substring(colonIndex + 1).trim();
            
            // Handle array format [item1, item2]
            if (value.startsWith('[') && value.endsWith(']')) {
                value = value.slice(1, -1).split(',').map(item => item.trim().replace(/^["']|["']$/g, ''));
            }
            // Handle quoted strings
            else if ((value.startsWith('"') && value.endsWith('"')) || 
                     (value.startsWith("'") && value.endsWith("'"))) {
                value = value.slice(1, -1);
            }
            
            metadata[key] = value;
        }
    });
    
    return { metadata, content: body };
}

// Simple markdown to HTML converter (basic implementation)
function markdownToHTML(markdown) {
    let html = markdown;
    
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
    
    // Images
    html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" />');
    
    // Paragraphs (split by double newlines)
    html = html.split('\n\n').map(para => {
        para = para.trim();
        if (para && !para.match(/^<[h|u|o|l|i]/)) {
            return '<p>' + para + '</p>';
        }
        return para;
    }).join('\n');
    
    // Lists
    html = html.replace(/^\- (.*$)/gim, '<li>$1</li>');
    html = html.replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>');
    
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
            const project = {
                id: projectName,
                path: projectName,
                ...parsed.metadata,
                body: parsed.content,
                html: markdownToHTML(parsed.content)
            };
            
            // Convert date string to year if needed
            if (project.date && !project.year) {
                const date = new Date(project.date);
                project.year = date.getFullYear();
            }
            
            // Ensure tags is an array
            if (typeof project.tags === 'string') {
                project.tags = [project.tags];
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
function renderProjectTile(project, basePath) {
    const coverImage = project.cover_image 
        ? (project.cover_image.startsWith('http') 
            ? project.cover_image 
            : `${basePath}/${project.path}/${project.cover_image}`)
        : `https://via.placeholder.com/350x250/cccccc/000000?text=${encodeURIComponent(project.title)}`;
    
    const tagsHTML = Array.isArray(project.tags) 
        ? project.tags.map(tag => `<span class="tag">${tag}</span>`).join('')
        : '';
    
    const description = project.short_description || project.body.substring(0, 150) + '...';
    
    return `
        <div class="project-tile" data-project-id="${project.id}" data-year="${project.year || ''}" data-tags="${Array.isArray(project.tags) ? project.tags.join(',') : project.tags || ''}">
            <div class="project-cover">
                <img src="${coverImage}" alt="${project.title}" />
            </div>
            <div class="project-content">
                <h3 class="project-title">${project.title}</h3>
                <div class="project-tags">${tagsHTML}</div>
                <div class="project-description">
                    <p>${description}</p>
                </div>
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
        if (src.startsWith('http')) {
            return match;
        }
        return `src="${basePath}/${project.path}/${src}"`;
    });
    
    // Process video tags
    processedHTML = processedHTML.replace(/<video src="([^"]+)"/g, (match, src) => {
        if (src.startsWith('http')) {
            return match;
        }
        return `<video src="${basePath}/${project.path}/${src}"`;
    });
    
    let citationsHTML = '';
    if (project.citations && Array.isArray(project.citations) && project.citations.length > 0) {
        citationsHTML = `
            <div class="citations">
                <h3>Citations</h3>
                <ul>
                    ${project.citations.map(citation => `<li>${citation}</li>`).join('')}
                </ul>
            </div>
        `;
    }
    
    return `
        <div class="project-detail-content">
            <button class="project-close-button" onclick="closeProjectDetail()">← Back</button>
            <div class="project-detail-header">
                <h1>${project.title}</h1>
                <div class="project-meta">
                    ${project.year ? `<span class="project-year">${project.year}</span>` : ''}
                    <div class="project-tags">${tagsHTML}</div>
                </div>
            </div>
            ${coverImage ? `<img src="${coverImage}" alt="${project.title}" style="max-width: 100%; margin-bottom: 30px;" />` : ''}
            ${citationsHTML}
            <div class="project-detail-body">
                ${processedHTML}
            </div>
        </div>
    `;
}

// Export functions for use in other scripts
window.markdownLoader = {
    loadMarkdownFile,
    loadProjects,
    renderProjectTile,
    renderProjectDetail,
    markdownToHTML,
    parseFrontmatter
};

