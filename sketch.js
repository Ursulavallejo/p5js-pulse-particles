// ==================================================
// MAIN SKETCH: background image + color-sampled particles (main canvas)
// and animated organic pulses (overlay via p5.Graphics)
// ==================================================

// LINK Projet on P5 Editor >>
//  https://editor.p5js.org/Ursulavallejo/full/ADM-CzP-z

//
// iOS adjustments summary:
// - Fix canvas positioning/z-index to sit above background (no external CSS)
// - Add unified touch events (touchStarted/touchMoved) mirroring mousePressed/mouseMoved
// - Prevent mobile browser gestures over the canvas (scroll/zoom) by returning false in touch handlers
// - Use windowWidth/windowHeight + resizeCanvas on windowResized
// - Keep your particle/pulse logic intact
// ==================================================

// ---------- Config ----------
const ratio = 2 // Canvas is image size / ratio (performance vs. detail)
let p_size = 46 // Grid cell size; also scales particle sizes

// ---------- State ----------
let img, overlay // Main image, and second layer for pulses
let particles = [] // Particle array (main canvas)
let pulse_list = [] // Pulses (stored normalized so resizing works)

// ---------- Animation params (frames) ----------
const PULSE_LIFETIME = 200 // Lifetime of each pulse (in frames)
const TARGET_FPS = 60 // Time normalization so pulses feel the same regardless of actual FPS

const ROT_SPEED_MIN = -0.02 // Min angular speed (rad/frame)
const ROT_SPEED_MAX = 0.02 // Max angular speed (rad/frame)
const GROWTH_MAX = 1.8 // Max growth multiplier over lifetime
const THICKNESS_FADE = 0.35 // How much ring thickness thins out (0..1)

// [Tail-fix] avoid over-emitting into the same grid cell on consecutive frames
const lastEmitByCell = new Map()
const EMIT_COOLDOWN_FRAMES = 2 // try 1..3; higher = less clumping, lower = denser trail

// [Misc] simple mobile detection for a few lightweight tweaks if needed
function isMobile() {
  return /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
}

function preload() {
  // Draw a pink placeholder before image loads
  document.body.style.background = '#ff3ea5'
  // Load the source image before setup()
  img = loadImage('assets/background.jpg')
}

function setup() {
  // Force a 1:1 mapping between logical and physical pixels
  pixelDensity(1)

  // Canvas smaller than image (sample image at full res, draw scaled)
  // createCanvas(img.width / ratio, img.height / ratio)

  createCanvas(windowWidth, windowHeight) // full screen inside the browser window

  // [iOS] Keep the canvas fixed and on top so Safari UI bars don't shift it
  //       Also disable touch gestures on the canvas surface.
  if (this.canvas && this.canvas.style) {
    const s = this.canvas.style
    s.position = 'fixed'
    s.inset = '0'
    s.zIndex = '10'
    s.touchAction = 'none' // prevent browser scroll/zoom over canvas
    s.display = 'block'
  }
  // [iOS] Avoid body scroll/margins without requiring external CSS
  if (document && document.body && document.body.style) {
    document.body.style.margin = '0'
    document.body.style.overflow = 'hidden'
  }

  // resize the image to match the canvas size
  img.resize(width, height)

  // Sample a color from the center (or any pixel) of the background image
  const sampledColor = img.get(floor(width * 0.5), floor(height * 0.5))
  const r = sampledColor[0]
  const g = sampledColor[1]
  const b = sampledColor[2]

  // Apply that color as page background
  document.body.style.background = `rgb(${r}, ${g}, ${b})`

  // Second drawing surface for pulses; same size as main canvas
  overlay = createGraphics(width, height)
  // Use HSB on overlay to control hue/saturation/brightness easily
  overlay.colorMode(HSB, 360, 100, 100, 100)

  noStroke()
}

