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
        
        const carouselContainer = document.getElementById('projects-carousel');
        if (!carouselContainer) {
            console.error('Carousel container element not found');
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

        // "Infinite" scroll:
        // Render 3 copies, start in the middle, and when the user scrolls close to the
        // edges, jump scrollLeft by one full set width back into the middle copy.
        const baseItemsHTML = highlightedProjects.map(project => createCarouselItem(project)).join('');
        carouselTrack.innerHTML = baseItemsHTML + baseItemsHTML + baseItemsHTML;

        // Setup click handlers for navigation
        carouselTrack.addEventListener('click', (event) => {
            const item = event.target && event.target.closest ? event.target.closest('.carousel-item') : null;
            if (!item) return;
            const slug = item.getAttribute('data-project-slug');
            const category = item.getAttribute('data-project-category');
            if (slug && category) {
                window.location.href = `${category}.html#${slug}`;
            }
        });
        
        const uniqueCount = highlightedProjects.length;
        if (uniqueCount > 0) {
            let oneSetWidth = 0;
            let isAdjusting = false;
            let isPointerDown = false;
            // Trackpad/touch should never "fight" the auto-scroll: we pause while the user
            // is actively dragging, but otherwise the carousel moves immediately.
            let lastInteractionTs = -1e15;
            let autoCarryPx = 0;
            
            const prefersReducedMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
            const autoScrollSpeedPxPerSec = 50;
            
            const markInteraction = () => {
                lastInteractionTs = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
            };
            
            const computeOneSetWidth = () => {
                const items = carouselTrack.querySelectorAll('.carousel-item');
                if (!items || items.length === 0) return 0;
                
                // Prefer layout-derived span (robust even if items vary in width)
                if (items.length >= uniqueCount + 1) {
                    const start = items[0].offsetLeft;
                    const nextSetStart = items[uniqueCount].offsetLeft;
                    const span = nextSetStart - start;
                    if (span > 0) return span;
                }
                
                // Fallback: assume uniform item widths
                const firstItem = items[0];
                const itemWidth = firstItem.getBoundingClientRect().width || firstItem.offsetWidth || 0;
                return itemWidth * uniqueCount;
            };
            
            const jumpToMiddle = () => {
                oneSetWidth = computeOneSetWidth();
                if (oneSetWidth <= 0) return;
                const prevBehavior = carouselContainer.style.scrollBehavior;
                carouselContainer.style.scrollBehavior = 'auto';
                carouselContainer.scrollLeft = oneSetWidth;
                carouselContainer.style.scrollBehavior = prevBehavior;
            };
            
            // Initialize position after layout
            requestAnimationFrame(() => {
                jumpToMiddle();
            });
            
            const normalizeScrollPosition = () => {
                if (isAdjusting) return;
                if (oneSetWidth <= 0) oneSetWidth = computeOneSetWidth();
                if (oneSetWidth <= 0) return;
                
                // Middle copy spans [oneSetWidth, 2*oneSetWidth).
                const leftEdge = oneSetWidth * 0.5;
                const rightEdge = oneSetWidth * 2.5;
                const x = carouselContainer.scrollLeft;
                
                if (x < leftEdge) {
                    isAdjusting = true;
                    const prevBehavior = carouselContainer.style.scrollBehavior;
                    carouselContainer.style.scrollBehavior = 'auto';
                    carouselContainer.scrollLeft = x + oneSetWidth;
                    carouselContainer.style.scrollBehavior = prevBehavior;
                    isAdjusting = false;
                } else if (x > rightEdge) {
                    isAdjusting = true;
                    const prevBehavior = carouselContainer.style.scrollBehavior;
                    carouselContainer.style.scrollBehavior = 'auto';
                    carouselContainer.scrollLeft = x - oneSetWidth;
                    carouselContainer.style.scrollBehavior = prevBehavior;
                    isAdjusting = false;
                }
            };
            
            carouselContainer.addEventListener('scroll', () => {
                // Defer to the next frame so we don't fight the browser's scrolling.
                requestAnimationFrame(normalizeScrollPosition);
            }, { passive: true });
            
            // Pause auto-scroll while user is interacting
            carouselContainer.addEventListener('pointerdown', () => {
                isPointerDown = true;
                markInteraction();
            }, { passive: true });
            window.addEventListener('pointerup', () => {
                if (isPointerDown) markInteraction();
                isPointerDown = false;
            }, { passive: true });
            window.addEventListener('pointercancel', () => {
                if (isPointerDown) markInteraction();
                isPointerDown = false;
            }, { passive: true });
            carouselContainer.addEventListener('wheel', () => {
                markInteraction();
            }, { passive: true });
            
            // Auto-scroll loop (keeps gesture scrolling intact)
            if (!prefersReducedMotion) {
                let lastTs = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
                
                const tick = (nowRaw) => {
                    const now = (typeof nowRaw === 'number') ? nowRaw : ((typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now());
                    const dtMs = Math.max(0, now - lastTs);
                    lastTs = now;
                    
                    const isVisible = (typeof document === 'undefined') || document.visibilityState === 'visible';
                    
                    if (isVisible && !isPointerDown) {
                        if (oneSetWidth <= 0) oneSetWidth = computeOneSetWidth();
                        if (oneSetWidth > 0) {
                            // Accumulate sub-pixel movement to keep the speed constant
                            // even when scrollLeft is quantized to integers.
                            autoCarryPx += autoScrollSpeedPxPerSec * (dtMs / 1000);
                            const step = Math.trunc(autoCarryPx);
                            if (step !== 0) {
                                autoCarryPx -= step;
                                carouselContainer.scrollLeft += step;
                                normalizeScrollPosition();
                            }
                        }
                    }
                    
                    requestAnimationFrame(tick);
                };
                
                requestAnimationFrame(tick);
            }
            
            window.addEventListener('resize', () => {
                // Recompute widths and keep the user in the middle copy.
                requestAnimationFrame(() => {
                    jumpToMiddle();
                });
            });
        }
    } catch (error) {
        console.error('Error initializing carousel:', error);
    }
})();

