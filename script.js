if (typeof Matter === 'undefined') {
    alert('Error: Matter.js library not loaded. Check the script tag in index.html.');
} else {
    console.log("Matter.js loaded successfully!");

    const Engine = Matter.Engine, Render = Matter.Render, Runner = Matter.Runner,
          Bodies = Matter.Bodies, Body = Matter.Body, Composite = Matter.Composite,
          Events = Matter.Events, Mouse = Matter.Mouse, MouseConstraint = Matter.MouseConstraint,
          Query = Matter.Query, World = Matter.World, Constraint = Matter.Constraint, // Added Constraint
          Detector = Matter.Detector; // Added Detector for glue collisions

    const canvasWidth = window.innerWidth;
    const canvasHeight = window.innerHeight;

    const engine = Engine.create();
    const world = engine.world;
    engine.world.gravity.y = 1;
    // Optional: Increase position iterations for constraint stability
    // engine.positionIterations = 10;
    // engine.velocityIterations = 8;

    const render = Render.create({
        element: document.body,
        engine: engine,
        options: {
            width: canvasWidth,
            height: canvasHeight,
            wireframes: false,
            background: '#87CEEB'
        }
    });

    const ground = Bodies.rectangle(canvasWidth / 2, canvasHeight - 25, canvasWidth * 2, 50, {
        isStatic: true, label: 'ground', friction: 0.9, render: { fillStyle: 'steelblue' }
    });
    Composite.add(world, [ground]);

    let score = 0;
    let currentBlock = null;
    let isGameOver = false;
    let windForceX = 0;
    let maxWindForce = 0.010; // Base max wind, will scale
    const strongWindThreshold = 0.006;
    let heldBlock = null;
    let draggedBlock = null;
    const targetHeightY = 150;
    let levelCleared = false;
    let highestBlockY = canvasHeight;
    let particles = []; // For particle effects

    const blockColors = ["#FF5733", "#33FF57", "#3357FF", "#FF33A1", "#FFFF33", "#FF8C00", "#DA70D6", "#00CED1"];
    const shapeTypes = ['rectangle', 'circle', 'small_rectangle', 'wide_rectangle'];

    let autoDropIntervalMs = 5000; // Base drop interval, will scale
    const minDropIntervalMs = 2500; // Fastest drop rate
    const maxAllowableWindForce = 0.025; // Cap wind scaling
    let autoDropTimeoutId = null;
    let windUpdateTimeoutId = null;

    // --- Glue Mechanic Variables ---
    const glueTriggerScore = 10; // Apply glue every 10 points
    let lastGlueScore = -1; // Ensure glue triggers correctly
    const glueStiffness = 0.01; // How rigid the glue is
    const glueBreakStretchRatio = 1.2; // Breaks if stretched > 20%

    // --- Utility Functions ---
    function getRandomElement(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
    function randomInRange(min, max) { return Math.random() * (max - min) + min; }
    function distance(posA, posB) { const dx = posA.x - posB.x; const dy = posA.y - posB.y; return Math.sqrt(dx * dx + dy * dy); }

    // --- Particle System ---
    function createParticles(x, y, pColor, count, intensity) {
        for (let i = 0; i < count; i++) {
            particles.push({
                x: x, y: y,
                vx: randomInRange(-intensity, intensity), vy: randomInRange(-intensity * 1.5, -intensity * 0.5), // Burst upwards slightly
                life: randomInRange(30, 60), // Frames to live
                radius: randomInRange(1, 3),
                color: pColor || 'rgba(255, 255, 255, 0.7)' // Default white
            });
        }
    }
    function updateAndDrawParticles(ctx) {
        const gravity = 0.1; // Simple particle gravity
        for (let i = particles.length - 1; i >= 0; i--) {
            const p = particles[i];
            p.x += p.vx; p.y += p.vy; p.vy += gravity; p.life--;
            if (p.life <= 0) { particles.splice(i, 1); continue; }
            ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2); ctx.fill();
        }
    }

    // --- Display ---
    function displayInfo() {
        const ctx = render.context; ctx.fillStyle = "black"; ctx.font = "24px Arial"; ctx.textAlign = "left";
        ctx.fillText("Score: " + score, 20, 40);
        let windDisplay = "Wind: "; const absWind = Math.abs(windForceX);
        if (absWind < 0.0001) { windDisplay += "Calm"; } else {
             windDisplay += `${windForceX > 0 ? '>>' : '<<'} (${(absWind * 1000).toFixed(1)})`;
             if (absWind >= strongWindThreshold) { windDisplay += " STRONG!"; ctx.fillStyle = "red"; }
        }
        ctx.fillText(windDisplay, 20, 70); ctx.fillStyle = "black";
        if (isGameOver) { /* Game Over Text */ } // (Keep existing game over text logic)
    }

    // --- Sky Color Update ---
    function updateSkyColor() { /* Keep existing sky color logic */ }

    // --- Glue Mechanic ---
    function applyGlue() {
        if (isGameOver || levelCleared) return;
        console.log("Applying glue!");
        createParticles(canvasWidth / 2, canvasHeight / 2, 'rgba(200, 200, 255, 0.8)', 30, 5); // Visual effect

        const blocks = Composite.allBodies(world).filter(body => body.label === 'block' && !body.isStatic);
        if (blocks.length < 2) return; // Need at least two blocks

        // Find potential collision pairs using Detector
        const detector = Detector.create();
        Detector.setBodies(detector, blocks);
        const pairs = Detector.collisions(detector);

        const existingConstraints = Composite.allConstraints(world).filter(c => c.label === 'glue');

        pairs.forEach(pair => {
            const bodyA = pair.bodyA; const bodyB = pair.bodyB;
            // Check if already glued
            const alreadyGlued = existingConstraints.some(c => (c.bodyA === bodyA && c.bodyB === bodyB) || (c.bodyA === bodyB && c.bodyB === bodyA));
            if (alreadyGlued) return;

            // Use SAT check for actual collision confirmation (more robust than distance)
            const collisionInfo = Matter.Collision.collides(bodyA, bodyB);
            if (collisionInfo && collisionInfo.collided) {
                 const currentDist = distance(bodyA.position, bodyB.position);
                 const constraint = Constraint.create({
                     bodyA: bodyA, bodyB: bodyB,
                     length: currentDist, // Set length to current distance
                     stiffness: glueStiffness,
                     label: 'glue',
                     render: { type: 'line', anchors: false, strokeStyle: '#FFFFFF', lineWidth: 1, visible: true }
                 });
                 Composite.add(world, constraint);
                 console.log("Glued two blocks");
            }
        });
    }
    function checkAndBreakGlue(windIsStrong) {
        if (!windIsStrong) return; // Only break during strong wind

        const glueConstraints = Composite.allConstraints(world).filter(c => c.label === 'glue');
        glueConstraints.forEach(constraint => {
            const bodyA = constraint.bodyA; const bodyB = constraint.bodyB;
            // Don't break if player is holding one of the involved blocks
            if (heldBlock === bodyA || heldBlock === bodyB) return;

            const currentDist = distance(bodyA.position, bodyB.position);
            if (currentDist > constraint.length * glueBreakStretchRatio) {
                 console.log("Glue broken by wind!");
                 createParticles((bodyA.position.x + bodyB.position.x)/2, (bodyA.position.y + bodyB.position.y)/2, 'rgba(255, 0, 0, 0.7)', 10, 3); // Red break effect
                 Composite.remove(world, constraint);
            }
        });
    }

    // --- Game Mechanics ---
    function resetLevel() {
        console.log("Resetting level...");
        levelCleared = true;
        if (autoDropTimeoutId) clearTimeout(autoDropTimeoutId);
        // Stop wind timer if needed, or let it run
        // if (windUpdateTimeoutId) clearTimeout(windUpdateTimeoutId);

        // Remove non-ground bodies AND glue constraints
        const bodiesToRemove = Composite.allBodies(world).filter(body => body.label !== 'ground');
        bodiesToRemove.forEach(body => Composite.remove(world, body));
        const constraintsToRemove = Composite.allConstraints(world).filter(c => c.label === 'glue');
        constraintsToRemove.forEach(c => Composite.remove(world, c));

        // Increase Difficulty
        autoDropIntervalMs = Math.max(minDropIntervalMs, autoDropIntervalMs * 0.95); // 5% faster drops
        maxWindForce = Math.min(maxAllowableWindForce, maxWindForce * 1.1); // 10% stronger wind potential
        console.log(`New Drop Interval: ${autoDropIntervalMs}ms, Max Wind: ${maxWindForce.toFixed(4)}`);

        score = 0; lastGlueScore = -1; // Reset score and glue tracking
        currentBlock = null; heldBlock = null; draggedBlock = null;
        highestBlockY = canvasHeight; render.options.background = '#87CEEB';
        particles = []; // Clear particles

        setTimeout(() => {
            levelCleared = false;
             if (!isGameOver) {
                 prepareNextBlock(); // This will schedule the drop timer
                 // Restart wind cycle if stopped, otherwise it continues
                 // scheduleNextWindUpdate(); // If we were stopping it
            }
        }, 500);
    }

    function prepareNextBlock() {
        if (isGameOver || levelCleared || currentBlock) return;
        const blockStartX = canvasWidth / 2; const blockStartY = 50;
        const shapeType = getRandomElement(shapeTypes); const blockColor = getRandomElement(blockColors);
        let newBlock, blockWidth = 100, blockHeight = 30, density = 0.005;
        switch (shapeType) { /* Density assignment based on type */ } // (Keep existing density logic)
        const blockOptions = { /* Material variance and options */ }; // (Keep existing options logic)
        switch (shapeType) { /* Body creation based on type */ } // (Keep existing shape creation logic)
        if (!newBlock.blockWidth) newBlock.blockWidth = blockWidth; if (!newBlock.blockHeight) newBlock.blockHeight = blockHeight;

        currentBlock = newBlock; Composite.add(world, currentBlock);
        console.log(`Prepared ${shapeType} (Density: ${density.toFixed(3)}). Timer started.`);
        scheduleNextAutoDrop();
    }

    // --- Auto Drop Logic ---
    function forceDropCurrentBlock() { /* Keep existing force drop logic */ }
    function scheduleNextAutoDrop() {
         if (autoDropTimeoutId) { clearTimeout(autoDropTimeoutId); }
         if (currentBlock && currentBlock.isStatic && !isGameOver && !levelCleared) {
             autoDropTimeoutId = setTimeout(forceDropCurrentBlock, autoDropIntervalMs);
         } else { autoDropTimeoutId = null; }
    }

    // --- Wind Logic ---
    function updateWind() {
        if (isGameOver || levelCleared) return;
        if (Math.random() < 0.65) { windForceX = randomInRange(-maxWindForce, maxWindForce); }
        else { windForceX = 0; }
        // Schedule next update
        scheduleNextWindUpdate();
    }
    function scheduleNextWindUpdate() {
         if (windUpdateTimeoutId) clearTimeout(windUpdateTimeoutId); // Clear previous timer if exists
         const nextWindUpdateDelay = randomInRange(3000, 8000); // Shorter max delay
         windUpdateTimeoutId = setTimeout(updateWind, nextWindUpdateDelay);
    }

    // --- Mouse Control Setup & Events ---
    const mouse = Mouse.create(render.canvas);
    const mouseConstraint = MouseConstraint.create(engine, { /* Options */ }); // (Keep existing setup)
    Composite.add(world, mouseConstraint);
    Events.on(mouseConstraint, 'mousedown', (event) => { /* Keep existing mousedown logic */ });
    Events.on(mouseConstraint, 'mouseup', (event) => { /* Keep existing mouseup logic */ });


    // --- Physics and Game Loop ---
    Events.on(engine, 'beforeUpdate', (event) => {
        if (isGameOver || levelCleared) return;
        const windIsStrong = Math.abs(windForceX) >= strongWindThreshold;
        // Apply Wind Force
        if (Math.abs(windForceX) > 0.0001) {
            const bodies = Composite.allBodies(world);
            for (let i = 0; i < bodies.length; i++) { const body = bodies[i];
                if (!body.isStatic && body.label !== 'ground' && body !== heldBlock && body !== currentBlock) {
                     Body.applyForce(body, body.position, { x: windForceX, y: 0 });
                }
            }
        }
        // Check for breaking glue
        checkAndBreakGlue(windIsStrong);
    });

    Events.on(engine, 'afterUpdate', (event) => {
         if (levelCleared) { displayInfo(); updateAndDrawParticles(render.context); return; } // Draw particles during clear
         if (isGameOver) { /* Keep existing Game Over logic */ displayInfo(); updateAndDrawParticles(render.context); return; } // Draw particles on game over

        const bodies = Composite.allBodies(world);
        let blockHasSettledThisFrame = false;
        let currentHighestY = canvasHeight;

        for (let i = 0; i < bodies.length; i++) {
            const body = bodies[i];
            if (body.isStatic || body.label === 'ground') { /* Update currentHighestY */ continue; } // (Keep existing logic)
            // --- Game Over Check ---
            const isOffBottom = body.position.y > canvasHeight + 50; const isOffSides = Math.abs(body.position.x - canvasWidth / 2) > canvasWidth / 2 + 100;
            if (body.label === 'block' && (isOffBottom || isOffSides)) { /* Set isGameOver = true */ break; } // (Keep existing logic)
            // --- Track Highest Point ---
            currentHighestY = Math.min(currentHighestY, body.position.y - (body.blockHeight || 30) / 2);
            // --- Landing / Goal / Glue Check ---
            if (body.isSettling) {
                const speed = body.speed; const angularSpeed = body.angularSpeed;
                const speedThreshold = 0.1; const angularSpeedThreshold = 0.05;
                if (speed < speedThreshold && angularSpeed < angularSpeedThreshold) { body.settleTimer = (body.settleTimer || 0) + 1; }
                else { body.settleTimer = 0; }
                const settleFramesRequired = 30;
                if (body.settleTimer >= settleFramesRequired) {
                    const settleSpeedBonus = Math.max(0, settleFramesRequired - body.settleTimer); // Bonus for faster settle
                    body.isSettling = false; body.settleTimer = 0;
                    createParticles(body.position.x, body.position.y, getRandomElement(blockColors), 15, 2); // Landing particles

                    if (!blockHasSettledThisFrame && !currentBlock && !draggedBlock && !levelCleared) {
                        score++;
                        if (settleSpeedBonus > 20) { // Award bonus for very fast settle
                             score += 5;
                             console.log("Fast settle bonus! +5");
                             // Add score bonus text effect? (optional)
                         }
                        console.log("Block landed! Score:", score);
                        const blockTopY = body.position.y - (body.blockHeight || 30) / 2;
                        highestBlockY = Math.min(highestBlockY, blockTopY);

                        // --- Glue Trigger Check ---
                        if (score > 0 && score % glueTriggerScore === 0 && score !== lastGlueScore) {
                             applyGlue();
                             lastGlueScore = score;
                        }

                        // --- Goal Check ---
                        if (blockTopY <= targetHeightY) {
                             console.log("Target height reached!"); resetLevel();
                             blockHasSettledThisFrame = true; break;
                         } else {
                             prepareNextBlock(); blockHasSettledThisFrame = true;
                         }
                    }
                }
            }
        } // End of body loop
        if (!blockHasSettledThisFrame) { highestBlockY = Math.min(highestBlockY, currentHighestY); }
        updateSkyColor(); displayInfo(); updateAndDrawParticles(render.context); // Draw particles last
    });

    // --- Draw Target Line & Particles ---
     Events.on(render, 'afterRender', (event) => {
         // Draw Target Line (Keep existing logic)
         // Update and Draw Particles is now called in afterUpdate to ensure it's drawn over game elements
     });

    // --- Initialize ---
    Render.run(render); const runner = Runner.create(); Runner.run(runner, engine);
    scheduleNextWindUpdate(); // Use the scheduled update
    prepareNextBlock();
    console.log("Stack Forever: Glue activates every 10 points! Difficulty scales. Bonus for fast drops.");
}
