import React, { useEffect, useRef } from 'react';

interface Point3D {
  x: number;
  y: number;
  z: number;
}

interface Edge3D {
  p1: number;
  p2: number;
  type?: 'hull' | 'wing' | 'tail' | 'engine' | 'rib' | 'cockpit';
}

// Construct the 3D Space Shuttle Orbiter CAD Wireframe Model
function buildShuttleModel() {
  const vertices: Point3D[] = [];
  const edges: Edge3D[] = [];

  const addVertex = (p: Point3D): number => {
    vertices.push(p);
    return vertices.length - 1;
  };

  const addEdge = (p1: number, p2: number, type: Edge3D['type'] = 'hull') => {
    edges.push({ p1, p2, type });
  };

  // 1. Nose Tip & Cap
  const noseTip = addVertex({ x: 0, y: 1, z: 80 });

  // Nose cap ring at Z = 68
  const noseRing: number[] = [];
  const nSeg = 8;
  for (let i = 0; i < nSeg; i++) {
    const theta = (i / nSeg) * Math.PI * 2;
    noseRing.push(
      addVertex({
        x: Math.sin(theta) * 7,
        y: Math.cos(theta) * 5.5 + 1,
        z: 68,
      })
    );
  }
  for (let i = 0; i < nSeg; i++) {
    addEdge(noseTip, noseRing[i], 'cockpit');
    addEdge(noseRing[i], noseRing[(i + 1) % nSeg], 'cockpit');
  }

  // 2. Cockpit / Forward Cabin Section (Z = 52)
  const cabinTop = addVertex({ x: 0, y: 15, z: 50 });
  const cabinLeft = addVertex({ x: -11, y: 12, z: 48 });
  const cabinRight = addVertex({ x: 11, y: 12, z: 48 });
  const cabinCenterChine = addVertex({ x: 0, y: 5, z: 62 });
  const cabinFloorLeft = addVertex({ x: -14, y: -4, z: 50 });
  const cabinFloorRight = addVertex({ x: 14, y: -4, z: 50 });

  addEdge(cabinTop, cabinLeft, 'cockpit');
  addEdge(cabinTop, cabinRight, 'cockpit');
  addEdge(cabinLeft, cabinCenterChine, 'cockpit');
  addEdge(cabinRight, cabinCenterChine, 'cockpit');
  addEdge(cabinTop, cabinCenterChine, 'cockpit');
  addEdge(cabinLeft, cabinFloorLeft, 'cockpit');
  addEdge(cabinRight, cabinFloorRight, 'cockpit');
  addEdge(cabinFloorLeft, cabinFloorRight, 'cockpit');

  // Connect nose ring to cabin
  addEdge(noseRing[0], cabinCenterChine, 'cockpit');
  addEdge(noseRing[2], cabinRight, 'cockpit');
  addEdge(noseRing[6], cabinLeft, 'cockpit');
  addEdge(noseRing[4], cabinFloorLeft, 'cockpit');
  addEdge(noseRing[4], cabinFloorRight, 'cockpit');

  // 3. Fuselage Bulkheads & Payload Bay
  const stations = [
    { z: 32, w: 17, h: 14, yOff: 3 },
    { z: 12, w: 18, h: 15, yOff: 3 },
    { z: -8, w: 18, h: 15, yOff: 3 },
    { z: -28, w: 18, h: 15, yOff: 3 },
    { z: -48, w: 17, h: 14, yOff: 3 },
  ];

  const bulkheadRings: number[][] = [];
  stations.forEach((st) => {
    const ring: number[] = [];
    const bSeg = 8;
    for (let i = 0; i < bSeg; i++) {
      const theta = (i / bSeg) * Math.PI * 2;
      ring.push(
        addVertex({
          x: Math.sin(theta) * st.w,
          y: Math.cos(theta) * st.h + st.yOff,
          z: st.z,
        })
      );
    }
    // Ring circumference
    for (let i = 0; i < bSeg; i++) {
      addEdge(ring[i], ring[(i + 1) % bSeg], 'rib');
    }
    bulkheadRings.push(ring);
  });

  // Longitudinal stringers connecting bulkheads
  // Connect cabin to first bulkhead
  addEdge(cabinTop, bulkheadRings[0][0], 'hull');
  addEdge(cabinRight, bulkheadRings[0][2], 'hull');
  addEdge(cabinLeft, bulkheadRings[0][6], 'hull');
  addEdge(cabinFloorRight, bulkheadRings[0][3], 'hull');
  addEdge(cabinFloorLeft, bulkheadRings[0][5], 'hull');

  // Connect bulkheads together
  for (let s = 0; s < bulkheadRings.length - 1; s++) {
    const r1 = bulkheadRings[s];
    const r2 = bulkheadRings[s + 1];
    for (let i = 0; i < 8; i++) {
      const type = i === 0 || i === 4 ? 'hull' : 'rib';
      addEdge(r1[i], r2[i], type);
    }
  }

  // Payload bay split doors centerline & hinges
  for (let s = 0; s < bulkheadRings.length; s++) {
    const spineV = bulkheadRings[s][0];
    const leftDoor = addVertex({
      x: -6,
      y: stations[s].h + stations[s].yOff - 1,
      z: stations[s].z,
    });
    const rightDoor = addVertex({
      x: 6,
      y: stations[s].h + stations[s].yOff - 1,
      z: stations[s].z,
    });
    addEdge(spineV, leftDoor, 'rib');
    addEdge(spineV, rightDoor, 'rib');
  }

  // 4. Swept Delta Wings (Double Delta Profile)
  // Left Wing
  const leftStrakeRoot = addVertex({ x: -17, y: 0, z: 24 });
  const leftStrakeMid = addVertex({ x: -28, y: -1, z: 4 });
  const leftWingTipFront = addVertex({ x: -66, y: -2, z: -32 });
  const leftWingTipBack = addVertex({ x: -66, y: -3, z: -46 });
  const leftElevonOuter = addVertex({ x: -44, y: -3, z: -48 });
  const leftElevonInner = addVertex({ x: -18, y: -3, z: -48 });

  addEdge(leftStrakeRoot, leftStrakeMid, 'wing');
  addEdge(leftStrakeMid, leftWingTipFront, 'wing');
  addEdge(leftWingTipFront, leftWingTipBack, 'wing');
  addEdge(leftWingTipBack, leftElevonOuter, 'wing');
  addEdge(leftElevonOuter, leftElevonInner, 'wing');
  addEdge(leftElevonInner, leftStrakeRoot, 'wing');

  // Left wing elevon flap line & internal wing ribs
  const leftWingRib1 = addVertex({ x: -45, y: -2, z: -18 });
  addEdge(leftStrakeMid, leftWingRib1, 'rib');
  addEdge(leftWingRib1, leftElevonOuter, 'rib');

  // Right Wing (Symmetrical)
  const rightStrakeRoot = addVertex({ x: 17, y: 0, z: 24 });
  const rightStrakeMid = addVertex({ x: 28, y: -1, z: 4 });
  const rightWingTipFront = addVertex({ x: 66, y: -2, z: -32 });
  const rightWingTipBack = addVertex({ x: 66, y: -3, z: -46 });
  const rightElevonOuter = addVertex({ x: 44, y: -3, z: -48 });
  const rightElevonInner = addVertex({ x: 18, y: -3, z: -48 });

  addEdge(rightStrakeRoot, rightStrakeMid, 'wing');
  addEdge(rightStrakeMid, rightWingTipFront, 'wing');
  addEdge(rightWingTipFront, rightWingTipBack, 'wing');
  addEdge(rightWingTipBack, rightElevonOuter, 'wing');
  addEdge(rightElevonOuter, rightElevonInner, 'wing');
  addEdge(rightElevonInner, rightStrakeRoot, 'wing');

  // Right wing internal rib
  const rightWingRib1 = addVertex({ x: 45, y: -2, z: -18 });
  addEdge(rightStrakeMid, rightWingRib1, 'rib');
  addEdge(rightWingRib1, rightElevonOuter, 'rib');

  // Connect wings to fuselage
  addEdge(leftStrakeRoot, bulkheadRings[1][6], 'wing');
  addEdge(leftElevonInner, bulkheadRings[4][6], 'wing');
  addEdge(rightStrakeRoot, bulkheadRings[1][2], 'wing');
  addEdge(rightElevonInner, bulkheadRings[4][2], 'wing');

  // 5. Vertical Stabilizer (Tail Fin)
  const tailRootFront = addVertex({ x: 0, y: 17, z: -8 });
  const tailTipFront = addVertex({ x: 0, y: 52, z: -38 });
  const tailTipBack = addVertex({ x: 0, y: 50, z: -48 });
  const tailRootBack = addVertex({ x: 0, y: 17, z: -48 });
  const rudderSplitTop = addVertex({ x: 0, y: 46, z: -45 });
  const rudderSplitBot = addVertex({ x: 0, y: 17, z: -46 });

  addEdge(tailRootFront, tailTipFront, 'tail');
  addEdge(tailTipFront, tailTipBack, 'tail');
  addEdge(tailTipBack, tailRootBack, 'tail');
  addEdge(tailRootBack, tailRootFront, 'tail');
  addEdge(rudderSplitTop, rudderSplitBot, 'tail');

  // Tail fin lateral aerofoil depth (twin fin skin lines)
  const tailFinL = addVertex({ x: -2, y: 34, z: -26 });
  const tailFinR = addVertex({ x: 2, y: 34, z: -26 });
  addEdge(tailFinL, tailTipFront, 'rib');
  addEdge(tailFinR, tailTipFront, 'rib');
  addEdge(tailFinL, tailRootFront, 'rib');
  addEdge(tailFinR, tailRootFront, 'rib');

  // 6. OMS Pods (Orbital Maneuvering System on aft shoulders)
  const omsLeftFront = addVertex({ x: -14, y: 12, z: -24 });
  const omsLeftBack = addVertex({ x: -16, y: 11, z: -48 });
  const omsLeftBulge = addVertex({ x: -19, y: 13, z: -36 });
  addEdge(omsLeftFront, omsLeftBulge, 'hull');
  addEdge(omsLeftBulge, omsLeftBack, 'hull');
  addEdge(omsLeftBack, omsLeftFront, 'hull');

  const omsRightFront = addVertex({ x: 14, y: 12, z: -24 });
  const omsRightBack = addVertex({ x: 16, y: 11, z: -48 });
  const omsRightBulge = addVertex({ x: 19, y: 13, z: -36 });
  addEdge(omsRightFront, omsRightBulge, 'hull');
  addEdge(omsRightBulge, omsRightBack, 'hull');
  addEdge(omsRightBack, omsRightFront, 'hull');

  // 7. SSME (Space Shuttle Main Engines) - 3 Nozzles arranged in triangle at aft
  const engineCenters: number[] = [];
  const createEngineBell = (cx: number, cy: number, cz: number, r: number) => {
    const centerRoot = addVertex({ x: cx, y: cy, z: cz });
    engineCenters.push(centerRoot);
    const nozzleSegs: number[] = [];
    const nPts = 6;
    for (let i = 0; i < nPts; i++) {
      const theta = (i / nPts) * Math.PI * 2;
      nozzleSegs.push(
        addVertex({
          x: cx + Math.sin(theta) * r,
          y: cy + Math.cos(theta) * r,
          z: cz - 11,
        })
      );
    }
    for (let i = 0; i < nPts; i++) {
      addEdge(nozzleSegs[i], nozzleSegs[(i + 1) % nPts], 'engine');
      addEdge(centerRoot, nozzleSegs[i], 'engine');
    }
  };

  // Top Engine
  createEngineBell(0, 9, -48, 5.5);
  // Bottom Left Engine
  createEngineBell(-8, -1, -48, 5.2);
  // Bottom Right Engine
  createEngineBell(8, -1, -48, 5.2);

  // Shuttle hull boundary polygons for dark silhouette occlusion (stars pass behind, never through)
  const fuselageBoundary = [
    noseTip,
    cabinRight,
    bulkheadRings[0][2],
    bulkheadRings[1][2],
    bulkheadRings[2][2],
    bulkheadRings[3][2],
    bulkheadRings[4][2],
    bulkheadRings[4][6],
    bulkheadRings[3][6],
    bulkheadRings[2][6],
    bulkheadRings[1][6],
    bulkheadRings[0][6],
    cabinLeft,
  ];

  const leftWingBoundary = [
    leftStrakeRoot,
    leftStrakeMid,
    leftWingTipFront,
    leftWingTipBack,
    leftElevonOuter,
    leftElevonInner,
  ];

  const rightWingBoundary = [
    rightStrakeRoot,
    rightStrakeMid,
    rightWingTipFront,
    rightWingTipBack,
    rightElevonOuter,
    rightElevonInner,
  ];

  const tailBoundary = [
    tailRootFront,
    tailTipFront,
    tailTipBack,
    tailRootBack,
  ];

  return {
    vertices,
    edges,
    engineCenters,
    silhouettes: [fuselageBoundary, leftWingBoundary, rightWingBoundary, tailBoundary],
  };
}

