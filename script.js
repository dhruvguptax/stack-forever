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
          Query = Matter.Query; // Needed for checking body under mouse

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
            background: '#87CEEB' // Initial sky color
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
    let currentBlock = null; // The block being prepared/dragged
    let isGameOver = false;
    let windForceX = 0;
    const maxWindForce = 0.008; // Slightly increased max wind
    const strongWindThreshold = 0.005; // Wind force above this allows holding
    let heldBlock = null; // The block currently being held static by the player

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
                 ctx.fillStyle = "red"; // Indicate strong wind
             }
        }
        ctx.fillText(windDisplay, 20, 70);
        ctx.fillStyle = "black"; // Reset color


        if (isGameOver) {
            ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
            ctx.fillRect(0, canvasHeight / 2 - 60, canvasWidth, 120);
            ctx.fillStyle = "white";
            ctx.font = "40px Arial";
            ctx.textAlign = "center";
            ctx.fillText("GAME OVER", canvasWidth / 2, canvasHeight / 2 - 10);
            ctx.font = "20px Arial";
            ctx.fillText("Score: " + score, canvasWidth / 2, canvasHeight / 2 + 25);
            // Simple Reload instruction
            ctx.fillText("Refresh page (F5) to restart", canvasWidth/2, canvasHeight / 2 + 50);

        }
    }

    function prepareNextBlock() {
        if (isGameOver) return;

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
            isStatic: true, // Start static at the top
            label: 'nextBlock', // Special label for the draggable block
            render: { fillStyle: blockColor }
        };

         switch (shapeType) {
             case 'circle':
                 const radius = 30 + Math.random() * 20;
                 newBlock = Bodies.circle(blockStartX, blockStartY, radius, blockOptions);
                 newBlock.blockWidth = radius * 2; // Approx width for positioning logic
                 break;
             case 'small_rectangle':
                  blockWidth = 50 + Math.random() * 30;
                  blockHeight = 20 + Math.random() * 20;
                  newBlock = Bodies.rectangle(blockStartX, blockStartY, blockWidth, blockHeight, blockOptions);
                  break;
             case 'wide_rectangle':
                  blockWidth = 120 + Math.random() * 50;
                  blockHeight = 20 + Math.random() * 10;
                  newBlock = Bodies.rectangle(blockStartX, blockStartY, blockWidth, blockHeight, blockOptions);
                  break;
             case 'rectangle':
             default:
                  blockWidth = 80 + Math.random() * 40;
                  blockHeight = 30 + Math.random() * 20;
                  newBlock = Bodies.rectangle(blockStartX, blockStartY, blockWidth, blockHeight, blockOptions);
                  break;
         }
         if (!newBlock.blockWidth) {
             newBlock.blockWidth = blockWidth; // Ensure width is stored
         }

        currentBlock = newBlock; // Keep track of the block being prepared
        Composite.add(world, currentBlock);
        console.log(`Prepared next block: ${shapeType}. Drag and release to drop.`);
    }


    function updateWind() {
         if (isGameOver) return;
         windForceX = (Math.random() - 0.5) * 2 * maxWindForce;
         console.log("Wind updated:", windForceX);
    }

    // --- Mouse Control Setup ---
    const mouse = Mouse.create(render.canvas);
    const mouseConstraint = MouseConstraint.create(engine, {
        mouse: mouse,
        constraint: {
            stiffness: 0.1, // Makes dragging a bit elastic
            render: {
                visible: false // Don't draw the constraint line
            }
        }
    });

    Composite.add(world, mouseConstraint);
    // Keep track of the body being dragged for placement
    let draggedBlock = null;


    // --- Mouse Event Handling ---
    Events.on(mouseConstraint, 'mousedown', (event) => {
        if (isGameOver) return;

        const mousePos = event.mouse.position;
        const bodiesUnderMouse = Query.point(Composite.allBodies(world), mousePos);

        if (bodiesUnderMouse.length > 0) {
            const clickedBody = bodiesUnderMouse[0];

            if (clickedBody.label === 'nextBlock' && clickedBody === currentBlock) {
                // Picked up the block waiting at the top
                draggedBlock = clickedBody;
                console.log("Dragging next block");
            } else if (clickedBody.label === 'block' && !clickedBody.isStatic && !clickedBody.isSettling) {
                // Clicked on an already placed, potentially unstable block
                if (Math.abs(windForceX) >= strongWindThreshold) {
                    // Allow holding only during strong wind
                    heldBlock = clickedBody;
                    Body.setStatic(heldBlock, true); // Temporarily lock it
                    heldBlock.render.opacity = 0.5; // Visual feedback
                    console.log("Holding block against strong wind!");
                }
            }
        }
    });

    Events.on(mouseConstraint, 'mouseup', (event) => {
        if (isGameOver) return;

        if (draggedBlock) {
            // Released the block being placed
            console.log("Released block for dropping");
            draggedBlock.label = 'block'; // Now it's a normal block
            draggedBlock.isSettling = true;
            Body.setStatic(draggedBlock, false); // Let physics take over
            currentBlock = null; // No longer the 'current' prepared block
            draggedBlock = null;
            // Landing check will handle score and preparing the next block
        }

        if (heldBlock) {
            // Released a block being held against wind
            console.log("Released held block");
            heldBlock.render.opacity = 1.0; // Restore visual
             // Only make dynamic IF game isn't over (safety check)
            if (!isGameOver) {
                 Body.setStatic(heldBlock, false);
             }
            heldBlock = null;
        }
    });


    // --- Physics and Game Loop ---
    Events.on(engine, 'beforeUpdate', (event) => {
        if (isGameOver || Math.abs(windForceX) < 0.0001) return;

        const bodies = Composite.allBodies(world);
         for (let i = 0; i < bodies.length; i++) {
             const body = bodies[i];
             // Apply wind ONLY to blocks actively settling and not the one being held
             if (body.isSettling && !body.isStatic && body.label === 'block' && body !== heldBlock) {
                 Body.applyForce(body, body.position, { x: windForceX, y: 0 });
             }
         }
    });

    Events.on(engine, 'afterUpdate', (event) => {
        if (isGameOver) {
             displayInfo();
             return;
         }

        const bodies = Composite.allBodies(world);
        let blockHasSettledThisFrame = false;
        const floorLevel = ground.position.y - 25; // Approx top edge of the ground

        for (let i = 0; i < bodies.length; i++) {
            const body = bodies[i];

             // Game Over Check: If a block center falls way off screen
            if (body.label === 'block' && !body.isStatic && body.position.y > canvasHeight + 150) {
                console.log("Game Over - Block fell off!");
                isGameOver = true;
                // Ensure any held block is released visually/physically on game over
                if (heldBlock) {
                    heldBlock.render.opacity = 1.0;
                    // Runner is stopped below, so no need to setStatic(false)
                    heldBlock = null;
                }
                Runner.stop(runner);
                break;
            }

            // Landing Check
            if (body.isSettling && !body.isStatic && body !== draggedBlock) {
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
                    body.isSettling = false;
                    body.settleTimer = 0;

                    if (!blockHasSettledThisFrame && !currentBlock && !draggedBlock) { // Ensure next isn't prepared while dragging
                        score++;
                        console.log("Block landed! Score:", score);
                        prepareNextBlock();
                        blockHasSettledThisFrame = true;
                    }
                }
            }
        }
        displayInfo();
    });

    // --- Initialize ---
    Render.run(render);
    const runner = Runner.create();
    Runner.run(runner, engine);

    setInterval(updateWind, 4000); // Update wind every 4 seconds
    prepareNextBlock(); // Prepare the first block

    console.log("Stack Forever: Mouse controls active! Drag blocks, hold against strong wind.");
}
