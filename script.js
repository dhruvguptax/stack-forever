if (typeof Matter === 'undefined') {
    alert('Error: Matter.js library not loaded. Check the script tag in index.html.');
} else {
    console.log("Matter.js loaded successfully!");

    const Engine = Matter.Engine,
          Render = Matter.Render,
          Runner = Matter.Runner,
          Bodies = Matter.Bodies,
          Composite = Matter.Composite,
          Events = Matter.Events,
          Mouse = Matter.Mouse,
          Body = Matter.Body,
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

    const ground = Bodies.rectangle(canvasWidth / 2, canvasHeight - 25, canvasWidth, 50, {
        isStatic: true,
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
    const blockWidth = 100;
    const blockHeight = 30;
    let skyColor = '#87CEEB';
    let towerHeight = 0;
    const horizontalMoveSpeed = 5;

    function displayScore() {
        const ctx = render.context;
        ctx.fillStyle = "black";
        ctx.font = "30px Arial";
        ctx.textAlign = "left";
        ctx.fillText("Score: " + score, 20, 40);
    }

    function prepareNextBlock() {
        blockStartX = canvasWidth / 2;
        const blockOptions = {
            friction: 0.7,
            restitution: 0.1,
            density: 0.005,
            isStatic: true
        };

        currentBlock = Bodies.rectangle(
            blockStartX,
            blockStartY,
            blockWidth,
            blockHeight,
            blockOptions
        );

        Composite.add(world, currentBlock);
        isBlockDropping = false;
        console.log("Prepared next block. Use arrows to move, Space to drop.");
    }

    function dropCurrentBlock() {
        if (currentBlock && currentBlock.isStatic) {
            currentBlock.isSettling = true;
            Matter.Body.setStatic(currentBlock, false);
            isBlockDropping = true;
            currentBlock = null;
            console.log("Dropped block. Checking for landing...");
        }
    }

    document.addEventListener('keydown', (event) => {
        if (!isBlockDropping && currentBlock && currentBlock.isStatic) {
            if (event.code === 'ArrowLeft') {
                blockStartX -= horizontalMoveSpeed;
                if (blockStartX - blockWidth / 2 < 0) {
                     blockStartX = blockWidth / 2;
                }
                 Matter.Body.setPosition(currentBlock, { x: blockStartX, y: blockStartY });
            } else if (event.code === 'ArrowRight') {
                blockStartX += horizontalMoveSpeed;
                 if (blockStartX + blockWidth / 2 > canvasWidth) {
                    blockStartX = canvasWidth - blockWidth / 2;
                 }
                 Matter.Body.setPosition(currentBlock, { x: blockStartX, y: blockStartY });
            }
        }

        if (event.code === 'Space') {
            if (currentBlock && currentBlock.isStatic) {
                 dropCurrentBlock();
             } else if (!currentBlock && !isBlockDropping) {
                 // Removed auto-prepare on space; it now happens on landing
             }
        }
    });

    Events.on(engine, 'beforeUpdate', (event) => {

    });

    Events.on(engine, 'afterUpdate', (event) => {
        const bodies = Composite.allBodies(world);
        let blockHasSettledThisFrame = false;

        for (let i = 0; i < bodies.length; i++) {
            const body = bodies[i];

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

        displayScore();
    });

    Render.run(render);
    const runner = Runner.create();
    Runner.run(runner, engine);

    prepareNextBlock();

    console.log("Stack Forever game setup complete. Control the block and press Space!");
}