function draw() {
  // ---------- 1) Background (scaled) ----------
  background(220)
  image(img, 0, 0, width, height)

  // ---------- 2) Particles (main canvas) ----------
  // Iterate backwards so we can safely remove items
  for (let i = particles.length - 1; i >= 0; i--) {
    updateParticle(particles[i])
    drawParticle(particles[i])
    if (deadParticle(particles[i])) particles.splice(i, 1)
  }

  // ---------- 3) Pulses (overlay) ----------
  overlay.clear()

  // Update pulse age, remove expired, draw animated (rotation + growth + fade)
  for (let i = pulse_list.length - 1; i >= 0; i--) {
    const p_element = pulse_list[i]

    // Safe defaults in case of legacy pulses without animation fields
    const t0 = typeof p_element.t0 === 'number' ? p_element.t0 : frameCount
    const rot = typeof p_element.rotSpeed === 'number' ? p_element.rotSpeed : 0

    // [Time] compute elapsed "virtual frames" so timing is fps-independent
    let framesElapsed
    if (typeof p_element.t0ms === 'number') {
      const now = millis()
      framesElapsed = (now - p_element.t0ms) / (1000 / TARGET_FPS) // virtual frames at TARGET_FPS
    } else {
      // fallback for pre-existing pulses without t0ms
      framesElapsed = frameCount - t0
    }

    // Age 0..1 over PULSE_LIFETIME virtual frames (fps-independent)

    const age = constrain(framesElapsed / PULSE_LIFETIME, 0, 1) // 0..1
    if (age >= 1) {
      pulse_list.splice(i, 1)
      continue
    }

    // Reproject normalized coords to current canvas size, relative coordinates
    const x = p_element.u * width
    const y = p_element.v * height

    // [Time] angle uses virtual frames
    const angle = framesElapsed * rot

    drawPulseAnimated(overlay, x, y, p_element.seed, age, angle)
  }

  // Composite overlay on top of main canvas
  image(overlay, 0, 0)
}

// ==================================================
// PARTICLES (MAIN CANVAS): sample color under mouse, emit grid cells
// ==================================================

// Emit new particles when mouse moves

// Emit new particles when the mouse moves (desktop)
function mouseMoved() {
  emitCellsAround(mouseX, mouseY)
  return false // avoid accidental text selection when canvas isn't full-window
}

// Optional: keep emitting while dragging with the mouse (desktop)
// function mouseDragged() {
//   emitCellsAround(mouseX, mouseY)
//   return false
// }

// [Touch] iOS/Android: mirror mouseMoved with touchMoved to emit while dragging
function touchMoved() {
  // Use all touches for multi-finger drawing; fall back to mouseX/mouseY if needed
  if (touches && touches.length) {
    for (const t of touches) emitCellsAround(t.x, t.y)
  } else {
    emitCellsAround(mouseX, mouseY)
  }
  return false // [iOS] prevent page scroll/zoom
}

// Emit particles from centers of nearby grid cells around (mx, my)
function emitCellsAround(mx, my) {
  const cellRadius = 1 // Neighbourhood radius in cells
  const col0 = floor(mx / p_size)
  const row0 = floor(my / p_size)

  for (let dy = -cellRadius; dy <= cellRadius; dy++) {
    for (let dx = -cellRadius; dx <= cellRadius; dx++) {
      const col = col0 + dx
      const row = row0 + dy

      // Cell center in canvas coordinates
      const cx = col * p_size + p_size / 2
      const cy = row * p_size + p_size / 2
      if (cx < 0 || cx >= width || cy < 0 || cy >= height) continue

      // [Tail-fix] per-cell cooldown so we don't dump many particles into the same cell every frame
      const key = col + ',' + row
      const last = lastEmitByCell.get(key) ?? -9999
      if (frameCount - last < EMIT_COOLDOWN_FRAMES) continue
      lastEmitByCell.set(key, frameCount)

      // Map canvas (cx, cy) → image (sx, sy) to get the correct pixel color
      const sx = floor(map(cx, 0, width, 0, img.width))
      const sy = floor(map(cy, 0, height, 0, img.height))

      const colRGB = img.get(sx, sy)

      // Spawn several particles per cell center for density
      for (let k = 0; k < 6; k++) {
        particles.push(createParticle(cx, cy, colRGB))
      }
    }
  }

  // Hard cap to prevent unbounded growth
  if (particles.length > 3000) particles.splice(0, particles.length - 3000)
}

