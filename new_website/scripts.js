document.addEventListener('DOMContentLoaded', function () {

    function checkImagesInView() {
        const images = document.querySelectorAll('img');
        const windowHeight = window.innerHeight;
        let foundInView = false;

        images.forEach(image => {
            const rect = image.getBoundingClientRect();
            const inView = (rect.top >= windowHeight * 0.001) && (rect.bottom >= 0);

            if (inView && !foundInView) {
                image.classList.add('in-view');
                foundInView = true;
            } else {
                image.classList.remove('in-view');
            }
        });
    }

    window.addEventListener('scroll', checkImagesInView);
    window.addEventListener('resize', checkImagesInView);
    checkImagesInView(); // Initial check
});

function adjustSidebarHeight() {
    const sidebarRows = document.querySelectorAll('.sidebar .row');
    const contentRows = document.querySelectorAll('.content .row');

    for (let i = 1; i < sidebarRows.length; i++) { // Start from 1 to skip the #home row
        if (contentRows[i - 1]) { // Match the index offset
            const contentHeight = contentRows[i - 1].getBoundingClientRect().height;
            const minHeight = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--row-min-height'));

            sidebarRows[i].style.height = contentHeight < minHeight ? '150px' : `${contentHeight}px`;
        }
    }
}

window.addEventListener('load', adjustSidebarHeight);
window.addEventListener('resize', adjustSidebarHeight);

function expandRows(button) {
    const row = button.closest('.expandable-row');
    const hiddenItems = row.querySelectorAll('.grid-item.hidden');
    hiddenItems.forEach(item => item.classList.remove('hidden'));
    button.classList.add('hidden');
    row.querySelector('.collapse-button').classList.remove('hidden');
    adjustSidebarHeight();
    checkImagesInView(); // Recheck images in view after expanding
}

function collapseRows(button) {
    const row = button.closest('.expandable-row');
    const gridItems = row.querySelectorAll('.grid-item');
    for (let i = 2; i < gridItems.length; i++) {
        gridItems[i].classList.add('hidden');
    }
    button.classList.add('hidden');
    row.querySelector('.expand-button').classList.remove('hidden');
    adjustSidebarHeight();
    checkImagesInView(); // Recheck images in view after collapsing
}

document.querySelectorAll('.expand-button').forEach(button => {
    button.addEventListener('click', () => expandRows(button));
});

document.querySelectorAll('.collapse-button').forEach(button => {
    button.addEventListener('click', () => collapseRows(button));
});
