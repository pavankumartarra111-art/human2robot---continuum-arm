/**
 * PERCEPTION MODULE
 * MediaPipe Hand Tracking, Fallback Pointer, and AR Canvas Drawing
 */

const HAND_CONNECTIONS = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [0, 9], [9, 10], [10, 11], [11, 12],
  [0, 13], [13, 14], [14, 15], [15, 16],
  [0, 17], [17, 18], [18, 19], [19, 20],
  [5, 9], [9, 13], [13, 17]
];

let mpHands = null;
let mediaStream = null;
let detectedLandmarks = null;

function initMediaPipeHands() {
  if (typeof Hands === 'undefined') return;
  mpHands = new Hands({
    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
  });
  mpHands.setOptions({
    maxNumHands: 1,
    modelComplexity: 1,
    minDetectionConfidence: 0.6,
    minTrackingConfidence: 0.6
  });
  mpHands.onResults((results) => {
    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
      detectedLandmarks = results.multiHandLandmarks[0];
      processHumanHandInput(detectedLandmarks);
    } else {
      detectedLandmarks = null;
    }
  });
}

async function startLiveWebcam() {
  const videoEl = document.getElementById('webcam-video');
  const btnLabel = document.getElementById('btn-webcam-label');
  const btnFlip = document.getElementById('btn-flip-cam');
  const fallbackBanner = document.getElementById('cam-fallback-banner');

  try {
    if (mediaStream) {
      mediaStream.getTracks().forEach(track => track.stop());
    }
    mediaStream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: state.facingMode,
        width: { ideal: 1280 },
        height: { ideal: 720 }
      },
      audio: false
    });
    videoEl.srcObject = mediaStream;
    await videoEl.play();

    state.webcamActive = true;
    if (btnLabel) btnLabel.textContent = 'Webcam Active';
    if (btnFlip) btnFlip.classList.remove('hidden');
    if (fallbackBanner) fallbackBanner.classList.add('hidden');

    if (!mpHands) initMediaPipeHands();
    runWebcamDetectionLoop();
  } catch (err) {
    console.warn('Camera permission unavailable:', err);
    state.webcamActive = false;
    if (fallbackBanner) fallbackBanner.classList.remove('hidden');
  }
}

async function runWebcamDetectionLoop() {
  if (!state.webcamActive) return;
  const videoEl = document.getElementById('webcam-video');
  if (videoEl.readyState >= 2 && mpHands) {
    try {
      await mpHands.send({ image: videoEl });
    } catch (e) {
      // Ignore transient frame errors
    }
  }
  requestAnimationFrame(runWebcamDetectionLoop);
}

function processHumanHandInput(landmarks) {
  if (state.autonomousMode) return;

  const thumbTip = landmarks[4];
  const indexTip = landmarks[8];

  const mirror = state.facingMode === 'user';
  const pinchX = mirror ? (1.0 - (thumbTip.x + indexTip.x) * 0.5) : ((thumbTip.x + indexTip.x) * 0.5);
  const pinchY = (thumbTip.y + indexTip.y) * 0.5;

  const pinchDist = Math.hypot(thumbTip.x - indexTip.x, thumbTip.y - indexTip.y);
  const pinching = pinchDist < 0.068;

  updateHumanInteraction(pinchX, pinchY, pinching);
}

function updateHumanInteraction(nx, ny, pinching) {
  if (state.autonomousMode) return;

  state.handNorm.x = Math.max(0.05, Math.min(0.95, nx));
  state.handNorm.y = Math.max(0.10, Math.min(0.90, ny));
  state.isPinching = pinching;

  const distToArBox = Math.hypot(state.handNorm.x - state.arBoxNorm.x, state.handNorm.y - state.arBoxNorm.y);
  const placeZone = CONFIG.arZones.place;

  if (pinching && (state.arBoxNorm.grabbed || distToArBox < 0.14)) {
    state.arBoxNorm.grabbed = true;
    state.arBoxNorm.x = state.handNorm.x;
    state.arBoxNorm.y = state.handNorm.y;

    if (state.arBoxNorm.x < 0.45) {
      state.taskPhase = 'GRASP';
    } else {
      state.taskPhase = 'TRANSPORT';
    }
  } else {
    if (state.arBoxNorm.grabbed) {
      state.arBoxNorm.grabbed = false;
      const inPlaceZone = Math.abs(state.arBoxNorm.x - placeZone.nx) < 0.18 &&
                          Math.abs(state.arBoxNorm.y - placeZone.ny) < 0.22;

      if (inPlaceZone) {
        state.taskPhase = 'RELEASE';
        state.arBoxNorm.x = placeZone.nx;
        state.arBoxNorm.y = placeZone.ny - (state.stackedCount * 0.035);

        commitRobotBoxStack();

        if (!state.humanCompletedFirstBox) {
          state.humanCompletedFirstBox = true;
          setTimeout(() => {
            enableAutonomousMode(true);
          }, 650);
        }
      } else {
        state.arBoxNorm.x = CONFIG.arZones.pick.nx;
        state.arBoxNorm.y = CONFIG.arZones.pick.ny;
        state.taskPhase = 'APPROACH';
      }
    } else {
      state.taskPhase = 'APPROACH';
    }
  }
}

