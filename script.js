window.onload = () => {
  const canvas = document.getElementById("gameCanvas");
  const ctx = canvas.getContext("2d");
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  let blocks = [];
  let gravity = 0.5;
  let wind = 0;
  let score = 0;

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
        this.vx += wind;
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

  function dropBlock() {
    const w = 100;
    const h = 30;
    const x = canvas.width / 2 - w / 2;
    const y = 0;
    blocks.push(new Block(x, y, w, h));
  }

  function gameLoop() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (let b of blocks) {
      b.update();
    }

    requestAnimationFrame(gameLoop);
  }

  dropBlock(); // drop the first block
  blocks.push(new Block(canvas.width / 2 - 100 / 2, canvas.height - 50, 100, 30, "steelblue")); // ground

  document.addEventListener("keydown", (e) => {
    if (e.code === "Space") dropBlock();
  });

  gameLoop();
};
