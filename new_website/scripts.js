document.addEventListener('DOMContentLoaded', () => {

    const inViewClass = 'in-view';
    const greyOutClass = 'grey-out';
    const hiddenClass = 'hidden';
    const expandButtonClass = 'expand-button';
    const collapseButtonClass = 'collapse-button';
    const expandableRowClass = 'expandable-row';
    const gridItemClass = 'grid-item';

    function checkElementsInView(elements) {
        const windowHeight = window.innerHeight;
        let foundInView = false;

        elements.forEach(element => {
            const rect = element.getBoundingClientRect();
            const inView = (rect.top >= 0) && (rect.bottom <= windowHeight);

            if (inView && !foundInView) {
                element.classList.add(inViewClass);
                element.classList.remove(greyOutClass);
                foundInView = true;
            } else {
                element.classList.remove(inViewClass);
                element.classList.add(greyOutClass);
            }
        });
    }

    function checkImagesAndCanvasesInView() {
        const images = document.querySelectorAll('img');
        const canvases = document.querySelectorAll('.cover-container canvas');
        checkElementsInView(images);
        checkElementsInView(canvases);
    }

    function adjustSidebarHeight() {
        const sidebarRows = document.querySelectorAll('.sidebar .row');
        const contentRows = document.querySelectorAll('.content .row');

        for (let i = 1; i < sidebarRows.length; i++) {
            if (contentRows[i - 1]) {
                const contentHeight = contentRows[i - 1].getBoundingClientRect().height;
                const minHeight = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--row-min-height'));

                sidebarRows[i].style.height = contentHeight < minHeight ? '150px' : `${contentHeight}px`;
            }
        }
    }

    function expandRows(button) {
        const row = button.closest(`.${expandableRowClass}`);
        const hiddenItems = row.querySelectorAll(`.${gridItemClass}.${hiddenClass}`);
        hiddenItems.forEach(item => item.classList.remove(hiddenClass));
        button.classList.add(hiddenClass);
        row.querySelector(`.${collapseButtonClass}`).classList.remove(hiddenClass);
        adjustSidebarHeight();
        checkImagesAndCanvasesInView(); // Recheck elements in view after expanding
    }

    function collapseRows(button) {
        const row = button.closest(`.${expandableRowClass}`);
        const gridItems = row.querySelectorAll(`.${gridItemClass}`);
        for (let i = 2; i < gridItems.length; i++) {
            gridItems[i].classList.add(hiddenClass);
        }
        button.classList.add(hiddenClass);
        row.querySelector(`.${expandButtonClass}`).classList.remove(hiddenClass);
        adjustSidebarHeight();
        checkImagesAndCanvasesInView(); // Recheck elements in view after collapsing
    }

    function attachExpandCollapseHandlers() {
        document.querySelectorAll(`.${expandButtonClass}`).forEach(button => {
            button.addEventListener('click', () => expandRows(button));
        });

        document.querySelectorAll(`.${collapseButtonClass}`).forEach(button => {
            button.addEventListener('click', () => collapseRows(button));
        });
    }

    window.addEventListener('scroll', checkImagesAndCanvasesInView);
    window.addEventListener('resize', checkImagesAndCanvasesInView);
    window.addEventListener('load', () => {
        adjustSidebarHeight();
        checkImagesAndCanvasesInView();
        attachExpandCollapseHandlers();
    });

    // Initial check when the DOM is fully loaded
    checkImagesAndCanvasesInView();
});
