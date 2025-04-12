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
          World = Matter.World; // Added World for direct manipulation if needed

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
            background: '#87CEEB'
        }
    });

    const ground = Bodies.rectangle(canvasWidth / 2, canvasHeight - 25, canvasWidth * 2, 50, {
        isStatic: true,
        label: 'ground',
        render: {
            fillStyle: 'steelblue'
        }
    });

    Composite.add(world, [ground]);

    let score = 0;
    let currentBlock = null;
    let isGameOver = false;
    let windForceX = 0;
    const maxWindForce = 0.010; // Increased slightly again
    const strongWindThreshold = 0.006;
    let heldBlock = null;
    let draggedBlock = null; // Ensure this is defined globally in this scope
    const targetHeightY = 150; // Y-coordinate for the target line (lower Y is higher on screen)
    let levelCleared = false; // Flag to manage level transition

    const blockColors = ["#FF5733", "#33FF57", "#3357FF", "#FF33A1", "#FFFF33", "#FF8C00", "#DA70D6", "#00CED1"];
    const shapeTypes = ['rectangle', 'circle', 'small_rectangle', 'wide_rectangle'];

    function getRandomElement(arr) {
        return arr[Math.floor(Math.random() * arr.length)];
    }

    function displayInfo() {
        const ctx = render.context;
        ctx.fillStyle = "black";
        ctx.font = "24px Arial";
        ctx.textAlign = "left";
        ctx.fillText("Score: " + score, 20, 40);

        let windDisplay = "Wind: ";
        const absWind = Math.abs(windForceX);
        if (absWind < 0.0001) {
            windDisplay += "Calm";
        } else {
             windDisplay += `${windForceX > 0 ? '>>' : '<<'} (${(absWind * 1000).toFixed(1)})`;
             if (absWind >= strongWindThreshold) {
                 windDisplay += " STRONG!";
                 ctx.fillStyle = "red";
             }
        }
        ctx.fillText(windDisplay, 20, 70);
        ctx.fillStyle = "black";


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

     function resetLevel() {
        console.log("Resetting level...");
        levelCleared = true; // Signal that we are clearing

        // Remove all non-ground bodies
        const bodiesToRemove = Composite.allBodies(world).filter(body => body.label !== 'ground');
        bodiesToRemove.forEach(body => Composite.remove(world, body));

        // Reset game state variables
        score = 0;
        currentBlock = null;
        heldBlock = null;
        draggedBlock = null;
        // isGameOver should remain false unless triggered again
        // windForceX will be updated by the interval

        // Add a small delay before preparing the next block for a smoother transition
        setTimeout(() => {
            levelCleared = false; // Allow game logic to resume fully
             if (!isGameOver) { // Don't prepare if somehow game over triggered during reset
                prepareNextBlock();
            }
        }, 500); // 0.5 second delay
    }


    function prepareNextBlock() {
        // Don't prepare if game over, or if a level is currently being cleared
        if (isGameOver || levelCleared || currentBlock) return;

        const blockStartX = canvasWidth / 2;
        const blockStartY = 50;
        const shapeType = getRandomElement(shapeTypes);
        const blockColor = getRandomElement(blockColors);
        let newBlock;
        let blockWidth = 100;
        let blockHeight = 30;

        const blockOptions = {
            friction: 0.7,
            restitution: 0.1,
            density: 0.005,
            isStatic: true,
            label: 'nextBlock',
            render: { fillStyle: blockColor }
        };

         switch (shapeType) {
             case 'circle':
                 const radius = 25 + Math.random() * 15; // slightly smaller circles maybe
                 newBlock = Bodies.circle(blockStartX, blockStartY, radius, blockOptions);
                 newBlock.blockWidth = radius * 2;
                 newBlock.blockHeight = radius * 2; // Store height for goal check
                 break;
             case 'small_rectangle':
                  blockWidth = 40 + Math.random() * 30;
                  blockHeight = 20 + Math.random() * 20;
                  newBlock = Bodies.rectangle(blockStartX, blockStartY, blockWidth, blockHeight, blockOptions);
                  break;
             case 'wide_rectangle':
                  blockWidth = 100 + Math.random() * 50;
                  blockHeight = 15 + Math.random() * 10;
                  newBlock = Bodies.rectangle(blockStartX, blockStartY, blockWidth, blockHeight, blockOptions);
                  break;
             case 'rectangle':
             default:
                  blockWidth = 60 + Math.random() * 40;
                  blockHeight = 25 + Math.random() * 20;
                  newBlock = Bodies.rectangle(blockStartX, blockStartY, blockWidth, blockHeight, blockOptions);
                  break;
         }
         if (!newBlock.blockWidth) newBlock.blockWidth = blockWidth;
         if (!newBlock.blockHeight) newBlock.blockHeight = blockHeight; // Ensure height is stored


        currentBlock = newBlock;
        Composite.add(world, currentBlock);
        console.log(`Prepared next block: ${shapeType}. Drag and release.`);
    }


    function updateWind() {
         if (isGameOver || levelCleared) return;
         windForceX = (Math.random() - 0.5) * 2 * maxWindForce;
         // console.log("Wind updated:", windForceX); // Less console spam
    }

    // --- Mouse Control Setup ---
    const mouse = Mouse.create(render.canvas);
    const mouseConstraint = MouseConstraint.create(engine, {
        mouse: mouse,
        constraint: {
            stiffness: 0.1,
            render: { visible: false }
        }
    });
    Composite.add(world, mouseConstraint);


    // --- Mouse Event Handling ---
    Events.on(mouseConstraint, 'mousedown', (event) => {
        if (isGameOver || levelCleared) return;

        const mousePos = event.mouse.position;
        // Find bodies specifically under the mouse, prioritizing 'nextBlock'
        const bodiesUnderMouse = Query.point(Composite.allBodies(world), mousePos);
        let clickedBody = null;
        let foundNextBlock = false;

        // Explicitly check if 'nextBlock' is under mouse
        for (const body of bodiesUnderMouse) {
            if (body.label === 'nextBlock' && body === currentBlock) {
                clickedBody = body;
                foundNextBlock = true;
                break; // Found the priority target
            }
        }
        // If nextBlock wasn't found directly, check for other interactable bodies
        if (!foundNextBlock && bodiesUnderMouse.length > 0) {
             // Check if we clicked a placed block during strong wind
             for (const body of bodiesUnderMouse) {
                  if (body.label === 'block' && !body.isStatic && !body.isSettling && Math.abs(windForceX) >= strongWindThreshold) {
                      clickedBody = body;
                      break;
                  }
             }
        }


        if (clickedBody) {
            if (clickedBody.label === 'nextBlock') {
                // Picked up the block waiting at the top
                draggedBlock = clickedBody;
                console.log("Dragging next block");
            } else if (clickedBody.label === 'block') {
                 // Clicked on an already placed, potentially unstable block during strong wind
                 heldBlock = clickedBody;
                 Body.setStatic(heldBlock, true);
                 heldBlock.render.opacity = 0.5;
                 console.log("Holding block against strong wind!");
            }
        }
    });

    Events.on(mouseConstraint, 'mouseup', (event) => {
        if (isGameOver || levelCleared) { // Also ensure held blocks are released visually if level cleared during hold
             if (heldBlock) {
                  heldBlock.render.opacity = 1.0;
                  heldBlock = null;
             }
             draggedBlock = null; // Ensure drag state is cleared too
             return;
        }

        if (draggedBlock) {
            console.log("Released block for dropping");
            // Check if the release position is valid (e.g., not inside another block - complex check, skip for now)
            draggedBlock.label = 'block';
            draggedBlock.isSettling = true;
            Body.setStatic(draggedBlock, false);
            currentBlock = null;
            draggedBlock = null;
        }

        if (heldBlock) {
            console.log("Released held block");
            heldBlock.render.opacity = 1.0;
             if (!isGameOver && !levelCleared) { // Don't make dynamic if game ended/resetting
                 Body.setStatic(heldBlock, false);
             }
            heldBlock = null;
        }
    });


    // --- Physics and Game Loop ---
    Events.on(engine, 'beforeUpdate', (event) => {
        if (isGameOver || levelCleared || Math.abs(windForceX) < 0.0001) return;

        const bodies = Composite.allBodies(world);
         for (let i = 0; i < bodies.length; i++) {
             const body = bodies[i];
             // Apply wind to all non-static blocks except ground, held, and the one being prepared/dragged
              if (!body.isStatic && body.label !== 'ground' && body !== heldBlock && body !== currentBlock) {
                 Body.applyForce(body, body.position, { x: windForceX, y: 0 });
             }
         }
    });

    Events.on(engine, 'afterUpdate', (event) => {
        // If level is clearing, just draw info and skip game logic
         if (levelCleared) {
             displayInfo();
             return;
         }
         // If game is over, stop runner and draw info
        if (isGameOver) {
             // Ensure runner is stopped only once
             if (runner.enabled) {
                 Runner.stop(runner);
             }
             displayInfo();
             return;
         }

        const bodies = Composite.allBodies(world);
        let blockHasSettledThisFrame = false;
        const floorLevel = ground.position.y - 25;

        for (let i = 0; i < bodies.length; i++) {
            const body = bodies[i];
            if (body.label === 'ground' || body.isStatic) continue; // Skip ground and static blocks

            // --- Game Over Check ---
            // Check if center is far below ground OR far off sides
            const isOffBottom = body.position.y > canvasHeight + 50; // Adjusted threshold
            const isOffSides = Math.abs(body.position.x - canvasWidth / 2) > canvasWidth / 2 + 100; // Check sides
            if (body.label === 'block' && (isOffBottom || isOffSides)) {
                console.log("Game Over - Block fell off!");
                isGameOver = true;
                if (heldBlock) { // Ensure held block is visually reset on game over
                     heldBlock.render.opacity = 1.0;
                     heldBlock = null;
                }
                // Stop runner will happen in the main check at the start of afterUpdate
                break; // Exit loop once game is over
            }


            // --- Landing and Goal Check ---
            if (body.isSettling) { // Check only blocks that were dropped
                const speed = body.speed;
                const angularSpeed = body.angularSpeed;
                const speedThreshold = 0.1;
                const angularSpeedThreshold = 0.05;

                if (speed < speedThreshold && angularSpeed < angularSpeedThreshold) {
                    body.settleTimer = (body.settleTimer || 0) + 1;
                } else {
                    body.settleTimer = 0;
                }

                const settleFramesRequired = 30;
                if (body.settleTimer >= settleFramesRequired) {
                    body.isSettling = false; // Stop settling check
                    body.settleTimer = 0;

                    if (!blockHasSettledThisFrame && !currentBlock && !draggedBlock) {
                        score++;
                        console.log("Block landed! Score:", score);

                        // --- Goal Check ---
                        const blockTopY = body.position.y - (body.blockHeight || 30) / 2; // Use stored height
                        if (blockTopY <= targetHeightY) {
                             console.log("Target height reached!");
                             resetLevel(); // Clear tower and restart
                             // Since resetLevel is called, we prevent preparing next block normally
                             blockHasSettledThisFrame = true; // Prevent prepareNextBlock below
                             // Exit the loop early as the level is resetting
                             break;
                         } else {
                             // Only prepare next block if goal wasn't reached
                             prepareNextBlock();
                             blockHasSettledThisFrame = true;
                         }
                    }
                }
            }
        } // End of body loop

        displayInfo();
    });

    // --- Draw Target Line ---
     Events.on(render, 'afterRender', (event) => {
        const ctx = render.context;
        ctx.beginPath();
        ctx.setLineDash([10, 10]); // Dashed line style
        ctx.moveTo(0, targetHeightY);
        ctx.lineTo(canvasWidth, targetHeightY);
        ctx.strokeStyle = 'rgba(255, 0, 0, 0.7)'; // Red dashed line
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.setLineDash([]); // Reset dash style
        ctx.lineWidth = 1; // Reset line width
     });


    // --- Initialize ---
    Render.run(render);
    const runner = Runner.create();
    Runner.run(runner, engine);

    setInterval(updateWind, 3500); // Update wind slightly more often
    prepareNextBlock();

    console.log("Stack Forever: Reach the red line! Mouse controls. Hold blocks in strong wind.");
}
