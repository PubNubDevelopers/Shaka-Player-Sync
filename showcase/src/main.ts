import './theme.css';
import gsap from 'gsap';
import { createStarfield } from './components/starfield';
import { buildEnvelopeScene } from './scenes/scene1-envelope';
import { buildGlobeArcScene } from './scenes/scene2-globe-arc';
import { buildVideoWrapScene } from './scenes/scene3-video-wrap';
import { buildTitleRevealScene } from './scenes/scene4-title-reveal';
import { buildIdeRevealScene } from './scenes/scene5-ide-reveal';

// Disable lag smoothing so background-tab catch-up works properly
gsap.ticker.lagSmoothing(0);

// ============================================
// Viewport scaling — fit 1920×1080 in any window
// ============================================
function scaleViewport() {
  const vp = document.getElementById('viewport')!;
  const scaleX = window.innerWidth / 1920;
  const scaleY = window.innerHeight / 1080;
  const scale = Math.min(scaleX, scaleY);
  vp.style.transform = `translate(-50%, -50%) scale(${scale})`;
}

window.addEventListener('resize', scaleViewport);
scaleViewport();

// ============================================
// Master timeline
// ============================================
const master = gsap.timeline({ paused: true });

// ============================================
// Scene container
// ============================================
const container = document.getElementById('scene-container')!;

// Star field
createStarfield(container, 120);

// Build scenes
buildEnvelopeScene(master, container);    // 0–3.5s  (dot flies across, zooms out)
buildGlobeArcScene(master, container);    // 2.5–10s (globe appears, arcs draw)
buildVideoWrapScene(master, container);   // 9–15s (video player wraps globe, cursor clicks play, globe spins)
buildTitleRevealScene(master, container); // 15–21s (chrome dissolves, globe shrinks, title text reveals)
buildIdeRevealScene(master, container);  // 21–32s (IDE window with Quick Start code)

// Expose for dev
(window as any).__tl = master;

const params = new URLSearchParams(window.location.search);
const isRecordMode = params.has('record');

// Quick-seek URL param: ?t=0.5
const urlT = params.get('t');
if (urlT) {
  const seekTo = parseFloat(urlT);
  if (!isNaN(seekTo)) {
    master.seek(seekTo, false);
  }
}

// ============================================
// Record mode — hides dev controls, click anywhere to play
// Usage: http://localhost:4200/?record
// ============================================
if (isRecordMode) {
  const devControls = document.getElementById('dev-controls')!;
  devControls.style.display = 'none';

  document.body.style.cursor = 'pointer';
  document.body.addEventListener('click', () => {
    document.body.style.cursor = 'none';
    document.documentElement.requestFullscreen().then(() => {
      scaleViewport();
      master.play();
    }).catch(() => {
      master.play();
    });
  }, { once: true });

  document.addEventListener('fullscreenchange', scaleViewport);
} else {
  // ============================================
  // Dev controls
  // ============================================
  const btnPlay = document.getElementById('btn-play') as HTMLButtonElement;
  const btnPause = document.getElementById('btn-pause') as HTMLButtonElement;
  const btnRestart = document.getElementById('btn-restart') as HTMLButtonElement;
  const scrubber = document.getElementById('scrubber') as HTMLInputElement;
  const timeDisplay = document.getElementById('time-display')!;

  let isScrubbing = false;

  btnPlay.addEventListener('click', () => master.play());
  btnPause.addEventListener('click', () => master.pause());
  btnRestart.addEventListener('click', () => {
    master.seek(0, false);
    master.pause();
  });

  scrubber.addEventListener('input', () => {
    isScrubbing = true;
    const t = parseFloat(scrubber.value);
    master.seek(t, false);
    master.pause();
  });

  scrubber.addEventListener('change', () => {
    isScrubbing = false;
  });

  gsap.ticker.add(() => {
    if (!isScrubbing) {
      const t = master.time();
      const dur = master.duration();
      scrubber.max = String(dur);
      scrubber.value = String(t);
      timeDisplay.textContent = `${t.toFixed(1)}s / ${dur.toFixed(1)}s`;
    }
  });
}
