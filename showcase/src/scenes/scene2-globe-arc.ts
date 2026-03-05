/**
 * Scene 2 — Globe appears (zoom-out reveal) + Multi-arc animation
 *
 * The globe is STATIC (no rotation) and oriented to show the Atlantic,
 * so all 5 cities are visible on the front face.
 *
 * Timeline placement (absolute):
 *   2.5–3.5s    Globe entrance (scale up from 0 + fade in)
 *   3.5s        NYC dot + label appears
 *   3.8–5.0s    Arc 1: NYC → London
 *   5.3–6.5s    Arc 2: NYC → Lagos
 *   6.8–8.0s    Arc 3: NYC → São Paulo
 *   8.3–9.5s    Arc 4: NYC → Buenos Aires
 *   10.0s       Pad end
 */

import createGlobe from 'cobe';
import gsap from 'gsap';

// ─── Layout constants ────────────────────────────────────────────────────────

const GLOBE_SIZE = 680;           // CSS px (square canvas)
const DPR = 2;

// Cobe's sphere occupies radius = sqrt(0.64)/2 * viewport = 0.4 of the canvas.
const RADIUS_RATIO = 0.4;

const GLOBE_CX = 1920 / 2;       // Center x in 1920×1080 viewport
const GLOBE_CY = 1080 / 2 - 20;  // Center y — slightly above center

// ─── Fixed globe orientation ─────────────────────────────────────────────────
//
// From cobe's shader, the center of the visible face is at longitude:
//   center_lon = -PI/2 - phi
//
// For mid-Atlantic (~35°W = -0.611 rad):
//   phi = -PI/2 + 0.611 ≈ -0.96

export const GLOBE_PHI = -0.96;
const GLOBE_THETA = 0.15;        // Slight tilt for aesthetics

// Mutable rotation state — scene 3 tweens this to start globe rotation
export const globeRotation = { phi: GLOBE_PHI };

// ─── City data ──────────────────────────────────────────────────────────────
// All cities chosen to be visible from the Atlantic-facing orientation.

interface CityDef {
  name: string;
  lat: number;
  lon: number;
}

const NYC: CityDef          = { name: 'New York',      lat:  40.7128, lon: -74.0060 };
const LONDON: CityDef       = { name: 'London',        lat:  51.5074, lon:  -0.1278 };
const LAGOS: CityDef        = { name: 'Lagos',         lat:   6.5244, lon:   3.3792 };
const SAO_PAULO: CityDef    = { name: 'São Paulo',     lat: -23.5505, lon: -46.6333 };
const BUENOS_AIRES: CityDef = { name: 'Buenos Aires',  lat: -34.6037, lon: -58.3816 };

const ARC_TARGETS = [LONDON, LAGOS, SAO_PAULO, BUENOS_AIRES];

// Per-arc draw progress [0..1], tweened by GSAP
const arcProgress: Record<string, number> = {};
ARC_TARGETS.forEach(c => { arcProgress[c.name] = 0; });

// ─── 3D → 2D projection (derived from cobe's GLSL shader) ───────────────────
//
// Cobe's fragment shader:
//   mat3 J(float theta, float phi) — rotation matrix
//   m = l * J  (view→world, where l is view-space direction)
//
// Inverse (world→view): l = J * m   (because J is orthogonal, J^-1 = J^T,
// and (J^T)^{-1} of the row-vector multiply gives J * m in column form).
//
// Screen mapping: a = l.xy * sqrt(0.64) → screen via viewport transform.
// Effective: screen = center ± l * 0.4 * GLOBE_SIZE.

function latLonTo3D(lat: number, lon: number, alt = 1): [number, number, number] {
  const φ = (lat * Math.PI) / 180;
  const λ = (lon * Math.PI) / 180;
  return [
    alt * Math.cos(φ) * Math.cos(λ),   // x
    alt * Math.sin(φ),                   // y
    -alt * Math.cos(φ) * Math.sin(λ),   // z
  ];
}

