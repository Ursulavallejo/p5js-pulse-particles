# 🌌 Pulse Particles — Interactive Generative Art - Creative Coding (p5.js)

### by Ursula Vallejo Janne

🔗 [Live demo on Netlify](https://p5-pulseparticles-demo-ios.netlify.app/)

🔗 [View on p5.js Editor](https://editor.p5js.org/Ursulavallejo/sketches/j0nmFnm_9)

---

## Overview

**Pulse Particles** is an interactive **generative art experiment** created with **p5.js** as part of the _Creative Coding_ course at **Högskola Dalarna**.
It blends color-sampled particles from an image background with dynamic, organic pulses that respond to user interaction (mouse or touch).

The sketch was designed and optimized to work seamlessly on **iOS** and **Android**, ensuring smooth visuals and responsive touch behavior.

---

## Concept

This project explores how **color and movement** can merge to convey a sense of **living energy**.
Users “paint” with moving particles derived from a background image, while generating expanding and rotating **pulses** — like visual heartbeats or breaths.

Each pulse is built with **Perlin noise**, resulting in soft, fluid, and unique shapes that never repeat exactly the same way.

---

## Features

- **Color-Sampled Particles** – Each particle inherits its color from the background pixel under the cursor or touch.
- **Animated Pulses** – Concentric, noise-driven rings grow and rotate, fading over time.
- 📱 **Full Mobile/iOS Compatibility**
  - Supports both `touchStarted` and `touchMoved`.
  - Prevents browser scroll and zoom gestures.
  - Uses `windowWidth`, `windowHeight`, and `resizeCanvas()` for dynamic resizing.
  - Keeps the canvas fixed and layered above all content (no external CSS required).
- 🔄 **Responsive Design** – Pulse positions are stored as normalized `(u, v)` coordinates, so they persist when the screen is resized or rotated.
- ⚙️ **Keyboard Shortcuts**
  - `F` → toggle fullscreen mode
  - `C` → clear all pulses

---

## Technical Details

- **Framework:** [p5.js](https://p5js.org/)
- **Language:** JavaScript (ES6)
- **Main Functions:**
  - `emitCellsAround()` → emits color-based particle clusters around the cursor.
  - `drawOrganicPulse()` → creates concentric noisy rings using Perlin noise.
  - `drawPulseAnimated()` → manages rotation, scaling, and fading over time.
- **Performance:**
  - Adjustable canvas ratio (`ratio = 2`) for quality vs. performance.
  - Particle limit (`3000 max`) to maintain stability.
- **Smooth transitions:** Uses `lerp()` for color and motion interpolation.

---

## Local Setup

1. Clone or download this repository:
   ```bash
   git clone https://github.com/yourusername/p5js-pulse-particles.git
   cd p5js-pulse-particles
   ```

```

2. Open `index.html` in your browser using a local server:
   e.g. VS Code Live Server

3. Interact using your **mouse** or **finger**(mobile) to create particles and pulses.

---

## iOS & Mobile Notes

Special adjustments were added for Safari on iPhone and iPad:

- Fixed canvas positioning to avoid UI bar shifts.
- Disabled default scroll/zoom gestures with `touchAction: 'none'`.
- Mirrored mouse events with touch equivalents.
- Automatic resizing on orientation change.

---

## Artistic Reflection

> _“This project was an exploration of color, motion, and interaction.
> I wanted users to generate visual energy through touch and gesture,
> and see that energy evolve into an organic, breathing flow.”_
> — _Ursula Vallejo Janne_

---

## Video Project:


---

## 📜 License

© 2025 **Ursula Vallejo Janne**
Released under the **MIT License** — feel free to use, remix, and learn from this project for educational or artistic purposes.
```
