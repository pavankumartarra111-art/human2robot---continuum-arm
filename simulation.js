/**
 * SIMULATION MODULE
 * Photo-Matched Cobot Continuum Hybrid Robot & 5-Box Tower Stacking Workcell
 * White Laboratory Environment
 */

let scene, camera, renderer;
let robotBaseGroup, shoulderGroup, upperLinkGroup, continuumGroup, wristGroup, gripperGroup;
let leftFingerGroup, rightFingerGroup;
let vertebraGroups = [];
let tendonLines = [];
let boxMeshes = [];
let obstacleMesh, srcPadMesh, tgtPadMesh;
const smoothedTipPos = new THREE.Vector3(-0.60, 0.36, 0.20);

/**
 * Creates procedural breadboard perforated hole texture for realistic laboratory table
 */
function createBreadboardTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');

  // Base brushed dark steel plate
  ctx.fillStyle = '#2a313b';
  ctx.fillRect(0, 0, 256, 256);

  // Subtle brushed steel directional grain
  for (let y = 0; y < 256; y += 2) {
    ctx.fillStyle = (y % 4 === 0) ? 'rgba(50, 60, 72, 0.35)' : 'rgba(35, 42, 50, 0.35)';
    ctx.fillRect(0, y, 256, 1);
  }

  // Regular grid of threaded M8 mounting holes
  const step = 32;
  for (let x = step / 2; x < 256; x += step) {
    for (let y = step / 2; y < 256; y += step) {
      // Outer counterbore shadow
      ctx.beginPath();
      ctx.arc(x, y, 4.5, 0, Math.PI * 2);
      ctx.fillStyle = '#111418';
      ctx.fill();

      // Inner threaded hole
      ctx.beginPath();
      ctx.arc(x, y, 3.2, 0, Math.PI * 2);
      ctx.fillStyle = '#080a0d';
      ctx.fill();

      // Top specular rim highlight
      ctx.beginPath();
      ctx.arc(x, y - 0.6, 3.8, Math.PI * 0.8, Math.PI * 0.2);
      ctx.strokeStyle = 'rgba(150, 168, 190, 0.45)';
      ctx.lineWidth = 0.8;
      ctx.stroke();
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(16, 10);
  return texture;
}

function initThreeWorkcell(rightPane, threeCanvas) {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0xffffff);
  scene.fog = new THREE.Fog(0xffffff, 4.0, 14.0);

  const rect = rightPane.getBoundingClientRect();
  camera = new THREE.PerspectiveCamera(44, rect.width / rect.height, 0.05, 50);
  camera.position.set(0.0, 1.32, 1.88);
  camera.lookAt(0, 0.28, 0.05);

  renderer = new THREE.WebGLRenderer({ canvas: threeCanvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setSize(rect.width, rect.height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  // Realistic Overhead Laboratory Lighting
  scene.add(new THREE.HemisphereLight(0xffffff, 0xdfe6ed, 0.92));

  const keyLight = new THREE.DirectionalLight(0xffffff, 1.12);
  keyLight.position.set(1.4, 3.2, 1.8);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.width = 2048;
  keyLight.shadow.mapSize.height = 2048;
  keyLight.shadow.camera.near = 0.1;
  keyLight.shadow.camera.far = 7.0;
  keyLight.shadow.bias = -0.0003;
  scene.add(keyLight);

  const fillLight = new THREE.DirectionalLight(0xd9e2ec, 0.45);
  fillLight.position.set(-1.8, 1.6, -1.0);
  scene.add(fillLight);

  // Clean Light Laboratory Floor & Shadow Receiver Plane
  const floorGeo = new THREE.PlaneGeometry(16, 16);
  const floorMat = new THREE.MeshStandardMaterial({
    color: 0xf4f6f9,
    roughness: 0.85,
    metalness: 0.05
  });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.46;
  floor.receiveShadow = true;
  scene.add(floor);

  // Subtle clean light grid
  const grid = new THREE.GridHelper(8, 40, 0xcbd5e1, 0xe2e8f0);
  grid.position.y = -0.458;
  scene.add(grid);

  buildWorkcellTable();
  buildPhotorealisticRobot();
  spawnWorkcellBoxes();
  setupOrbitControls(threeCanvas);
}

/**
 * Builds optical breadboard table with station pads and central obstacle
 */
function buildWorkcellTable() {
  const wc = CONFIG.workcell;
  const tableGroup = new THREE.Group();
  scene.add(tableGroup);

  const breadboardMat = new THREE.MeshStandardMaterial({
    map: createBreadboardTexture(),
    roughness: 0.48,
    metalness: 0.62,
    color: 0x9099a6
  });

  // Tabletop Steel Plate
  const tableTop = new THREE.Mesh(
    new THREE.BoxGeometry(wc.tableWidth, wc.tableHeight, wc.tableDepth),
    breadboardMat
  );
  tableTop.position.set(0, -wc.tableHeight / 2, 0);
  tableTop.receiveShadow = true;
  tableGroup.add(tableTop);

  // Aluminum Extrusion Frame (Under Table)
  const extrusionMat = new THREE.MeshStandardMaterial({
    color: 0x5a6574,
    metalness: 0.85,
    roughness: 0.32
  });

  const legGeo = new THREE.BoxGeometry(0.06, 0.40, 0.06);
  const legX = wc.tableWidth / 2 - 0.08;
  const legZ = wc.tableDepth / 2 - 0.08;
  const legY = -wc.tableHeight - 0.20;

  [[-legX, -legZ], [legX, -legZ], [-legX, legZ], [legX, legZ]].forEach(([x, z]) => {
    const leg = new THREE.Mesh(legGeo, extrusionMat);
    leg.position.set(x, legY, z);
    leg.castShadow = true;
    tableGroup.add(leg);
  });

  // Station Pads (Source on Left, Target Pallet on Right)
  const padGeo = new THREE.BoxGeometry(0.32, 0.008, 0.34);
  const padMat = new THREE.MeshStandardMaterial({ color: 0x242e3d, roughness: 0.60 });

  srcPadMesh = new THREE.Mesh(padGeo, padMat);
  srcPadMesh.position.set(wc.sourceZone.x, 0.004, wc.sourceZone.z);
  srcPadMesh.receiveShadow = true;
  scene.add(srcPadMesh);

  tgtPadMesh = new THREE.Mesh(padGeo, padMat);
  tgtPadMesh.position.set(wc.targetZone.x, 0.004, wc.targetZone.z);
  tgtPadMesh.receiveShadow = true;
  scene.add(tgtPadMesh);

  // Central Partition Obstacle Barrier
  const obs = wc.obstacle;
  obstacleMesh = new THREE.Mesh(
    new THREE.BoxGeometry(obs.width, obs.height, obs.depth),
    new THREE.MeshStandardMaterial({ color: 0x242b35, metalness: 0.6, roughness: 0.35 })
  );
  obstacleMesh.position.set(obs.x, obs.height / 2, obs.z);
  obstacleMesh.castShadow = true;
  obstacleMesh.receiveShadow = true;
  scene.add(obstacleMesh);
}

/**
 * Spawns the 5 Workpiece Boxes queued on the source pad with distinct natural earth colours
 */
function spawnWorkcellBoxes() {
  boxMeshes.forEach(b => scene.remove(b));
  boxMeshes = [];
  const wc = CONFIG.workcell;
  const palette = (wc.boxPalette && wc.boxPalette.length > 0) ? wc.boxPalette : [
    { hex: 0xc2593f, name: 'Terracotta Clay' },
    { hex: 0x4a6b47, name: 'Forest Moss' },
    { hex: 0xcf8a2c, name: 'Warm Ochre' },
    { hex: 0x3e5c6b, name: 'River Slate' },
    { hex: 0x7d4e38, name: 'Walnut Timber' },
  ];

  for (let i = 0; i < wc.totalBoxes; i++) {
    const item = palette[i % palette.length];
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(wc.boxSize, wc.boxSize, wc.boxSize),
      new THREE.MeshStandardMaterial({
        color: item.hex,
        roughness: 0.65, // Natural matte clay/stone/timber finish
        metalness: 0.08  // Organic low-reflectance material (non-AI, non-metallic)
      })
    );
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.position.set(
      wc.sourceZone.x,
      wc.boxSize / 2 + 0.008,
      wc.sourceZone.z - i * (wc.boxSize + 0.025)
    );
    mesh.userData = { stacked: false, grasped: false, index: i, colorInfo: item };
    scene.add(mesh);
    boxMeshes.push(mesh);
  }

  state.stackedCount = 0;
  state.activeBoxIdx = 0;
  state.arBoxNorm = { x: CONFIG.arZones.pick.nx, y: CONFIG.arZones.pick.ny, grabbed: false };
  const elStacked = document.getElementById('tele-stacked');
  if (elStacked) elStacked.textContent = '0';
}

/**
 * Builds the Photorealistic Cobot Continuum Hybrid Robot matching the photo
 */
function buildPhotorealisticRobot() {
  const r = CONFIG.robot;

  const milledAluminum = new THREE.MeshStandardMaterial({ color: 0x9099a4, metalness: 0.88, roughness: 0.26 });
  const darkGraphite = new THREE.MeshStandardMaterial({ color: 0x22262d, metalness: 0.62, roughness: 0.36 });
  const cobotCyan = new THREE.MeshStandardMaterial({ color: 0x4fa0d2, metalness: 0.15, roughness: 0.42 });
  const stainlessSteel = new THREE.MeshStandardMaterial({ color: 0xc4cdd6, metalness: 0.94, roughness: 0.20 });
  const cameraBlack = new THREE.MeshStandardMaterial({ color: 0x121417, metalness: 0.45, roughness: 0.55 });
  const cameraLensGlass = new THREE.MeshStandardMaterial({ color: 0x05070a, metalness: 0.95, roughness: 0.08 });
  const gripperMatte = new THREE.MeshStandardMaterial({ color: 0x181a1e, metalness: 0.72, roughness: 0.32 });
  const rubberPad = new THREE.MeshStandardMaterial({ color: 0x2b3036, metalness: 0.05, roughness: 0.88 });

  // 1. Robot Base Group (Centered behind obstacle)
  robotBaseGroup = new THREE.Group();
  robotBaseGroup.position.set(r.baseX, r.baseY, r.baseZ);
  scene.add(robotBaseGroup);

  // Square Milled Aluminum Flange Plate with 4 Corner Bolts
  const flange = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.018, 0.24), milledAluminum);
  flange.position.y = 0.009;
  flange.castShadow = true;
  flange.receiveShadow = true;
  robotBaseGroup.add(flange);

  const boltGeo = new THREE.CylinderGeometry(0.009, 0.009, 0.010, 6);
  const boltMat = new THREE.MeshStandardMaterial({ color: 0x333b44, metalness: 0.85, roughness: 0.3 });
  [[-0.095, -0.095], [0.095, -0.095], [-0.095, 0.095], [0.095, 0.095]].forEach(([bx, bz]) => {
    const bolt = new THREE.Mesh(boltGeo, boltMat);
    bolt.position.set(bx, 0.022, bz);
    robotBaseGroup.add(bolt);
  });

  // Conical Pedestal Riser
  const cone = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.125, 0.095, 32), milledAluminum);
  cone.position.y = 0.065;
  cone.castShadow = true;
  robotBaseGroup.add(cone);

  // Dark Rotating Turret Cylinder (Joint 1 Base)
  const turret = new THREE.Mesh(new THREE.CylinderGeometry(0.092, 0.092, 0.080, 32), darkGraphite);
  turret.position.y = 0.152;
  turret.castShadow = true;
  robotBaseGroup.add(turret);

  // Cyan Accent Ring 1
  const ring1 = new THREE.Mesh(new THREE.CylinderGeometry(0.093, 0.093, 0.006, 32), cobotCyan);
  ring1.position.y = 0.194;
  robotBaseGroup.add(ring1);

  // 2. Shoulder Group (Joint 2 - Pitch Pivot & Camera Mount)
  shoulderGroup = new THREE.Group();
  shoulderGroup.position.set(0, 0.20, 0);
  robotBaseGroup.add(shoulderGroup);

  // Large Rounded Shoulder Knuckle Housing
  const shoulderKnuckle = new THREE.Mesh(new THREE.SphereGeometry(0.092, 28, 28), darkGraphite);
  shoulderKnuckle.position.set(0, 0.045, 0);
  shoulderKnuckle.castShadow = true;
  shoulderGroup.add(shoulderKnuckle);

  // Cyan Accent Ring 2 (around shoulder pivot)
  const ring2 = new THREE.Mesh(new THREE.TorusGeometry(0.088, 0.004, 16, 32), cobotCyan);
  ring2.position.set(0, 0.045, 0);
  ring2.rotation.y = Math.PI / 2;
  shoulderGroup.add(ring2);

  // Intel RealSense D435 Stereo Depth Camera mounted on top of shoulder
  const cameraMount = new THREE.Group();
  cameraMount.position.set(0, 0.145, 0.015);

  const stalk = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.035, 0.030), darkGraphite);
  stalk.position.y = -0.012;
  cameraMount.add(stalk);

  const camBody = new THREE.Mesh(new THREE.BoxGeometry(0.095, 0.026, 0.025), cameraBlack);
  camBody.castShadow = true;
  cameraMount.add(camBody);

  const camFace = new THREE.Mesh(new THREE.BoxGeometry(0.088, 0.020, 0.002), cameraLensGlass);
  camFace.position.z = 0.013;
  cameraMount.add(camFace);

  const lensGeo = new THREE.CylinderGeometry(0.0055, 0.0055, 0.003, 16);
  const leftLens = new THREE.Mesh(lensGeo, milledAluminum);
  leftLens.rotation.x = Math.PI / 2;
  leftLens.position.set(-0.030, 0, 0.014);
  cameraMount.add(leftLens);

  const rightLens = leftLens.clone();
  rightLens.position.x = 0.030;
  cameraMount.add(rightLens);

  const irDot = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.003, 16), darkGraphite);
  irDot.rotation.x = Math.PI / 2;
  irDot.position.set(0.005, 0, 0.014);
  cameraMount.add(irDot);

  shoulderGroup.add(cameraMount);

  // 3. Rigid Upper Arm Link
  upperLinkGroup = new THREE.Group();
  upperLinkGroup.position.set(0, 0.045, 0);
  shoulderGroup.add(upperLinkGroup);

  const upperCylinder = new THREE.Mesh(new THREE.CylinderGeometry(0.060, 0.074, r.shoulderLength, 28), darkGraphite);
  upperCylinder.position.set(0, r.shoulderLength / 2, 0);
  upperCylinder.castShadow = true;
  upperLinkGroup.add(upperCylinder);

  const ring3 = new THREE.Mesh(new THREE.CylinderGeometry(0.061, 0.061, 0.006, 28), cobotCyan);
  ring3.position.set(0, r.shoulderLength - 0.03, 0);
  upperLinkGroup.add(ring3);

  const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.060, 0.040, 24), milledAluminum);
  collar.position.set(0, r.shoulderLength, 0);
  collar.castShadow = true;
  upperLinkGroup.add(collar);

  // 4. 16-Segment Skeletonized Continuum Spine (from Photo)
  continuumGroup = new THREE.Group();
  scene.add(continuumGroup);

  vertebraGroups = [];
  const diskGeo = new THREE.CylinderGeometry(r.segmentRadius, r.segmentRadius * 0.94, 0.014, 24);
  const coreGeo = new THREE.CylinderGeometry(0.016, 0.016, 0.024, 16);
  const lugGeo = new THREE.BoxGeometry(0.010, 0.012, 0.014);

  for (let i = 0; i < r.segmentCount; i++) {
    const vGroup = new THREE.Group();

    // Central Flexible Stainless Core
    const core = new THREE.Mesh(coreGeo, milledAluminum);
    vGroup.add(core);

    // Skeletonized CNC Aluminum Vertebra Disc
    const disk = new THREE.Mesh(diskGeo, stainlessSteel);
    disk.castShadow = true;
    vGroup.add(disk);

    // 3 Peripheral Tendon Eyelet Lugs
    for (let t = 0; t < 3; t++) {
      const ang = r.tendonAngles[t];
      const lug = new THREE.Mesh(lugGeo, milledAluminum);
      lug.position.set(
        Math.cos(ang) * (r.segmentRadius + 0.003),
        0,
        Math.sin(ang) * (r.segmentRadius + 0.003)
      );
      vGroup.add(lug);
    }

    continuumGroup.add(vGroup);
    vertebraGroups.push(vGroup);
  }

  // 3 Braided Steel Tendons
  tendonLines = [0x505862, 0x505862, 0x505862].map(color => {
    const line = new THREE.Line(
      new THREE.BufferGeometry(),
      new THREE.LineBasicMaterial({ color, linewidth: 1.5 })
    );
    continuumGroup.add(line);
    return line;
  });

  // 5. Cobot Wrist & Industrial Adaptive 2-Finger Gripper
  wristGroup = new THREE.Group();
  scene.add(wristGroup);

  const wristHub = new THREE.Mesh(new THREE.CylinderGeometry(0.046, 0.046, 0.055, 24), darkGraphite);
  wristHub.castShadow = true;
  wristGroup.add(wristHub);

  const ringWrist = new THREE.Mesh(new THREE.CylinderGeometry(0.047, 0.047, 0.005, 24), cobotCyan);
  wristGroup.add(ringWrist);

  const toolFlange = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.048, 0.012, 24), milledAluminum);
  toolFlange.position.y = -0.034;
  wristGroup.add(toolFlange);

  gripperGroup = new THREE.Group();
  gripperGroup.position.set(0, -0.040, 0);
  wristGroup.add(gripperGroup);

  const palm = new THREE.Mesh(new THREE.BoxGeometry(0.084, 0.045, 0.060), gripperMatte);
  palm.position.y = -0.022;
  palm.castShadow = true;
  gripperGroup.add(palm);

  leftFingerGroup = buildAdaptiveFinger(true, gripperMatte, rubberPad);
  leftFingerGroup.position.set(-0.038, -0.042, 0);
  gripperGroup.add(leftFingerGroup);

  rightFingerGroup = buildAdaptiveFinger(false, gripperMatte, rubberPad);
  rightFingerGroup.position.set(0.038, -0.042, 0);
  gripperGroup.add(rightFingerGroup);
}