/**
 * Project a 3D world point to 2D overlay coordinates.
 *
 * Uses l = J(theta, phi) * m  (the cobe rotation matrix applied to world point).
 *
 * J = | cos(phi)              0           sin(phi)             |
 *     | sin(phi)*sin(theta)   cos(theta)  -cos(phi)*sin(theta) |
 *     | -sin(phi)*cos(theta)  sin(theta)  cos(phi)*cos(theta)  |
 */
function project(px: number, py: number, pz: number): { x: number; y: number; vis: boolean } {
  const cp = Math.cos(GLOBE_PHI),   sp = Math.sin(GLOBE_PHI);
  const ct = Math.cos(GLOBE_THETA), st = Math.sin(GLOBE_THETA);

  const vx =  cp * px                + sp * pz;
  const vy =  sp * st * px + ct * py - cp * st * pz;
  const vz = -sp * ct * px + st * py + cp * ct * pz;

  const r = GLOBE_SIZE * RADIUS_RATIO;
  return {
    x: GLOBE_SIZE / 2 + vx * r,
    y: GLOBE_SIZE / 2 - vy * r,
    vis: vz > 0.05,
  };
}

/** Project a city to 2D coordinates (surface level) */
function projectCity(city: CityDef): { x: number; y: number; vis: boolean } {
  const [cx, cy, cz] = latLonTo3D(city.lat, city.lon);
  return project(cx, cy, cz);
}

// ─── Arc path builder (great-circle, raised above surface) ──────────────────

function buildArcPathBetween(
  from: CityDef,
  to: CityDef,
  progress: number,
): { d: string; tipX: number; tipY: number; tipVis: boolean } {
  const [ax, ay, az] = latLonTo3D(from.lat, from.lon);
  const [bx, by, bz] = latLonTo3D(to.lat, to.lon);

  const SEGS = 60;
  const endSeg = Math.max(1, Math.ceil(SEGS * progress));

  let d = '';
  let started = false;
  let tipX = 0, tipY = 0, tipVis = false;

  const dot = ax * bx + ay * by + az * bz;
  const omega = Math.acos(Math.max(-1, Math.min(1, dot)));
  const sinO = Math.sin(omega);
  const useSlerp = omega > 0.001;

  for (let i = 0; i <= endSeg; i++) {
    const t = i / SEGS;

    let px: number, py: number, pz: number;
    if (!useSlerp) {
      px = (1 - t) * ax + t * bx;
      py = (1 - t) * ay + t * by;
      pz = (1 - t) * az + t * bz;
    } else {
      const sa = Math.sin((1 - t) * omega) / sinO;
      const sb = Math.sin(t * omega) / sinO;
      px = sa * ax + sb * bx;
      py = sa * ay + sb * by;
      pz = sa * az + sb * bz;
    }

    // Raise above the surface — parabolic altitude
    const alt = 1.0 + 0.2 * Math.sin(t * Math.PI);
    const len = Math.sqrt(px * px + py * py + pz * pz);
    px = (px / len) * alt;
    py = (py / len) * alt;
    pz = (pz / len) * alt;

    const p = project(px, py, pz);

    if (!p.vis) {
      started = false;
      continue;
    }

    if (!started) {
      d += `M${p.x.toFixed(1)},${p.y.toFixed(1)}`;
      started = true;
    } else {
      d += `L${p.x.toFixed(1)},${p.y.toFixed(1)}`;
    }

    tipX = p.x;
    tipY = p.y;
    tipVis = p.vis;
  }

  return { d, tipX, tipY, tipVis };
}

// ─── SVG element factory ────────────────────────────────────────────────────

function svgEl<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs: Record<string, string> = {},
): SVGElementTagNameMap[K] {
  const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  return el;
}

// ═════════════════════════════════════════════════════════════════════════════
// MAIN SCENE BUILDER
// ═════════════════════════════════════════════════════════════════════════════

