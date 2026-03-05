/**
 * Scene 1a — "The Broken Room" (0–2.5s)
 *
 * Cold open: 5 video players from 5 cities, all out of sync.
 * Text flickers: "Everyone's watching. Nobody's in sync."
 * SNAP — all progress bars slam into alignment + shockwave.
 * Panels dissolve so the globe can take over.
 */

import gsap from 'gsap';
import { createVideoPanel, getProgressElements } from '../components/video-panel';

// ---------------------------------------------------------------------------
// Panel layout
// ---------------------------------------------------------------------------
const PANEL_W = 280;
const CY = 380;
const GAP = 40;
const TOTAL_W = PANEL_W * 5 + GAP * 4;
const START_X = (1920 - TOTAL_W) / 2;

const PANELS = [
  { city: 'New York', isHost: true, progress: 0.17, timeStr: '1:23', state: 'playing' as const, x: START_X, y: CY + 50 },
  { city: 'London', isHost: false, progress: 0.22, timeStr: '1:47', state: 'playing' as const, x: START_X + (PANEL_W + GAP), y: CY - 20 },
  { city: 'Tokyo', isHost: false, progress: 0.12, timeStr: '0:58', state: 'buffering' as const, x: START_X + (PANEL_W + GAP) * 2, y: CY - 60 },
  { city: 'São Paulo', isHost: false, progress: 0.19, timeStr: '1:31', state: 'paused' as const, x: START_X + (PANEL_W + GAP) * 3, y: CY - 20 },
  { city: 'Sydney', isHost: false, progress: 0.14, timeStr: '1:12', state: 'playing' as const, x: START_X + (PANEL_W + GAP) * 4, y: CY + 50 },
];

const SYNCED_PROGRESS = 0.17;
const SYNCED_TIME = '1:23';

