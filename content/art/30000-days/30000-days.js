/**
 * 30.000 days – interactive visualization
 * Renders ~29,000 day-dots as SVG paths (vector) so they stay sharp when zooming.
 * Blue = past, Yellow = today, Light gray = future.
 */
(function () {
    // Tear down any previous instance (re-opening the panel)
    if (window._d30k) {
        window._d30k.destroy();
        window._d30k = null;
    }

    var TOTAL_DAYS = Math.ceil(80 * 365.25);
    var MS_PER_DAY = 86400000;

    var gridEl = document.getElementById('d30k-grid');
    var wrap = gridEl && gridEl.parentElement;
    var birthdayInput = document.getElementById('d30k-birthday');
    if (!gridEl || !wrap || !birthdayInput) return;

    var resizeTimer;
    var initialRenderDone = false;
    var svgEl = null;
    var pathPastEl = null;
    var pathTodayEl = null;
    var pathFutureEl = null;

    function dateToYMD(d) {
        return d.getFullYear() + '-' +
            String(d.getMonth() + 1).padStart(2, '0') + '-' +
            String(d.getDate()).padStart(2, '0');
    }

    function defaultBirthday() {
        var d = new Date();
        d.setFullYear(d.getFullYear() - 30);
        return dateToYMD(d);
    }

    function parseBirthday(value) {
        if (!value) return null;
        var parts = value.split('-').map(Number);
        if (parts.length !== 3) return null;
        var d = new Date(parts[0], parts[1] - 1, parts[2]);
        return isNaN(d.getTime()) ? null : d;
    }

    // Minimum width to accept (panel may be mid-transition otherwise)
    var MIN_WIDTH_CSS = Math.min(400, Math.max(300, window.innerWidth * 0.35));

    /** Expected .project-detail-body width when the panel has finished its open transition. */
    function getExpectedColumnWidth() {
        var panel = document.getElementById('project-detail');
        var panelWidth = window.innerWidth;
        if (window.innerWidth >= 1800 && panel && !panel.classList.contains('expanded')) {
            panelWidth = window.innerWidth * 0.5;
        }
        if (window.innerWidth <= 1024) {
            return panelWidth - 40;
        }
        return Math.min(panelWidth, 900);
    }

    function pathDataForRange(startIdx, endIdx, cols, stride, cellSize) {
        var parts = [];
        for (var i = startIdx; i < endIdx; i++) {
            var x = (i % cols) * stride;
            var y = Math.floor(i / cols) * stride;
            parts.push('M', x, y, 'h', cellSize, 'v', cellSize, 'h', -cellSize, 'v', -cellSize, 'z');
        }
        return parts.join(' ');
    }

    function buildGrid(birthDate) {
        if (!birthDate || !gridEl || !wrap) return;

        // Use full column width (same as header) so grid spans entire width on all screen sizes.
        // During the panel open transition, clientWidth is still small; use expected final width so we render once at the correct size.
        var column = wrap.closest('.project-detail-body');
        var measuredWidth = column ? column.clientWidth : wrap.clientWidth;
        var cssWidth = measuredWidth >= MIN_WIDTH_CSS ? measuredWidth : getExpectedColumnWidth();
        if (cssWidth < MIN_WIDTH_CSS) return;

        // Days lived via arithmetic — no per-day Date objects
        var start = new Date(birthDate.getFullYear(), birthDate.getMonth(), birthDate.getDate());
        var today = new Date();
        today.setHours(0, 0, 0, 0);
        var daysLived = Math.max(0, Math.min(TOTAL_DAYS, Math.floor((today.getTime() - start.getTime()) / MS_PER_DAY)));

        var dpr = window.devicePixelRatio || 1;
        var deviceW = Math.floor(cssWidth * dpr);

        // Available height: from wrap top to the viewport bottom
        var wrapRect = wrap.getBoundingClientRect();
        var availCssH = window.innerHeight - wrapRect.top;
        var deviceH = Math.floor(availCssH * dpr);

        // 2 device-pixel gap for visible whitespace between dots
        var deviceGap = Math.max(2, Math.round(1.5 * dpr));

        // On mobile, enforce a minimum dot size of 2 CSS pixels and allow vertical overflow
        var isMobile = window.innerWidth < 768;
        var MIN_DOT_CSS_PX = 2;
        var minDeviceCellSize = isMobile ? Math.ceil(MIN_DOT_CSS_PX * dpr) : 1;

        // Find the largest integer device-pixel cell size that fits (desktop). On mobile, fix at 2 CSS px.
        var deviceCellSize = minDeviceCellSize;
        if (!isMobile) {
            for (var dsz = Math.floor(10 * dpr); dsz >= minDeviceCellSize; dsz--) {
                var dstride = dsz + deviceGap;
                var c = Math.floor((deviceW + deviceGap) / dstride);
                if (c < 1) continue;
                var r = Math.ceil(TOTAL_DAYS / c);
                var gh = r * dstride - deviceGap;
                if (gh <= deviceH) {
                    deviceCellSize = dsz;
                    break;
                }
            }
        }

        var deviceStride = deviceCellSize + deviceGap;
        var cols = Math.floor((deviceW + deviceGap) / deviceStride);
        var rows = Math.ceil(TOTAL_DAYS / cols);
        var cw = cols * deviceStride - deviceGap;
        var ch = rows * deviceStride - deviceGap;

        var cssW = cw / dpr;
        var cssH = ch / dpr;

        if (svgEl && !svgEl.parentNode) {
            svgEl = null;
            pathPastEl = pathTodayEl = pathFutureEl = null;
        }
        if (!svgEl) {
            svgEl = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            svgEl.setAttribute('id', 'd30k-grid');
            svgEl.setAttribute('role', 'img');
            svgEl.setAttribute('aria-label', 'Grid of days in an 80-year life. Lived days in blue, today in yellow, future days in light gray.');
            pathPastEl = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            pathPastEl.setAttribute('fill', 'rgb(0, 0, 255)');
            pathTodayEl = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            pathTodayEl.setAttribute('fill', 'rgb(255, 255, 0)');
            pathFutureEl = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            pathFutureEl.setAttribute('fill', '#d0d0d0');
            svgEl.appendChild(pathPastEl);
            svgEl.appendChild(pathTodayEl);
            svgEl.appendChild(pathFutureEl);
            wrap.replaceChild(svgEl, gridEl);
            gridEl = svgEl;
        }

        svgEl.setAttribute('viewBox', '0 0 ' + cw + ' ' + ch);
        svgEl.setAttribute('width', cw);
        svgEl.setAttribute('height', ch);
        svgEl.style.width = cssW + 'px';
        svgEl.style.height = cssH + 'px';

        pathPastEl.setAttribute('d', pathDataForRange(0, daysLived, cols, deviceStride, deviceCellSize));

        if (daysLived >= 0 && daysLived < TOTAL_DAYS) {
            pathTodayEl.setAttribute('d', pathDataForRange(daysLived, daysLived + 1, cols, deviceStride, deviceCellSize));
            pathTodayEl.style.display = '';
        } else {
            pathTodayEl.style.display = 'none';
        }

        pathFutureEl.setAttribute('d', pathDataForRange(daysLived + 1, TOTAL_DAYS, cols, deviceStride, deviceCellSize));

        initialRenderDone = true;
    }

    function update() {
        var value = birthdayInput.value || defaultBirthday();
        if (!birthdayInput.value) birthdayInput.value = value;
        var b = parseBirthday(value);
        if (b) buildGrid(b);
    }

    // Initial setup
    birthdayInput.value = defaultBirthday();
    birthdayInput.addEventListener('change', update);
    birthdayInput.addEventListener('input', update);

    function onResize() {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(update, 100);
    }
    window.addEventListener('resize', onResize);

    // Defer first render until the panel's width transition has finished, so both width and height
    // are correct and we render once at the final size (no half-height then expand).
    var detailPanel = document.getElementById('project-detail');
    var firstRenderScheduled = false;
    var firstRenderTimeout;

    function scheduleFirstRender() {
        if (firstRenderScheduled) return;
        firstRenderScheduled = true;
        clearTimeout(firstRenderTimeout);
        update();
    }

    function onTransitionEnd(e) {
        if (e.propertyName === 'width') {
            scheduleFirstRender();
        }
    }

    if (detailPanel) {
        detailPanel.addEventListener('transitionend', onTransitionEnd);

        // Also observe class changes (expand/collapse toggle)
        var observer = new MutationObserver(function () {
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(update, 150);
        });
        observer.observe(detailPanel, { attributes: true, attributeFilter: ['class'] });
    }

    // First render only after panel has finished opening (transitionend), so layout is final.
    // Fallback after 450ms for no-transition (e.g. reload with panel open) or if transitionend doesn't fire.
    firstRenderTimeout = setTimeout(scheduleFirstRender, 450);

    // Cleanup function
    window._d30k = {
        destroy: function () {
            clearTimeout(firstRenderTimeout);
            window.removeEventListener('resize', onResize);
            birthdayInput.removeEventListener('change', update);
            birthdayInput.removeEventListener('input', update);
            if (detailPanel) detailPanel.removeEventListener('transitionend', onTransitionEnd);
            clearTimeout(resizeTimer);
            if (observer) observer.disconnect();
        }
    };
})();
