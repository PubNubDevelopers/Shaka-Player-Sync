/**
 * Three.js Globe — wireframe sphere with dot grid, atmosphere glow,
 * city markers, and arc curves.
 */

import * as THREE from 'three';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const GLOBE_RADIUS = 200;
const ATMOSPHERE_RADIUS = GLOBE_RADIUS * 1.15;
const DOT_COUNT = 3000;

// City coordinates [lat, lon]
export const CITIES: Record<string, { lat: number; lon: number; isHost: boolean }> = {
  'New York': { lat: 40.7128, lon: -74.006, isHost: true },
  'London': { lat: 51.5074, lon: -0.1278, isHost: false },
  'Tokyo': { lat: 35.6762, lon: 139.6503, isHost: false },
  'São Paulo': { lat: -23.5505, lon: -46.6333, isHost: false },
  'Sydney': { lat: -33.8688, lon: 151.2093, isHost: false },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Convert lat/lon (degrees) → 3D position on sphere */
export function latLonToVec3(lat: number, lon: number, radius: number = GLOBE_RADIUS): THREE.Vector3 {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);
  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta),
  );
}

/** Create an arc curve between two lat/lon points, arcing above the surface */
function createArcCurve(
  from: { lat: number; lon: number },
  to: { lat: number; lon: number },
  altitude: number = 1.5,
): THREE.CubicBezierCurve3 {
  const start = latLonToVec3(from.lat, from.lon);
  const end = latLonToVec3(to.lat, to.lon);

  // Midpoint lifted above the surface
  const mid = start.clone().add(end).multiplyScalar(0.5);
  const dist = start.distanceTo(end);
  mid.normalize().multiplyScalar(GLOBE_RADIUS + dist * 0.3 * altitude);

  // Control points
  const ctrl1 = start.clone().lerp(mid, 0.33);
  const ctrl2 = end.clone().lerp(mid, 0.33);

  return new THREE.CubicBezierCurve3(start, ctrl1, ctrl2, end);
}

// ---------------------------------------------------------------------------
// Simplified land mass detection using lat/lon bounding boxes
// This covers major continents — good enough for a "digital globe" dot pattern
// ---------------------------------------------------------------------------
const LAND_BOXES: Array<[number, number, number, number]> = [
  // North America [latMin, latMax, lonMin, lonMax]
  [25, 70, -170, -50],
  [15, 32, -120, -80],  // Mexico/Central America
  // South America
  [-55, 12, -82, -34],
  // Europe
  [35, 72, -12, 45],
  // Africa
  [-35, 37, -18, 52],
  // Asia
  [10, 75, 45, 180],
  [10, 55, 60, 145],
  // Southeast Asia / Indonesia
  [-10, 20, 95, 155],
  // Australia
  [-45, -10, 112, 155],
  // Middle East
  [12, 42, 25, 63],
  // Japan/Korea more precisely
  [30, 46, 128, 146],
  // India
  [8, 35, 68, 90],
  // UK/Iceland/Scandinavia
  [50, 72, -25, 30],
  // Greenland
  [60, 84, -75, -10],
];

function isLand(lat: number, lon: number): boolean {
  for (const [latMin, latMax, lonMin, lonMax] of LAND_BOXES) {
    if (lat >= latMin && lat <= latMax && lon >= lonMin && lon <= lonMax) {
      return true;
    }
  }
  return false;
}

// ---------------------------------------------------------------------------
// Globe class
// ---------------------------------------------------------------------------
export class Globe {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;

  globeGroup: THREE.Group;
  wireframeMesh: THREE.LineSegments;
  dotsMesh: THREE.Points;
  atmosphereMesh: THREE.Mesh;
  citySprites: Map<string, THREE.Mesh> = new Map();
  cityPulses: Map<string, THREE.Mesh> = new Map();
  arcLines: Map<string, THREE.Line> = new Map();
  arcDrawProgress: Map<string, { line: THREE.Line; curve: THREE.CubicBezierCurve3 }> = new Map();

  canvas: HTMLCanvasElement;
  animationId: number = 0;
  rotationSpeed: number = 0;

