/**
 * CONFIGURATION & PARAMETERS
 * Continuum Cobot Workcell - 5-Box Tower Stacking with Obstacle Clearance
 */
const CONFIG = {
  robot: {
    baseX: 0,
    baseY: 0,
    baseZ: -0.36,
    baseHeight: 0.24,             // Base pedestal & cobot joint height (m)
    shoulderLength: 0.32,         // Rigid upper arm length (m)
    segmentCount: 16,             // 16 skeletonized vertebra segments (matching photo)
    segmentRadius: 0.046,         // Outer vertebra disk radius (m)
    tendonRoutingRadius: 0.038,   // Tendon routing pitch radius (m)
    tendonAngles: [0, (2 * Math.PI) / 3, (4 * Math.PI) / 3], // Radial 120-deg spacing
    pretensionN: 12.0,            // Resting tendon tension (N)
    maxTensionN: 28.0,            // Peak actuation limit (N)
    gripperFingerLength: 0.125,   // Adaptive 2-finger gripper length (m)
  },
  workcell: {
    tableWidth: 2.3,              // Workbench length (m)
    tableDepth: 1.35,             // Workbench depth (m)
    tableHeight: 0.06,            // Workbench surface thickness (m)
    sourceZone: { x: -0.60, y: 0.03, z: 0.20 }, // Pick zone center coordinates
    targetZone: { x: 0.60, y: 0.03, z: 0.20 },  // Place zone center coordinates
    obstacle: { x: 0.0, y: 0.19, z: 0.20, width: 0.14, height: 0.38, depth: 0.34 }, // Central barrier
    boxSize: 0.105,               // Workpiece cube dimension (m)
    totalBoxes: 5,                // 5 Stacking boxes
    // 5 Distinct Nature-Inspired Material Colours (Earthy, non-AI)
    boxPalette: [
      { hex: 0xc2593f, css: '#c2593f', border: '#8c3520', name: 'Terracotta Clay' },
      { hex: 0x4a6b47, css: '#4a6b47', border: '#2e472c', name: 'Forest Moss' },
      { hex: 0xcf8a2c, css: '#cf8a2c', border: '#8f5b12', name: 'Warm Ochre' },
      { hex: 0x3e5c6b, css: '#3e5c6b', border: '#233842', name: 'River Slate' },
      { hex: 0x7d4e38, css: '#7d4e38', border: '#523021', name: 'Walnut Timber' },
    ]
  },
  arZones: {
    pick: { nx: 0.24, ny: 0.56, nw: 0.22, nh: 0.24 },   // Normalized left pane coordinates
    place: { nx: 0.76, ny: 0.56, nw: 0.22, nh: 0.24 },  // Normalized right pane coordinates
  },
  control: {
    smoothing: 0.16,              // Target lerp smoothing factor
    obstacleClearance: 0.18,      // Minimum vertical elevation over barrier (m)
  }
};
