/**
 * Scene 4 — The Title Reveal
 *
 * The video player chrome dissolves. The globe shrinks and rises while
 * still spinning. Large title text fades in below it with Apple-style
 * staggered motion.
 *
 * Timeline (absolute positions on master):
 *   15.0s       Player chrome dissolves (0.8s)
 *   15.3s       Globe begins shrinking + rising (1.7s)
 *   15.0–21.0s  Globe continues spinning
 *   16.2s       "Shaka Player" fades in (0.8s)
 *   16.5s       "Sync" fades in (0.8s)
 *   18.0s       "@pubnub/shaka-player" subtitle fades in (0.6s)
 *   21.0s       Pad end — hold frame
 */

import gsap from 'gsap';
import { globeRotation, GLOBE_PHI } from './scene2-globe-arc';

// ─── Scene timing ────────────────────────────────────────────────────────────

const T0 = 15.0;
const T_CHROME_DUR = 0.8;
const T_SHRINK = 15.3;
const T_SHRINK_DUR = 1.7;
const T_LINE1 = 16.2;
const T_LINE2 = 16.5;
const T_LINE_DUR = 0.8;
const T_SUBTITLE = 18.0;
const T_END = 21.0;

// Where scene 3 left globeRotation.phi
const PHI_SCENE3_END = GLOBE_PHI + 0.8;

// ═════════════════════════════════════════════════════════════════════════════
// MAIN SCENE BUILDER
// ═════════════════════════════════════════════════════════════════════════════

export function buildTitleRevealScene(
  tl: gsap.core.Timeline,
  container: HTMLElement,
): void {

  // ── Query existing elements ────────────────────────────────────────────

  const vpFrame = container.querySelector('.vp-frame') as HTMLElement | null;
  const globeWrapper = container.querySelector('.globe-arc-wrapper') as HTMLElement | null;

  // ── Create title elements ──────────────────────────────────────────────

  const titleGroup = document.createElement('div');
  titleGroup.className = 'title-reveal';

  const line1 = document.createElement('div');
  line1.className = 'title-reveal__line';
  line1.textContent = 'Shaka Player';

  const line2 = document.createElement('div');
  line2.className = 'title-reveal__line title-reveal__line--gradient';
  line2.textContent = 'Sync';

  const subtitle = document.createElement('div');
  subtitle.className = 'title-reveal__subtitle';
  subtitle.textContent = '@pubnub/shaka-player';

  titleGroup.appendChild(line1);
  titleGroup.appendChild(line2);
  titleGroup.appendChild(subtitle);
  container.appendChild(titleGroup);

  // ── Initial hidden states ──────────────────────────────────────────────

  gsap.set(line1, { opacity: 0, y: 40 });
  gsap.set(line2, { opacity: 0, y: 40 });
  gsap.set(subtitle, { opacity: 0, y: 20 });

  // ════════════════════════════════════════════════════════════════════════
  // GSAP TIMELINE
  // ════════════════════════════════════════════════════════════════════════

  // ── 15.0s — Player chrome dissolves ────────────────────────────────────

  if (vpFrame) {
    tl.to(vpFrame, {
      opacity: 0,
      duration: T_CHROME_DUR,
      ease: 'power2.inOut',
    }, T0);
  }

  // ── 15.0–21.0s — Globe continues spinning ─────────────────────────────

  tl.to(globeRotation, {
    phi: PHI_SCENE3_END + 1.5,
    duration: T_END - T0,
    ease: 'none',
  }, T0);

  // ── 15.3s — Globe shrinks + rises ─────────────────────────────────────

  if (globeWrapper) {
    tl.to(globeWrapper, {
      scale: 0.4,
      y: -120,
      duration: T_SHRINK_DUR,
      ease: 'power3.inOut',
    }, T_SHRINK);
  }

  // ── 16.2s — "Shaka Player" reveals ────────────────────────────────────

  tl.to(line1, {
    opacity: 1,
    y: 0,
    duration: T_LINE_DUR,
    ease: 'power2.out',
  }, T_LINE1);

  // ── 16.5s — "Sync" reveals ────────────────────────────────────────────

  tl.to(line2, {
    opacity: 1,
    y: 0,
    duration: T_LINE_DUR,
    ease: 'power2.out',
  }, T_LINE2);

  // ── 18.0s — Subtitle reveals ──────────────────────────────────────────

  tl.to(subtitle, {
    opacity: 1,
    y: 0,
    duration: 0.6,
    ease: 'power2.out',
  }, T_SUBTITLE);

  // ── Pad end ────────────────────────────────────────────────────────────

  tl.set({}, {}, T_END);
}