function buildAdaptiveFinger(isLeft, fingerMat, padMat) {
  const fGroup = new THREE.Group();
  const dir = isLeft ? 1 : -1;

  const prox = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.048, 0.022), fingerMat);
  prox.position.set(dir * 0.006, -0.022, 0);
  prox.rotation.z = dir * 0.12;
  prox.castShadow = true;
  fGroup.add(prox);

  const distal = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.054, 0.020), fingerMat);
  distal.position.set(dir * 0.004, -0.062, 0);
  distal.castShadow = true;
  fGroup.add(distal);

  const pad = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.046, 0.018), padMat);
  pad.position.set(dir * -0.006, -0.062, 0);
  fGroup.add(pad);

  return fGroup;
}

/**
 * Commits a box to the tower stack on the target pallet
 */
function commitRobotBoxStack() {
  const wc = CONFIG.workcell;
  const box = boxMeshes[state.activeBoxIdx];
  if (!box) return;

  box.userData.grasped = false;
  box.userData.stacked = true;
  const stackY = (state.stackedCount * wc.boxSize) + wc.boxSize / 2 + 0.008;
  box.position.set(wc.targetZone.x, stackY, wc.targetZone.z);

  state.stackedCount++;
  const elStacked = document.getElementById('tele-stacked');
  if (elStacked) elStacked.textContent = state.stackedCount;

  const errMm = (2.2 + Math.random() * 3.4).toFixed(1);
  const elError = document.getElementById('tele-error');
  if (elError) elError.textContent = `${errMm} mm`;

  if (state.activeBoxIdx < boxMeshes.length - 1) {
    state.activeBoxIdx++;
  } else {
    setTimeout(() => {
      if (state.autonomousMode) spawnWorkcellBoxes();
    }, 1000);
  }
}

