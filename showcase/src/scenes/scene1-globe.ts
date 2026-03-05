/**
 * Scene 1b — Globe Entrance (2–5s) + Cities Light Up (5–8s)
 *
 * The "✓ Synced." text dissolves → globe scales in from center →
 * wireframe draws → atmosphere pulses → rotation begins.
 * Then cities pop in one by one with arcs connecting them.
 */

import * as THREE from 'three';
import gsap from 'gsap';
import { Globe, CITIES } from '../components/globe';

// City order for the pop-in animation
const CITY_ORDER = ['New York', 'London', 'Tokyo', 'São Paulo', 'Sydney'];

export function buildGlobeScene(
  tl: gsap.core.Timeline,
  container: HTMLElement,
): Globe {
  // =========================================================================
  // Create the globe and mount it
  // =========================================================================
  const globe = new Globe();
  globe.mount(container);

  // Pre-create city markers and arcs (hidden)
  for (const name of CITY_ORDER) {
    globe.createCityMarker(name);
  }
  // Arcs from NYC to all others
  for (const name of CITY_ORDER) {
    if (name === 'New York') continue;
    globe.createArc(name);
    globe.setArcProgress(name, 0); // Start with no draw
  }

  // Start globe at scale 0 (will animate in)
  globe.globeGroup.scale.set(0, 0, 0);

  // =========================================================================
  // Create city label overlays (HTML positioned over globe)
  // =========================================================================
  const labelContainer = document.createElement('div');
  labelContainer.className = 'globe-labels';
  labelContainer.style.cssText = `
    position: absolute; inset: 0; z-index: 10;
    pointer-events: none;
  `;
  container.appendChild(labelContainer);

  const cityLabels: Map<string, HTMLElement> = new Map();
  for (const name of CITY_ORDER) {
    const label = document.createElement('div');
    label.className = 'city-label';
    if (CITIES[name].isHost) label.classList.add('city-label--host');
    label.innerHTML = `
      <span class="city-label__dot ${CITIES[name].isHost ? 'city-label__dot--host' : ''}"></span>
      <span class="city-label__name">${name}</span>
      ${CITIES[name].isHost ? '<span class="city-label__crown">👑</span>' : ''}
    `;
    label.style.opacity = '0';
    labelContainer.appendChild(label);
    cityLabels.set(name, label);
  }

  // Center text overlay for "One room. Five cities. Real-time."
  const textOverlay = document.createElement('div');
  textOverlay.className = 'center-text';
  textOverlay.style.top = '82%';
  textOverlay.innerHTML = `<div class="center-text__line" style="opacity:0; font-size:26px; letter-spacing: 2px;">
    One room. Five cities. <span style="color: #3B82F6; font-weight: 700;">Real-time.</span>
  </div>`;
  container.appendChild(textOverlay);
  const textEl = textOverlay.querySelector('.center-text__line') as HTMLElement;

  // =========================================================================
  // Helpers: project 3D city positions → 2D screen coordinates for labels
  // =========================================================================
  function updateLabelPositions() {
    for (const [name, label] of cityLabels.entries()) {
      const city = CITIES[name];
      // Get the city's 3D position within the rotated globe group
      const sprite = globe.citySprites.get(name);
      if (!sprite) continue;

      const worldPos = new THREE.Vector3();
      sprite.getWorldPosition(worldPos);

      // Project to screen
      const projected = worldPos.clone().project(globe.camera);

      // Convert to CSS coordinates within 1920x1080
      const x = (projected.x * 0.5 + 0.5) * 1920;
      const y = (-projected.y * 0.5 + 0.5) * 1080;

      label.style.left = `${x}px`;
      label.style.top = `${y - 28}px`; // Offset above the dot

      // Hide if on back side of globe
      const dotProduct = worldPos.clone().normalize().dot(
        globe.camera.position.clone().normalize()
      );
      if (dotProduct < 0.15) {
        label.style.visibility = 'hidden';
      } else {
        label.style.visibility = 'visible';
      }
    }
  }

  // Update label positions every frame once globe is visible
  let labelsActive = false;
  const origRender = globe.renderer.render.bind(globe.renderer);
  const origRenderScene = globe.scene;
  const origRenderCam = globe.camera;

  // Patch into the render loop to update labels
  const patchedRender = (scene: any, camera: any) => {
    origRender(scene, camera);
    if (labelsActive) updateLabelPositions();
  };
  globe.renderer.render = patchedRender as any;
  // Re-trigger first render
  globe.renderer.render(origRenderScene, origRenderCam);

  // =========================================================================
  // GLOBE ENTRANCE: 3.0–5.0s (after panels dissolve)
  // =========================================================================

  // 3.0s — Canvas appears
  tl.to(globe.canvas, { opacity: 1, duration: 0.5, ease: 'power2.out' }, 3.0);

  // 3.0s — Globe scales in from center
  tl.to(globe.globeGroup.scale, {
    x: 1, y: 1, z: 1,
    duration: 1.5,
    ease: 'back.out(1.2)',
  }, 3.0);

  // 3.2s — Wireframe draws on (opacity ramp)
  const wireframeProxy = { opacity: 0 };
  tl.to(wireframeProxy, {
    opacity: 0.4,
    duration: 1.5,
    ease: 'power2.inOut',
    onUpdate: () => globe.setWireframeOpacity(wireframeProxy.opacity),
  }, 3.2);

  // 3.5s — Dots fade in (land masses appear)
  const dotsProxy = { opacity: 0 };
  tl.to(dotsProxy, {
    opacity: 0.85,
    duration: 1.2,
    ease: 'power2.out',
    onUpdate: () => globe.setDotsOpacity(dotsProxy.opacity),
  }, 3.5);

  // 4.0s — Atmosphere glow pulses on
  const atmoProxy = { opacity: 0 };
  tl.to(atmoProxy, {
    opacity: 1,
    duration: 0.6,
    ease: 'power2.out',
    onUpdate: () => globe.setAtmosphereOpacity(atmoProxy.opacity),
  }, 4.0);
  // Quick pulse
  tl.to(atmoProxy, {
    opacity: 0.5,
    duration: 0.4,
    ease: 'power2.in',
    onUpdate: () => globe.setAtmosphereOpacity(atmoProxy.opacity),
  }, 4.6);
  tl.to(atmoProxy, {
    opacity: 0.8,
    duration: 0.4,
    ease: 'power2.out',
    onUpdate: () => globe.setAtmosphereOpacity(atmoProxy.opacity),
  }, 5.0);

  // 3.5s — Slow rotation begins
  tl.to(globe, { rotationSpeed: 0.002, duration: 2.0, ease: 'power1.inOut' }, 3.5);

  // =========================================================================
  // CITIES LIGHT UP: 5.0–8.0s
  // =========================================================================
  const cityDelay = 0.45; // Stagger between each city
  const startTime = 5.0;

  CITY_ORDER.forEach((name, i) => {
    const t = startTime + i * cityDelay;

    // City dot fades in
    const cityProxy = { opacity: 0 };
    tl.to(cityProxy, {
      opacity: 1,
      duration: 0.3,
      ease: 'power2.out',
      onUpdate: () => globe.setCityOpacity(name, cityProxy.opacity),
    }, t);

    // Pulse ring pop: show → expand → fade → hide
    tl.call(() => globe.showCityPulse(name), [], t);
    const pulse = globe.cityPulses.get(name);
    if (pulse) {
      tl.to(pulse.scale, {
        x: 3, y: 3, z: 3,
        duration: 0.5,
        ease: 'power2.out',
      }, t);
      tl.to(pulse.material, {
        opacity: 0,
        duration: 0.4,
        ease: 'power2.in',
      }, t + 0.15);
    }
    tl.call(() => globe.hideCityPulse(name), [], t + 0.6);

    // City label fades in
    const label = cityLabels.get(name);
    if (label) {
      tl.to(label, { opacity: 1, duration: 0.4, ease: 'power2.out' }, t + 0.15);
    }

    // Activate label tracking after first city appears
    if (i === 0) {
      tl.call(() => { labelsActive = true; }, [], t);
    }
  });

  // Arc lines draw from NYC to each viewer city (staggered with cities)
  const arcCities = CITY_ORDER.filter(n => n !== 'New York');
  arcCities.forEach((name, i) => {
    const t = startTime + (i + 1) * cityDelay; // Match city timing (offset by 1 since NYC is first)

    // Draw the arc progressively
    const arcProxy = { progress: 0, opacity: 0 };
    tl.to(arcProxy, {
      opacity: 0.7,
      duration: 0.2,
      ease: 'power2.out',
      onUpdate: () => globe.setArcOpacity(name, arcProxy.opacity),
    }, t);

    tl.to(arcProxy, {
      progress: 1,
      duration: 0.6,
      ease: 'power2.inOut',
      onUpdate: () => globe.setArcProgress(name, arcProxy.progress),
    }, t);
  });

  // 7.0s — Text overlay fades in
  tl.to(textEl, { opacity: 1, duration: 0.8, ease: 'power2.out' }, 7.0);

  // Pad to 8s
  tl.set({}, {}, 8.0);

  return globe;
}
