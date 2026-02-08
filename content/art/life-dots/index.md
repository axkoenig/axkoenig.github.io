---
title: Life in Dots
date_end: 2025
short_description: An 80-year life as one dot per day. Lived days in blue, today in yellow, the rest in light gray.
cover_image: image.png
custom_js: life-dots.js
---

<div id="life-dots-app">
<div class="life-dots-bar">
<label for="life-dots-birthday">Birthday</label>
<input type="date" id="life-dots-birthday" aria-label="Your date of birth" />
</div>
<div class="life-dots-grid-wrap">
<canvas id="life-dots-grid" role="img" aria-label="Grid of days in an 80-year life. Lived days in blue, today in yellow, future days in light gray."></canvas>
</div>
</div>