/**
 * Calculates trajectory over central barrier to stack 5 boxes
 */
function computeRobotTargetPosition(dt) {
  const wc = CONFIG.workcell;
  const activeBox = boxMeshes[state.activeBoxIdx];
  const obsSafeY = wc.obstacle.height + CONFIG.control.obstacleClearance;
  const targetStackY = (state.stackedCount * wc.boxSize) + wc.boxSize / 2 + 0.008;

  if (!activeBox) return new THREE.Vector3(0, 0.55, 0.1);

  if (state.autonomousMode) {
    state.autoClock = (state.autoClock + dt * 0.26) % 1.0;
    const t = state.autoClock;

    if (t < 0.22) {
      state.taskPhase = 'APPROACH';
      state.isPinching = false;
      const u = t / 0.22;
      return new THREE.Vector3(
        activeBox.position.x,
        THREE.MathUtils.lerp(0.46, activeBox.position.y + 0.15, u),
        activeBox.position.z
      );
    } else if (t < 0.34) {
      state.taskPhase = 'GRASP';
      state.isPinching = true;
      return new THREE.Vector3(activeBox.position.x, activeBox.position.y + 0.125, activeBox.position.z);
    } else if (t < 0.78) {
      state.taskPhase = 'TRANSPORT';
      state.isPinching = true;
      const u = (t - 0.34) / 0.44;
      const x = THREE.MathUtils.lerp(wc.sourceZone.x, wc.targetZone.x, u);
      const baseLineY = THREE.MathUtils.lerp(0.22, targetStackY + 0.14, u);
      const y = baseLineY + Math.sin(u * Math.PI) * (obsSafeY + 0.12 - 0.22);
      const z = THREE.MathUtils.lerp(activeBox.position.z, wc.targetZone.z, u);
      return new THREE.Vector3(x, y, z);
    } else if (t < 0.90) {
      if (state.taskPhase !== 'RELEASE') {
        state.taskPhase = 'RELEASE';
        state.isPinching = false;
        commitRobotBoxStack();
      }
      return new THREE.Vector3(wc.targetZone.x, targetStackY + 0.18, wc.targetZone.z);
    } else {
      state.taskPhase = 'APPROACH';
      state.isPinching = false;
      return new THREE.Vector3(0.0, 0.56, 0.08);
    }
  }

  // Teleoperation Synchronization from 2D Perception
  const normX = state.handNorm.x;
  const normY = state.handNorm.y;

  const mappedX = THREE.MathUtils.mapLinear(normX, 0.20, 0.80, wc.sourceZone.x, wc.targetZone.x);
  const clampedX = Math.max(-0.75, Math.min(0.75, mappedX));

  let mappedY = THREE.MathUtils.mapLinear(normY, 0.72, 0.18, 0.17, 0.68);
  if (Math.abs(clampedX) < 0.28) {
    mappedY = Math.max(mappedY, obsSafeY + 0.06);
  }

  const mappedZ = state.arBoxNorm.grabbed
    ? THREE.MathUtils.lerp(activeBox.position.z, wc.targetZone.z, Math.max(0, (normX - 0.24) / 0.52))
    : activeBox.position.z;

  return new THREE.Vector3(clampedX, mappedY, mappedZ);
}