// Create one particle with small random velocity and color from image
function createParticle(x, y, col) {
  const ang = random(TWO_PI)
  const spd = random(0.3, 2.0)
  return {
    x,
    y,
    vx: cos(ang) * spd,
    vy: sin(ang) * spd,
    size: random(3, p_size * 0.9),
    life: 255,
    fade: random(4, 7),
    col,
  }
}

// Simple physics + lifetime
function updateParticle(p) {
  // small random walk to avoid clumping
  p.vx += random(-0.03, 0.03)
  p.vy += random(-0.03, 0.03)

  p.x += p.vx
  p.y += p.vy
  p.vx *= 0.98
  p.vy *= 0.98
  p.life -= p.fade
}

// Render particle with alpha driven by remaining life
function drawParticle(p) {
  fill(p.col[0], p.col[1], p.col[2], p.life)
  circle(p.x, p.y, p.size)
}

// A particle is dead when fully transparent
function deadParticle(p) {
  return p.life <= 0
}

// ==================================================
// PULSES (OVERLAY): animated concentric noisy rings
// - Position stored  (u,v) so resizing keeps layout
// - Color and size depend on vertical depth (distance factor)
//- constrain to normalize scale values betwen 0-1
// ==================================================

// Add a new pulse at mouse position , with its own seed + animation params
function mousePressed() {
  pulse_list.push({
    u: mouseX / width, // 0..1 (normalized X)
    v: mouseY / height, // 0..1 (normalized Y)
    seed: (floor(mouseX) * 73856093) ^ (floor(mouseY) * 19349663),
    t0: frameCount, // start frame for age and rotation
    t0ms: millis(), // [Time] ms start to compute fps-independent timing
    rotSpeed: random(ROT_SPEED_MIN, ROT_SPEED_MAX),
  })
}

// IOS/ ANDROID [Touch] mirror mousePressed on mobile so taps also create pulses
function touchStarted() {
  if (touches && touches.length) {
    for (const t of touches) {
      pulse_list.push({
        u: t.x / width,
        v: t.y / height,
        seed: (floor(t.x) * 73856093) ^ (floor(t.y) * 19349663),
        t0: frameCount, // legacy
        t0ms: millis(), // [Time] ms start for fps-independent timing
        rotSpeed: random(ROT_SPEED_MIN, ROT_SPEED_MAX),
      })
    }
  } else {
    // Fallback in case touches[] is empty but the event fires
    pulse_list.push({
      u: mouseX / width,
      v: mouseY / height,
      seed: (floor(mouseX) * 73856093) ^ (floor(mouseY) * 19349663),
      t0: frameCount, // legacy
      t0ms: millis(), // [Time]
      rotSpeed: random(ROT_SPEED_MIN, ROT_SPEED_MAX),
    })
  }
  return false // [iOS] prevent page scroll/zoom on tap
}

/*
  Draw one animated pulse:
  - depth-based base size & color (top=far, bottom=near)
  - growth over time (+ rotation)
  - alpha fade-out to disappear
 */