function initPointerFallback(pCanvas) {
  pCanvas.addEventListener('pointerdown', (e) => {
    if (state.webcamActive || state.autonomousMode) return;
    const rect = pCanvas.getBoundingClientRect();
    state.pointerActive = true;
    state.pointerDown = true;
    updateHumanInteraction((e.clientX - rect.left) / rect.width, (e.clientY - rect.top) / rect.height, true);
  });

  window.addEventListener('pointermove', (e) => {
    if (state.webcamActive || state.autonomousMode) return;
    const rect = pCanvas.getBoundingClientRect();
    if (e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom) {
      state.pointerActive = true;
      updateHumanInteraction((e.clientX - rect.left) / rect.width, (e.clientY - rect.top) / rect.height, state.pointerDown);
    }
  });

  window.addEventListener('pointerup', () => {
    if (state.webcamActive || state.autonomousMode) return;
    if (state.pointerDown) {
      state.pointerDown = false;
      updateHumanInteraction(state.handNorm.x, state.handNorm.y, false);
    }
  });
}

function buildVirtualSkeleton(hx, hy, pinching) {
  const pts = [];
  const pinchOffset = pinching ? 0.012 : 0.045;
  pts.push({ x: hx, y: hy + 0.09 });
  const angles = [-0.42, -0.18, 0.0, 0.18, 0.38];
  for (let f = 0; f < 5; f++) {
    for (let j = 1; j <= 4; j++) {
      const len = j * 0.025;
      let dx = angles[f] * len * 1.4;
      if (f === 0) dx -= pinchOffset;
      if (f === 1) dx += pinchOffset;
      pts.push({ x: hx + dx, y: hy + 0.06 - len });
    }
  }
  return pts;
}

function drawCornerBrackets(ctx, x, y, w, h, len, color) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  // Top-left
  ctx.beginPath();
  ctx.moveTo(x, y + len); ctx.lineTo(x, y); ctx.lineTo(x + len, y);
  ctx.stroke();
  // Top-right
  ctx.beginPath();
  ctx.moveTo(x + w - len, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w, y + len);
  ctx.stroke();
  // Bottom-left
  ctx.beginPath();
  ctx.moveTo(x, y + h - len); ctx.lineTo(x, y + h); ctx.lineTo(x + len, y + h);
  ctx.stroke();
  // Bottom-right
  ctx.beginPath();
  ctx.moveTo(x + w - len, y + h); ctx.lineTo(x + w, y + h); ctx.lineTo(x + w, y + h - len);
  ctx.stroke();
  ctx.restore();
}

