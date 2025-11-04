/**
 * UI Scripts - Image scroll effects, sidebar interactions, project detail modals
 */

document.addEventListener('DOMContentLoaded', () => {
    const inViewClass = 'in-view';
    const hiddenClass = 'hidden';

    // Check if elements are in viewport and apply effects
    function checkElementsInView(elements) {
        const windowHeight = window.innerHeight;
        const viewportTop = window.scrollY;
        const viewportBottom = viewportTop + windowHeight;

        elements.forEach(element => {
            const rect = element.getBoundingClientRect();
            const elementTop = rect.top + viewportTop;
            const elementBottom = elementTop + rect.height;
            
            const isInView = elementBottom > viewportTop && elementTop < viewportBottom;

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
                const projectId = tile.dataset.projectId;
                if (projectId && window.currentProjects) {
                    const project = window.currentProjects.find(p => p.id === projectId);
                    if (project) {
                        showProjectDetail(project);
                    }
                }
            });
        });
    }

    // Show project detail modal
    function showProjectDetail(project) {
        const projectDetail = document.getElementById('project-detail');
        const projectsGrid = document.getElementById('projects-grid');
        const basePath = window.projectBasePath || 'content';
        
        if (!projectDetail || !window.markdownLoader) {
            console.error('Project detail element or markdown loader not found');
            return;
        }

        const detailHTML = window.markdownLoader.renderProjectDetail(project, basePath);
        projectDetail.innerHTML = detailHTML;
        
        if (projectsGrid) {
            projectsGrid.classList.add(hiddenClass);
        }
        projectDetail.classList.remove(hiddenClass);
        
        // Scroll to top
        window.scrollTo(0, 0);
        
        // Recheck images in view after rendering
        setTimeout(() => {
            checkImagesAndCanvasesInView();
        }, 100);
    }

    // Close project detail modal
    window.closeProjectDetail = function() {
        const projectDetail = document.getElementById('project-detail');
        const projectsGrid = document.getElementById('projects-grid');
        
        if (projectDetail) {
            projectDetail.classList.add(hiddenClass);
        }
        if (projectsGrid) {
            projectsGrid.classList.remove(hiddenClass);
        }
    };

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

