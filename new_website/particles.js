const canvas = document.getElementById('particleCanvas');
const ctx = canvas.getContext('2d');
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

const particles = [];
const navbarItems = document.querySelectorAll('nav ul li a');
let mouse = {
    x: null,
    y: null,
    radius: 100
};

class Particle {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.size = 3;
        this.baseX = this.x;
        this.baseY = this.y;
        this.density = Math.random() * 30 + 1;
        this.history = []; // To keep track of previous positions
    }

    draw() {
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.closePath();
        ctx.fill();
        
        // Draw the trail
        ctx.strokeStyle = '#000';
        ctx.beginPath();
        for (let i = 0; i < this.history.length; i++) {
            const point = this.history[i];
            ctx.lineTo(point.x, point.y);
        }
        ctx.stroke();
    }

    update() {
        let dx = Math.random() * 4 - 2;
        let dy = Math.random() * 4 - 2;
        this.x += dx;
        this.y += dy;

        // Mouse interaction
        let dxMouse = mouse.x - this.x;
        let dyMouse = mouse.y - this.y;
        let distanceMouse = Math.sqrt(dxMouse * dxMouse + dyMouse * dyMouse);
        let forceDirectionXMouse = dxMouse / distanceMouse;
        let forceDirectionYMouse = dyMouse / distanceMouse;
        let maxDistanceMouse = mouse.radius;
        let forceMouse = (maxDistanceMouse - distanceMouse) / maxDistanceMouse;
        let directionXMouse = forceDirectionXMouse * forceMouse * this.density;
        let directionYMouse = forceDirectionYMouse * forceMouse * this.density;

        if (distanceMouse < mouse.radius) {
            this.x -= directionXMouse;
            this.y -= directionYMouse;
        }

        // Attract to navbar items
        let nearNavbarItem = false;
        for (let i = 0; i < navbarItems.length; i++) {
            const rect = navbarItems[i].getBoundingClientRect();
            const attractPoint = {
                x: rect.left + rect.width / 2,
                y: rect.top + rect.height / 2,
            };
            let dx = attractPoint.x - this.x;
            let dy = attractPoint.y - this.y;
            let distance = Math.sqrt(dx * dx + dy * dy);
            let forceDirectionX = dx / distance;
            let forceDirectionY = dy / distance;
            let maxDistance = 700;
            let force = (maxDistance - distance) / maxDistance;
            if (distance < maxDistance) {
                this.x += forceDirectionX * force * this.density;
                this.y += forceDirectionY * force * this.density;
            }
            if (distance < 20) {
                nearNavbarItem = true;
            }
        }

        // Respawn particles only if they are close to the navbar items
        if (nearNavbarItem && Math.random() < 0.01) {
            this.x = Math.random() * canvas.width;
            this.y = Math.random() * canvas.height;
            this.history = []; // Clear history to avoid lines
        }

        // Save the current position to the history
        this.history.push({ x: this.x, y: this.y });
        if (this.history.length > 10) {
            this.history.shift(); // Limit the length of the trail
        }

        this.draw();
    }
}

function init() {
    for (let i = 0; i < 1000; i++) {
        const x = Math.random() * canvas.width;
        const y = Math.random() * canvas.height;
        particles.push(new Particle(x, y));
    }
}

function animate() {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.1)'; // Light fade to create trail effect
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    for (let i = 0; i < particles.length; i++) {
        particles[i].update();
    }
    requestAnimationFrame(animate);
}

init();
animate();

window.addEventListener('resize', () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    particles.length = 0;
    init();
});

window.addEventListener('mousemove', (event) => {
    mouse.x = event.x;
    mouse.y = event.y;
});
