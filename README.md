# SnakeMaster 🐍

[![JavaScript](https://img.shields.io/badge/JavaScript-ES6-F7DF1E?style=flat-square&logo=javascript&logoColor=black)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
[![HTML5 Canvas](https://img.shields.io/badge/HTML5-Canvas-E34F26?style=flat-square&logo=html5&logoColor=white)](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API)
[![License: MIT](https://img.shields.io/badge/License-MIT-green?style=flat-square)](LICENSE)

---

## What it does

SnakeMaster is a browser-based implementation of the classic Snake arcade game, built entirely from scratch using vanilla JavaScript and the HTML5 Canvas API — no game engines, no frameworks, no dependencies.

You control a snake that grows longer every time it eats food. If it hits a wall or its own body, it's game over. The longer you survive, the faster it moves.

**Controls:**
- `Arrow Keys` or `W A S D` — change direction
- `Space` — pause / resume
- The game auto-starts on page load

---

## Why it matters

This project is a practical exercise in understanding how game loops actually work without a framework abstracting it away. Most game engines hide the render-update cycle behind `update()` / `draw()` callbacks. Building it manually means handling:

- **Frame timing** with `requestAnimationFrame` — rendering at 60fps while running game logic at a fixed tick rate
- **Collision detection** — checking head position against all body segments on every frame efficiently
- **State management** — tracking game state (running, paused, game-over) and transitioning between them cleanly
- **Progressive difficulty** — dynamically adjusting tick delay as score increases so the speed curve feels fair, not punishing

For anyone learning JavaScript seriously, building a game loop from scratch is one of the clearest ways to understand how the browser event model and rendering pipeline actually work.

---

## How to use it

No installation. No dependencies. Just open the file.

```bash
git clone https://github.com/Rakeshgr962/SnakeMaster.git
cd SnakeMaster
```

Then double-click `index.html` — it opens in any browser. No server needed.

If you want to serve it:
```bash
python -m http.server 8000
# Open http://localhost:8000
```

---

## How it works (technical overview)

The game runs on a fixed-interval game loop:

```javascript
// Simplified core loop from game.js
function gameLoop() {
  if (!paused && !gameOver) {
    update();   // Move snake, check collisions, spawn food
    draw();     // Clear canvas, redraw grid, snake, food, score
  }
  setTimeout(gameLoop, speed);  // speed decreases as score increases
}
```

**Collision detection** checks whether the snake's new head position matches:
1. Any canvas boundary (wall collision)
2. Any existing body segment (self-collision)

**High score persistence** uses `localStorage` — your best score survives a page refresh.

---

## Project structure

```
SnakeMaster/
├── index.html      # Page shell — canvas element, score display, overlay states
├── style.css       # Styling — dark background, centered canvas, score font
├── game.js         # All game logic:
│                   #   - Snake data structure (array of {x, y} segments)
│                   #   - Food spawning (random position, not on snake body)
│                   #   - Input handling (keyboard events, direction queue)
│                   #   - Game loop (update + draw cycle)
│                   #   - Speed scaling and score tracking
└── assets/         # Audio clips for eat/game-over sound effects
```

---

## Customization

In `game.js`, tweak these constants at the top of the file:

```javascript
const GRID_SIZE = 20;         // Size of each cell in pixels
const INITIAL_SPEED = 150;    // Starting tick delay in ms (lower = faster)
const SPEED_INCREMENT = 5;    // How much faster per food eaten
const SCORE_PER_FOOD = 10;    // Score value of each food item
```

---

## License

MIT — see [LICENSE](LICENSE).