function drawPulseAnimated(g, x, y, seed, age, angle) {
  // Depth factor from vertical position (0 = top/far, 1 = bottom/near)
  const distance_factor = constrain((y + 1) / height, 0, 1)

  // Base radius from depth (small at top, large at bottom)
  const minR = min(width, height) * 0.05
  const maxR = min(width, height) * 0.35
  const baseR = map(distance_factor, 0, 1, minR, maxR)

  // Base thickness from depth; then thin out over lifetime
  const thickness0 = map(distance_factor, 0, 1, 28, 60)
  const growth = lerp(1.0, GROWTH_MAX, age)
  const thickness = lerp(thickness0, thickness0 * (1 - THICKNESS_FADE), age)

  // Depth → color in HSB (far=gray, near=turquoise)
  const farHue = 0,
    farSat = 0,
    farBri = 60
  const nearHue = 170,
    nearSat = 90,
    nearBri = 95
  const hue = lerp(farHue, nearHue, distance_factor)
  const sat = lerp(farSat, nearSat, distance_factor)
  const bri = lerp(farBri, nearBri, distance_factor)

  // Fade over lifetime
  const fade = 1.0 - pow(age, 1.2)

  // Draw concentric noisy rings centered at (0,0) after transform
  g.push()
  g.translate(x, y)
  g.rotate(angle)
  drawOrganicPulse(
    g,
    0,
    0,
    baseR * growth,
    thickness,
    seed,
    hue,
    sat,
    bri,
    6,
    fade
  )
  g.pop()
}

//  ring renderer (no transforms):
// draws several concentric noisy rings around (cx, cy).

function drawOrganicPulse(
  g,
  cx,
  cy,
  baseR,
  thickness,
  seed,
  hue,
  sat,
  bri,
  rings = 6,
  fade = 1.0
) {
  g.push()
  g.noFill()
  for (let i = 0; i < rings; i++) {
    const r = baseR + i * 6
    const alpha = map(i, 0, rings - 1, 70, 15) * fade
    g.stroke(hue, sat, bri, alpha)
    g.strokeWeight(1.6)
    drawNoisyRing(g, cx, cy, r, thickness, seed + i * 1234)
  }
  g.pop()
}

//One closed noisy ring using Perlin noise to modulate radius.

function drawNoisyRing(g, cx, cy, r, thickness, seed) {
  noiseSeed(seed)
  g.beginShape()
  const step = 0.035 // angular resolution
  for (let a = 0; a < TWO_PI; a += step) {
    const nx = cos(a) * 1.25
    const ny = sin(a) * 1.25
    const n = noise(nx * 1.8 + 10, ny * 1.8 + 20) // [0..1]
    const rr = r + (n - 0.5) * thickness * 2.0 // radius modulation
    g.vertex(cx + cos(a) * rr, cy + sin(a) * rr)
  }
  g.endShape(CLOSE)
}

// ==================================================
// KEY SHORTCUTS / RESIZING
// ==================================================
function keyPressed() {
  if (key === 'f' || key === 'F') {
    // Toggle fullscreen and resize canvas accordingly
    const fs = !fullscreen()
    fullscreen(fs)
    if (fs) {
      resizeCanvas(displayWidth, displayHeight)
      p_size = 126 //  particle grid at large res
    } else {
      resizeCanvas(img.width / ratio, img.height / ratio)
      p_size = 46
    }
    // Recreate overlay at new size; re-colored each frame from pulse_list
    overlay = createGraphics(width, height)
    overlay.colorMode(HSB, 360, 100, 100, 100)
  }

  // Clear all pulses
  if (key === 'c' || key === 'C') {
    pulse_list = []
  }
}

function windowResized() {
  // [iOS] handle UI bar show/hide and orientation changes
  resizeCanvas(windowWidth, windowHeight)
  overlay = createGraphics(width, height)
  overlay.colorMode(HSB, 360, 100, 100, 100)
  img.resize(width, height)
}

// ==================================================
// NOTES
// - ratio links canvas space to image space for correct pixel sampling.
// - p_size controls particle spacing AND particle scale for consistent look.
// - pulse_list stores normalized positions so pulses survive resizing.
//-  In this sketch, lerp() is used to smoothly blend between two color values
// depending on distance_factor, creating gradual transitions instead of sudden jumps.
// ==================================================
// --- About lerp() ---
// lerp(a, b, t) stands for "linear interpolation".
// It returns a value between 'a' and 'b', based on the factor 't' (0..1).
//  - t = 0 → returns 'a'
//  - t = 1 → returns 'b'
//  - t = 0.5 → returns the midpoint between them
//
// Example: lerp(10, 20, 0.25) → 12.5
