/**
 * Carousel - Displays highlighted projects in a horizontally scrollable strip
 */

(async function() {
    // Wait for markdown loader to be available
    if (typeof window.markdownLoader === 'undefined') {
        console.error('markdown-loader.js must be loaded before carousel.js');
        return;
    }

    // Load project lists from central configuration
    let artProjectList = [];
    let researchProjectList = [];
    
    try {
        const response = await fetch('content/projects.json');
        if (response.ok) {
            const config = await response.json();
            artProjectList = config.art || [];
            researchProjectList = config.research || [];
            console.log('Loaded project lists from config:', { art: artProjectList, research: researchProjectList });
        } else {
            console.error('Failed to load projects.json');
        }
    } catch (error) {
        console.error('Error loading projects.json:', error);
    }

    try {
        // Load highlighted projects from both categories
        const highlightedProjects = await window.markdownLoader.loadHighlightedProjects(
            artProjectList,
            researchProjectList
        );

        if (highlightedProjects.length === 0) {
            console.log('No highlighted projects found');
            const carousel = document.getElementById('projects-carousel');
            if (carousel) {
                carousel.style.display = 'none';
            }
            return;
        }

        const carouselTrack = document.querySelector('.carousel-track');
        if (!carouselTrack) {
            console.error('Carousel track element not found');
            return;
        }

        // Function to create a carousel item
        function createCarouselItem(project) {
            let coverImage = '';
            
            if (project.cover_image) {
                // If it's already a full URL, use it directly
                if (project.cover_image.startsWith('http://') || project.cover_image.startsWith('https://')) {
                    coverImage = project.cover_image;
                } else {
                    // Construct path based on category
                    const basePath = project.category === 'art' ? 'content/art' : 'content/research';
                    coverImage = `${basePath}/${project.path}/${project.cover_image}`;
                }
            } else {
                coverImage = 'https://via.placeholder.com/300x200/cccccc/999999?text=';
            }

            const projectUrl = `${project.category}.html#${project.slug}`;
            const shortDescription = project.short_description || '';
            const yearLabel = project.year_label || project.year || (project.date ? new Date(project.date).getFullYear() : '');

            return `
                <div class="carousel-item" data-project-slug="${project.slug}" data-project-category="${project.category}">
                    <img src="${coverImage}" alt="${project.title || ''}" loading="lazy" />
                    <div class="carousel-overlay">
                        <h3>${project.title || 'Untitled'}</h3>
                        ${yearLabel ? `<div class="carousel-year">${yearLabel}</div>` : ''}
                        ${shortDescription ? `<p>${shortDescription}</p>` : ''}
                    </div>
                </div>
            `;
        }

        // Render items once (native horizontal scroll handles gestures)
        carouselTrack.innerHTML = highlightedProjects.map(project => createCarouselItem(project)).join('');

        // Setup click handlers for navigation
        const carouselItems = document.querySelectorAll('.carousel-item');
        carouselItems.forEach(item => {
            item.addEventListener('click', () => {
                const slug = item.getAttribute('data-project-slug');
                const category = item.getAttribute('data-project-category');
                if (slug && category) {
                    window.location.href = `${category}.html#${slug}`;
                }
            });
        });
    } catch (error) {
        console.error('Error initializing carousel:', error);
    }
})();

