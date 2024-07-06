function adjustSidebarHeight() {
    const sidebarRows = document.querySelectorAll('.sidebar .row');
    const contentRows = document.querySelectorAll('.content .row');

    for (let i = 1; i < sidebarRows.length; i++) { // Start from 1 to skip the #home row
        if (contentRows[i - 1]) { // Match the index offset
            const contentHeight = contentRows[i - 1].offsetHeight;
            sidebarRows[i].style.height = contentHeight < parseInt(getComputedStyle(document.documentElement).getPropertyValue('--row-min-height')) ? '150px' : contentHeight + 'px';
        }
    }
}

window.addEventListener('load', adjustSidebarHeight);
window.addEventListener('resize', adjustSidebarHeight);

function expandRows() {
    const hiddenItems = document.querySelectorAll('.grid-item.hidden');
    hiddenItems.forEach(item => item.classList.remove('hidden'));
    document.getElementById('expandButton').classList.add('hidden');
    document.getElementById('collapseButton').classList.remove('hidden');
    adjustSidebarHeight();
}

function collapseRows() {
    const gridItems = document.querySelectorAll('.grid-item');
    for (let i = 2; i < gridItems.length; i++) {
        gridItems[i].classList.add('hidden');
    }
    document.getElementById('expandButton').classList.remove('hidden');
    document.getElementById('collapseButton').classList.add('hidden');
    adjustSidebarHeight();
}