// ---------------------------------------------------------------------------
export function buildScene1(
  tl: gsap.core.Timeline,
  container: HTMLElement
): void {
  const dangerGlow = document.createElement('div');
  dangerGlow.className = 'ambient-glow ambient-glow--danger';
  container.appendChild(dangerGlow);

  const calmGlow = document.createElement('div');
  calmGlow.className = 'ambient-glow ambient-glow--calm';
  container.appendChild(calmGlow);

  const panelEls = PANELS.map((cfg) => {
    const el = createVideoPanel(cfg);
    container.appendChild(el);
    return el;
  });

  const centerText = document.createElement('div');
  centerText.className = 'center-text';
  centerText.style.top = '62%';
  const textLine = document.createElement('div');
  textLine.className = 'center-text__line';
  textLine.textContent = '"Everyone\'s watching. Nobody\'s in sync."';
  centerText.appendChild(textLine);
  container.appendChild(centerText);

  const shockwave = document.createElement('div');
  shockwave.className = 'shockwave';
  shockwave.style.left = '50%';
  shockwave.style.top = '40%';
  shockwave.style.width = '0px';
  shockwave.style.height = '0px';
  shockwave.style.transform = 'translate(-50%, -50%)';
  container.appendChild(shockwave);

  const flash = document.createElement('div');
  flash.style.cssText = `
    position: absolute; inset: 0; z-index: 200;
    background: rgba(255, 255, 255, 0); pointer-events: none;
  `;
  container.appendChild(flash);

  // =========================================================================
  // 0.0s — Panels appear
  // =========================================================================
  tl.set(panelEls, { opacity: 0, y: 40, scale: 0.92 }, 0);
  tl.to(panelEls, { opacity: 1, y: 0, scale: 1, duration: 0.5, stagger: 0.08, ease: 'power3.out' }, 0);
  tl.to(dangerGlow, { opacity: 1, duration: 0.8, ease: 'power2.inOut' }, 0);

  // 0.3s — jitter
  panelEls.forEach((el, i) => {
    const xJ = (i % 2 === 0 ? 1 : -1) * (3 + i * 0.5);
    const yJ = (i % 2 === 0 ? -1 : 1) * (2 + i * 0.3);
    tl.to(el, { x: xJ, y: yJ, duration: 0.4, repeat: 3, yoyo: true, ease: 'sine.inOut' }, 0.3);
  });
  tl.to(dangerGlow, { opacity: 0.6, duration: 0.6, repeat: 2, yoyo: true, ease: 'sine.inOut' }, 0.2);

  // 1.3s — text flickers
  tl.set(textLine, { opacity: 0 }, 0);
  tl.to(textLine, { opacity: 1, duration: 0.06, repeat: 5, yoyo: true, ease: 'none' }, 1.3);
  tl.to(textLine, { opacity: 0.9, duration: 0.15, ease: 'power1.out' }, 1.7);

  // =========================================================================
  // 2.0s — THE SNAP
  // =========================================================================
  tl.to(flash, { background: 'rgba(255, 255, 255, 0.25)', duration: 0.06, ease: 'none' }, 2.0);
  tl.to(flash, { background: 'rgba(255, 255, 255, 0)', duration: 0.5, ease: 'power3.out' }, 2.06);
  tl.to(shockwave, { opacity: 0.8, width: '2200px', height: '2200px', duration: 0.8, ease: 'power2.out' }, 2.0);
  tl.to(shockwave, { opacity: 0, duration: 0.5, ease: 'power2.in' }, 2.4);

  panelEls.forEach((el) => tl.to(el, { x: 0, y: 0, duration: 0.3, ease: 'power4.out' }, 2.0));
  panelEls.forEach((el) => {
    const { fill, head, time } = getProgressElements(el);
    tl.to(fill, { width: `${SYNCED_PROGRESS * 100}%`, duration: 0.25, ease: 'power4.out' }, 2.0);
    tl.to(head, { left: `${SYNCED_PROGRESS * 100}%`, duration: 0.25, ease: 'power4.out' }, 2.0);
    tl.call(() => { time.textContent = SYNCED_TIME; }, [], 2.0);
  });
  tl.call(() => {
    panelEls.forEach((el) => {
      el.classList.remove('warning');
      el.classList.add('synced');
      el.querySelectorAll('.video-panel__thumb-bar').forEach((bar) => bar.classList.add('active'));
      el.querySelector('.video-panel__spinner')?.classList.remove('visible');
      el.querySelector('.video-panel__paused-icon')?.classList.remove('visible');
    });
  }, [], 2.0);

  tl.to(dangerGlow, { opacity: 0, duration: 0.4, ease: 'power2.out' }, 2.0);
  tl.to(calmGlow, { opacity: 1, duration: 0.6, ease: 'power2.out' }, 2.1);

  // 2.3s — "✓ Synced."
  tl.to(textLine, { opacity: 0, duration: 0.15, ease: 'power2.in' }, 2.3);
  tl.call(() => {
    textLine.textContent = '✓ Synced.';
    textLine.style.color = '#22C55E';
    textLine.style.fontSize = '32px';
    textLine.style.fontWeight = '700';
  }, [], 2.5);
  tl.to(textLine, { opacity: 1, duration: 0.3, ease: 'power2.out' }, 2.5);

  // =========================================================================
  // 3.0s — Dissolve: panels + text scatter outward, making room for the globe
  // =========================================================================
  tl.to(textLine, { opacity: 0, scale: 1.4, duration: 0.5, ease: 'power2.in' }, 3.0);

  // Panels shrink toward center and fade out (like being pulled into a singularity)
  panelEls.forEach((el, i) => {
    const angle = ((i - 2) / 2) * 0.8; // spread from center
    tl.to(el, {
      opacity: 0,
      scale: 0.3,
      x: Math.sin(angle) * 200,
      y: -100,
      duration: 0.7,
      ease: 'power3.in',
    }, 3.0);
  });

  tl.to(calmGlow, { opacity: 0, duration: 0.8, ease: 'power2.inOut' }, 3.0);
}
