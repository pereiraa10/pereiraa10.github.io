// =============================================================
//  HARMONOGRAPH BACKGROUND — TUNABLE PARAMETERS
//  Edit anything in HP to change the look and feel.
// =============================================================
const HP = {
  // --- Shape (x-axis) ---
  f1: 2,            // x pendulum 1 frequency  (try near-integers for drift)
  f2: 3.01,         // x pendulum 2 frequency
  p1: 0,            // x pendulum 1 phase offset (radians)
  p2: Math.PI / 2,  // x pendulum 2 phase offset (1.57 ≈ π/2)

  // --- Shape (y-axis) ---
  f3: 2.01,         // y pendulum 1 frequency
  f4: 3,            // y pendulum 2 frequency
  p3: Math.PI / 4,  // y pendulum 1 phase offset
  p4: 0,            // y pendulum 2 phase offset

  // --- Decay ---
  damping: 0.0003,  // how fast the curve spirals inward (0 = no decay, 0.001 = fast)

  // --- Resolution ---
  steps: 80000,     // total points precomputed — more = finer curve, more memory
  dt:    0.02,      // time increment per step — smaller = smoother, slower to build

  // --- Size ---
  scale: 0.58,      // fraction of viewport min-dimension used for the drawing

  // --- Color ---
  opacity:    0.2,        // stroke opacity (0–1)
  lineWidth:  1.2,        // stroke width in pixels
  colorTwo:   '#00bfcf14',  // second gradient color (teal accent); set equal to primary for no gradient
  colorBands: 24,         // number of color segments along the curve (1 = solid single color)

  // --- Scroll feel ---
  easing: true,     // apply ease-in curve to scroll progress (true = slower start)
};
// =============================================================