interface Star {
  x: number;
  y: number;
  radius: number;
  baseAlpha: number;
  currentAlpha: number;
  twinkleSpeed: number;
  phase: number;
  vx: number;
  vy: number;
  hasGlow: boolean;
}

function initStars(w: number, h: number): Star[] {
  const count = Math.max(160, Math.floor((w * h) / 8500));
  const stars: Star[] = [];
  for (let i = 0; i < count; i++) {
    const depth = Math.random();
    const baseRadius = depth < 0.65 ? 0.6 + Math.random() * 0.5 : depth < 0.9 ? 1.1 + Math.random() * 0.4 : 1.6 + Math.random() * 0.6;
    const radius = Number((baseRadius * 1.25).toFixed(2));
    const baseAlpha = Math.min(1.0, (0.35 + Math.random() * 0.5) * 1.25);
    const twinkleSpeed = 0.018 + Math.random() * 0.038;
    const phase = Math.random() * Math.PI * 2;
    const speed = (0.08 + radius * 0.06) * 1.5;
    const vx = speed * (0.8 + Math.random() * 0.4);
    const vy = -speed * (0.3 + Math.random() * 0.3);

    stars.push({
      x: Math.random() * w,
      y: Math.random() * h,
      radius,
      baseAlpha,
      currentAlpha: baseAlpha,
      twinkleSpeed,
      phase,
      vx,
      vy,
      hasGlow: radius > 1.4,
    });
  }
  return stars;
}

