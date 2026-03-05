/**
 * Scene 2 — Polished Globe (cobe) + Arc Animations
 *
 * Replaces the cheap wireframe globe with a GitHub-quality cobe globe.
 * City markers and arcs are rendered on an SVG overlay with positions
 * projected to match the cobe globe's rotation.
 *
 * Timeline placement (absolute):
 *   3.0–4.5s   Globe entrance (scale + fade in, rotation begins)
 *   5.0–7.0s   Cities appear sequentially + arcs draw (NYC → 4 cities)
 *   7.0–8.0s   "One room. Five cities. Real-time."
 *   8.0–9.0s   Globe fades/scales out
 *   8.5–10.0s  Panels reappear (all synced) + "All synced." text
 *   10.5s      Pad end
 */

import createGlobe from 'cobe';
import gsap from 'gsap';

// ─── City data ───────────────────────────────────────────────────────────────

interface CityDef {
  lat: number;
  lon: number;
  isHost: boolean;
}

const CITIES: Record<string, CityDef> = {
  'New York':  { lat: 40.7128,  lon: -74.0060, isHost: true },
  'London':    { lat: 51.5074,  lon:  -0.1278, isHost: false },
  'Tokyo':     { lat: 35.6762,  lon: 139.6503, isHost: false },
  'São Paulo': { lat: -23.5505, lon: -46.6333, isHost: false },
  'Sydney':    { lat: -33.8688, lon: 151.2093, isHost: false },
};

const CITY_ORDER = ['New York', 'London', 'Tokyo', 'São Paulo', 'Sydney'];
const ARC_TARGETS = CITY_ORDER.filter(c => c !== 'New York');

// ─── Layout constants ────────────────────────────────────────────────────────

const GLOBE_SIZE = 680;           // CSS px (square canvas)
const DPR = 2;
const RADIUS_RATIO = 0.33;       // Projected sphere radius / canvas size (calibrate to cobe)
const GLOBE_CX = 1920 / 2;       // Center x in 1920×1080 viewport
const GLOBE_CY = 1080 / 2 - 20;  // Center y — slightly above center

// ─── Shared mutable state (tweened by GSAP, read by cobe + overlay) ─────────

const globe = {
  phi: 0.8,     // Y-axis rotation — starts centered on ~46°W (Atlantic view)
  theta: 0.15,  // X-axis tilt — slight top-down
};

// Per-arc draw progress [0..1], tweened by GSAP
const arcProgress: Record<string, number> = {};
ARC_TARGETS.forEach(c => { arcProgress[c] = 0; });

// ─── 3D → 2D projection (matches cobe's coordinate system) ─────────────────

function latLonTo3D(lat: number, lon: number, alt = 1): [number, number, number] {
  const φ = (lat * Math.PI) / 180;
  const λ = (lon * Math.PI) / 180;
  return [
    alt * Math.cos(φ) * Math.sin(λ),
    alt * Math.sin(φ),
    alt * Math.cos(φ) * Math.cos(λ),
  ];
}

/**
 * Rotate a 3D point by the current globe rotation and project
 * to 2D coordinates within the GLOBE_SIZE canvas.
 */
function project(px: number, py: number, pz: number): { x: number; y: number; vis: boolean } {
  const cp = Math.cos(globe.phi),   sp = Math.sin(globe.phi);
  const ct = Math.cos(globe.theta), st = Math.sin(globe.theta);

  // Rotate around Y by phi
  const x1 =  px * cp + pz * sp;
  const y1 =  py;
  const z1 = -px * sp + pz * cp;

  // Rotate around X by theta
  const x2 = x1;
  const y2 = y1 * ct - z1 * st;
  const z2 = y1 * st + z1 * ct;

  const r = GLOBE_SIZE * RADIUS_RATIO;
  return {
    x: GLOBE_SIZE / 2 + x2 * r,
    y: GLOBE_SIZE / 2 - y2 * r,
    vis: z2 > 0.05, // small margin avoids edge-clipping artifacts
  };
}

function projectCity(name: string) {
  const c = CITIES[name];
  const [x, y, z] = latLonTo3D(c.lat, c.lon);
  return project(x, y, z);
}

// ─── Arc path builder (great-circle, raised above surface) ──────────────────

