/**
 * Scene 1 — Dot + trailing line flies across, then zooms out toward center (~3.5s)
 *
 * The dot glides left→right, then shrinks and converges to the center
 * of the screen where the globe will appear (smooth zoom-out effect).
 */

import gsap from 'gsap';

export function buildEnvelopeScene(
  tl: gsap.core.Timeline,
  container: HTMLElement,
): void {

  // ── Dot + trail element ───────────────────────────────────────────────────

  const packet = document.createElement('div');
  packet.className = 'msg-packet';
  packet.innerHTML = `
    <div class="msg-packet__trail"></div>
    <div class="msg-packet__dot"></div>
  `;
  container.appendChild(packet);

  const trail = packet.querySelector('.msg-packet__trail') as HTMLElement;

  // ── Timeline ──────────────────────────────────────────────────────────────

  // Start off-screen left, vertically centered
  gsap.set(packet, {
    x: -200,
    y: 490,
    opacity: 0,
    scale: 0.6,
  });

  gsap.set(trail, { width: 0 });

  // 0.0s — pop in with spring
  tl.to(packet, {
    opacity: 1,
    scale: 1,
    duration: 0.35,
    ease: 'back.out(1.7)',
  }, 0);

  // 0.1s — glide across toward the right-center area
  tl.to(packet, {
    x: 800,
    duration: 2.0,
    ease: 'power1.out',
  }, 0.1);

  // Gentle vertical float as it travels
  tl.to(packet, {
    y: 470,
    duration: 1.0,
    ease: 'sine.inOut',
    yoyo: true,
    repeat: 1,
  }, 0.1);

  // Trail grows behind the dot
  tl.to(trail, {
    width: 600,
    duration: 1.6,
    ease: 'power2.out',
  }, 0.3);

  // 2.2s — ZOOM OUT: dot shrinks and moves to globe center (960, 510)
  tl.to(packet, {
    x: 944,
    y: 504,
    scale: 0.08,
    duration: 1.0,
    ease: 'power3.in',
  }, 2.2);

  // Trail shrinks and fades during zoom out
  tl.to(trail, {
    width: 0,
    opacity: 0,
    duration: 0.6,
    ease: 'power2.in',
  }, 2.2);

  // 3.0s — fade out as globe takes over
  tl.to(packet, {
    opacity: 0,
    duration: 0.25,
    ease: 'power2.in',
  }, 3.0);

  // Pad
  tl.set({}, {}, 3.5);
}
