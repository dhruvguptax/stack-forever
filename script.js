window.onload = () => {
  const canvas = document.getElementById("gameCanvas");
  const ctx = canvas.getContext("2d");

  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  let blocks = [];
  let gravity = 0.5;
  let wind = 0;
  let score = 0;
  let skyColor = "#87CEEB"; // Light blue sky
  let windStrength = 0;

  // Function to randomly change the wind strength
  function randomizeWind() {
    windStrength = (Math.random() - 0.5) * 2; // Wind between -1 and 1
  }

  // Function to change the sky color as the tower gets higher
  function changeSkyColor() {
    if (score < 5) {
      skyColor = "#87CEEB"; // Light blue sky
    } else if (score < 10) {
      skyColor = "#FFD700"; // Golden sky
    } else if (score < 20) {
      skyColor = "#FF4500"; // Red sky
    } else {
      skyColor = "#800080"; // Purple sky
    }
  }

  class Block {
    constructor(x, y, w, h, color = "tomato") {
      this.x = x;
      this.y = y;
      this.w = w;
      this.h = h;
      this.vy = 0;
      this.vx = 0;
      this.color = color;
      this.landed = false;
    }

    update() {
      if (!this.landed) {
        this.vy += gravity;
        this.vx += windStrength;
        this.y += this.vy;
        this.x += this.vx;

        const last = blocks[blocks.length - 2];
        if (last && this.y + this.h >= last.y) {
          this.y = last.y - this.h;
          this.vy = 0;
          this.vx = 0;
          this.landed = true;
          score++;
        }
      }

      ctx.fillStyle = this.color;
      ctx.fillRect(this.x, this.y, this.w, this.h);
    }
  }

  // Display Score on the screen
  function displayScore() {
    ctx.fillStyle = "black";
    ctx.font = "30px Arial";
    ctx.fillText("Score: " + score, 20, 40);
  }

  // Drop a new block
  function dropBlock() {
    const w = 100;
    const h = 30;
    const x = canvas.width / 2 - w / 2;
    const y = 0;
    const color = getRandomColor(); // Random color for each block
    blocks.push(new Block(x, y, w, h, color));
  }

  // Generate random color for blocks
  function getRandomColor() {
    const colors = ["#FF5733", "#33FF57", "#3357FF", "#FF33A1", "#FFFF33"];
    return colors[Math.floor(Math.random() * colors.length)];
  }

  function gameLoop() {
    ctx.fillStyle = skyColor; // Set the sky color
    ctx.fillRect(0, 0, canvas.width, canvas.height); // Draw the background

    // Update blocks
    for (let b of blocks) {
      b.update();
    }

    displayScore(); // Display the score

    // Request animation frame to keep the game running
    requestAnimationFrame(gameLoop);
  }

  // Initial ground block
  blocks.push(new Block(canvas.width / 2 - 50, canvas.height - 50, 100, 30, "steelblue"));

  // Drop a new block when spacebar is pressed
  document.addEventListener("keydown", (e) => {
    if (e.code === "Space") {
      dropBlock();
    }
  });

  // Randomize wind every 3 seconds
  setInterval(randomizeWind, 3000);

  // Change the sky color based on score every 1 second
  setInterval(changeSkyColor, 1000);

  gameLoop(); // Start the game loop
};