function buildArcPath(
  from: string,
  to: string,
  progress: number,
): { d: string; tipX: number; tipY: number; tipVis: boolean } {
  const c1 = CITIES[from], c2 = CITIES[to];
  const [ax, ay, az] = latLonTo3D(c1.lat, c1.lon);
  const [bx, by, bz] = latLonTo3D(c2.lat, c2.lon);

  const SEGS = 60;
  const endSeg = Math.max(1, Math.ceil(SEGS * progress));

  let d = '';
  let started = false;
  let tipX = 0, tipY = 0, tipVis = false;

  // Pre-compute the dot product & omega for slerp
  const dot = ax * bx + ay * by + az * bz;
  const omega = Math.acos(Math.max(-1, Math.min(1, dot)));
  const sinO = Math.sin(omega);
  const useSlerp = omega > 0.001;

  for (let i = 0; i <= endSeg; i++) {
    const t = i / SEGS;

    // Interpolate on unit sphere (slerp)
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

    // Raise above the surface — parabolic altitude peaking at the midpoint
    const alt = 1.0 + 0.25 * Math.sin(t * Math.PI);
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

export function buildScene2Globe(
  tl: gsap.core.Timeline,
  container: HTMLElement,
): void {

  // ── DOM: wrapper centered in viewport ───────────────────────────────────

  const wrapper = document.createElement('div');
  wrapper.className = 'globe2-wrapper';
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

  // Ambient glow behind the globe
  const globeGlow = document.createElement('div');
  globeGlow.className = 'ambient-glow ambient-glow--calm';
  globeGlow.style.opacity = '0';
  container.appendChild(globeGlow);

  // ── Canvas for cobe ─────────────────────────────────────────────────────

  const canvas = document.createElement('canvas');
  Object.assign(canvas.style, {
    width: `${GLOBE_SIZE}px`,
    height: `${GLOBE_SIZE}px`,
  });
  wrapper.appendChild(canvas);

  // ── SVG overlay (arcs + city markers) ───────────────────────────────────

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

  // Glow filters
  const defs = svgEl('defs');
  defs.innerHTML = `
    <filter id="arc-glow" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="3" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <filter id="dot-glow" x="-100%" y="-100%" width="300%" height="300%">
      <feGaussianBlur stdDeviation="4" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>`;
  svg.appendChild(defs);

  // ── SVG: arc paths + traveling pulses ───────────────────────────────────

  const arcPathEls = new Map<string, SVGPathElement>();
  const arcPulseEls = new Map<string, SVGCircleElement>();

  for (const city of ARC_TARGETS) {
    const path = svgEl('path', {
      fill: 'none',
      stroke: '#3B82F6',
      'stroke-width': '2.5',
      'stroke-linecap': 'round',
      filter: 'url(#arc-glow)',
    });
    path.style.opacity = '0';
    svg.appendChild(path);
    arcPathEls.set(city, path);

    const pulse = svgEl('circle', {
      r: '5',
      fill: '#93C5FD',
      filter: 'url(#arc-glow)',
    });
    pulse.style.opacity = '0';
    svg.appendChild(pulse);
    arcPulseEls.set(city, pulse);
  }

  // ── SVG: city dots + pulse rings ────────────────────────────────────────

  const dotEls = new Map<string, SVGCircleElement>();
  const ringEls = new Map<string, SVGCircleElement>();

  for (const name of CITY_ORDER) {
    const h = CITIES[name].isHost;
    const color = h ? '#FBBF24' : '#3B82F6';

    // Pulse ring (expands & fades on appear)
    const ring = svgEl('circle', {
      r: h ? '14' : '10',
      fill: 'none',
      stroke: color,
      'stroke-width': '1.5',
      filter: 'url(#dot-glow)',
    });
    ring.style.opacity = '0';
    svg.appendChild(ring);
    ringEls.set(name, ring);

    // Core dot
    const dot = svgEl('circle', {
      r: h ? '5' : '3.5',
      fill: color,
      filter: 'url(#dot-glow)',
    });
    dot.style.opacity = '0';
    svg.appendChild(dot);
    dotEls.set(name, dot);
  }

  // ── City labels (HTML) ──────────────────────────────────────────────────

  const labelBox = document.createElement('div');
  Object.assign(labelBox.style, {
    position: 'absolute',
    inset: '0',
    pointerEvents: 'none',
    zIndex: '10',
  });
  wrapper.appendChild(labelBox);

  const labelEls = new Map<string, HTMLElement>();
  for (const name of CITY_ORDER) {
    const h = CITIES[name].isHost;
    const lbl = document.createElement('div');
    lbl.className = `city-label${h ? ' city-label--host' : ''}`;
    lbl.innerHTML = `
      <span class="city-label__dot${h ? ' city-label__dot--host' : ''}"></span>
      <span class="city-label__name">${name}</span>
      ${h ? '<span class="city-label__crown">👑</span>' : ''}`;
    lbl.style.opacity = '0';
    labelBox.appendChild(lbl);
    labelEls.set(name, lbl);
  }

  // ── Text overlays ──────────────────────────────────────────────────────

  function mkText(html: string, top: string): HTMLElement {
    const wrap = document.createElement('div');
    wrap.className = 'center-text';
    wrap.style.top = top;
    wrap.innerHTML = `<div class="center-text__line" style="opacity:0">${html}</div>`;
    container.appendChild(wrap);
    return wrap.querySelector('.center-text__line') as HTMLElement;
  }

  const taglineEl = mkText(
    '<span style="font-size:26px;letter-spacing:2px">One room. Five cities. <span style="color:#3B82F6;font-weight:700">Real-time.</span></span>',
    '82%',
  );

  const syncedEl = mkText(
    '<span style="font-size:32px;font-weight:700;color:#22C55E">✓ All synced.</span>',
    '62%',
  );

  // ── Initialize cobe ────────────────────────────────────────────────────

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _cobeGlobe = createGlobe(canvas, {
    devicePixelRatio: DPR,
    width: GLOBE_SIZE * DPR,
    height: GLOBE_SIZE * DPR,
    phi: globe.phi,
    theta: globe.theta,
    dark: 1,
    diffuse: 1.2,
    mapSamples: 16000,
    mapBrightness: 6,
    baseColor: [0.3, 0.3, 0.3],
    markerColor: [0.1, 0.8, 1],
    glowColor: [0.15, 0.3, 0.8],
    markers: [],
    onRender: (state: Record<string, any>) => {
      state.phi = globe.phi;
      state.theta = globe.theta;
      refreshOverlays();
    },
  });

  // ── Overlay refresh (runs every cobe frame ≈60 fps) ────────────────────

  function refreshOverlays() {
    // --- City dots + rings + labels ---
    for (const name of CITY_ORDER) {
      const dot = dotEls.get(name)!;
      // Only project if GSAP has made the dot visible
      if (parseFloat(dot.style.opacity) <= 0) continue;

      const p = projectCity(name);
      const vis = p.vis ? 'visible' : 'hidden';

      dot.setAttribute('cx', p.x.toFixed(1));
      dot.setAttribute('cy', p.y.toFixed(1));
      dot.style.visibility = vis;

      const ring = ringEls.get(name)!;
      ring.setAttribute('cx', p.x.toFixed(1));
      ring.setAttribute('cy', p.y.toFixed(1));
      ring.style.visibility = vis;

      const lbl = labelEls.get(name)!;
      lbl.style.left = `${p.x}px`;
      lbl.style.top = `${p.y - 24}px`;
      lbl.style.visibility = vis;
    }

    // --- Arc paths + traveling pulses ---
    for (const city of ARC_TARGETS) {
      const progress = arcProgress[city];
      if (progress <= 0) continue;

      const pathEl = arcPathEls.get(city)!;
      const pulseEl = arcPulseEls.get(city)!;

      const arc = buildArcPath('New York', city, progress);
      pathEl.setAttribute('d', arc.d || '');

      // Show traveling pulse at arc tip while drawing
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

  // ── 3.0s — Globe entrance ──────────────────────────────────────────────

  tl.to(globeGlow, { opacity: 0.8, duration: 0.6, ease: 'power2.out' }, 3.0);
  tl.to(wrapper, { opacity: 1, duration: 0.5, ease: 'power2.out' }, 3.0);
  tl.to(wrapper, { scale: 1, duration: 1.5, ease: 'back.out(1.2)' }, 3.0);

  // ── 3.0–8.0s — Slow rotation ──────────────────────────────────────────

  tl.to(globe, { phi: 1.6, duration: 5.0, ease: 'none' }, 3.0);

  // ── 5.0–6.8s — Cities appear sequentially ─────────────────────────────

  const CITY_T0 = 5.0;
  const CITY_GAP = 0.35;

  CITY_ORDER.forEach((name, i) => {
    const t = CITY_T0 + i * CITY_GAP;
    const isHost = CITIES[name].isHost;

    // Dot fades in
    tl.to(dotEls.get(name)!, { opacity: 1, duration: 0.3, ease: 'power2.out' }, t);

    // Pulse ring: flash → expand → fade
    const ring = ringEls.get(name)!;
    tl.to(ring, { opacity: 0.8, duration: 0.05 }, t);
    tl.to(ring, {
      attr: { r: isHost ? 30 : 22 },
      opacity: 0,
      duration: 0.6,
      ease: 'power2.out',
    }, t + 0.05);

    // Label fades in
    tl.to(labelEls.get(name)!, { opacity: 1, duration: 0.4, ease: 'power2.out' }, t + 0.1);
  });

  // ── 5.35–7.0s — Arcs draw from NYC to each city ───────────────────────

  ARC_TARGETS.forEach((city, i) => {
    const t = CITY_T0 + (i + 1) * CITY_GAP;

    // Arc path fades in
    tl.to(arcPathEls.get(city)!, { opacity: 0.8, duration: 0.15 }, t);

    // Traveling pulse appears
    tl.to(arcPulseEls.get(city)!, { opacity: 1, duration: 0.1 }, t);

    // Progressive draw via proxy
    const proxy = { p: 0 };
    tl.fromTo(proxy, { p: 0 }, {
      p: 1,
      duration: 0.7,
      ease: 'power2.inOut',
      onUpdate() { arcProgress[city] = proxy.p; },
    }, t);

    // Pulse fades after arc completes
    tl.to(arcPulseEls.get(city)!, { opacity: 0, duration: 0.3 }, t + 0.6);
  });

  // ── 7.0s — Tagline ────────────────────────────────────────────────────

  tl.to(taglineEl, { opacity: 1, duration: 0.8, ease: 'power2.out' }, 7.0);

  // ── 8.0s — Globe out ──────────────────────────────────────────────────

  tl.to(taglineEl, { opacity: 0, duration: 0.3, ease: 'power2.in' }, 8.0);
  tl.to(globeGlow, { opacity: 0, duration: 0.6, ease: 'power2.inOut' }, 8.0);
  tl.to(wrapper, { scale: 0.5, opacity: 0, duration: 0.8, ease: 'power3.in' }, 8.0);

  // Hide all overlay elements
  CITY_ORDER.forEach(n => {
    tl.to(dotEls.get(n)!, { opacity: 0, duration: 0.3 }, 8.0);
    tl.to(labelEls.get(n)!, { opacity: 0, duration: 0.3 }, 8.0);
  });
  ARC_TARGETS.forEach(c => {
    tl.to(arcPathEls.get(c)!, { opacity: 0, duration: 0.3 }, 8.0);
  });

  // ── 8.5s — Video panels reappear (all synced) ─────────────────────────

  // Reuse the panels created by scene 1 (still in the DOM, just invisible)
  const panels = container.querySelectorAll<HTMLElement>('.video-panel');

  // New calm ambient glow for the return
  const returnGlow = document.createElement('div');
  returnGlow.className = 'ambient-glow ambient-glow--calm';
  returnGlow.style.opacity = '0';
  container.appendChild(returnGlow);

  tl.to(returnGlow, { opacity: 1, duration: 0.6, ease: 'power2.out' }, 8.5);

  panels.forEach((panel, i) => {
    tl.to(panel, {
      opacity: 1,
      scale: 1,
      x: 0,
      y: 0,
      duration: 0.6,
      ease: 'power3.out',
    }, 8.5 + i * 0.06);
  });

  // ── 9.2s — "All synced." ──────────────────────────────────────────────

  tl.to(syncedEl, { opacity: 1, duration: 0.5, ease: 'power2.out' }, 9.2);

  // ── 10.5s — Pad timeline end ──────────────────────────────────────────

  tl.set({}, {}, 10.5);
}