  constructor(width: number = 1920, height: number = 1080) {
    // Scene
    this.scene = new THREE.Scene();

    // Camera — positioned far enough to see the whole globe with padding
    this.camera = new THREE.PerspectiveCamera(45, width / height, 1, 2000);
    this.camera.position.set(0, 40, 700);
    this.camera.lookAt(0, 0, 0);

    // Renderer
    this.canvas = document.createElement('canvas');
    this.canvas.style.cssText = `
      position: absolute; inset: 0; z-index: 5;
      pointer-events: none; opacity: 0;
    `;
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      alpha: true,
      antialias: true,
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    // Globe group (for rotation)
    this.globeGroup = new THREE.Group();
    // Tilt the globe slightly for a nicer angle
    this.globeGroup.rotation.x = 0.15;
    this.scene.add(this.globeGroup);

    // Build components
    this.wireframeMesh = this.createWireframe();
    this.dotsMesh = this.createDots();
    this.atmosphereMesh = this.createAtmosphere();

    // Initially hide everything
    this.wireframeMesh.visible = false;
    this.dotsMesh.visible = false;
    this.atmosphereMesh.visible = false;

    this.globeGroup.add(this.wireframeMesh);
    this.globeGroup.add(this.dotsMesh);
    this.scene.add(this.atmosphereMesh); // Atmosphere doesn't rotate

    // Ambient light
    const ambient = new THREE.AmbientLight(0xffffff, 0.3);
    this.scene.add(ambient);
  }

  // -------------------------------------------------------------------------
  // Wireframe sphere
  // -------------------------------------------------------------------------
  private createWireframe(): THREE.LineSegments {
    const geo = new THREE.SphereGeometry(GLOBE_RADIUS, 36, 18);
    const wireGeo = new THREE.WireframeGeometry(geo);
    const mat = new THREE.LineBasicMaterial({
      color: 0x334155,
      transparent: true,
      opacity: 0,
    });
    return new THREE.LineSegments(wireGeo, mat);
  }

