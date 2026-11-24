# Continuum Morph-Arm Simulation // Workcell

A high-fidelity 3D robotics simulation combining a photo-matched hybrid continuum cobot with 5-box obstacle tower stacking, constant-curvature kinematics, and vision teleoperation in a photorealistic white laboratory environment.

---

## Workcell & Natural Material Features

- **5 Nature-Inspired Workpiece Block Materials (Non-AI):**
  - **Box 1 - Terracotta Clay (`#c2593f` / `0xc2593f`):** Natural earthenware fired red clay.
  - **Box 2 - Forest Moss (`#4a6b47` / `0x4a6b47`):** Natural woodland moss and deep foliage leaf.
  - **Box 3 - Warm Ochre (`#cf8a2c` / `0xcf8a2c`):** Natural iron oxide mineral earth sand.
  - **Box 4 - River Slate (`#3e5c6b` / `0x3e5c6b`):** Natural riverbed slate pebble and deep mineral stone.
  - **Box 5 - Walnut Timber (`#7d4e38` / `0x7d4e38`):** Organic hardwood bark and burnt umber.
  - *All blocks rendered with natural matte roughness (`0.65`) and organic low-reflectance (`metalness: 0.08`), avoiding synthetic AI neon glows.*

- **Enhanced Human-Coded Typography & Colors:**
  - Increased font sizes across toolbar (`15px` / `13px`), buttons (`13px` semibold), viewport badges (`12px` bold), and bottom telemetry values (`14px` bold).
  - Grounded natural color hierarchy for telemetry cards: Terracotta (`T1`), Forest Green (`T2`), River Slate (`T3`), Warm Ochre (`Curvature`), and Walnut Timber (`Active Phase`).

- **Physical Continuum Cobot Kinematics (Photo-Matched):**
  - **Stationary Base Flange:** Square aluminum flange plate with 4 hex bolts fastened to the optical breadboard table.
  - **Rotating Base Turret (Joint 1 Yaw):** Anthracite graphite cylinder with sky-blue accent ring.
  - **Dynamic Shoulder Pitch (Joint 2):** Articulates naturally with reach distance and elevation.
  - **Mounted Stereo Depth Camera:** Intel RealSense D435 camera mounted on the shoulder pivot.
  - **16-Segment Skeletonized Continuum Spine:** 16 CNC stainless steel vertebra discs with central core flexure spacers and peripheral cable routing eyelet lugs.
  - **Continuous Braided Steel Cables:** 3 dynamic tension cables tightening and relaxing through vertebra eyelets.
  - **Wrist & Robotiq-Style Adaptive 2-Finger Gripper:** Smoothly closes around each box, holds it securely during transit, and opens to release onto the tower.
- **5-Box Tower Stacking:** Parabolic trajectory lifting each of the 5 workpiece boxes over the central barrier and stacking them into a vertical tower (`0 / 5` through `5 / 5`).
- **White Laboratory Setting:** Pure `#ffffff` background with natural daylight hemisphere bounce and soft overhead panel lighting.

---

## Project Structure

```text
pa/
├── index.html          # Clean HTML structure with prominent typography and nature palette
├── serve.py            # Local Python HTTP server (enables webcam/CORS support)
├── start.bat           # 1-click Windows startup script
├── README.md           # Documentation, kinematics model, and guide
├── css/
│   └── style.css       # Strict rectangular styling, enhanced font sizes & nature color variables
└── js/
    ├── config.js       # Centralized robot, workcell, and 5-color natural palette
    ├── perception.js   # MediaPipe Hands tracking, nature color box rendering & AR canvas
    ├── simulation.js   # Three.js 3D workcell, 16-segment arm, kinematics & 5-box stacking
    └── app.js          # Main coordinator, 60 FPS loop, UI event bindings
```

---

## Quick Start

### 1-Click Startup (Recommended)
Double-click **`start.bat`**. This launches the local Python server and opens `http://localhost:8000/index.html` in your default browser.

### Command Line
```bash
python serve.py
```
Or with standard Python HTTP server:
```bash
python -m http.server 8000
```
Then open `http://localhost:8000/index.html`.
