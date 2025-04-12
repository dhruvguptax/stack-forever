window.onload = () => {
  const canvas = document.getElementById("gameCanvas");
  const ctx = canvas.getContext("2d");
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  // TEST: Fill canvas with a red square
  ctx.fillStyle = "red";
  ctx.fillRect(100, 100, 200, 200);
};
