// Get canvas and its 2D rendering context
const canvas = document.getElementById('background-canvas');
const ctx = canvas.getContext('2d');

// Variables to store canvas size
let width, height;

// Array to hold all node objects
let nodes = [];

// Configuration constants
const NODE_COUNT = 70;        // Number of nodes to display
const MAX_DISTANCE = 140;     // Max distance to draw connecting lines

/**
 * Resize the canvas to fill the entire window
 */
function resize() {
  width = window.innerWidth;
  height = window.innerHeight;
  canvas.width = width;
  canvas.height = height;
}

// Initial resize and add listener to handle window resizing
resize();
window.addEventListener('resize', resize);

/**
 * Class representing a single network node
 */
class Node {
  constructor() {
    // Start at random position within canvas bounds
    this.x = Math.random() * width;
    this.y = Math.random() * height;

    // Radius between 2 and 4 pixels
    this.radius = 2 + Math.random() * 2;

    // Small random speed for smooth drifting motion
    this.speedX = (Math.random() - 0.5) * 0.3;
    this.speedY = (Math.random() - 0.5) * 0.3;

    // Starting alpha (opacity) for glow effect, between 0.3 and 1
    this.alpha = 0.3 + Math.random() * 0.7;

    // Speed to pulse the alpha up and down smoothly
    this.alphaSpeed = 0.002 + Math.random() * 0.004;
  }

  /**
   * Update the node's position and alpha each frame
   */
  move() {
    this.x += this.speedX;
    this.y += this.speedY;

    // Bounce off canvas edges
    if (this.x < 0 || this.x > width) this.speedX *= -1;
    if (this.y < 0 || this.y > height) this.speedY *= -1;

    // Pulse alpha value between 0.3 and 1
    this.alpha += this.alphaSpeed;
    if (this.alpha > 1 || this.alpha < 0.3) this.alphaSpeed *= -1;
  }

  /**
   * Draw the glowing node as a radial gradient circle
   */
  draw() {
    ctx.beginPath();

    // Create radial gradient for soft glowing effect
    const gradient = ctx.createRadialGradient(
      this.x, this.y, 0,
      this.x, this.y, this.radius * 4
    );
    gradient.addColorStop(0, `rgba(29, 185, 84, ${this.alpha})`);   // bright Spotify green glow center
    gradient.addColorStop(1, 'rgba(29, 185, 84, 0)');               // fully transparent edge

    ctx.fillStyle = gradient;
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

/**
 * Draw lines between nodes that are close enough
 */
function connectNodes() {
  for (let i = 0; i < NODE_COUNT; i++) {
    for (let j = i + 1; j < NODE_COUNT; j++) {
      const dx = nodes[i].x - nodes[j].x;
      const dy = nodes[i].y - nodes[j].y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Draw line only if nodes are within MAX_DISTANCE
      if (dist < MAX_DISTANCE) {
        const lineAlpha = 1 - dist / MAX_DISTANCE; // fade line by distance
        ctx.strokeStyle = `rgba(29, 185, 84, ${lineAlpha * 0.4})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(nodes[i].x, nodes[i].y);
        ctx.lineTo(nodes[j].x, nodes[j].y);
        ctx.stroke();
      }
    }
  }
}

/**
 * Animation loop - clear canvas, move & draw nodes, connect nodes, then request next frame
 */
function animate() {
  ctx.clearRect(0, 0, width, height);

  nodes.forEach(node => {
    node.move();
    node.draw();
  });

  connectNodes();

  requestAnimationFrame(animate);
}

// Initialize nodes array with NODE_COUNT nodes
for (let i = 0; i < NODE_COUNT; i++) {
  nodes.push(new Node());
}

// Start the animation loop
animate();