export function buildGlobeArcScene(
  tl: gsap.core.Timeline,
  container: HTMLElement,
): void {

  // ── DOM: wrapper centered in viewport ──────────────────────────────────

  const wrapper = document.createElement('div');
  wrapper.className = 'globe-arc-wrapper';
  Object.assign(wrapper.style, {
    position: 'absolute',
    left: `${GLOBE_CX - GLOBE_SIZE / 2}px`,
    top: `${GLOBE_CY - GLOBE_SIZE / 2}px`,
    width: `${GLOBE_SIZE}px`,
    height: `${GLOBE_SIZE}px`,
    zIndex: '5',
    pointerEvents: 'none',
  });
  container.appendChild(wrapper);

  // ── Canvas for cobe ────────────────────────────────────────────────────

  const canvas = document.createElement('canvas');
  Object.assign(canvas.style, {
    width: `${GLOBE_SIZE}px`,
    height: `${GLOBE_SIZE}px`,
  });
  wrapper.appendChild(canvas);

  // ── SVG overlay (arcs + dots) ──────────────────────────────────────────

  const svg = svgEl('svg', {
    width: String(GLOBE_SIZE),
    height: String(GLOBE_SIZE),
    viewBox: `0 0 ${GLOBE_SIZE} ${GLOBE_SIZE}`,
  });
  Object.assign(svg.style, {
    position: 'absolute',
    inset: '0',
    pointerEvents: 'none',
    overflow: 'visible',
  });
  wrapper.appendChild(svg);

  // Glow filter + landing pulse filter
  const defs = svgEl('defs');
  defs.innerHTML = `
    <filter id="arc-glow2" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="3" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <filter id="landing-glow" x="-200%" y="-200%" width="500%" height="500%">
      <feGaussianBlur stdDeviation="8" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>`;
  svg.appendChild(defs);

  // ── SVG: per-arc paths + traveling dots ────────────────────────────────

  const arcPathEls = new Map<string, SVGPathElement>();
  const arcPulseEls = new Map<string, SVGCircleElement>();

  for (const city of ARC_TARGETS) {
    const path = svgEl('path', {
      fill: 'none',
      stroke: '#007AFF',
      'stroke-width': '3.5',
      'stroke-linecap': 'round',
      filter: 'url(#arc-glow2)',
    });
    path.style.opacity = '0';
    svg.appendChild(path);
    arcPathEls.set(city.name, path);

    const pulse = svgEl('circle', {
      r: '7',
      fill: '#007AFF',
      filter: 'url(#arc-glow2)',
    });
    pulse.style.opacity = '0';
    svg.appendChild(pulse);
    arcPulseEls.set(city.name, pulse);
  }

  // ── SVG: city endpoint dots ────────────────────────────────────────────

  const ALL_CITIES = [NYC, ...ARC_TARGETS];
  const cityDotEls = new Map<string, SVGCircleElement>();

  for (const city of ALL_CITIES) {
    const isOrigin = city === NYC;
    const dot = svgEl('circle', {
      r: isOrigin ? '7' : '6',
      fill: '#007AFF',
    });
    dot.style.opacity = '0';
    svg.appendChild(dot);
    cityDotEls.set(city.name, dot);
  }

  // ── SVG: landing glow rings (expand + fade when arc arrives) ──────────

  const landingGlowEls = new Map<string, SVGCircleElement>();

  for (const city of ARC_TARGETS) {
    const ring = svgEl('circle', {
      r: '6',
      fill: 'none',
      stroke: '#007AFF',
      'stroke-width': '3',
      filter: 'url(#landing-glow)',
    });
    ring.style.opacity = '0';
    svg.appendChild(ring);
    landingGlowEls.set(city.name, ring);
  }

  // ── HTML: city name labels ─────────────────────────────────────────────

  const cityLabelEls = new Map<string, HTMLElement>();

  for (const city of ALL_CITIES) {
    const label = document.createElement('div');
    label.className = 'globe-city-label';
    label.textContent = city.name;
    label.style.opacity = '0';
    wrapper.appendChild(label);
    cityLabelEls.set(city.name, label);
  }

  // ── Initialize cobe ───────────────────────────────────────────────────
  // Also place cobe markers at city positions for pixel-perfect reference.

  // No cobe markers — city positions are shown via SVG overlay dots instead,
  // which allows proper fade-out when scene3 transitions to the player chrome.

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _cobeGlobe = createGlobe(canvas, {
    devicePixelRatio: DPR,
    width: GLOBE_SIZE * DPR,
    height: GLOBE_SIZE * DPR,
    phi: GLOBE_PHI,
    theta: GLOBE_THETA,
    dark: 1,
    diffuse: 1.4,
    mapSamples: 16000,
    mapBrightness: 6,
    baseColor: [0.25, 0.25, 0.3],
    markerColor: [0, 0.48, 1],
    glowColor: [0.92, 0.92, 0.96],
    markers: [],
    onRender: (state: Record<string, any>) => {
      // phi is controlled by globeRotation — scene3 tweens it to start rotation
      state.phi = globeRotation.phi;
      state.theta = GLOBE_THETA;
      refreshOverlays();
    },
  });

  // ── Overlay refresh (runs every cobe frame ≈60 fps) ───────────────────

  function refreshOverlays() {
    // --- City dots + labels + landing glows ---
    for (const city of ALL_CITIES) {
      const dotEl = cityDotEls.get(city.name)!;
      const labelEl = cityLabelEls.get(city.name)!;
      const p = projectCity(city);

      // Update dot position
      dotEl.setAttribute('cx', p.x.toFixed(1));
      dotEl.setAttribute('cy', p.y.toFixed(1));
      dotEl.style.visibility = p.vis && parseFloat(dotEl.style.opacity) > 0 ? 'visible' : 'hidden';

      // Update label position (offset below the dot)
      labelEl.style.left = `${p.x}px`;
      labelEl.style.top = `${p.y + 16}px`;
      labelEl.style.visibility = p.vis && parseFloat(labelEl.style.opacity) > 0 ? 'visible' : 'hidden';

      // Update landing glow position (for destination cities)
      const glowEl = landingGlowEls.get(city.name);
      if (glowEl) {
        glowEl.setAttribute('cx', p.x.toFixed(1));
        glowEl.setAttribute('cy', p.y.toFixed(1));
        glowEl.style.visibility = p.vis ? 'visible' : 'hidden';
      }
    }

    // --- Arc paths + traveling pulses ---
    for (const city of ARC_TARGETS) {
      const progress = arcProgress[city.name];
      if (progress <= 0) continue;

      const pathEl = arcPathEls.get(city.name)!;
      const pulseEl = arcPulseEls.get(city.name)!;

      const arc = buildArcPathBetween(NYC, city, progress);
      pathEl.setAttribute('d', arc.d || '');

      if (arc.tipVis && progress > 0.02 && progress < 0.95) {
        pulseEl.setAttribute('cx', arc.tipX.toFixed(1));
        pulseEl.setAttribute('cy', arc.tipY.toFixed(1));
        pulseEl.style.visibility = 'visible';
      } else {
        pulseEl.style.visibility = 'hidden';
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // GSAP TIMELINE
  // ═══════════════════════════════════════════════════════════════════════════

  gsap.set(wrapper, { scale: 0, opacity: 0, transformOrigin: '50% 50%' });

  // ── 2.5s — Globe entrance (overlaps with dot shrinking) ───────────────

  tl.to(wrapper, { opacity: 1, duration: 0.5, ease: 'power2.out' }, 2.5);
  tl.to(wrapper, { scale: 1, duration: 1.2, ease: 'back.out(1.0)' }, 2.5);

  // ── 3.5s — NYC (origin) dot + label appears ───────────────────────────

  tl.to(cityDotEls.get(NYC.name)!, { opacity: 1, duration: 0.3, ease: 'power2.out' }, 3.5);
  tl.to(cityLabelEls.get(NYC.name)!, { opacity: 1, duration: 0.3, ease: 'power2.out' }, 3.5);

  // ── Sequential arcs: NYC → each city ──────────────────────────────────

  const ARC_GAP = 1.5;   // Time between each arc start
  const ARC_DUR = 1.2;   // Duration of each arc draw

  ARC_TARGETS.forEach((city, i) => {
    const t = 3.8 + i * ARC_GAP;

    // Arc path fades in
    tl.to(arcPathEls.get(city.name)!, { opacity: 0.9, duration: 0.15 }, t);

    // Traveling pulse appears
    tl.to(arcPulseEls.get(city.name)!, { opacity: 1, duration: 0.1 }, t);

    // Progressive draw via proxy
    const proxy = { p: 0 };
    tl.fromTo(proxy, { p: 0 }, {
      p: 1,
      duration: ARC_DUR,
      ease: 'power2.inOut',
      onUpdate() { arcProgress[city.name] = proxy.p; },
    }, t);

    // City endpoint dot + label appears when arc arrives
    tl.to(cityDotEls.get(city.name)!, {
      opacity: 1,
      duration: 0.3,
      ease: 'power2.out',
    }, t + ARC_DUR - 0.2);

    tl.to(cityLabelEls.get(city.name)!, {
      opacity: 1,
      duration: 0.4,
      ease: 'power2.out',
    }, t + ARC_DUR - 0.15);

    // Traveling pulse fades after arc completes
    tl.to(arcPulseEls.get(city.name)!, { opacity: 0, duration: 0.3 }, t + ARC_DUR - 0.1);

    // ── Landing glow effect: ring expands + fades ──────────────────────

    const glowEl = landingGlowEls.get(city.name)!;
    const landT = t + ARC_DUR - 0.05;

    // Pop in
    tl.fromTo(glowEl,
      { attr: { r: 6 } },
      { attr: { r: 6 }, duration: 0.01 },
      landT,
    );
    tl.to(glowEl, { opacity: 0.8, duration: 0.05 }, landT);

    // Expand outward
    tl.to(glowEl, {
      attr: { r: 35 },
      duration: 0.6,
      ease: 'power2.out',
    }, landT);

    // Fade the glow ring out
    tl.to(glowEl, {
      opacity: 0,
      duration: 0.4,
      ease: 'power2.in',
    }, landT + 0.25);

    // ── Arc + destination fade out while still sending ─────────────────
    // Start fading the arc line midway through the draw so it dissolves
    // as the message travels, and clear the destination shortly after.

    const fadeMid = t + ARC_DUR * 0.4;   // Begin fade at 40% of the draw
    const fadeDur = ARC_DUR * 0.8;        // Fade lasts through the rest + a bit

    // Fade the arc line while it's still drawing
    tl.to(arcPathEls.get(city.name)!, {
      opacity: 0,
      duration: fadeDur,
      ease: 'power1.in',
    }, fadeMid);

    // Fade the destination dot shortly after landing
    tl.to(cityDotEls.get(city.name)!, {
      opacity: 0,
      duration: 0.4,
      ease: 'power2.in',
    }, t + ARC_DUR + 0.1);

    // Fade the destination label alongside the dot
    tl.to(cityLabelEls.get(city.name)!, {
      opacity: 0,
      duration: 0.4,
      ease: 'power2.in',
    }, t + ARC_DUR + 0.1);
  });

  // ── Pad end ───────────────────────────────────────────────────────────

  const lastArcEnd = 3.8 + (ARC_TARGETS.length - 1) * ARC_GAP + ARC_DUR + 0.5;
  tl.set({}, {}, lastArcEnd);
}
