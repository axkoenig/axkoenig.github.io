/**
 * Life in Dots – interactive visualization
 * Renders ~29,000 day-dots as SVG paths (vector) so they stay sharp when zooming.
 * Blue = past, Yellow = today, Light gray = future.
 */
(function () {
    // Tear down any previous instance (re-opening the panel)
    if (window._lifeDots) {
        window._lifeDots.destroy();
        window._lifeDots = null;
    }

    var TOTAL_DAYS = Math.ceil(80 * 365.25);
    var MS_PER_DAY = 86400000;

    var gridEl = document.getElementById('life-dots-grid');
    var wrap = gridEl && gridEl.parentElement;
    var birthdayInput = document.getElementById('life-dots-birthday');
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

        // Use full column width (same as header) so grid spans entire width on all screen sizes
        var column = wrap.closest('.project-detail-body');
        var cssWidth = column ? column.clientWidth : wrap.clientWidth;
        // Skip until panel has finished expanding (avoid rendering at 50–100px during transition)
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
            svgEl.setAttribute('id', 'life-dots-grid');
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

    // Wait for the detail panel's width transition to finish before first render.
    // The panel animates from width:0 to width:100% over ~400ms.
    var detailPanel = document.getElementById('project-detail');

    function onTransitionEnd(e) {
        if (e.propertyName === 'width') {
            update();
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

    // First render: wait for panel to have full width (it animates from 0 to 100%).
    // Run once immediately (reload / no-transition case), then retry until width is acceptable.
    update();
    if (!initialRenderDone) {
        var retries = 0;
        var maxRetries = 25; // 0ms, 100ms, 200ms, ... 2400ms
        var retryInterval = setInterval(function () {
            update();
            if (initialRenderDone || ++retries >= maxRetries) {
                clearInterval(retryInterval);
            }
        }, 100);
        window._lifeDotsRetryInterval = retryInterval;
    }

    // Cleanup function
    window._lifeDots = {
        destroy: function () {
            if (window._lifeDotsRetryInterval) {
                clearInterval(window._lifeDotsRetryInterval);
                window._lifeDotsRetryInterval = null;
            }
            window.removeEventListener('resize', onResize);
            birthdayInput.removeEventListener('change', update);
            birthdayInput.removeEventListener('input', update);
            if (detailPanel) detailPanel.removeEventListener('transitionend', onTransitionEnd);
            clearTimeout(resizeTimer);
            if (observer) observer.disconnect();
        }
    };
})();