(function () {
  // --- Canvas setup ---
  const canvas = document.createElement('canvas');
  canvas.id = 'harmonograph-bg';
  Object.assign(canvas.style, {
    position:        'fixed',
    top:             '0',
    left:            '0',
    width:           '100vw',
    height:          '100vh',
    zIndex:          '0',
    pointerEvents:   'none',
    backgroundColor: 'transparent', // override .light > * which forces bg on all body children
  });
  document.body.insertBefore(canvas, document.body.firstChild);

  const ctx = canvas.getContext('2d');
  let points = [];
  let W, H, cx, cy, radius;
  let drawnUpTo = 0;  // last point index actually painted on canvas
  let currentColor = '';

  function resize() {
    W = canvas.width  = window.innerWidth;
    H = canvas.height = window.innerHeight;
    cx = W / 2;
    cy = H / 2;
    radius = Math.min(W, H) * HP.scale;
    precompute();
    drawnUpTo = 0;
    fullRedraw(lastProgress);
  }

  // --- Precompute all points once ---
  function precompute() {
    points = new Float32Array(HP.steps * 2);
    for (let i = 0; i < HP.steps; i++) {
      const t = i * HP.dt;
      const d = Math.exp(-HP.damping * t);
      const x = (Math.sin(HP.f1 * t + HP.p1) + Math.sin(HP.f2 * t + HP.p2)) * d;
      const y = (Math.sin(HP.f3 * t + HP.p3) + Math.sin(HP.f4 * t + HP.p4)) * d;
      points[i * 2]     = cx + x * radius * 0.5;
      points[i * 2 + 1] = cy + y * radius * 0.5;
    }
  }

  // --- Read accent color from CSS variable ---
  function accentColor() {
    return getComputedStyle(document.documentElement)
             .getPropertyValue('--primary-color').trim() || '#7C5CFF';
  }

  function hexToRgb(hex) {
    hex = hex.replace('#', '');
    return [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16)];
  }

  // Interpolated rgba at curve-progress t (0–1): primary color → colorTwo
  function colorAt(t) {
    const a = hexToRgb(accentColor());
    const b = hexToRgb(HP.colorTwo);
    const r  = Math.round(a[0] + (b[0] - a[0]) * t);
    const g  = Math.round(a[1] + (b[1] - a[1]) * t);
    const bl = Math.round(a[2] + (b[2] - a[2]) * t);
    return `rgba(${r},${g},${bl},${HP.opacity})`;
  }

  function applyStrokeStyle(t) {
    currentColor     = accentColor();  // track for dark/light toggle detection
    ctx.strokeStyle  = colorAt(t);
    ctx.globalAlpha  = 1;
    ctx.lineWidth    = HP.lineWidth;
    ctx.lineJoin     = 'round';
    ctx.lineCap      = 'butt';         // butt caps don't extend past endpoints — no overlap blobs
  }

  // --- Full redraw from 0 → progress, looping through color bands ---
  function fullRedraw(progress) {
    const n = Math.floor(progress * HP.steps);
    ctx.clearRect(0, 0, W, H);
    drawnUpTo = 0;
    if (n < 2) return;

    const bandSize = Math.ceil(HP.steps / HP.colorBands);
    let bandStart = 0;
    while (bandStart < n) {
      const bandEnd = Math.min(bandStart + bandSize, n);
      const t = bandStart / HP.steps;  // 0→1 position in full curve
      applyStrokeStyle(t);
      ctx.beginPath();
      const from = Math.max(0, bandStart - 1);  // one-point overlap prevents join gap
      ctx.moveTo(points[from * 2], points[from * 2 + 1]);
      for (let i = from + 1; i < bandEnd; i++) ctx.lineTo(points[i * 2], points[i * 2 + 1]);
      ctx.stroke();
      bandStart = bandEnd;
    }
    drawnUpTo = n;
  }

  // --- Incremental draw: only stroke the new segment, split at color band boundaries ---
  function incrementalDraw(newEnd) {
    if (newEnd <= drawnUpTo) return;

    const bandSize  = Math.ceil(HP.steps / HP.colorBands);
    const startBand = Math.floor(drawnUpTo / bandSize);
    const endBand   = Math.floor(newEnd    / bandSize);

    let segStart = drawnUpTo;
    for (let band = startBand; band <= endBand; band++) {
      const segEnd = Math.min((band + 1) * bandSize - 1, newEnd);
      if (segEnd < segStart) continue;
      const t = band / HP.colorBands;
      applyStrokeStyle(t);
      ctx.beginPath();
      // Start one point back so segments overlap at the join — prevents gaps at slow scroll
      const from = Math.max(0, segStart - 1);
      ctx.moveTo(points[from * 2], points[from * 2 + 1]);
      for (let i = from + 1; i <= segEnd; i++) ctx.lineTo(points[i * 2], points[i * 2 + 1]);
      ctx.stroke();
      segStart = segEnd + 1;
    }
    drawnUpTo = newEnd;
  }

  // --- Scroll listener ---
  let lastProgress = 0;
  let rafId = null;

  function onScroll() {
    const maxScroll = document.body.scrollHeight - window.innerHeight;
    let p = maxScroll > 0 ? window.scrollY / maxScroll : 0;
    if (HP.easing) p = p * p * (3 - 2 * p); // smoothstep
    lastProgress = p;
    if (!rafId) rafId = requestAnimationFrame(tick);
  }

  function tick() {
    rafId = null;
    const newEnd = Math.floor(lastProgress * HP.steps);
    const colorNow = accentColor();

    if (colorNow !== currentColor) {
      // Color changed (dark/light toggle) — must full redraw
      fullRedraw(lastProgress);
    } else if (newEnd >= drawnUpTo) {
      // Scrolling down — just extend
      incrementalDraw(newEnd);
    } else {
      // Scrolling up — must clear and redraw
      fullRedraw(lastProgress);
    }
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', resize);

  // Re-read color when dark mode toggles
  new MutationObserver(() => {
    fullRedraw(lastProgress);
  }).observe(document.body, { attributes: true, attributeFilter: ['class'] });

  resize();
})();