function renderLeftPerceptionPane(leftPane, pCanvas, pCtx, videoEl) {
  const rect = leftPane.getBoundingClientRect();
  const w = Math.floor(rect.width);
  const h = Math.floor(rect.height);
  if (pCanvas.width !== w || pCanvas.height !== h) {
    pCanvas.width = w;
    pCanvas.height = h;
  }

  pCtx.clearRect(0, 0, w, h);

  // 1. Background Video or Technical Grid
  if (state.webcamActive && videoEl.readyState >= 2) {
    pCtx.save();
    if (state.facingMode === 'user') {
      pCtx.scale(-1, 1);
      pCtx.drawImage(videoEl, -w, 0, w, h);
    } else {
      pCtx.drawImage(videoEl, 0, 0, w, h);
    }
    pCtx.restore();
    pCtx.fillStyle = 'rgba(255, 255, 255, 0.12)';
    pCtx.fillRect(0, 0, w, h);
  } else {
    pCtx.fillStyle = '#f8fafc';
    pCtx.fillRect(0, 0, w, h);

    pCtx.strokeStyle = 'rgba(203, 213, 225, 0.6)';
    pCtx.lineWidth = 1;
    for (let x = 0; x < w; x += 40) {
      pCtx.beginPath(); pCtx.moveTo(x, 0); pCtx.lineTo(x, h); pCtx.stroke();
    }
    for (let y = 0; y < h; y += 40) {
      pCtx.beginPath(); pCtx.moveTo(0, y); pCtx.lineTo(w, y); pCtx.stroke();
    }
  }

  // 2. Draw Target Zones (Sharp Rectangles)
  const pick = CONFIG.arZones.pick;
  const place = CONFIG.arZones.place;

  // PICK ZONE (Left)
  const px = pick.nx * w, py = pick.ny * h, pw = pick.nw * w, ph = pick.nh * h;
  pCtx.strokeStyle = '#94a3b8';
  pCtx.lineWidth = 1.5;
  pCtx.strokeRect(px - pw / 2, py - ph / 2, pw, ph);
  pCtx.fillStyle = 'rgba(226, 232, 240, 0.50)';
  pCtx.fillRect(px - pw / 2, py - ph / 2, pw, ph);

  drawCornerBrackets(pCtx, px - pw / 2, py - ph / 2, pw, ph, 8, '#475569');

  pCtx.fillStyle = '#1e293b';
  pCtx.font = 'bold 15px "JetBrains Mono", monospace';
  pCtx.textAlign = 'center';
  pCtx.fillText('PICK ZONE (LEFT)', px, py + ph / 2 + 22);

  // PLACE / TOWER ZONE (Right)
  const tx = place.nx * w, ty = place.ny * h, tw = place.nw * w, th = place.nh * h;
  pCtx.strokeStyle = '#94a3b8';
  pCtx.lineWidth = 1.5;
  pCtx.strokeRect(tx - tw / 2, ty - th / 2, tw, th);
  pCtx.fillStyle = 'rgba(226, 232, 240, 0.50)';
  pCtx.fillRect(tx - tw / 2, ty - th / 2, tw, th);

  drawCornerBrackets(pCtx, tx - tw / 2, ty - th / 2, tw, th, 8, '#475569');

  pCtx.fillStyle = '#1e293b';
  pCtx.fillText('PLACE / TOWER ZONE (RIGHT)', tx, ty + th / 2 + 22);

  // Reference Trajectory Guide
  pCtx.strokeStyle = 'rgba(148, 163, 184, 0.5)';
  pCtx.lineWidth = 1;
  pCtx.setLineDash([4, 4]);
  pCtx.beginPath();
  pCtx.moveTo(px, py);
  pCtx.quadraticCurveTo(w * 0.5, h * 0.3, tx, ty);
  pCtx.stroke();
  pCtx.setLineDash([]);

  // 3. Draw Interactive Workpiece Box with Nature-Inspired Material Colour (Large Font)
  const bx = state.arBoxNorm.x * w;
  const by = state.arBoxNorm.y * h;
  const boxPx = 58;

  const pal = (CONFIG.workcell && CONFIG.workcell.boxPalette) ? CONFIG.workcell.boxPalette : [
    { hex: 0xc2593f, css: '#c2593f', border: '#8c3520', name: 'Terracotta' },
    { hex: 0x4a6b47, css: '#4a6b47', border: '#2e472c', name: 'Forest Moss' },
    { hex: 0xcf8a2c, css: '#cf8a2c', border: '#8f5b12', name: 'Warm Ochre' },
    { hex: 0x3e5c6b, css: '#3e5c6b', border: '#233842', name: 'River Slate' },
    { hex: 0x7d4e38, css: '#7d4e38', border: '#523021', name: 'Walnut Timber' },
  ];
  const activeColor = pal[state.activeBoxIdx % pal.length];

  pCtx.fillStyle = activeColor.css;
  pCtx.fillRect(bx - boxPx / 2, by - boxPx / 2, boxPx, boxPx);

  pCtx.strokeStyle = activeColor.border;
  pCtx.lineWidth = 2.0;
  pCtx.strokeRect(bx - boxPx / 2, by - boxPx / 2, boxPx, boxPx);

  pCtx.fillStyle = '#ffffff';
  pCtx.font = 'bold 13px "JetBrains Mono", monospace';
  pCtx.textAlign = 'center';
  pCtx.fillText(`BOX #${state.activeBoxIdx + 1}`, bx, by - 3);
  pCtx.font = 'bold 10px "JetBrains Mono", monospace';
  pCtx.fillText(activeColor.name.toUpperCase(), bx, by + 13);
  pCtx.textAlign = 'left';

  // 4. Draw Hand Skeleton (CAD Lines + Solid Points)
  let landmarksToDraw = null;
  if (state.webcamActive && detectedLandmarks) {
    const mirror = state.facingMode === 'user';
    landmarksToDraw = detectedLandmarks.map(pt => ({
      x: mirror ? (1.0 - pt.x) : pt.x,
      y: pt.y
    }));
  } else if (!state.autonomousMode) {
    landmarksToDraw = buildVirtualSkeleton(state.handNorm.x, state.handNorm.y, state.isPinching);
  }

  if (landmarksToDraw) {
    pCtx.strokeStyle = state.isPinching ? '#16a34a' : '#2563eb';
    pCtx.lineWidth = 2.0;
    HAND_CONNECTIONS.forEach(([i, j]) => {
      pCtx.beginPath();
      pCtx.moveTo(landmarksToDraw[i].x * w, landmarksToDraw[i].y * h);
      pCtx.lineTo(landmarksToDraw[j].x * w, landmarksToDraw[j].y * h);
      pCtx.stroke();
    });

    landmarksToDraw.forEach((pt, idx) => {
      const isPinchFinger = idx === 4 || idx === 8;
      pCtx.beginPath();
      pCtx.arc(pt.x * w, pt.y * h, isPinchFinger ? 4.0 : 2.5, 0, Math.PI * 2);
      pCtx.fillStyle = isPinchFinger ? (state.isPinching ? '#16a34a' : '#2563eb') : '#0f172a';
      pCtx.fill();
    });
  }
}