  // -------------------------------------------------------------------------
  // Dot grid on sphere surface (land masses)
  // -------------------------------------------------------------------------
  private createDots(): THREE.Points {
    const positions: number[] = [];
    const colors: number[] = [];

    // Evenly distribute points on sphere using Fibonacci sphere
    for (let i = 0; i < DOT_COUNT; i++) {
      const y = 1 - (i / (DOT_COUNT - 1)) * 2; // -1 to 1
      const radius = Math.sqrt(1 - y * y);
      const theta = ((Math.PI * (1 + Math.sqrt(5))) * i);

      const x = Math.cos(theta) * radius;
      const z = Math.sin(theta) * radius;

      // Convert to lat/lon to check land
      const lat = Math.asin(y) * (180 / Math.PI);
      const lon = Math.atan2(z, x) * (180 / Math.PI);

      const land = isLand(lat, lon);

      positions.push(
        x * GLOBE_RADIUS,
        y * GLOBE_RADIUS,
        z * GLOBE_RADIUS,
      );

      if (land) {
        // Land dots: brighter blue
        colors.push(0.23, 0.51, 0.96); // ~#3B82F6
      } else {
        // Ocean dots: very dim
        colors.push(0.08, 0.10, 0.16); // ~#141A28
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

    const mat = new THREE.PointsMaterial({
      size: 3,
      vertexColors: true,
      transparent: true,
      opacity: 0,
      sizeAttenuation: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    return new THREE.Points(geo, mat);
  }

  // -------------------------------------------------------------------------
  // Atmosphere glow
  // -------------------------------------------------------------------------
  private createAtmosphere(): THREE.Mesh {
    const geo = new THREE.SphereGeometry(ATMOSPHERE_RADIUS, 48, 24);
    const mat = new THREE.ShaderMaterial({
      vertexShader: `
        varying vec3 vNormal;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec3 vNormal;
        uniform float uOpacity;
        void main() {
          float intensity = pow(0.55 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 3.0);
          intensity = clamp(intensity, 0.0, 1.0);
          vec3 color = mix(vec3(0.23, 0.51, 0.96), vec3(0.55, 0.36, 0.96), 0.3);
          gl_FragColor = vec4(color, intensity * uOpacity * 0.6);
        }
      `,
      uniforms: {
        uOpacity: { value: 0 },
      },
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
      transparent: true,
      depthWrite: false,
    });

    return new THREE.Mesh(geo, mat);
  }

  // -------------------------------------------------------------------------
  // City markers
  // -------------------------------------------------------------------------
  createCityMarker(name: string): void {
    const city = CITIES[name];
    if (!city) return;

    const pos = latLonToVec3(city.lat, city.lon, GLOBE_RADIUS + 2);

    // Glowing sphere
    const geo = new THREE.SphereGeometry(city.isHost ? 5 : 3.5, 16, 16);
    const color = city.isHost ? 0xfbbf24 : 0x3b82f6; // gold or blue
    const mat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(pos);
    mesh.visible = false; // hidden until animated
    this.globeGroup.add(mesh);
    this.citySprites.set(name, mesh);

    // Pulse ring
    const ringGeo = new THREE.RingGeometry(city.isHost ? 6 : 4.5, city.isHost ? 8 : 6, 32);
    const ringMat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.copy(pos);
    ring.lookAt(new THREE.Vector3(0, 0, 0)); // Face outward
    ring.visible = false; // hidden until animated
    this.globeGroup.add(ring);
    this.cityPulses.set(name, ring);
  }

  // -------------------------------------------------------------------------
  // Arc line between NYC and a city
  // -------------------------------------------------------------------------
  createArc(targetCity: string): void {
    const nyc = CITIES['New York'];
    const target = CITIES[targetCity];
    if (!nyc || !target) return;

    const curve = createArcCurve(nyc, target);

    // Use TubeGeometry for visible arcs (WebGL line width is 1px max)
    const tubeGeo = new THREE.TubeGeometry(curve, 64, 1.2, 8, false);
    const color = 0x3b82f6;
    const mat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    const mesh = new THREE.Mesh(tubeGeo, mat);
    mesh.visible = false;
    this.globeGroup.add(mesh);

    // Store as Line type for compatibility — we cast when needed
    this.arcLines.set(targetCity, mesh as unknown as THREE.Line);
    this.arcDrawProgress.set(targetCity, {
      line: mesh as unknown as THREE.Line,
      curve,
    });
  }

  /**
   * Update arc draw range to animate it drawing from 0 → full.
   * progress: 0..1
   */
  setArcProgress(targetCity: string, progress: number): void {
    const entry = this.arcDrawProgress.get(targetCity);
    if (!entry) return;
    // For TubeGeometry: indices-based draw range
    const geo = entry.line.geometry;
    const totalIndices = geo.index ? geo.index.count : 0;
    const count = Math.floor(progress * totalIndices);
    geo.setDrawRange(0, count);
  }

  // -------------------------------------------------------------------------
  // Wireframe draw progress (reveal from angle)
  // -------------------------------------------------------------------------
  setWireframeOpacity(opacity: number): void {
    (this.wireframeMesh.material as THREE.LineBasicMaterial).opacity = opacity;
    this.wireframeMesh.visible = opacity > 0;
  }

  setDotsOpacity(opacity: number): void {
    (this.dotsMesh.material as THREE.PointsMaterial).opacity = opacity;
    this.dotsMesh.visible = opacity > 0;
  }

  setAtmosphereOpacity(opacity: number): void {
    const mat = this.atmosphereMesh.material as THREE.ShaderMaterial;
    mat.uniforms.uOpacity.value = opacity;
    this.atmosphereMesh.visible = opacity > 0;
  }

  setCityOpacity(name: string, opacity: number): void {
    const sprite = this.citySprites.get(name);
    if (sprite) {
      sprite.visible = opacity > 0;
      (sprite.material as THREE.MeshBasicMaterial).opacity = opacity;
    }
    // Pulse ring is controlled separately via showCityPulse / hideCityPulse
  }

  showCityPulse(name: string): void {
    const pulse = this.cityPulses.get(name);
    if (pulse) {
      pulse.visible = true;
      pulse.scale.set(1, 1, 1);
      (pulse.material as THREE.MeshBasicMaterial).opacity = 0.6;
    }
  }

  hideCityPulse(name: string): void {
    const pulse = this.cityPulses.get(name);
    if (pulse) {
      pulse.visible = false;
      (pulse.material as THREE.MeshBasicMaterial).opacity = 0;
    }
  }

  setArcOpacity(targetCity: string, opacity: number): void {
    const obj = this.arcLines.get(targetCity);
    if (obj) {
      obj.visible = opacity > 0;
      (obj.material as THREE.MeshBasicMaterial).opacity = opacity;
    }
  }

  // -------------------------------------------------------------------------
  // Render loop
  // -------------------------------------------------------------------------
  mount(container: HTMLElement): void {
    container.appendChild(this.canvas);
    this.startRenderLoop();
  }

  private startRenderLoop(): void {
    const render = () => {
      this.animationId = requestAnimationFrame(render);
      this.globeGroup.rotation.y += this.rotationSpeed;
      this.renderer.render(this.scene, this.camera);
    };
    render();
  }

  dispose(): void {
    cancelAnimationFrame(this.animationId);
    this.renderer.dispose();
  }
}
