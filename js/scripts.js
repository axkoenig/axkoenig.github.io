/**
 * UI Scripts - Image scroll effects, sidebar interactions, project detail modals
 */

(function() {
    /**
     * Project detail "router" — keep the overlay UI in sync with the URL hash
     * and browser history. This makes macOS two-finger swipe Back behave like
     * a normal browser "Back" (close project detail first).
     */
    function getProjectDetailEl() {
        return document.getElementById('project-detail');
    }
    
    function getProjectsGridEl() {
        return document.getElementById('projects-grid');
    }
    
    function getBasePath() {
        return window.projectBasePath || 'content';
    }

    /** Max height used by CSS for project-detail images (100vh - 200px). */
    const PROJECT_DETAIL_MAX_IMAGE_HEIGHT_PX = 200;

    /**
     * In project detail, make all vertical (portrait) single images and videos
     * use the same width: the minimum of their would-be rendered widths when
     * scaled to fit viewport height. Excludes images inside .image-pair.
     */
    function applyUniformVerticalImageWidths() {
        const body = document.querySelector('.project-detail-body');
        if (!body || !body.closest('#project-detail')?.classList.contains('active')) return;

        const maxHeightPx = Math.max(100, window.innerHeight - PROJECT_DETAIL_MAX_IMAGE_HEIGHT_PX);
        const minWidthFloor = 200;

        const singleMedia = body.querySelectorAll(':scope > figure > img, :scope > figure > video, :scope > img');
        const verticalMedia = [];
        const widths = [];

        singleMedia.forEach((el) => {
            if (el.closest('.image-pair')) return;
            const w = el.tagName === 'VIDEO' ? el.videoWidth : el.naturalWidth;
            const h = el.tagName === 'VIDEO' ? el.videoHeight : el.naturalHeight;
            if (!w || !h || h <= w) return;
            verticalMedia.push(el);
            const widthAtMaxHeight = (w / h) * maxHeightPx;
            widths.push(widthAtMaxHeight);
        });

        const targetWidth = widths.length ? Math.max(minWidthFloor, Math.min(...widths)) : null;

        singleMedia.forEach((el) => {
            if (el.closest('.image-pair')) return;
            const w = el.tagName === 'VIDEO' ? el.videoWidth : el.naturalWidth;
            const h = el.tagName === 'VIDEO' ? el.videoHeight : el.naturalHeight;
            if (!w || !h || h <= w) {
                el.style.width = '';
                return;
            }
            if (targetWidth != null) {
                el.style.width = targetWidth + 'px';
            } else {
                el.style.width = '';
            }
        });
    }
    
    function getSlugFromHash() {
        const raw = (window.location && window.location.hash) ? window.location.hash : '';
        if (!raw || raw.length < 2) return '';
        try {
            return decodeURIComponent(raw.substring(1));
        } catch {
            return raw.substring(1);
        }
    }
    
    function findProjectBySlug(slug) {
        if (!slug || !Array.isArray(window.currentProjects)) return null;
        return window.currentProjects.find((p) => String(p.slug || p.id) === String(slug)) || null;
    }
    
    function setActiveTile(slugOrId) {
        const projectTiles = document.querySelectorAll('.project-tile');
        projectTiles.forEach((tile) => {
            const tileSlug = tile.dataset.projectSlug || tile.dataset.projectId;
            if (tileSlug && slugOrId && String(tileSlug) === String(slugOrId)) {
                tile.classList.add('active');
            } else {
                tile.classList.remove('active');
            }
        });
    }
    
    function closeProjectDetailUI() {
        const projectDetail = getProjectDetailEl();
        const content = document.querySelector('.content');
        
        if (projectDetail) {
            projectDetail.classList.remove('active');
        }
        if (content) {
            content.classList.remove('has-detail');
        }
        
        setActiveTile(null);
        
        // Best-effort cleanup: remove scroll handler if we attached one
        if (projectDetail && projectDetail._detailScrollHandler) {
            projectDetail.removeEventListener('scroll', projectDetail._detailScrollHandler);
            projectDetail._detailScrollHandler = null;
        }
    }
    
    function openProjectDetailUI(project, options = {}) {
        const { skipAnimation = false } = options;
        const projectDetail = getProjectDetailEl();
        const basePath = getBasePath();
        
        if (!projectDetail || !window.markdownLoader) {
            console.error('Project detail element or markdown loader not found');
            return;
        }
        
        const detailHTML = window.markdownLoader.renderProjectDetail(project, basePath);
        projectDetail.innerHTML = detailHTML;
        
        if (skipAnimation) {
            projectDetail.classList.add('no-transition');
        }
        
        projectDetail.classList.add('active');
        
        if (skipAnimation) {
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    projectDetail.classList.remove('no-transition');
                });
            });
        }
        
        const slug = project.slug || project.id;
        setActiveTile(slug);
        projectDetail.scrollTop = 0;
        
        // Recheck images in view after rendering
        if (typeof window.requestAnimationFrame === 'function') {
            setTimeout(() => {
                if (typeof window.__checkImagesAndCanvasesInView === 'function') {
                    window.__checkImagesAndCanvasesInView();
                }
            }, 150);
        }
        
        // Add scroll listener to the detail panel for image effects
        const detailScrollHandler = () => {
            if (typeof window.__checkImagesAndCanvasesInView === 'function') {
                window.__checkImagesAndCanvasesInView();
            }
        };
        
        if (projectDetail._detailScrollHandler) {
            projectDetail.removeEventListener('scroll', projectDetail._detailScrollHandler);
        }
        projectDetail.addEventListener('scroll', detailScrollHandler);
        projectDetail._detailScrollHandler = detailScrollHandler;

        function runUniformWidthWhenReady() {
            applyUniformVerticalImageWidths();
        }
        setTimeout(runUniformWidthWhenReady, 50);
        const body = projectDetail.querySelector('.project-detail-body');
        if (body) {
            body.querySelectorAll('img, video').forEach((el) => {
                if (el.closest('.image-pair')) return;
                el.addEventListener('load', runUniformWidthWhenReady);
                el.addEventListener('loadedmetadata', runUniformWidthWhenReady);
            });
        }
    }

    function ensureProjectHistoryInitialized() {
        // Only apply this routing behavior on pages that actually have a project overlay.
        if (!getProjectDetailEl()) return;
        
        if (window.__projectHistoryInitialized) return;
        window.__projectHistoryInitialized = true;
        
        const slug = getSlugFromHash();
        const cleanUrl = window.location.pathname + window.location.search;
        
        // Always mark the current entry as the "list view" state.
        // If we arrived with a hash (deep link), create a synthetic list-view entry
        // so Back closes the overlay before leaving the page.
        if (slug) {
            window.history.replaceState({ projectOpen: false }, '', cleanUrl);
            window.history.pushState({ projectOpen: true, projectSlug: slug }, '', `${cleanUrl}#${encodeURIComponent(slug)}`);
        } else {
            window.history.replaceState({ projectOpen: false }, '', cleanUrl);
        }
    }
    
    async function syncProjectDetailToUrl(options = {}) {
        const { skipAnimation = true } = options;
        ensureProjectHistoryInitialized();
        if (!getProjectDetailEl()) return;

        const slug = getSlugFromHash();
        if (!slug) {
            closeProjectDetailUI();
            return;
        }

        if (!Array.isArray(window.currentProjects)) {
            return;
        }

        let project = findProjectBySlug(slug);
        if (!project) {
            closeProjectDetailUI();
            const cleanUrl = window.location.pathname + window.location.search;
            window.history.replaceState({ projectOpen: false }, '', cleanUrl);
            return;
        }

        if (!project.body && window.markdownLoader && typeof window.markdownLoader.loadSingleProject === 'function') {
            const basePath = getBasePath();
            const full = await window.markdownLoader.loadSingleProject(basePath, project.slug || project.id);
            if (full) {
                const idx = window.currentProjects.findIndex(p => (p.slug || p.id) === slug);
                if (idx >= 0) window.currentProjects[idx] = full;
                project = full;
            }
        }
        openProjectDetailUI(project, { skipAnimation });
    }
    
    function openProjectBySlug(slug, options = {}) {
        const { pushHistory = true, skipAnimation = false } = options;
        if (!slug) return;
        
        const project = findProjectBySlug(slug);
        if (!project) return;
        
        if (pushHistory) {
            ensureProjectHistoryInitialized();
            const cleanUrl = window.location.pathname + window.location.search;
            const targetHash = `#${encodeURIComponent(project.slug || project.id)}`;
            const targetUrl = `${cleanUrl}${targetHash}`;
            
            // Avoid pushing duplicate entries
            if ((window.location.pathname + window.location.search + window.location.hash) !== targetUrl) {
                window.history.pushState(
                    { projectOpen: true, projectSlug: project.slug || project.id },
                    '',
                    targetUrl
                );
            }
        }
        
        // Render UI to match the URL (no further history changes)
        syncProjectDetailToUrl({ skipAnimation });
    }
    
    // Public API used by HTML templates (e.g. close button) and page scripts.
    window.syncProjectDetailToUrl = syncProjectDetailToUrl;
    window.openProjectBySlug = openProjectBySlug;
    
    // Backward compatibility (some pages call showProjectDetail(project, skipAnimation))
    window.showProjectDetail = function(project, skipAnimation = false) {
        if (!project) return;
        const slug = project.slug || project.id;
        openProjectBySlug(slug, { pushHistory: true, skipAnimation: !!skipAnimation });
    };
    
    // The close button should behave like browser Back (so trackpad swipe matches).
    window.closeProjectDetail = function() {
        // If we have a hash, prefer going "Back" to the list-view state.
        if (window.location.hash) {
            window.history.back();
            return;
        }
        
        // Fallback (should be rare): just close UI.
        closeProjectDetailUI();
    };
    
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
    
    // Expose for the router (best-effort re-check after rendering detail view)
    window.__checkImagesAndCanvasesInView = checkImagesAndCanvasesInView;

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

    // Delegate tile clicks (works for dynamically rendered project lists)
    document.addEventListener('click', (event) => {
        const tile = event.target && event.target.closest ? event.target.closest('.project-tile') : null;
        if (!tile) return;
        
        const grid = getProjectsGridEl();
        if (grid && !grid.contains(tile)) return;
        
        const slug = tile.dataset.projectSlug || tile.dataset.projectId;
        if (slug) {
            openProjectBySlug(slug, { pushHistory: true, skipAnimation: false });
        }
    });
    
    // Keep UI ↔ URL in sync for browser Back/Forward (including macOS trackpad swipe)
    window.addEventListener('popstate', () => {
        syncProjectDetailToUrl({ skipAnimation: true });
    });
    window.addEventListener('hashchange', () => {
        syncProjectDetailToUrl({ skipAnimation: true });
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
    setupSidebarNavigation();
    // If we landed with a hash, ensure history is initialized early and
    // attempt to sync (may open later once projects are loaded).
    ensureProjectHistoryInitialized();
    syncProjectDetailToUrl({ skipAnimation: true });

    // Event listeners
    window.addEventListener('scroll', () => {
        checkImagesAndCanvasesInView();
        updateSidebarHighlight();
    });
    
    window.addEventListener('resize', () => {
        checkImagesAndCanvasesInView();
        updateSidebarHighlight();
        applyUniformVerticalImageWidths();
    });
    
    window.addEventListener('load', () => {
        checkImagesAndCanvasesInView();
        updateSidebarYears();
    });
});
})();

