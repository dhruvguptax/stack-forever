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
          MouseConstraint = Matter.MouseConstraint;

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
    let isBlockDropping = false;
    let blockStartX = canvasWidth / 2;
    const blockStartY = 50;
    let skyColor = '#87CEEB';
    const horizontalMoveSpeed = 5;
    let isGameOver = false;
    let windForceX = 0;
    const maxWindForce = 0.005; // Adjusted for subtle effect, tune as needed

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

        // Display Wind
        let windDisplay = "Wind: ";
        if (Math.abs(windForceX) < 0.0001) {
            windDisplay += "Calm";
        } else if (windForceX > 0) {
            windDisplay += `>> (${(windForceX * 1000).toFixed(1)})`; // Arbitrary scaling for display
        } else {
            windDisplay += `<< (${(Math.abs(windForceX) * 1000).toFixed(1)})`;
        }
         ctx.fillText(windDisplay, 20, 70);


        if (isGameOver) {
            ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
            ctx.fillRect(0, canvasHeight / 2 - 50, canvasWidth, 100);
            ctx.fillStyle = "white";
            ctx.font = "40px Arial";
            ctx.textAlign = "center";
            ctx.fillText("GAME OVER", canvasWidth / 2, canvasHeight / 2);
            ctx.font = "20px Arial";
            ctx.fillText("Score: " + score, canvasWidth / 2, canvasHeight / 2 + 35);
            // Add restart instructions later if needed
        }
    }

    function prepareNextBlock() {
        if (isGameOver) return;

        blockStartX = canvasWidth / 2;
        const shapeType = getRandomElement(shapeTypes);
        const blockColor = getRandomElement(blockColors);
        let newBlock;
        let blockWidth = 100; // Default width
        let blockHeight = 30;  // Default height

        const blockOptions = {
            friction: 0.7,
            restitution: 0.1,
            density: 0.005,
            isStatic: true,
            render: { fillStyle: blockColor }
        };

        switch (shapeType) {
            case 'circle':
                const radius = 30 + Math.random() * 20; // Random radius
                newBlock = Bodies.circle(blockStartX, blockStartY, radius, blockOptions);
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

        // Tag the block with its dimensions for boundary checks later if needed
        newBlock.blockWidth = blockWidth; // Store width for movement checks
        newBlock.label = 'block'; // Identify blocks

        currentBlock = newBlock;
        Composite.add(world, currentBlock);
        isBlockDropping = false;
        console.log(`Prepared next block: ${shapeType}`);
    }

    function dropCurrentBlock() {
        if (isGameOver || !currentBlock || !currentBlock.isStatic) return;

        currentBlock.isSettling = true;
        Matter.Body.setStatic(currentBlock, false);
        isBlockDropping = true;
        currentBlock = null;
        console.log("Dropped block. Checking for landing...");
    }

    function updateWind() {
         if (isGameOver) return;
         windForceX = (Math.random() - 0.5) * 2 * maxWindForce; // Random wind between -max and +max
         console.log("Wind updated:", windForceX);
    }


    document.addEventListener('keydown', (event) => {
        if (isGameOver) return;

        if (!isBlockDropping && currentBlock && currentBlock.isStatic) {
            const currentBlockWidth = currentBlock.blockWidth || 100; // Use stored width or default
            if (event.code === 'ArrowLeft') {
                blockStartX -= horizontalMoveSpeed;
                if (blockStartX - currentBlockWidth / 2 < 0) {
                     blockStartX = currentBlockWidth / 2;
                }
                 Matter.Body.setPosition(currentBlock, { x: blockStartX, y: blockStartY });
            } else if (event.code === 'ArrowRight') {
                blockStartX += horizontalMoveSpeed;
                 if (blockStartX + currentBlockWidth / 2 > canvasWidth) {
                    blockStartX = canvasWidth - currentBlockWidth / 2;
                 }
                 Matter.Body.setPosition(currentBlock, { x: blockStartX, y: blockStartY });
            }
        }

        if (event.code === 'Space') {
            if (currentBlock && currentBlock.isStatic) {
                 dropCurrentBlock();
            }
        }
    });

    Events.on(engine, 'beforeUpdate', (event) => {
        if (isGameOver || Math.abs(windForceX) < 0.0001) return; // No wind effect if calm or game over

        const bodies = Composite.allBodies(world);
         for (let i = 0; i < bodies.length; i++) {
             const body = bodies[i];
             // Apply wind only to blocks that are currently falling (marked as settling)
             if (body.isSettling && !body.isStatic && body.label === 'block') {
                 Body.applyForce(body, body.position, { x: windForceX, y: 0 });
             }
         }
    });

    Events.on(engine, 'afterUpdate', (event) => {
        if (isGameOver) {
             displayInfo(); // Keep showing game over screen
             return;
         }

        const bodies = Composite.allBodies(world);
        let blockHasSettledThisFrame = false;
        const floorLevel = ground.position.y - (ground.height || 50) / 2; // Top edge of the ground

        for (let i = 0; i < bodies.length; i++) {
            const body = bodies[i];

            // Game Over Check: If a block falls below the ground level significantly
             if (body.label === 'block' && !body.isStatic && body.position.y > canvasHeight + 100) { // Check if block fell way off screen
                console.log("Game Over - Block fell off!");
                isGameOver = true;
                Runner.stop(runner); // Stop the physics simulation
                 break; // Exit loop once game is over
             }


            // Landing Check (only if game isn't over)
            if (body.isSettling && !body.isStatic) {
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

                    if (!blockHasSettledThisFrame) {
                        score++;
                        console.log("Block landed! Score:", score);
                        prepareNextBlock();
                        blockHasSettledThisFrame = true;
                    }
                }
            }
        }

        displayInfo(); // Update score and wind display
    });

    // --- Initialize ---

    Render.run(render);
    const runner = Runner.create();
    Runner.run(runner, engine);

    setInterval(updateWind, 5000); // Update wind every 5 seconds
    prepareNextBlock();

    console.log("Stack Forever: Now with shapes, wind, and game over!");
}
