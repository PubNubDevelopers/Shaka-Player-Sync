/**
 * Scene 3 — The Player Reveal
 *
 * The globe IS the video. Player chrome draws itself around it — piece by
 * piece, like someone is quietly assembling the interface.
 *
 * When the frame appears:
 *   - The globe starts slowly rotating
 *   - City labels + dots fade out
 *   - A cursor slides in and clicks play
 *
 * Timeline (absolute positions on master):
 *   9.0s        Border DRAWS clockwise from top-center (0.8s)
 *               City labels + SVG overlay fade out (0.5s)
 *   10.2s       Progress bar materializes (0.3s)
 *   10.4s       Timestamps fade in (0.3s)
 *   10.5s       Title fades in (0.4s)
 *   10.7s       Play button fades in at center (0.3s)
 *   11.0s       Cursor slides in toward play button (0.7s)
 *   11.7s       Cursor "clicks" — play button responds
 *   11.8s       Globe starts spinning + progress bar advances
 *   15.0s       Pad end — globe still spinning
 */

import gsap from 'gsap';
import { globeRotation, GLOBE_PHI } from './scene2-globe-arc';

// ─── Layout constants (must match scene2-globe-arc.ts) ───────────────────────

const GLOBE_CX = 1920 / 2;
const GLOBE_CY = 1080 / 2 - 20;
const GLOBE_SIZE = 680;

// ─── Wider, more horizontal frame ────────────────────────────────────────────

const FRAME_W = 1060;
const FRAME_H = 620;
const BORDER_R = 20;

// Frame centered on the globe
const FRAME_X = GLOBE_CX - FRAME_W / 2;
const FRAME_Y = GLOBE_CY - FRAME_H / 2;

// Globe center relative to frame's top-left
const GLOBE_REL_X = FRAME_W / 2;
const GLOBE_REL_Y = GLOBE_CY - FRAME_Y;

// ─── Scene timing ────────────────────────────────────────────────────────────

const T0 = 9.0;                                      // Scene start
const T_BORDER_DUR  = 0.8;
const T_BORDER_END  = T0 + T_BORDER_DUR;             // 9.8
const T_PROGRESS    = T_BORDER_END + 0.4;            // 10.2
const T_TIMESTAMPS  = T_PROGRESS + 0.2;              // 10.4
const T_TITLE       = T_TIMESTAMPS + 0.1;            // 10.5
const T_PLAY_BTN    = T_TITLE + 0.2;                 // 10.7
const T_CURSOR      = T_PLAY_BTN + 0.3;              // 11.0
const T_CLICK       = T_CURSOR + 0.7;                // 11.7
const T_END         = 15.0;

// ─── SVG rounded-rect path starting from top-center, clockwise ──────────────

function roundedRectPath(w: number, h: number, r: number): string {
  return [
    `M ${w / 2},0`,
    `L ${w - r},0`,
    `A ${r},${r} 0 0 1 ${w},${r}`,
    `L ${w},${h - r}`,
    `A ${r},${r} 0 0 1 ${w - r},${h}`,
    `L ${r},${h}`,
    `A ${r},${r} 0 0 1 0,${h - r}`,
    `L 0,${r}`,
    `A ${r},${r} 0 0 1 ${r},0`,
    `Z`,
  ].join(' ');
}

// ═════════════════════════════════════════════════════════════════════════════
// MAIN SCENE BUILDER
// ═════════════════════════════════════════════════════════════════════════════

