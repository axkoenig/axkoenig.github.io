/**
 * Carousel - Displays highlighted projects in a continuous scrolling carousel
 */

(async function() {
    // Wait for markdown loader to be available
    if (typeof window.markdownLoader === 'undefined') {
        console.error('markdown-loader.js must be loaded before carousel.js');
        return;
    }

    // List of project folders (in production, this could be fetched from server)
    const artProjectList = ['blindhaed', 'monoliths', 'facades', 'sakral', 'blindhaed-analog', 'aufnahme-02', 'aufnahme-01'];
    const researchProjectList = ['squirrel-data-loading', 'grasp-refinement', 'imperial-teleoperation', 'hololens-surgery'];

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
            const year = project.year || (project.date ? new Date(project.date).getFullYear() : '');

            return `
                <div class="carousel-item" data-project-slug="${project.slug}" data-project-category="${project.category}">
                    <img src="${coverImage}" alt="${project.title || ''}" loading="lazy" />
                    <div class="carousel-overlay">
                        <h3>${project.title || 'Untitled'}</h3>
                        ${year ? `<div class="carousel-year">${year}</div>` : ''}
                        ${shortDescription ? `<p>${shortDescription}</p>` : ''}
                    </div>
                </div>
            `;
        }

        // Create carousel items HTML
        let carouselItemsHTML = highlightedProjects.map(project => createCarouselItem(project)).join('');
        
        // Duplicate items for seamless infinite scroll
        carouselItemsHTML += carouselItemsHTML;

        carouselTrack.innerHTML = carouselItemsHTML;

        // Get carousel items immediately
        const carouselItems = document.querySelectorAll('.carousel-item');
        const images = carouselTrack.querySelectorAll('img');
        let initialized = false;
        
        // Function to initialize carousel - called immediately and refined after images load
        function initializeCarousel(refine = false) {
            if (initialized && !refine) return;
            
            // Calculate explicit width for Safari compatibility
            // Since items are duplicated, we need the total width
            const itemWidth = carouselItems[0] ? carouselItems[0].offsetWidth : 750;
            const totalItems = carouselItems.length;
            const totalWidth = itemWidth * totalItems;
            // Animation should move exactly half the width (since items are duplicated)
            const halfWidth = totalWidth / 2;
            
            // Set explicit width instead of relying on fit-content
            carouselTrack.style.width = totalWidth + 'px';
            
            // Fixed velocity: 50 pixels per second (adjust this value to change speed)
            const velocityPixelsPerSecond = 50;
            // Calculate duration to maintain constant velocity
            const animationDuration = Math.abs(halfWidth) / velocityPixelsPerSecond;
            
            // Use a consistent animation name (not time-based) to prevent conflicts
            const animationName = 'scroll-carousel-dynamic';
            
            // Create or update dynamic keyframes
            let styleElement = document.getElementById('carousel-animation-style');
            if (!styleElement) {
                styleElement = document.createElement('style');
                styleElement.id = 'carousel-animation-style';
                document.head.appendChild(styleElement);
            }
            
            styleElement.textContent = `
                @keyframes ${animationName} {
                    from {
                        transform: translateX(0);
                    }
                    to {
                        transform: translateX(${-halfWidth}px);
                    }
                }
                @-webkit-keyframes ${animationName} {
                    from {
                        -webkit-transform: translateX(0);
                        transform: translateX(0);
                    }
                    to {
                        -webkit-transform: translateX(${-halfWidth}px);
                        transform: translateX(${-halfWidth}px);
                    }
                }
            `;
            
            // Force Safari to recognize the animation by triggering a reflow
            void carouselTrack.offsetWidth;
            
            // Apply animation with calculated duration
            carouselTrack.style.animation = `${animationName} ${animationDuration}s linear infinite`;
            carouselTrack.style.webkitAnimation = `${animationName} ${animationDuration}s linear infinite`;
            carouselTrack.style.animationPlayState = 'running';
            carouselTrack.style.webkitAnimationPlayState = 'running';
            
            if (!initialized) {
                initialized = true;
                console.log(`Carousel initialized: ${highlightedProjects.length} projects, width: ${totalWidth}px, distance: ${halfWidth}px, duration: ${animationDuration.toFixed(2)}s, velocity: ${velocityPixelsPerSecond}px/s`);
            } else if (refine) {
                console.log(`Carousel refined after image load: width: ${totalWidth}px, duration: ${animationDuration.toFixed(2)}s`);
            }
        }
        
        // Initialize immediately with estimated dimensions to prevent frozen start
        initializeCarousel();
        
        // Refine after images load to get accurate dimensions
        if (images.length > 0) {
            let loadedCount = 0;
            const checkAllLoaded = () => {
                if (loadedCount === images.length) {
                    // Small delay to ensure dimensions are accurate
                    requestAnimationFrame(() => {
                        requestAnimationFrame(() => {
                            initializeCarousel(true);
                        });
                    });
                }
            };
            
            images.forEach(img => {
                if (img.complete) {
                    loadedCount++;
                    checkAllLoaded();
                } else {
                    img.addEventListener('load', () => {
                        loadedCount++;
                        checkAllLoaded();
                    });
                    img.addEventListener('error', () => {
                        loadedCount++;
                        checkAllLoaded();
                    });
                }
            });
            
            // Fallback timeout in case images take too long
            setTimeout(() => {
                if (loadedCount < images.length) {
                    console.warn('Carousel: Some images did not load, refining with current dimensions');
                    initializeCarousel(true);
                }
            }, 1000);
        }

        // Setup click handlers for navigation
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

