/**
 * UI Scripts - Image scroll effects, sidebar interactions, project detail modals
 */

document.addEventListener('DOMContentLoaded', () => {
    // Set active navigation link based on current page
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';
    const navLinks = document.querySelectorAll('.header-nav a');
    
    // Check if we're on the home page
    if (currentPage === 'index.html' || currentPage === '' || currentPage === 'website/index.html' || window.location.pathname.endsWith('/')) {
        document.body.classList.add('is-home-page');
    }
    
    navLinks.forEach(link => {
        const linkHref = link.getAttribute('href');
        if (linkHref === currentPage || (currentPage === '' && linkHref === 'index.html')) {
            link.classList.add('active');
        }
    });

    const inViewClass = 'in-view';
    const hiddenClass = 'hidden';

    // Check if elements are in viewport and apply effects
    function checkElementsInView(elements) {
        const windowHeight = window.innerHeight;
        const viewportTop = window.scrollY;
        const viewportBottom = viewportTop + windowHeight;
        
        // Check detail panel viewport
        const projectDetail = document.getElementById('project-detail');
        const isDetailActive = projectDetail && projectDetail.classList.contains('active');

        elements.forEach(element => {
            const rect = element.getBoundingClientRect();
            
            // Check if in main viewport
            const isInMainView = rect.bottom > 0 && rect.top < windowHeight;
            
            // Check if in detail panel viewport
            let isInDetailView = false;
            if (isDetailActive) {
                const detailRect = projectDetail.getBoundingClientRect();
                // Check if element is within the detail panel boundaries
                const isInDetailBounds = rect.left >= detailRect.left && 
                                        rect.right <= detailRect.right &&
                                        rect.top >= detailRect.top &&
                                        rect.bottom <= detailRect.bottom;
                
                if (isInDetailBounds) {
                    // Calculate relative position within detail panel
                    const relativeTop = rect.top - detailRect.top;
                    const relativeBottom = rect.bottom - detailRect.top;
                    const visibleTop = Math.max(0, relativeTop);
                    const visibleBottom = Math.min(detailRect.height, relativeBottom);
                    
                    // Element is in view if any part is visible
                    isInDetailView = visibleBottom > visibleTop;
                }
            }
            
            const isInView = isInMainView || isInDetailView;

            if (isInView) {
                element.classList.add(inViewClass);
            } else {
                element.classList.remove(inViewClass);
            }
        });
    }

    // Check images and canvases in view
    function checkImagesAndCanvasesInView() {
        const images = document.querySelectorAll('img:not(.profile-pic)');
        const canvases = document.querySelectorAll('.cover-container canvas');
        checkElementsInView([...images, ...canvases]);
    }

    // Setup project tile click handlers
    function setupProjectTiles() {
        const projectTiles = document.querySelectorAll('.project-tile');
        projectTiles.forEach(tile => {
            tile.addEventListener('click', () => {
                const projectSlug = tile.dataset.projectSlug || tile.dataset.projectId;
                if (projectSlug && window.currentProjects) {
                    const project = window.currentProjects.find(p => (p.slug || p.id) === projectSlug);
                    if (project) {
                        showProjectDetail(project);
                    }
                }
            });
        });
    }

    // Show project detail in fullscreen panel
    function showProjectDetail(project) {
        const projectDetail = document.getElementById('project-detail');
        const content = document.querySelector('.content');
        const basePath = window.projectBasePath || 'content';
        
        if (!projectDetail || !window.markdownLoader) {
            console.error('Project detail element or markdown loader not found');
            return;
        }

        const detailHTML = window.markdownLoader.renderProjectDetail(project, basePath);
        projectDetail.innerHTML = detailHTML;
        
        // Add active class to show fullscreen panel
        projectDetail.classList.add('active');
        
        // Mark clicked tile as active
        const projectTiles = document.querySelectorAll('.project-tile');
        projectTiles.forEach(tile => {
            const tileSlug = tile.dataset.projectSlug || tile.dataset.projectId;
            const projectSlug = project.slug || project.id;
            if (tileSlug === projectSlug) {
                tile.classList.add('active');
            } else {
                tile.classList.remove('active');
            }
        });
        
        // Scroll panel to top
        projectDetail.scrollTop = 0;
        
        // Update URL with hash and push to history
        const projectSlug = project.slug || project.id;
        const newUrl = window.location.pathname + window.location.search + '#' + projectSlug;
        window.history.pushState({ projectOpen: true, projectSlug: projectSlug }, '', newUrl);
        
        // Recheck images in view after rendering
        setTimeout(() => {
            checkImagesAndCanvasesInView();
        }, 150);
        
        // Add scroll listener to the detail panel for image effects
        const detailScrollHandler = () => {
            checkImagesAndCanvasesInView();
        };
        
        // Remove any existing listener
        projectDetail.removeEventListener('scroll', detailScrollHandler);
        // Add new scroll listener
        projectDetail.addEventListener('scroll', detailScrollHandler);
        
        // Store handler for cleanup if needed
        projectDetail._detailScrollHandler = detailScrollHandler;
    }

    // Close project detail panel
    window.closeProjectDetail = function() {
        const projectDetail = document.getElementById('project-detail');
        const content = document.querySelector('.content');
        
        if (projectDetail) {
            projectDetail.classList.remove('active');
        }
        if (content) {
            content.classList.remove('has-detail');
        }
        
        // Remove active class from all tiles
        const projectTiles = document.querySelectorAll('.project-tile');
        projectTiles.forEach(tile => {
            tile.classList.remove('active');
        });
        
        // Update URL to remove hash
        const urlWithoutHash = window.location.pathname + window.location.search;
        window.history.replaceState(null, '', urlWithoutHash);
    };

    // Toggle fullscreen mode (kept for backward compatibility, but does nothing now)
    window.toggleProjectFullscreen = function() {
        // Detail view is always fullscreen now
    };

    // Keyboard shortcuts for project detail navigation
    document.addEventListener('keydown', (event) => {
        // Only trigger if project detail is open and not typing in an input/textarea
        const projectDetail = document.getElementById('project-detail');
        const isInputFocused = document.activeElement && 
            (document.activeElement.tagName === 'INPUT' || 
             document.activeElement.tagName === 'TEXTAREA' ||
             document.activeElement.isContentEditable);
        
        if (projectDetail && projectDetail.classList.contains('active') && !isInputFocused) {
            // ESC key or Left arrow to close project detail
            if (event.key === 'Escape' || event.key === 'ArrowLeft') {
                event.preventDefault();
                window.closeProjectDetail();
            }
        }
    });

    // Setup sidebar year highlighting
    function updateSidebarHighlight() {
        const sidebarRows = document.querySelectorAll('.sidebar .row[data-year]');
        const projectTiles = document.querySelectorAll('.project-tile');
        
        if (sidebarRows.length === 0 || projectTiles.length === 0) {
            return;
        }
        
        const viewportCenter = window.scrollY + window.innerHeight / 2;
        let currentYear = null;
        
        projectTiles.forEach(tile => {
            const rect = tile.getBoundingClientRect();
            const tileTop = window.scrollY + rect.top;
            const tileBottom = tileTop + rect.height;
            
            if (viewportCenter >= tileTop && viewportCenter <= tileBottom) {
                currentYear = tile.dataset.year;
            }
        });
        
        sidebarRows.forEach(row => {
            if (row.dataset.year === currentYear) {
                row.classList.add('active');
            } else {
                row.classList.remove('active');
            }
        });
    }

    // Setup sidebar year navigation
    function setupSidebarNavigation() {
        const sidebarRows = document.querySelectorAll('.sidebar .row[data-year]');
        
        sidebarRows.forEach(row => {
            row.addEventListener('click', () => {
                const year = row.dataset.year;
                const targetTile = document.querySelector(`.project-tile[data-year="${year}"]`);
                
                if (targetTile) {
                    targetTile.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            });
        });
    }

    // Update sidebar years based on all projects
    function updateSidebarYears() {
        const projectsGrid = document.getElementById('projects-grid');
        if (!projectsGrid) return;
        
        const allTiles = Array.from(projectsGrid.querySelectorAll('.project-tile'))
            .map(tile => tile.dataset.year)
            .filter(year => year);
        
        const uniqueYears = [...new Set(allTiles)].sort((a, b) => b - a);
        const sidebarYears = document.getElementById('sidebar-years');
        
        if (sidebarYears) {
            sidebarYears.innerHTML = '';
            uniqueYears.forEach(year => {
                const yearRow = document.createElement('div');
                yearRow.className = 'row';
                yearRow.dataset.year = year;
                yearRow.textContent = year;
                sidebarYears.appendChild(yearRow);
            });
            
            setupSidebarNavigation();
        }
    }
    
    // Make updateSidebarYears globally accessible
    window.updateSidebarYears = updateSidebarYears;

    // Handle browser back button
    window.addEventListener('popstate', (event) => {
        const projectDetail = document.getElementById('project-detail');
        if (projectDetail && projectDetail.classList.contains('active')) {
            // If project is open and back button is pressed, close it
            window.closeProjectDetail();
        }
    });

    // Handle swipe gestures on mobile
    let touchStartX = 0;
    let touchStartY = 0;
    let touchEndX = 0;
    let touchEndY = 0;

    document.addEventListener('touchstart', (e) => {
        touchStartX = e.changedTouches[0].screenX;
        touchStartY = e.changedTouches[0].screenY;
    }, { passive: true });

    document.addEventListener('touchend', (e) => {
        touchEndX = e.changedTouches[0].screenX;
        touchEndY = e.changedTouches[0].screenY;
        handleSwipe();
    }, { passive: true });

    function handleSwipe() {
        const projectDetail = document.getElementById('project-detail');
        if (!projectDetail || !projectDetail.classList.contains('active')) {
            return;
        }

        const deltaX = touchStartX - touchEndX;
        const deltaY = touchStartY - touchEndY;
        const minSwipeDistance = 50; // Minimum distance for a swipe

        // Check if it's a horizontal swipe (more horizontal than vertical)
        if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > minSwipeDistance) {
            // Swipe left (close project)
            if (deltaX > 0) {
                window.closeProjectDetail();
            }
        }
    }

    // Initialize
    checkImagesAndCanvasesInView();
    setupProjectTiles();
    setupSidebarNavigation();

    // Event listeners
    window.addEventListener('scroll', () => {
        checkImagesAndCanvasesInView();
        updateSidebarHighlight();
    });
    
    window.addEventListener('resize', () => {
        checkImagesAndCanvasesInView();
        updateSidebarHighlight();
    });
    
    window.addEventListener('load', () => {
        checkImagesAndCanvasesInView();
        updateSidebarYears();
    });
});