export function buildVideoWrapScene(
  tl: gsap.core.Timeline,
  container: HTMLElement,
): void {

  // ── Root container ──────────────────────────────────────────────────────

  const frame = document.createElement('div');
  frame.className = 'vp-frame';
  Object.assign(frame.style, {
    position: 'absolute',
    left: `${FRAME_X}px`,
    top: `${FRAME_Y}px`,
    width: `${FRAME_W}px`,
    height: `${FRAME_H}px`,
    zIndex: '15',
    pointerEvents: 'none',
  });

  // ── SVG border (stroke-dashoffset draw animation) ─────────────────────

  const NS = 'http://www.w3.org/2000/svg';

  const borderSvg = document.createElementNS(NS, 'svg');
  borderSvg.setAttribute('width', String(FRAME_W));
  borderSvg.setAttribute('height', String(FRAME_H));
  borderSvg.setAttribute('viewBox', `0 0 ${FRAME_W} ${FRAME_H}`);
  borderSvg.style.cssText = 'position:absolute;inset:0;overflow:visible;pointer-events:none;';

  const borderPath = document.createElementNS(NS, 'path');
  borderPath.setAttribute('d', roundedRectPath(FRAME_W, FRAME_H, BORDER_R));
  borderPath.setAttribute('fill', 'none');
  borderPath.setAttribute('stroke', 'rgba(255,255,255,0.12)');
  borderPath.setAttribute('stroke-width', '1');
  borderPath.setAttribute('stroke-linecap', 'round');
  borderSvg.appendChild(borderPath);
  frame.appendChild(borderSvg);

  // ── Play button — circle with triangle, centered on globe ─────────────

  const playBtn = document.createElement('div');
  playBtn.className = 'vp-frame__play-btn';
  playBtn.innerHTML = `
    <svg viewBox="0 0 60 60" width="60" height="60">
      <circle cx="30" cy="30" r="29" fill="rgba(255,255,255,0.06)"
              stroke="rgba(255,255,255,0.15)" stroke-width="1"/>
      <polygon points="24,18 24,42 44,30" fill="rgba(255,255,255,0.6)"/>
    </svg>
  `;
  Object.assign(playBtn.style, {
    position: 'absolute',
    left: `${GLOBE_REL_X}px`,
    top: `${GLOBE_REL_Y}px`,
    transform: 'translate(-50%, -50%)',
    zIndex: '10',
  });
  frame.appendChild(playBtn);

  // ── Cursor — macOS-style pointer arrow ────────────────────────────────

  const cursor = document.createElement('div');
  cursor.className = 'vp-frame__cursor';
  cursor.innerHTML = `
    <svg viewBox="0 0 24 28" width="24" height="28" fill="none">
      <path d="M5.5 0.5L5.5 21L10 16.5L15 25.5L18 24L13 15L19 15L5.5 0.5Z"
            fill="white" stroke="rgba(0,0,0,0.4)" stroke-width="0.75"
            stroke-linejoin="round"/>
    </svg>
  `;
  Object.assign(cursor.style, {
    position: 'absolute',
    zIndex: '20',
    pointerEvents: 'none',
    transformOrigin: '5px 0',
  });
  frame.appendChild(cursor);

  // ── Controls area (bottom of frame, inside border) ────────────────────

  const controls = document.createElement('div');
  controls.className = 'vp-frame__controls';
  controls.innerHTML = `
    <div class="vp-frame__title">Synced Playback</div>
    <div class="vp-frame__progress">
      <div class="vp-frame__progress-track"></div>
      <div class="vp-frame__progress-fill"></div>
      <div class="vp-frame__progress-head"></div>
    </div>
    <div class="vp-frame__timestamps">
      <span class="vp-frame__time-left">0:24</span>
      <span class="vp-frame__time-right">3:24</span>
    </div>
  `;
  frame.appendChild(controls);
  container.appendChild(frame);

  // ── Grab sub-elements ─────────────────────────────────────────────────

  const titleEl      = frame.querySelector('.vp-frame__title') as HTMLElement;
  const progressEl   = frame.querySelector('.vp-frame__progress') as HTMLElement;
  const timestampsEl = frame.querySelector('.vp-frame__timestamps') as HTMLElement;
  const fillEl       = frame.querySelector('.vp-frame__progress-fill') as HTMLElement;
  const headEl       = frame.querySelector('.vp-frame__progress-head') as HTMLElement;

  // ── Find globe overlay elements to fade out ───────────────────────────

  const globeSvg   = container.querySelector('.globe-arc-wrapper svg');
  const cityLabels = container.querySelectorAll('.globe-city-label');

  // ── Set up stroke-dashoffset for border draw ──────────────────────────

  const totalLength = borderPath.getTotalLength();
  borderPath.setAttribute('stroke-dasharray', String(totalLength));
  borderPath.setAttribute('stroke-dashoffset', String(totalLength));

  // ── Initial hidden states (everything invisible, NO scale) ────────────

  gsap.set(playBtn,      { opacity: 0 });
  gsap.set(cursor,       { opacity: 0, left: FRAME_W - 100, top: FRAME_H - 50 });
  gsap.set(titleEl,      { opacity: 0 });
  gsap.set(progressEl,   { opacity: 0 });
  gsap.set(timestampsEl, { opacity: 0 });

  // ════════════════════════════════════════════════════════════════════════
  // GSAP TIMELINE
  // ════════════════════════════════════════════════════════════════════════

  // ── 9.0s — Border draws clockwise from top-center ─────────────────────
  tl.to(borderPath, {
    attr: { 'stroke-dashoffset': 0 },
    duration: T_BORDER_DUR,
    ease: 'power3.inOut',
  }, T0);

  // ── 9.0s — Fade out city labels + SVG overlay ────────────────────────
  if (globeSvg) {
    tl.to(globeSvg, { opacity: 0, duration: 0.5, ease: 'power2.in' }, T0);
  }
  cityLabels.forEach(el => {
    tl.to(el, { opacity: 0, duration: 0.5, ease: 'power2.in' }, T0);
  });

  // Globe stays static until the cursor clicks play — then it starts spinning.
  // Rotation begins at T_CLICK and runs through T_END (~3.2s of spinning).
  tl.fromTo(globeRotation,
    { phi: GLOBE_PHI },
    { phi: GLOBE_PHI + 0.8, duration: T_END - T_CLICK, ease: 'power1.inOut' },
    T_CLICK + 0.1,
  );

  // ── 10.2s — Progress bar materializes ─────────────────────────────────
  tl.to(progressEl, {
    opacity: 1,
    duration: 0.3,
    ease: 'power2.out',
  }, T_PROGRESS);

  // ── 10.4s — Timestamps fade in ───────────────────────────────────────
  tl.to(timestampsEl, {
    opacity: 1,
    duration: 0.3,
    ease: 'power2.out',
  }, T_TIMESTAMPS);

  // ── 10.5s — Title fades in ───────────────────────────────────────────
  tl.to(titleEl, {
    opacity: 1,
    duration: 0.4,
    ease: 'power2.out',
  }, T_TITLE);

  // ── 10.7s — Play button fades in at center ───────────────────────────
  tl.to(playBtn, {
    opacity: 1,
    duration: 0.3,
    ease: 'power2.out',
  }, T_PLAY_BTN);

  // ── 11.0s — Cursor slides in toward play button ──────────────────────
  tl.to(cursor, { opacity: 1, duration: 0.12 }, T_CURSOR);
  tl.to(cursor, {
    left: GLOBE_REL_X,
    top: GLOBE_REL_Y,
    duration: 0.7,
    ease: 'power2.out',
  }, T_CURSOR);

  // ── 11.7s — Cursor "clicks" ──────────────────────────────────────────
  tl.to(cursor, { scale: 0.82, duration: 0.08, ease: 'power2.in' }, T_CLICK);
  tl.to(cursor, { scale: 1, duration: 0.12, ease: 'power2.out' }, T_CLICK + 0.08);

  // Play button responds — brief flash then fades away
  tl.to(playBtn, { opacity: 0.9, duration: 0.05 }, T_CLICK + 0.04);
  tl.to(playBtn, { opacity: 0, duration: 0.3, ease: 'power2.in' }, T_CLICK + 0.1);

  // Progress bar starts advancing (video "playing") — runs through end of scene
  const playDur = T_END - T_CLICK - 0.1;
  tl.to(fillEl, { width: '18%', duration: playDur, ease: 'none' }, T_CLICK + 0.1);
  tl.to(headEl, { left: '18%', duration: playDur, ease: 'none' }, T_CLICK + 0.1);

  // ── Cursor fades out ─────────────────────────────────────────────────
  tl.to(cursor, { opacity: 0, duration: 0.4, ease: 'power2.in' }, T_CLICK + 0.3);

  // ── Pad end ───────────────────────────────────────────────────────────

  tl.set({}, {}, T_END);
}