/**
 * Solves Constant-Curvature Kinematics & Actuates Cobot Continuum Hybrid
 */
function updateContinuumArmKinematics(targetPos) {
  const r = CONFIG.robot;
  const basePos = new THREE.Vector3(r.baseX, r.baseY + r.baseHeight, r.baseZ);

  // 1. Orient Shoulder Turret toward target
  const delta = new THREE.Vector3().subVectors(targetPos, basePos);
  const yaw = Math.atan2(delta.x, delta.z);
  robotBaseGroup.rotation.y = yaw;

  upperLinkGroup.rotation.x = 0.38;

  // Shoulder Tip Origin
  const shoulderTipLocal = new THREE.Vector3(0, r.shoulderLength, 0);
  shoulderTipLocal.applyAxisAngle(new THREE.Vector3(1, 0, 0), 0.38);
  shoulderTipLocal.applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
  const shoulderTip = shoulderTipLocal.add(basePos);

  // 2. Wrist Position (Perpendicular downward approach)
  const wristPos = targetPos.clone().add(new THREE.Vector3(0, 0.065, 0));

  // Constant-Curvature Spline
  const midCtrl = new THREE.Vector3().lerpVectors(shoulderTip, wristPos, 0.5);
  const span = shoulderTip.distanceTo(wristPos);
  const bendArch = Math.max(0.14, (1.18 - span) * 0.48);
  midCtrl.y += bendArch;
  midCtrl.z += 0.08;

  const curve = new THREE.QuadraticBezierCurve3(shoulderTip, midCtrl, wristPos);
  const tendonPoints = [[], [], []];
  const upAxis = new THREE.Vector3(0, 1, 0);

  // 3. Align 16 Vertebrae along Tangents
  for (let i = 0; i < r.segmentCount; i++) {
    const u = (i + 0.5) / r.segmentCount;
    const pt = curve.getPoint(u);
    const tangent = curve.getTangent(u).normalize();

    const vGroup = vertebraGroups[i];
    vGroup.position.copy(pt);
    vGroup.quaternion.setFromUnitVectors(upAxis, tangent);

    const normal = new THREE.Vector3().crossVectors(tangent, new THREE.Vector3(0, 0, 1)).normalize();
    if (normal.lengthSq() < 0.01) normal.set(1, 0, 0);
    const binormal = new THREE.Vector3().crossVectors(tangent, normal).normalize();

    for (let t = 0; t < 3; t++) {
      const ang = r.tendonAngles[t];
      const offset = new THREE.Vector3()
        .addScaledVector(normal, Math.cos(ang) * r.tendonRoutingRadius)
        .addScaledVector(binormal, Math.sin(ang) * r.tendonRoutingRadius);
      tendonPoints[t].push(pt.clone().add(offset));
    }
  }

  for (let t = 0; t < 3; t++) {
    tendonLines[t].geometry.setFromPoints(tendonPoints[t]);
  }

  // 4. Orient Wrist & Gripper
  wristGroup.position.copy(wristPos);
  wristGroup.rotation.set(0, 0, 0);

  // 5. Adaptive Gripper Finger Actuation
  const fingerTravel = state.isPinching ? 0.024 : 0.046;
  leftFingerGroup.position.x = -fingerTravel;
  rightFingerGroup.position.x = fingerTravel;

  // 6. Handle Active Workpiece Grasping & Release
  const activeBox = boxMeshes[state.activeBoxIdx];
  if (activeBox && !activeBox.userData.stacked) {
    if (state.isPinching && (state.arBoxNorm.grabbed || state.autonomousMode)) {
      activeBox.userData.grasped = true;
      activeBox.position.set(wristPos.x, wristPos.y - 0.11, wristPos.z);
    } else if (!state.autonomousMode && activeBox.userData.grasped && !state.isPinching) {
      activeBox.userData.grasped = false;
      const wc = CONFIG.workcell;
      activeBox.position.set(
        wc.sourceZone.x,
        wc.boxSize / 2 + 0.008,
        wc.sourceZone.z - state.activeBoxIdx * (wc.boxSize + 0.025)
      );
    }
  }

  // 7. Telemetry Values
  const baseP = r.pretensionN;
  const t1 = Math.max(4, Math.min(26, baseP + (targetPos.y - 0.32) * 14.5));
  const t2 = Math.max(4, Math.min(26, baseP - targetPos.x * 11.5 - (targetPos.y - 0.32) * 6.0));
  const t3 = Math.max(4, Math.min(26, baseP + targetPos.x * 11.5 - (targetPos.y - 0.32) * 6.0));
  const curvature = (0.72 + bendArch * 3.1).toFixed(2);

  const elT1 = document.getElementById('tele-t1');
  if (elT1) elT1.textContent = `${t1.toFixed(1)} N`;
  const barT1 = document.getElementById('bar-t1');
  if (barT1) barT1.style.width = `${(t1 / r.maxTensionN) * 100}%`;

  const elT2 = document.getElementById('tele-t2');
  if (elT2) elT2.textContent = `${t2.toFixed(1)} N`;
  const barT2 = document.getElementById('bar-t2');
  if (barT2) barT2.style.width = `${(t2 / r.maxTensionN) * 100}%`;

  const elT3 = document.getElementById('tele-t3');
  if (elT3) elT3.textContent = `${t3.toFixed(1)} N`;
  const barT3 = document.getElementById('bar-t3');
  if (barT3) barT3.style.width = `${(t3 / r.maxTensionN) * 100}%`;

  const elCurv = document.getElementById('tele-curvature');
  if (elCurv) elCurv.textContent = `${curvature} m⁻¹`;

  const elPhase = document.getElementById('tele-phase');
  if (elPhase) elPhase.textContent = state.taskPhase;
}

function setupOrbitControls(threeCanvas) {
  let dragging = false, px = 0, py = 0;
  let theta = 0.0, phi = 0.88;
  const radius = 2.28;

  const applyOrbit = () => {
    camera.position.x = radius * Math.sin(phi) * Math.sin(theta);
    camera.position.y = Math.max(0.25, radius * Math.cos(phi));
    camera.position.z = radius * Math.sin(phi) * Math.cos(theta);
    camera.lookAt(0, 0.28, 0.05);
  };

  threeCanvas.addEventListener('pointerdown', (e) => {
    dragging = true;
    px = e.clientX;
    py = e.clientY;
  });
  window.addEventListener('pointerup', () => { dragging = false; });
  window.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    theta -= (e.clientX - px) * 0.008;
    phi = Math.max(0.32, Math.min(1.42, phi - (e.clientY - py) * 0.008));
    px = e.clientX;
    py = e.clientY;
    applyOrbit();
  });
}
