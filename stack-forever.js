const {
    Engine,
    Render,
    Runner,
    Composite,
    Bodies,
    Constraint,
    Events,
    Body,
    Mouse,
    MouseConstraint
} = Matter;

// Basic setup
const engine = Engine.create();
const world = engine.world;

const canvasWidth = window.innerWidth;
const canvasHeight = window.innerHeight;

const render = Render.create({
    element: document.body,
    engine,
    options: {
        width: canvasWidth,
        height: canvasHeight,
        wireframes: false,
        background: '#87CEEB'
    }
});

Render.run(render);
const runner = Runner.create();
Runner.run(runner, engine);

// Floor
const floor = Bodies.rectangle(canvasWidth / 2, canvasHeight - 20, canvasWidth, 40, {
    isStatic: true,
    render: { fillStyle: '#222' }
});
Composite.add(world, floor);

// Variables
let stack = [];
let currentBlock = null;
let currentConstraint = null;
let isGameOver = false;
let score = 0;
let wind = 0;
let autoDropInterval = 2000;
let autoDropTimer = null;
let skyColor = { r: 135, g: 206, b: 235 };

// Block Types
const blockTypes = [
    { w: 60, h: 60, color: '#ff7675', weight: 1 },
    { w: 80, h: 40, color: '#74b9ff', weight: 1.2 },
    { w: 40, h: 80, color: '#55efc4', weight: 0.8 },
    { w: 100, h: 50, color: '#ffeaa7', weight: 1.5 }
];

// Random block generator
function createBlock(x, y) {
    const type = blockTypes[Math.floor(Math.random() * blockTypes.length)];
    const block = Bodies.rectangle(x, y, type.w, type.h, {
        restitution: 0,
        friction: 0.6,
        density: 0.001 * type.weight,
        label: 'block',
        render: {
            fillStyle: type.color
        }
    });

    if (Math.random() < 0.05) {
        block.render.fillStyle = '#dfe6e9'; // Special block
        block.isSticky = true;
    }

    return block;
}

// Particle Effect (Simple Circles)
function createParticleEffect(x, y) {
    for (let i = 0; i < 10; i++) {
        const particle = Bodies.circle(x, y, 3, {
            restitution: 0.8,
            friction: 0,
            density: 0.0001,
            render: {
                fillStyle: '#ffffff'
            }
        });
        const angle = Math.random() * 2 * Math.PI;
        const speed = Math.random() * 2 + 1;
        Body.setVelocity(particle, {
            x: Math.cos(angle) * speed,
            y: Math.sin(angle) * speed
        });
        Composite.add(world, particle);
        setTimeout(() => Composite.remove(world, particle), 1000);
    }
}

// Drop Block
function dropBlock() {
    if (!currentBlock) return;

    Composite.remove(world, currentConstraint);
    currentConstraint = null;
    currentBlock = null;
    score++;
    wind = (Math.random() - 0.5) * 0.002;
    autoDropInterval = Math.max(500, autoDropInterval - 50);
    scheduleAutoDrop();
}

// Schedule Auto Drop
function scheduleAutoDrop() {
    clearTimeout(autoDropTimer);
    autoDropTimer = setTimeout(() => dropBlock(), autoDropInterval);
}

// Generate New Block
function generateNewBlock() {
    const block = createBlock(canvasWidth / 2, 100);
    currentBlock = block;
    Composite.add(world, block);
    currentConstraint = Constraint.create({
        pointA: { x: block.position.x, y: block.position.y - 100 },
        bodyB: block,
        pointB: { x: 0, y: 0 },
        stiffness: 0.1,
        damping: 0.05,
        render: { visible: false }
    });
    Composite.add(world, currentConstraint);
    scheduleAutoDrop();
}

// Mouse Interaction
window.addEventListener('click', () => {
    if (!isGameOver) dropBlock();
    else location.reload(); // Restart
});

// Sky Color Based on Score
function updateSkyColor() {
    skyColor.r = Math.min(255, 135 + score);
    skyColor.g = Math.max(100, 206 - score);
    skyColor.b = Math.max(100, 235 - score * 1.5);
    const color = `rgb(${skyColor.r}, ${skyColor.g}, ${skyColor.b})`;
    render.options.background = color;
}

// Game Over Check
Events.on(engine, 'afterUpdate', () => {
    if (currentBlock) {
        Body.applyForce(currentBlock, currentBlock.position, { x: wind, y: 0 });
    }

    const blocks = Composite.allBodies(world).filter(b => b.label === 'block');

    blocks.forEach(block => {
        if (block.position.y > canvasHeight + 100 && !isGameOver) {
            isGameOver = true;
            alert('Game Over!\nScore: ' + score);
        }

        if (block.isSticky && block.position.y >= canvasHeight - 80 && !block.hasStuck) {
            const constraint = Constraint.create({
                bodyA: block,
                pointB: { x: block.position.x, y: block.position.y },
                stiffness: 0.8,
                damping: 0.1,
                render: { visible: false }
            });
            Composite.add(world, constraint);
            block.hasStuck = true;
            createParticleEffect(block.position.x, block.position.y);
        }
    });

    updateSkyColor();
});

// Start Game
generateNewBlock();
