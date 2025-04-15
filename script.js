if (typeof Matter === 'undefined') {
    alert('Error: Matter.js library not loaded. Check the script tag in index.html.');
} else {
    console.log("Stack Forever: Loading script (vFixFirstBlock)...");

    const Engine = Matter.Engine, Render = Matter.Render, Runner = Matter.Runner,
          Bodies = Matter.Bodies, Body = Matter.Body, Composite = Matter.Composite,
          Events = Matter.Events, Mouse = Matter.Mouse, MouseConstraint = Matter.MouseConstraint,
          Query = Matter.Query, World = Matter.World, Constraint = Matter.Constraint,
          Detector = Matter.Detector, Common = Matter.Common;

    const canvasWidth = window.innerWidth;
    const canvasHeight = window.innerHeight;

    const engine = Engine.create();
    const world = engine.world;
    engine.world.gravity.y = 1;

    const render = Render.create({ element: document.body, engine: engine, options: { width: canvasWidth, height: canvasHeight, wireframes: false, background: '#87CEEB' } });
    const ground = Bodies.rectangle(canvasWidth / 2, canvasHeight - 25, canvasWidth * 2, 50, { isStatic: true, label: 'ground', friction: 1.0, render: { fillStyle: 'steelblue' } });
    Composite.add(world, [ground]);

    let score = 0;
    let currentBlock = null;
    let isGameOver = false;
    let windForceX = 0;
    let maxWindForce = 0.010;
    const strongWindThreshold = 0.006;
    let heldBlock = null;
    let draggedBlock = null;
    const targetHeightY = 150;
    let levelCleared = false;
    let highestBlockY = canvasHeight;
    let particles = [];

    const blockColors = ["#FF5733", "#33FF57", "#3357FF", "#FF33A1", "#FFFF33", "#FF8C00", "#DA70D6", "#00CED1"];
    const shapeTypes = ['rectangle', 'circle', 'small_rectangle', 'wide_rectangle'];

    const minDropIntervalMs = 500;
    const maxAllowableWindForce = 0.030;
    let windUpdateTimeoutId = null;

    let contactMap = new Map();
    const glueTimeRequired = 3000;
    const glueStiffness = 0.01;
    const glueBreakStretchRatio = 1.2;

    function getRandomElement(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
    function randomInRange(min, max) { return Math.random() * (max - min) + min; }
    function distance(posA, posB) { const dx = posA.x - posB.x; const dy = posA.y - posB.y; return Math.sqrt(dx * dx + dy * dy); }
    function getPairId(bodyA, bodyB) { return bodyA.id < bodyB.id ? `${bodyA.id}-${bodyB.id}` : `${bodyB.id}-${bodyA.id}`; }
    function getNumericWeight(body) { const density = (typeof body.density === 'number' && isFinite(body.density)) ? body.density : 0.005; const area = (typeof body.area === 'number' && isFinite(body.area) && body.area > 0) ? body.area : 500; const factor = 8; const weight = Math.round(density * area * factor); if (!isFinite(weight) || weight <= 0) { console.error("Invalid weight calculated! Inputs:", body.density, body.area, "Result:", weight); return 1; } return Math.max(1, weight); }

    function createParticles(x, y, pColor, count, intensity, dirY = -1) { for (let i = 0; i < count; i++) { particles.push({ x: x, y: y, vx: randomInRange(-intensity, intensity), vy: randomInRange(intensity * 1.5 * dirY, intensity * 0.5 * dirY), life: randomInRange(20, 40), radius: randomInRange(1, 3), color: pColor || 'rgba(255, 255, 255, 0.7)' }); } }
    function updateAndDrawParticles(ctx) { const gravity = 0.1; for (let i = particles.length - 1; i >= 0; i--) { const p = particles[i]; p.x += p.vx; p.y += p.vy; p.vy += gravity; p.life--; if (p.life <= 0) { particles.splice(i, 1); continue; } try { ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2); ctx.fill(); } catch (e) { console.warn("Error drawing particle:", e); particles.splice(i, 1); } } }

    function displayInfo() { const ctx = render.context; ctx.fillStyle = "black"; ctx.font = "24px Arial"; ctx.textAlign = "left"; ctx.fillText("Score: " + score.toFixed(score % 1 === 0 ? 0 : 1), 20, 40); let windDisplay = "Wind: "; const absWind = Math.abs(windForceX); if (absWind < 0.0001) { windDisplay += "Calm"; } else { windDisplay += `${windForceX > 0 ? '>>' : '<<'} (${(absWind * 1000).toFixed(1)})`; if (absWind >= strongWindThreshold) { windDisplay += " STRONG!"; ctx.fillStyle = "red"; } } ctx.fillText(windDisplay, 20, 70); ctx.fillStyle = "black"; if (isGameOver) { ctx.fillStyle = "rgba(0, 0, 0, 0.7)"; ctx.fillRect(0, canvasHeight / 2 - 60, canvasWidth, 120); ctx.fillStyle = "white"; ctx.font = "40px Arial"; ctx.textAlign = "center"; ctx.fillText("GAME OVER", canvasWidth / 2, canvasHeight / 2 - 10); ctx.font = "20px Arial"; ctx.fillText("Final Score: " + score.toFixed(score % 1 === 0 ? 0 : 1), canvasWidth / 2, canvasHeight / 2 + 25); ctx.fillText("Refresh page (F5) to restart", canvasWidth/2, canvasHeight / 2 + 50); } }
    function updateSkyColor() { let progress = Math.max(0, Math.min(1, (canvasHeight - highestBlockY) / (canvasHeight - targetHeightY - 50))); let skyColor; if (progress < 0.25) { skyColor = '#87CEEB'; } else if (progress < 0.5) { skyColor = `rgb(${Math.round(135 + (255 - 135) * (progress - 0.25) * 4)}, ${Math.round(206 - (206 - 165) * (progress - 0.25) * 4)}, ${Math.round(235 - (235 - 0) * (progress - 0.25) * 4)})`; } else if (progress < 0.75) { skyColor = `rgb(${Math.round(255 - (255 - 128) * (progress - 0.5) * 4)}, ${Math.round(165 - (165 - 0) * (progress - 0.5) * 4)}, ${Math.round(0 + (128 - 0) * (progress - 0.5) * 4)})`; } else { skyColor = `rgb(${Math.round(128 - (128 - 100) * (progress - 0.75) * 4)}, 0, ${Math.round(128 + (0 - 128) * (progress - 0.75) * 4)})`; } render.options.background = skyColor; }

    function applyGlueConstraint(bodyA, bodyB) { if (!bodyA || !bodyB) return; const existingConstraints = Composite.allConstraints(world).filter(c => c.label === 'glue'); const alreadyGlued = existingConstraints.some(c => (c.bodyA === bodyA && c.bodyB === bodyB) || (c.bodyA === bodyB && c.bodyB === bodyA)); if (alreadyGlued) return; console.log(`Applying constraint between ${bodyA.id} and ${bodyB.id}`); const currentDist = distance(bodyA.position, bodyB.position); const constraint = Constraint.create({ bodyA: bodyA, bodyB: bodyB, length: currentDist, stiffness: glueStiffness, label: 'glue', render: { type: 'line', anchors: false, strokeStyle: '#FFFFFF', lineWidth: 1, visible: true } }); Composite.add(world, constraint); createParticles((bodyA.position.x + bodyB.position.x)/2, (bodyA.position.y + bodyB.position.y)/2, 'rgba(200, 200, 255, 0.8)', 15, 3); }
    function checkAndBreakGlue(windIsStrong) { if (!windIsStrong) return; const glueConstraints = Composite.allConstraints(world).filter(c => c.label === 'glue'); glueConstraints.forEach(constraint => { const bodyA = constraint.bodyA; const bodyB = constraint.bodyB; if (!bodyA || !bodyB || bodyA.isStatic || bodyB.isStatic) { Composite.remove(world, constraint); return; } if (heldBlock === bodyA || heldBlock === bodyB) return; const currentDist = distance(bodyA.position, bodyB.position); if (currentDist > constraint.length * glueBreakStretchRatio) { console.log("Glue broken by wind!"); createParticles((bodyA.position.x + bodyB.position.x)/2, (bodyA.position.y + bodyB.position.y)/2, 'rgba(255, 0, 0, 0.7)', 10, 3); Composite.remove(world, constraint); } }); }
    function updateContactsAndApplyGlue(engineTimestamp) { const blocks = Composite.allBodies(world).filter(body => body.label === 'block' && !body.isStatic); if (blocks.length < 2) { contactMap.clear(); return; } const detector = Detector.create(); Detector.setBodies(detector, blocks); const currentCollisions = Detector.collisions(detector); const currentCollisionPairs = new Set(); currentCollisions.forEach(pair => { const bodyA = pair.bodyA; const bodyB = pair.bodyB; const pairId = getPairId(bodyA, bodyB); currentCollisionPairs.add(pairId); const isGlued = Composite.allConstraints(world).some(c => c.label === 'glue' && ((c.bodyA === bodyA && c.bodyB === bodyB) || (c.bodyA === bodyB && c.bodyB === bodyA))); if (isGlued) { contactMap.delete(pairId); return; } if (contactMap.has(pairId)) { const contactInfo = contactMap.get(pairId); const elapsedTime = engineTimestamp - contactInfo.startTime; if (elapsedTime >= glueTimeRequired) { applyGlueConstraint(bodyA, bodyB); contactMap.delete(pairId); } } else { contactMap.set(pairId, { startTime: engineTimestamp, bodyA, bodyB }); } }); const mapKeys = Array.from(contactMap.keys()); mapKeys.forEach(pairId => { if (!currentCollisionPairs.has(pairId)) { contactMap.delete(pairId); } }); }

    function resetLevel() { console.log("Resetting level..."); levelCleared = true; const bodiesToRemove = Composite.allBodies(world).filter(body => body.label !== 'ground'); bodiesToRemove.forEach(body => Composite.remove(world, body)); const constraintsToRemove = Composite.allConstraints(world).filter(c => c.label === 'glue'); constraintsToRemove.forEach(c => Composite.remove(world, c)); contactMap.clear(); maxWindForce = Math.min(maxAllowableWindForce, maxWindForce * 1.05); console.log(`Max Wind: ${maxWindForce.toFixed(4)}`); score = 0; currentBlock = null; heldBlock = null; draggedBlock = null; highestBlockY = canvasHeight; render.options.background = '#87CEEB'; particles = []; setTimeout(() => { levelCleared = false; if (!isGameOver) { prepareNextBlock(); } }, 500); }

    function prepareNextBlock() {
        console.log("Attempting to prepare next block..."); // Diagnostic Log
        if (isGameOver || levelCleared || currentBlock) { console.log("Prepare skipped:", {isGameOver, levelCleared, currentBlockExists: !!currentBlock}); return; }

        // Score handled on landing

        const blockStartX = canvasWidth / 2; const blockStartY = 50; let shapeType = getRandomElement(shapeTypes); let blockColor;
        let newBlock, blockWidth = 100, blockHeight = 30, density = 0.005, friction = 0.7, restitution = 0.1; let blockLabel = 'nextBlock'; let specialType = 'normal';
        const rand = Math.random();
        if (rand < 0.1) { specialType = 'anchor'; } else if (rand < 0.2) { specialType = 'light'; }
        switch (shapeType) { case 'circle': density = 0.003; break; case 'small_rectangle': density = 0.004; break; case 'rectangle': density = 0.005; break; case 'wide_rectangle': density = 0.007; break; }
        if (specialType === 'anchor') { density *= 2.5; friction = 0.95; shapeType = Math.random() < 0.7 ? 'rectangle' : 'wide_rectangle'; console.log("Anchor Block!"); }
        else if (specialType === 'light') { density *= 0.4; friction = 0.3; restitution = 0.3; shapeType = Math.random() < 0.7 ? 'small_rectangle' : 'circle'; console.log("Light Block!"); }

        if (density <= 0.0035) blockColor = '#ADD8E6'; else if (density <= 0.0055) blockColor = '#FFD700'; else if (density <= 0.0075) blockColor = '#FFA500'; else blockColor = '#696969';
        const blockOptions = { friction: Math.max(0.1, friction + randomInRange(-0.05, 0.05)), restitution: Math.max(0, restitution + randomInRange(-0.05, 0.05)), density: density, isStatic: true, label: blockLabel, render: { fillStyle: blockColor } };

        try { // Add try-catch around body creation
            switch (shapeType) {
                 case 'circle': const radius = 20 + randomInRange(0, 15); newBlock = Bodies.circle(blockStartX, blockStartY, radius, blockOptions); newBlock.blockWidth = radius * 2; newBlock.blockHeight = radius * 2; break;
                 case 'small_rectangle': blockWidth = 40 + randomInRange(0, 30); blockHeight = 20 + randomInRange(0, 20); newBlock = Bodies.rectangle(blockStartX, blockStartY, blockWidth, blockHeight, blockOptions); break;
                 case 'wide_rectangle': blockWidth = 100 + randomInRange(0, 50); blockHeight = 15 + randomInRange(0, 10); newBlock = Bodies.rectangle(blockStartX, blockStartY, blockWidth, blockHeight, blockOptions); break;
                 case 'rectangle': default: blockWidth = 60 + randomInRange(0, 40); blockHeight = 25 + randomInRange(0, 20); newBlock = Bodies.rectangle(blockStartX, blockStartY, blockWidth, blockHeight, blockOptions); break;
            }
            if (!newBlock) throw new Error("Body creation failed"); // Explicit check

            if (!newBlock.blockWidth) newBlock.blockWidth = blockWidth; if (!newBlock.blockHeight) newBlock.blockHeight = blockHeight;
            // Body.set(newBlock, "area", newBlock.area); // Removed this line - potentially problematic
            newBlock.numericWeight = getNumericWeight(newBlock);

            currentBlock = newBlock;
            console.log("Adding block to world:", newBlock.id); // Diagnostic Log
            Composite.add(world, currentBlock);
            console.log(`Prepared ${shapeType} (${specialType}). Waiting for drop.`);
        } catch (error) {
            console.error("!!!!!!!! ERROR during prepareNextBlock !!!!!!!!!!", error);
            isGameOver = true; // Stop game if block prep fails critically
        }
        // No auto-drop timer schedule here
    }

    // Removed forceDropCurrentBlock and scheduleNextAutoDrop

    function updateWind() { if (isGameOver || levelCleared) return; if (Math.random() < 0.65) { windForceX = randomInRange(-maxWindForce, maxWindForce); } else { windForceX = 0; } scheduleNextWindUpdate(); }
    function scheduleNextWindUpdate() { if (windUpdateTimeoutId) clearTimeout(windUpdateTimeoutId); const nextWindUpdateDelay = randomInRange(3000, 8000); windUpdateTimeoutId = setTimeout(updateWind, nextWindUpdateDelay); }

    const mouse = Mouse.create(render.canvas); const mouseConstraint = MouseConstraint.create(engine, { mouse: mouse, constraint: { stiffness: 0.1, render: { visible: false } } }); Composite.add(world, mouseConstraint);
    Events.on(mouseConstraint, 'mousedown', (event) => {
        console.log("Mouse Down"); // Diagnostic Log
        if (isGameOver || levelCleared) return; const mousePos = event.mouse.position; const bodiesUnderMouse = Query.point(Composite.allBodies(world), mousePos); let clickedBody = null; let foundNextBlock = false; for (const body of bodiesUnderMouse) { if (body.label === 'nextBlock' && body === currentBlock) { clickedBody = body; foundNextBlock = true; break; } } if (!foundNextBlock && bodiesUnderMouse.length > 0) { for (const body of bodiesUnderMouse) { if (body.label === 'block' && !body.isStatic && !body.isSettling && Math.abs(windForceX) >= strongWindThreshold) { clickedBody = body; break; } } } if (clickedBody) { if (clickedBody.label === 'nextBlock') { draggedBlock = clickedBody; console.log("Dragging next block."); } else if (clickedBody.label === 'block') { heldBlock = clickedBody; Body.setStatic(heldBlock, true); heldBlock.render.opacity = 0.5; console.log("Holding block against strong wind!"); } } });
    Events.on(mouseConstraint, 'mouseup', (event) => {
        console.log("Mouse Up"); // Diagnostic Log
        if (isGameOver || levelCleared) { if (heldBlock) { heldBlock.render.opacity = 1.0; heldBlock = null; } draggedBlock = null; return; }
        if (draggedBlock) {
            const blockToDrop = draggedBlock; // Keep reference before clearing
            console.log("Player released block for dropping ID:", blockToDrop.id);
            draggedBlock = null; // Clear drag state

            if(blockToDrop){ // Ensure block still exists
                 blockToDrop.label = 'block';
                 blockToDrop.isSettling = true;
                 try {
                    Body.setStatic(blockToDrop, false); // Make it dynamic
                    console.log("Block set to dynamic:", blockToDrop.id); // Diagnostic Log
                    Body.setAngularVelocity(blockToDrop, randomInRange(-0.05, 0.05));
                 } catch(error){
                    console.error("!!!!! ERROR setting block static false !!!!!", error, blockToDrop);
                 }
                 currentBlock = null; // Block is dropped
                 // *** Next block prepared after landing ***
            } else {
                 console.warn("draggedBlock was null or invalid on mouseup");
            }
        }
        if (heldBlock) { console.log("Released held block"); heldBlock.render.opacity = 1.0; if (!isGameOver && !levelCleared) { Body.setStatic(heldBlock, false); } heldBlock = null; }
    });

    Events.on(engine, 'beforeUpdate', (event) => { if (isGameOver || levelCleared) return; const windIsStrong = Math.abs(windForceX) >= strongWindThreshold; if (Math.abs(windForceX) > 0.0001) { const bodies = Composite.allBodies(world); for (let i = 0; i < bodies.length; i++) { const body = bodies[i]; if (!body.isStatic && body.label !== 'ground' && body !== heldBlock && body !== currentBlock) { Body.applyForce(body, body.position, { x: windForceX, y: 0 }); } } } checkAndBreakGlue(windIsStrong); });

    Events.on(engine, 'afterUpdate', (event) => {
         const engineTimestamp = event.timestamp;
         if (levelCleared) { displayInfo(); updateAndDrawParticles(render.context); return; }
         if (isGameOver) { if (runner.enabled) { Runner.stop(runner); } displayInfo(); updateAndDrawParticles(render.context); return; }

        const bodies = Composite.allBodies(world); let blockHasSettledThisFrame = false; let currentHighestY = canvasHeight;
        const bodiesToRemoveThisFrame = [];
        for (let i = 0; i < bodies.length; i++) {
            const body = bodies[i]; if (body.isStatic || body.label === 'ground') { if(body.label !== 'ground' && body.blockHeight) currentHighestY = Math.min(currentHighestY, body.position.y - body.blockHeight / 2); continue; }
            const isOffBottom = body.position.y > canvasHeight + 50; const isOffSides = Math.abs(body.position.x - canvasWidth / 2) > canvasWidth / 2 + 100;
            if (body.label === 'block' && (isOffBottom || isOffSides)) {
                if (!bodiesToRemoveThisFrame.includes(body)) {
                     console.log("Game Over - Block fell off!"); isGameOver = true; bodiesToRemoveThisFrame.push(body);
                     if (heldBlock) { heldBlock.render.opacity = 1.0; heldBlock = null; }
                     // Stop timers? No, just let runner stop.
                } continue;
            }
            if(body.blockHeight) currentHighestY = Math.min(currentHighestY, body.position.y - body.blockHeight / 2);
            if (body.isSettling) {
                const speed = body.speed; const angularSpeed = body.angularSpeed; const speedThreshold = 0.1; const angularSpeedThreshold = 0.05;
                if (speed < speedThreshold && angularSpeed < angularSpeedThreshold) { body.settleTimer = (body.settleTimer || 0) + 1; } else { body.settleTimer = 0; }
                const settleFramesRequired = 30;
                if (body.settleTimer >= settleFramesRequired) {
                    body.isSettling = false; body.settleTimer = 0;
                    createParticles(body.position.x, body.position.y, body.render.fillStyle || '#CCC', 15, 2);
                    if (!blockHasSettledThisFrame && !currentBlock && !draggedBlock && !levelCleared && !isGameOver) {
                        const pointsToAdd = (score >= 5) ? 1.5 : 1; score += pointsToAdd;
                        console.log(`Block landed! +${pointsToAdd.toFixed(pointsToAdd % 1 === 0 ? 0 : 1)} point(s). Score: ${score.toFixed(score % 1 === 0 ? 0 : 1)}`);
                        const blockTopY = body.position.y - (body.blockHeight || 30) / 2; highestBlockY = Math.min(highestBlockY, blockTopY);
                        if (blockTopY <= targetHeightY) { console.log("Target height reached!"); resetLevel(); blockHasSettledThisFrame = true; }
                        else { prepareNextBlock(); blockHasSettledThisFrame = true; } // Prepare next block AFTER landing
                    }
                }
            }
        }
        if (bodiesToRemoveThisFrame.length > 0) { bodiesToRemoveThisFrame.forEach(body => Composite.remove(world, body)); }
        if (!isGameOver && !levelCleared) { updateContactsAndApplyGlue(engineTimestamp); }
        if (!blockHasSettledThisFrame && !levelCleared && !isGameOver) { highestBlockY = Math.min(highestBlockY, currentHighestY); }
        updateSkyColor(); displayInfo(); updateAndDrawParticles(render.context);
    });

     Events.on(render, 'afterRender', (event) => {
        const ctx = render.context;
        if (!isGameOver && !levelCleared) {
            ctx.beginPath(); ctx.setLineDash([10, 10]); ctx.moveTo(0, targetHeightY); ctx.lineTo(canvasWidth, targetHeightY);
            ctx.strokeStyle = 'rgba(255, 0, 0, 0.7)'; ctx.lineWidth = 2; ctx.stroke(); ctx.setLineDash([]); ctx.lineWidth = 1;
        }
        // Weight label removed
     });

    const overlay = document.getElementById('instructions-overlay');
    const startButton = document.getElementById('start-button');
    let gameStarted = false;
    const runner = Runner.create();

    function startGame() {
        console.log("startGame function called"); // Diagnostic Log
        if (gameStarted) return;
        console.log("Starting game sequence...");
        gameStarted = true;
        overlay.style.display = 'none';
        console.log("Hiding overlay, preparing first block...");
        prepareNextBlock(); // Prepare first block *before* starting runner? Or after? Let's do before.
        console.log("First block prepared, starting runner and wind...");
        Runner.run(runner, engine); // Start engine runner
        scheduleNextWindUpdate(); // Start wind cycle
        console.log("Game started!");
    }

    startButton.addEventListener('click', startGame);
    Render.run(render); // Start rendering

    console.log("Stack Forever: Ready. Click Start Game. (vFixFirstBlockDrop)");
} // End of Matter check
