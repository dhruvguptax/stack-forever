if (typeof Matter === 'undefined') {
    alert('Error: Matter.js library not loaded. Check the script tag in index.html.');
} else {
    console.log("Matter.js loaded successfully!");

    const Engine = Matter.Engine,
          Render = Matter.Render,
          Runner = Matter.Runner,
          Bodies = Matter.Bodies,
          Body = Matter.Body,
          Composite = Matter.Composite,
          Events = Matter.Events,
          Mouse = Matter.Mouse,
          MouseConstraint = Matter.MouseConstraint,
          Query = Matter.Query,
          World = Matter.World;

    const canvasWidth = window.innerWidth;
    const canvasHeight = window.innerHeight;

    const engine = Engine.create();
    const world = engine.world;
    engine.world.gravity.y = 1;

    const render = Render.create({
        element: document.body,
        engine: engine,
        options: {
            width: canvasWidth,
            height: canvasHeight,
            wireframes: false,
            background: '#87CEEB' // Base sky color
        }
    });

    const ground = Bodies.rectangle(canvasWidth / 2, canvasHeight - 25, canvasWidth * 2, 50, {
        isStatic: true,
        label: 'ground',
        friction: 0.9, // Slightly higher friction for ground
        render: {
            fillStyle: 'steelblue'
        }
    });

    Composite.add(world, [ground]);

    let score = 0;
    let currentBlock = null; // The static block at the top, ready to be dragged/dropped
    let isGameOver = false;
    let windForceX = 0;
    const maxWindForce = 0.010;
    const strongWindThreshold = 0.006;
    let heldBlock = null;
    let draggedBlock = null;
    const targetHeightY = 150;
    let levelCleared = false;
    let highestBlockY = canvasHeight; // Track highest point for sky color

    const blockColors = ["#FF5733", "#33FF57", "#3357FF", "#FF33A1", "#FFFF33", "#FF8C00", "#DA70D6", "#00CED1"];
    const shapeTypes = ['rectangle', 'circle', 'small_rectangle', 'wide_rectangle'];

    const autoDropIntervalMs = 5000; // Drop every 5 seconds if player hasn't
    let autoDropTimeoutId = null; // To manage the auto-drop timer

    // --- Utility Functions ---
    function getRandomElement(arr) {
        return arr[Math.floor(Math.random() * arr.length)];
    }
    function randomInRange(min, max) {
        return Math.random() * (max - min) + min;
    }

    // --- Display ---
    function displayInfo() {
        const ctx = render.context;
        ctx.fillStyle = "black";
        ctx.font = "24px Arial";
        ctx.textAlign = "left";
        // Score
        ctx.fillText("Score: " + score, 20, 40);
        // Wind
        let windDisplay = "Wind: ";
        const absWind = Math.abs(windForceX);
        if (absWind < 0.0001) { windDisplay += "Calm"; }
        else {
             windDisplay += `${windForceX > 0 ? '>>' : '<<'} (${(absWind * 1000).toFixed(1)})`;
             if (absWind >= strongWindThreshold) {
                 windDisplay += " STRONG!";
                 ctx.fillStyle = "red"; // Use red for strong wind text
             }
        }
        ctx.fillText(windDisplay, 20, 70);
        ctx.fillStyle = "black"; // Reset color
        // Game Over
        if (isGameOver) {
            ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
            ctx.fillRect(0, canvasHeight / 2 - 60, canvasWidth, 120);
            ctx.fillStyle = "white";
            ctx.font = "40px Arial";
            ctx.textAlign = "center";
            ctx.fillText("GAME OVER", canvasWidth / 2, canvasHeight / 2 - 10);
            ctx.font = "20px Arial";
            ctx.fillText("Final Score: " + score, canvasWidth / 2, canvasHeight / 2 + 25);
            ctx.fillText("Refresh page (F5) to restart", canvasWidth/2, canvasHeight / 2 + 50);
        }
    }

    // --- Sky Color Update ---
    function updateSkyColor() {
        let progress = Math.max(0, Math.min(1, (canvasHeight - highestBlockY) / (canvasHeight - targetHeightY - 50))); // Normalize height progress (0 to 1)
        let skyColor;

        if (progress < 0.25) { // 0 - 25% height
            skyColor = '#87CEEB'; // Light Blue
        } else if (progress < 0.5) { // 25% - 50%
             // Transition Blue -> Orange
            skyColor = `rgb(${Math.round(135 + (255 - 135) * (progress - 0.25) * 4)}, ${Math.round(206 - (206 - 165) * (progress - 0.25) * 4)}, ${Math.round(235 - (235 - 0) * (progress - 0.25) * 4)})`;
        } else if (progress < 0.75) { // 50% - 75%
             // Transition Orange -> Purple
            skyColor = `rgb(${Math.round(255 - (255 - 128) * (progress - 0.5) * 4)}, ${Math.round(165 - (165 - 0) * (progress - 0.5) * 4)}, ${Math.round(0 + (128 - 0) * (progress - 0.5) * 4)})`;
        } else { // 75% - 100%+
             // Transition Purple -> Darker Purple/Red
            skyColor = `rgb(${Math.round(128 - (128 - 100) * (progress - 0.75) * 4)}, 0, ${Math.round(128 + (0 - 128) * (progress - 0.75) * 4)})`;
        }
        render.options.background = skyColor;
    }


    // --- Game Mechanics ---
    function resetLevel() {
        console.log("Resetting level...");
        levelCleared = true;
        if (autoDropTimeoutId) clearTimeout(autoDropTimeoutId); // Stop pending auto-drop

        const bodiesToRemove = Composite.allBodies(world).filter(body => body.label !== 'ground');
        bodiesToRemove.forEach(body => Composite.remove(world, body));

        score = 0;
        currentBlock = null;
        heldBlock = null;
        draggedBlock = null;
        highestBlockY = canvasHeight; // Reset height tracker
        render.options.background = '#87CEEB'; // Reset sky

        setTimeout(() => {
            levelCleared = false;
             if (!isGameOver) {
                 scheduleNextAutoDrop(); // Start the drop timer again
                 prepareNextBlock();
            }
        }, 500);
    }


    function prepareNextBlock() {
        if (isGameOver || levelCleared || currentBlock) return; // Don't make new one if one exists or game ended

        const blockStartX = canvasWidth / 2;
        const blockStartY = 50;
        const shapeType = getRandomElement(shapeTypes);
        const blockColor = getRandomElement(blockColors);
        let newBlock;
        let blockWidth = 100, blockHeight = 30, density = 0.005;

        // Assign density based on shape type/size (lighter <--> heavier)
        switch (shapeType) {
            case 'circle': density = 0.003; break; // Circles lighter
            case 'small_rectangle': density = 0.004; break;
            case 'rectangle': density = 0.005; break; // Medium default
            case 'wide_rectangle': density = 0.007; break; // Wide heavier
        }

        const blockOptions = {
            // Add slight random variance to friction/bounciness
            friction: Math.max(0.1, 0.6 + randomInRange(-0.1, 0.1)),
            restitution: Math.max(0, 0.1 + randomInRange(-0.05, 0.1)),
            density: density,
            isStatic: true,
            label: 'nextBlock',
            render: { fillStyle: blockColor }
        };

         switch (shapeType) {
             case 'circle':
                 const radius = 20 + randomInRange(0, 15); // Smaller range
                 newBlock = Bodies.circle(blockStartX, blockStartY, radius, blockOptions);
                 newBlock.blockWidth = radius * 2; newBlock.blockHeight = radius * 2;
                 break;
             case 'small_rectangle':
                  blockWidth = 40 + randomInRange(0, 30); blockHeight = 20 + randomInRange(0, 20);
                  newBlock = Bodies.rectangle(blockStartX, blockStartY, blockWidth, blockHeight, blockOptions);
                  break;
             case 'wide_rectangle':
                  blockWidth = 100 + randomInRange(0, 50); blockHeight = 15 + randomInRange(0, 10);
                  newBlock = Bodies.rectangle(blockStartX, blockStartY, blockWidth, blockHeight, blockOptions);
                  break;
             case 'rectangle': default:
                  blockWidth = 60 + randomInRange(0, 40); blockHeight = 25 + randomInRange(0, 20);
                  newBlock = Bodies.rectangle(blockStartX, blockStartY, blockWidth, blockHeight, blockOptions);
                  break;
         }
         if (!newBlock.blockWidth) newBlock.blockWidth = blockWidth;
         if (!newBlock.blockHeight) newBlock.blockHeight = blockHeight;

        currentBlock = newBlock;
        Composite.add(world, currentBlock);
        console.log(`Prepared ${shapeType} (Density: ${density.toFixed(3)}). Timer started.`);

        // Schedule the automatic drop for this block
        scheduleNextAutoDrop();
    }

    // --- Auto Drop Logic ---
    function forceDropCurrentBlock() {
         if (currentBlock && currentBlock.isStatic) {
            console.log("Auto-dropping block!");
            // Ensure it's not being dragged simultaneously
            if (draggedBlock === currentBlock) {
                draggedBlock = null; // Player loses drag control
            }
            currentBlock.label = 'block';
            currentBlock.isSettling = true;
            Body.setStatic(currentBlock, false);
            currentBlock = null; // It's no longer the 'next' block
            // Landing check will handle preparing the *actual* next block
        }
        autoDropTimeoutId = null; // Clear the ID as it has executed
    }

    function scheduleNextAutoDrop() {
        // Clear any existing timer first
        if (autoDropTimeoutId) {
            clearTimeout(autoDropTimeoutId);
        }
        // Schedule the drop only if a static currentBlock exists
        if (currentBlock && currentBlock.isStatic) {
            autoDropTimeoutId = setTimeout(forceDropCurrentBlock, autoDropIntervalMs);
        } else {
            autoDropTimeoutId = null; // No block to drop
        }
    }


    // --- Wind Logic ---
    function updateWind() {
        if (isGameOver || levelCleared) return;

        // Decide if wind blows this interval (e.g., 60% chance)
        if (Math.random() < 0.6) {
             windForceX = randomInRange(-maxWindForce, maxWindForce);
        } else {
             windForceX = 0; // Calm period
        }
        // console.log("Wind updated:", windForceX);

        // Schedule the next wind update after a random delay
        const nextWindUpdateDelay = randomInRange(3000, 10000); // 3 to 10 seconds
        setTimeout(updateWind, nextWindUpdateDelay);
    }


    // --- Mouse Control Setup ---
    const mouse = Mouse.create(render.canvas);
    const mouseConstraint = MouseConstraint.create(engine, {
        mouse: mouse,
        constraint: { stiffness: 0.1, render: { visible: false } }
    });
    Composite.add(world, mouseConstraint);


    // --- Mouse Event Handling ---
    Events.on(mouseConstraint, 'mousedown', (event) => {
        if (isGameOver || levelCleared) return;
        const mousePos = event.mouse.position;
        const bodiesUnderMouse = Query.point(Composite.allBodies(world), mousePos);
        let clickedBody = null;
        let foundNextBlock = false;

        for (const body of bodiesUnderMouse) {
            if (body.label === 'nextBlock' && body === currentBlock) {
                clickedBody = body; foundNextBlock = true; break;
            }
        }
        if (!foundNextBlock && bodiesUnderMouse.length > 0) {
             for (const body of bodiesUnderMouse) {
                  if (body.label === 'block' && !body.isStatic && !body.isSettling && Math.abs(windForceX) >= strongWindThreshold) {
                      clickedBody = body; break;
                  }
             }
        }

        if (clickedBody) {
            if (clickedBody.label === 'nextBlock') {
                draggedBlock = clickedBody;
                // When player starts dragging, cancel the pending auto-drop for this block
                if (autoDropTimeoutId) { clearTimeout(autoDropTimeoutId); autoDropTimeoutId = null; }
                console.log("Dragging next block, auto-drop cancelled.");
            } else if (clickedBody.label === 'block') {
                 heldBlock = clickedBody; Body.setStatic(heldBlock, true); heldBlock.render.opacity = 0.5;
                 console.log("Holding block against strong wind!");
            }
        }
    });

    Events.on(mouseConstraint, 'mouseup', (event) => {
         // Always release held block visually/physically if game ended or level cleared during hold
         if (isGameOver || levelCleared) {
             if (heldBlock) { heldBlock.render.opacity = 1.0; heldBlock = null; }
             draggedBlock = null; return;
         }

        if (draggedBlock) {
            console.log("Player released block for dropping");
            // Player manually dropped the block
            if (autoDropTimeoutId) { clearTimeout(autoDropTimeoutId); autoDropTimeoutId = null; } // Ensure timer is cancelled

            draggedBlock.label = 'block';
            draggedBlock.isSettling = true;
            Body.setStatic(draggedBlock, false);
            currentBlock = null; // It's dropped, no longer the 'next' block
            draggedBlock = null;
            // Landing check now handles score/next block prep
            // We need to restart the auto-drop timer cycle for the *next* block when it gets prepared
            // This happens automatically in prepareNextBlock now
        }

        if (heldBlock) {
            console.log("Released held block");
            heldBlock.render.opacity = 1.0;
            if (!isGameOver && !levelCleared) { Body.setStatic(heldBlock, false); }
            heldBlock = null;
        }
    });


    // --- Physics and Game Loop ---
    Events.on(engine, 'beforeUpdate', (event) => {
        if (isGameOver || levelCleared || Math.abs(windForceX) < 0.0001) return;
        const bodies = Composite.allBodies(world);
        for (let i = 0; i < bodies.length; i++) {
            const body = bodies[i];
            if (!body.isStatic && body.label !== 'ground' && body !== heldBlock && body !== currentBlock) {
                Body.applyForce(body, body.position, { x: windForceX, y: 0 });
            }
        }
    });

    Events.on(engine, 'afterUpdate', (event) => {
         if (levelCleared) { displayInfo(); return; }
        if (isGameOver) {
             if (runner.enabled) { Runner.stop(runner); }
             displayInfo(); return;
         }

        const bodies = Composite.allBodies(world);
        let blockHasSettledThisFrame = false;
        let currentHighestY = canvasHeight; // Reset check each frame

        for (let i = 0; i < bodies.length; i++) {
            const body = bodies[i];
            if (body.isStatic || body.label === 'ground') { // Also track highest static block
                 if (body.label !== 'ground') currentHighestY = Math.min(currentHighestY, body.position.y - (body.blockHeight || 30) / 2);
                 continue;
             }

            // --- Game Over Check ---
            const isOffBottom = body.position.y > canvasHeight + 50;
            const isOffSides = Math.abs(body.position.x - canvasWidth / 2) > canvasWidth / 2 + 100;
            if (body.label === 'block' && (isOffBottom || isOffSides)) {
                console.log("Game Over - Block fell off!");
                isGameOver = true;
                if (heldBlock) { heldBlock.render.opacity = 1.0; heldBlock = null; }
                if (autoDropTimeoutId) { clearTimeout(autoDropTimeoutId); autoDropTimeoutId = null; } // Stop timer
                break;
            }

             // Track highest point of *any* non-ground block for sky color
             currentHighestY = Math.min(currentHighestY, body.position.y - (body.blockHeight || 30) / 2);


            // --- Landing and Goal Check ---
            if (body.isSettling) {
                const speed = body.speed; const angularSpeed = body.angularSpeed;
                const speedThreshold = 0.1; const angularSpeedThreshold = 0.05;

                if (speed < speedThreshold && angularSpeed < angularSpeedThreshold) {
                    body.settleTimer = (body.settleTimer || 0) + 1;
                } else { body.settleTimer = 0; }

                const settleFramesRequired = 30;
                if (body.settleTimer >= settleFramesRequired) {
                    body.isSettling = false; body.settleTimer = 0;

                    // Prevent preparing next block if another settled or level reset is happening
                    if (!blockHasSettledThisFrame && !currentBlock && !draggedBlock && !levelCleared) {
                        score++;
                        console.log("Block landed! Score:", score);
                        const blockTopY = body.position.y - (body.blockHeight || 30) / 2;
                        // Update overall highest point
                        highestBlockY = Math.min(highestBlockY, blockTopY);

                        if (blockTopY <= targetHeightY) {
                             console.log("Target height reached!");
                             resetLevel();
                             blockHasSettledThisFrame = true; // Prevent default prepare below
                             break; // Exit loop, level resetting
                         } else {
                             // Prepare next normally IF not resetting
                             prepareNextBlock();
                             blockHasSettledThisFrame = true;
                         }
                    }
                }
            }
        } // End of body loop

        // Update highest point if no blocks settled this frame but tower exists
        if (!blockHasSettledThisFrame) {
             highestBlockY = Math.min(highestBlockY, currentHighestY);
        }

        updateSkyColor(); // Update sky based on highest point
        displayInfo();
    });

    // --- Draw Target Line ---
     Events.on(render, 'afterRender', (event) => {
        if (isGameOver || levelCleared) return; // Don't draw if game over or clearing
        const ctx = render.context;
        ctx.beginPath(); ctx.setLineDash([10, 10]);
        ctx.moveTo(0, targetHeightY); ctx.lineTo(canvasWidth, targetHeightY);
        ctx.strokeStyle = 'rgba(255, 0, 0, 0.7)'; ctx.lineWidth = 2;
        ctx.stroke();
        ctx.setLineDash([]); ctx.lineWidth = 1;
     });

    // --- Initialize ---
    Render.run(render);
    const runner = Runner.create();
    Runner.run(runner, engine);

    // Start the wind cycle
    updateWind(); // Initial call, subsequent calls are scheduled by setTimeout within the function
    // First block preparation
    prepareNextBlock(); // This will also schedule the first auto-drop

    console.log("Stack Forever: Auto-dropping shapes! Reach the red line. Density affects wind resistance.");
}
