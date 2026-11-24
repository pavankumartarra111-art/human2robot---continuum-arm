/**
 * APPLICATION ENTRY POINT & EVENT COORDINATOR
 */

const state = {
  webcamActive: false,
  facingMode: 'user',
  autonomousMode: false,
  humanCompletedFirstBox: false,
  taskPhase: 'APPROACH',
  isPinching: false,
  handNorm: { x: 0.24, y: 0.35 },
  arBoxNorm: { x: 0.24, y: 0.56, grabbed: false },
  pointerActive: false,
  pointerDown: false,
  autoClock: 0,
  stackedCount: 0,
  activeBoxIdx: 0,
  telemetry: {
    t1: 12.0,
    t2: 12.0,
    t3: 12.0,
    curvature: 1.15,
    errorMm: 4.1
  }
};

const leftPane = document.getElementById('left-pane');
const rightPane = document.getElementById('right-pane');
const videoEl = document.getElementById('webcam-video');
const pCanvas = document.getElementById('perception-canvas');
const pCtx = pCanvas.getContext('2d');
const threeCanvas = document.getElementById('three-canvas');

function enableAutonomousMode(enabled) {
  state.autonomousMode = enabled;
  const autoDot = document.getElementById('auto-dot');
  const autoLabel = document.getElementById('btn-auto-label');
  const statusText = document.getElementById('global-status-text');
  const robotBadge = document.getElementById('robot-exec-badge');

  if (enabled) {
    state.autoClock = 0;
    if (autoDot) autoDot.className = 'w-2.5 h-2.5 bg-[#15803d] rounded-none';
    if (autoLabel) autoLabel.textContent = 'Autonomous: ON';
    if (statusText) statusText.textContent = 'AUTONOMOUS';
    if (robotBadge) robotBadge.textContent = 'AUTONOMOUS';
  } else {
    if (autoDot) autoDot.className = 'w-2.5 h-2.5 bg-[#94a3b8] rounded-none';
    if (autoLabel) autoLabel.textContent = 'Autonomous Mode';
    if (statusText) statusText.textContent = 'SYNCED';
    if (robotBadge) robotBadge.textContent = 'SYNCED';
  }
}

// UI Event Handlers
document.getElementById('btn-start-webcam').addEventListener('click', startLiveWebcam);

document.getElementById('btn-flip-cam').addEventListener('click', () => {
  state.facingMode = state.facingMode === 'user' ? 'environment' : 'user';
  startLiveWebcam();
});

document.getElementById('btn-auto-mode').addEventListener('click', () => {
  if (typeof RobotAudio !== 'undefined') RobotAudio.resume();
  enableAutonomousMode(!state.autonomousMode);
});

// Sound Toggle Button & Audio Unlock
const btnSound = document.getElementById('btn-sound-toggle');
const iconSoundOn = document.getElementById('icon-sound-on');
const iconSoundOff = document.getElementById('icon-sound-off');
const lblSound = document.getElementById('btn-sound-label');

if (btnSound) {
  btnSound.addEventListener('click', () => {
    if (typeof RobotAudio !== 'undefined') {
      const active = RobotAudio.toggle();
      if (lblSound) lblSound.textContent = active ? 'Sound: ON' : 'Sound: OFF';
      if (iconSoundOn) iconSoundOn.classList.toggle('hidden', !active);
      if (iconSoundOff) iconSoundOff.classList.toggle('hidden', active);
    }
  });
}

// User interaction gesture unlocks AudioContext per browser autoplay policy
const unlockAudioContext = () => {
  if (typeof RobotAudio !== 'undefined') RobotAudio.resume();
  window.removeEventListener('pointerdown', unlockAudioContext);
  window.removeEventListener('keydown', unlockAudioContext);
};
window.addEventListener('pointerdown', unlockAudioContext);
window.addEventListener('keydown', unlockAudioContext);

document.getElementById('btn-reset-scene').addEventListener('click', () => {
  state.humanCompletedFirstBox = false;
  enableAutonomousMode(false);
  spawnWorkcellBoxes();
  state.taskPhase = 'APPROACH';
  state.isPinching = false;
});

const btnDismiss = document.getElementById('btn-dismiss-banner');
if (btnDismiss) {
  btnDismiss.addEventListener('click', () => {
    const banner = document.getElementById('cam-fallback-banner');
    if (banner) banner.classList.add('hidden');
  });
}

window.addEventListener('resize', () => {
  if (!renderer || !camera) return;
  const rect = rightPane.getBoundingClientRect();
  camera.aspect = rect.width / rect.height;
  camera.updateProjectionMatrix();
  renderer.setSize(rect.width, rect.height);
});

/**
 * MAIN 60 FPS SIMULATION RENDER LOOP
 */
let prevTime = performance.now();

function mainLoop(now) {
  requestAnimationFrame(mainLoop);
  const dt = Math.min(0.05, (now - prevTime) / 1000);
  prevTime = now;

  // 1. Render Left Perception Pane (Webcam / Virtual Hand Tracking)
  renderLeftPerceptionPane(leftPane, pCanvas, pCtx, videoEl);

  // 2. Solve Continuum Kinematics & Actuate Arm
  const desiredTip = computeRobotTargetPosition(dt);
  smoothedTipPos.lerp(desiredTip, CONFIG.control.smoothing);
  updateContinuumArmKinematics(smoothedTipPos);

  // 3. Render Right 3D Workcell View
  renderer.render(scene, camera);
}

window.onload = function () {
  initPointerFallback(pCanvas);
  initThreeWorkcell(rightPane, threeCanvas);
  mainLoop(performance.now());
};
