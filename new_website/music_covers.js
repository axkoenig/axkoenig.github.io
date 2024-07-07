document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.cover-container').forEach(container => {
        drawBlurryDots(container);
    });
});

function drawBlurryDots(container) {
    const canvas = container.querySelector('.canvas');
    const ctx = canvas.getContext('2d');
    const names = container.dataset.names.split(',');
    const sizes = container.dataset.sizes.split(',').map(Number);
    const canvasSize = parseInt(container.dataset.canvasSize, 10); // Get canvas size from data attribute
    const minDistanceFactor = 0.6; // Factor to increase minimum distance based on dot size
    const maxAttempts = 100; // Maximum number of attempts to find a non-overlapping position
    const opacity = 0.5; // Opacity for the colors

    canvas.width = canvasSize;
    canvas.height = canvasSize;

    canvas.style.backgroundColor = '#f5f5f5';

    const colors = [
        `rgba(255, 255, 0, ${opacity})`,
        `rgba(255, 192, 203, ${opacity})`,
        `rgba(238, 130, 238, ${opacity})`,
        // `rgba(0, 255, 0, ${opacity})`,
        // `rgba(0, 0, 255, ${opacity})`,
        `rgba(255, 0, 0, ${opacity})`,
    ];

    function shuffle(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
    }

    shuffle(colors);

    function generateRandomPosition(existingPositions, minDistanceFactor, canvasSize, dotRadius) {
        let bestPosition = null;
        let bestDistance = 0;
        for (let attempts = 0; attempts < maxAttempts; attempts++) {
            const position = {
                x: Math.random() * (canvasSize - 2 * dotRadius) + dotRadius,
                y: Math.random() * (canvasSize - 2 * dotRadius) + dotRadius
            };
            let minDistanceToOtherDots = Infinity;
            for (const pos of existingPositions) {
                const dx = position.x - pos.x;
                const dy = position.y - pos.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                const minDistance = (dotRadius + pos.radius) * minDistanceFactor;
                if (distance < minDistance) {
                    minDistanceToOtherDots = Math.min(minDistanceToOtherDots, distance);
                }
            }
            if (minDistanceToOtherDots > bestDistance) {
                bestDistance = minDistanceToOtherDots;
                bestPosition = position;
            }
        }
        return bestPosition;
    }

    const existingPositions = [];
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    container.querySelectorAll('.dot-text').forEach(element => element.remove()); // Clear existing text elements

    names.forEach((name, index) => {
        const dotSizeFraction = sizes[index];
        const dotRadius = (canvasSize * dotSizeFraction) / 2;
        const position = generateRandomPosition(existingPositions, minDistanceFactor, canvasSize, dotRadius);
        if (position === null) {
            console.warn(`Could not place dot: ${name}`);
            return;
        }
        existingPositions.push({ ...position, radius: dotRadius });

        const color = colors[index % colors.length];

        // Draw the blurry dot
        ctx.beginPath();
        ctx.arc(position.x, position.y, dotRadius, 0, 2 * Math.PI, false);
        ctx.fillStyle = color;
        ctx.filter = 'blur(30px)'; // Increased blurriness
        ctx.fill();

        // Create text element
        const textElement = document.createElement('div');
        textElement.className = 'dot-text';
        textElement.innerText = name;
        textElement.style.left = `${position.x}px`;
        textElement.style.top = `${position.y}px`;
        textElement.style.fontSize = `${dotRadius / 2.5}px`;
        textElement.style.color = 'white';
        container.appendChild(textElement);
    });
}