// Configurable flight parameters
const FLIGHT_DURATION_MS = 6800; // Smooth orbital period
const SHUTTLE_SIZE_SCALE = 1.45; // Well-proportioned orbiter scale

export const CubeSpinner: React.FC<{ onCancel?: () => void }> = ({ onCancel }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // 3D Space Shuttle Flight Canvas Renderer
  useEffect(() => {
    if (typeof navigator !== 'undefined' && /jsdom/i.test(navigator.userAgent)) {
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;

    let ctx: CanvasRenderingContext2D | null = null;
    try {
      ctx = canvas.getContext('2d');
    } catch {
      return;
    }
    if (!ctx) return;

    const { vertices, edges, engineCenters, silhouettes } = buildShuttleModel();

    let animationFrameId: number;
    let stars: Star[] = [];
    let lastTime = performance.now();

    const render = () => {
      const time = performance.now();
      const dt = Math.min((time - lastTime) / 16.666, 2.0);
      lastTime = time;

      // Loop progress from 0 to 1
      const progress = (time % FLIGHT_DURATION_MS) / FLIGHT_DURATION_MS;

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const width = window.innerWidth || canvas.clientWidth || 1920;
      const height = window.innerHeight || canvas.clientHeight || 1080;

      if (canvas.width !== Math.floor(width * dpr) || canvas.height !== Math.floor(height * dpr)) {
        canvas.width = Math.floor(width * dpr);
        canvas.height = Math.floor(height * dpr);
        stars = initStars(width, height);
      }

      if (stars.length === 0) {
        stars = initStars(width, height);
      }

      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, width, height);

      // 1. Draw Moving Background Stars (matches slide 3 starfield)
      for (let i = 0; i < stars.length; i++) {
        const star = stars[i];

        // Animate drifting position
        star.x += star.vx * dt;
        star.y += star.vy * dt;

        // Wrap around borders seamlessly
        if (star.x > width + 15) {
          star.x = -15;
          star.y = Math.random() * height;
        } else if (star.x < -15) {
          star.x = width + 15;
        }

        if (star.y < -15) {
          star.y = height + 15;
          star.x = Math.random() * width;
        } else if (star.y > height + 15) {
          star.y = -15;
        }

        // Animate twinkle
        star.phase += star.twinkleSpeed * dt;
        const twinkleFactor = Math.sin(star.phase);
        star.currentAlpha = Math.max(0.2, Math.min(1.0, star.baseAlpha + twinkleFactor * 0.35));

        ctx.beginPath();
        ctx.arc(star.x, star.y, star.radius, 0, Math.PI * 2);

        if (star.hasGlow) {
          ctx.shadowBlur = 4 * star.radius;
          ctx.shadowColor = `rgba(255, 255, 255, ${star.currentAlpha})`;
          ctx.fillStyle = `rgba(255, 255, 255, ${star.currentAlpha})`;
        } else {
          ctx.shadowBlur = 0;
          ctx.fillStyle = `rgba(255, 255, 255, ${star.currentAlpha})`;
        }

        ctx.fill();
      }
      ctx.shadowBlur = 0;

      // Circular Orbital Trajectory around the center text
      const centerX = width / 2;
      const centerY = height / 2;
      const radiusX = Math.max(260, Math.min(width * 0.36, 420));
      const radiusY = Math.max(180, Math.min(height * 0.28, 260));

      const angle = progress * Math.PI * 2; // Orbit angle around the center

      // Current shuttle flight center coordinates
      const cx = centerX + Math.cos(angle) * radiusX;
      const cy = centerY + Math.sin(angle) * radiusY;

      // Orbit tangent velocity in screen coords (screen Y is down)
      const vx = -Math.sin(angle) * radiusX;
      const vy = Math.cos(angle) * radiusY;

      // 3D Forward direction vector F (nose points in flight direction)
      let Fx = vx;
      let Fy = -vy; // 3D Y is up
      let Fz = -Math.sin(angle) * 35; // Subtle 3D orbital inclination
      const lenF = Math.hypot(Fx, Fy, Fz) || 1;
      Fx /= lenF;
      Fy /= lenF;
      Fz /= lenF;

      // Inward direction vector pointing toward center of orbit
      const inX = centerX - cx;
      const inY = -(centerY - cy);
      const lenIn = Math.hypot(inX, inY) || 1;
      const Ix = inX / lenIn;
      const Iy = inY / lenIn;

      // Up vector U with inward banking (~32° bank towards center)
      const bankAngle = 0.55;
      let Ux = Ix * Math.sin(bankAngle);
      let Uy = Iy * Math.sin(bankAngle);
      let Uz = Math.cos(bankAngle);

      // Orthogonalize U against F (Gram-Schmidt)
      const dotUF = Ux * Fx + Uy * Fy + Uz * Fz;
      Ux -= dotUF * Fx;
      Uy -= dotUF * Fy;
      Uz -= dotUF * Fz;
      const lenU = Math.hypot(Ux, Uy, Uz) || 1;
      Ux /= lenU;
      Uy /= lenU;
      Uz /= lenU;

      // Right vector R = F x U
      let Rx = Fy * Uz - Fz * Uy;
      let Ry = Fz * Ux - Fx * Uz;
      let Rz = Fx * Uy - Fy * Ux;
      const lenR = Math.hypot(Rx, Ry, Rz) || 1;
      Rx /= lenR;
      Ry /= lenR;
      Rz /= lenR;

      const fov = 340;
      const camDist = 200;

      // 3D to 2D projection centered at (cx, cy)
      const project = (p: Point3D) => {
        const transX = Rx * p.x + Ux * p.y + Fx * p.z;
        const transY = Ry * p.x + Uy * p.y + Fy * p.z;
        const transZ = Rz * p.x + Uz * p.y + Fz * p.z;

        const scale = (fov / (fov + transZ + camDist)) * SHUTTLE_SIZE_SCALE;
        return {
          x: cx + transX * scale,
          y: cy - transY * scale,
          z: transZ,
          origZ: p.z,
          scale,
        };
      };

      // Project all vertices
      const projected = vertices.map(project);

      // 2. Dark Occlusion Silhouette (ensures stars stay behind and NEVER overlap or shine through the shuttle)
      ctx.fillStyle = '#09090b';
      silhouettes.forEach((poly) => {
        if (!poly.length) return;
        ctx.beginPath();
        const first = projected[poly[0]];
        if (!first) return;
        ctx.moveTo(first.x, first.y);
        for (let i = 1; i < poly.length; i++) {
          const pt = projected[poly[i]];
          if (pt) ctx.lineTo(pt.x, pt.y);
        }
        ctx.closePath();
        ctx.fill();
      });

      // 1. Render SSME Engine Exhaust Thrust Plumes (trailing behind engines along orbit tangent)
      engineCenters.forEach((engineIdx, i) => {
        const eng = projected[engineIdx];
        if (!eng) return;

        const plumeLength = (36 + 12 * Math.sin(time * 0.025 + i * 1.5)) * (eng.scale / SHUTTLE_SIZE_SCALE);
        // Direction vector trailing opposite to flight heading (behind the engine)
        const plumeEndX = eng.x - Fx * plumeLength;
        const plumeEndY = eng.y - (-Fy) * plumeLength;

        ctx.beginPath();
        ctx.moveTo(eng.x, eng.y);
        ctx.lineTo(plumeEndX, plumeEndY);
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.75)';
        ctx.lineWidth = 3.2 * (eng.scale / SHUTTLE_SIZE_SCALE);
        ctx.shadowColor = 'rgba(56, 189, 248, 0.9)';
        ctx.shadowBlur = 10;
        ctx.stroke();

        // Inner white-hot core
        ctx.beginPath();
        ctx.moveTo(eng.x, eng.y);
        ctx.lineTo(eng.x - Fx * plumeLength * 0.45, eng.y - (-Fy) * plumeLength * 0.45);
        ctx.strokeStyle = 'rgba(240, 249, 255, 0.9)';
        ctx.lineWidth = 1.6 * (eng.scale / SHUTTLE_SIZE_SCALE);
        ctx.stroke();

        ctx.shadowBlur = 0;
      });

      // 2. Diagnostic Scanning Wave sweeping along the hull
      const scanCycle = (time % 2800) / 2800;
      const scanZ = 80 - scanCycle * 140;

      // 3. Render 3D Wireframe Edges
      edges.forEach((edge) => {
        const p1 = projected[edge.p1];
        const p2 = projected[edge.p2];

        const midZ = (p1.origZ + p2.origZ) / 2;
        const distFromScan = Math.abs(midZ - scanZ);
        const isScanning = distFromScan < 16;

        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);

        if (isScanning) {
          const scanIntensity = 1 - distFromScan / 16;
          ctx.strokeStyle = `rgba(224, 242, 254, ${0.75 + scanIntensity * 0.25})`;
          ctx.lineWidth = 2.2;
          ctx.shadowColor = 'rgba(56, 189, 248, 0.95)';
          ctx.shadowBlur = 10;
        } else if (edge.type === 'wing' || edge.type === 'tail' || edge.type === 'hull') {
          ctx.strokeStyle = 'rgba(56, 189, 248, 0.8)';
          ctx.lineWidth = 1.8;
          ctx.shadowColor = 'rgba(56, 189, 248, 0.4)';
          ctx.shadowBlur = 5;
        } else if (edge.type === 'cockpit') {
          ctx.strokeStyle = 'rgba(125, 211, 252, 0.9)';
          ctx.lineWidth = 1.9;
          ctx.shadowColor = 'rgba(56, 189, 248, 0.5)';
          ctx.shadowBlur = 5;
        } else if (edge.type === 'engine') {
          const pulse = (Math.sin(time * 0.008) + 1) / 2;
          ctx.strokeStyle = `rgba(56, 189, 248, ${0.7 + pulse * 0.3})`;
          ctx.lineWidth = 1.7;
          ctx.shadowColor = 'rgba(56, 189, 248, 0.75)';
          ctx.shadowBlur = 8;
        } else {
          ctx.strokeStyle = 'rgba(56, 189, 248, 0.35)';
          ctx.lineWidth = 1.2;
          ctx.shadowBlur = 0;
        }

        ctx.stroke();
        ctx.shadowBlur = 0;
      });

      // 4. Glowing Accent Nodes on key structure points
      const keyNodes = [
        0, // Nose tip
        projected.length - 1,
        projected.length - 7,
        projected.length - 13,
      ];
      keyNodes.forEach((nodeIdx) => {
        if (!projected[nodeIdx]) return;
        const pt = projected[nodeIdx];
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 2.4 * (pt.scale / SHUTTLE_SIZE_SCALE), 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(224, 242, 254, 0.95)';
        ctx.shadowColor = 'rgba(56, 189, 248, 0.85)';
        ctx.shadowBlur = 8;
        ctx.fill();
        ctx.shadowBlur = 0;
      });

      ctx.restore();

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <div className="fixed inset-0 w-screen h-screen select-none overflow-hidden bg-[#09090b]">
      <style>
        {`
          @keyframes ellipsis {
            0% { content: ''; }
            25% { content: '.'; }
            50% { content: '..'; }
            75% { content: '...'; }
          }
          .animated-dots::after {
            content: '';
            animation: ellipsis 1.5s infinite steps(1, end);
            display: inline-block;
            width: 1.5em;
            text-align: left;
          }
        `}
      </style>
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-10 text-center px-4">
        <h2 className="text-foreground font-headline-lg text-headline-lg">
          Extracting core assumptions<span className="animated-dots"></span>
        </h2>
        <p className="text-muted-foreground mt-3 font-code-lg text-code-lg animate-pulse">
          Deconstructing decision framework
        </p>
        {onCancel && (
          <div className="mt-8 pointer-events-auto animate-in fade-in duration-1000 delay-500">
            <button
              type="button"
              onClick={onCancel}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-md text-outline hover:text-on-surface hover:bg-zinc-800/60 font-code-sm text-sm transition-colors border border-transparent hover:border-zinc-800"
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
              Cancel
            </button>
          </div>
        )}
      </div>
      <span className="sr-only">Extracting core assumptions...</span>
      {/* Fullscreen 3D Blueprint Space Shuttle Flight Arena */}
      <canvas
        ref={canvasRef}
        className="w-full h-full block"
        aria-label="3D Space Shuttle Flight Blueprint"
      />
    </div>
  );
};

export const SpaceShuttleBlueprint = CubeSpinner;

export default CubeSpinner;
