/**
 * ROBOT AUDIO ENGINE (Web Audio API Synthesizer)
 * Realistic industrial cobot sound synthesis:
 * - Servo/stepper motor harmonic whir modulated by arm velocity
 * - Micro-servo adaptive gripper clamping and pneumatic release
 * - Solid physical contact impact when workpiece docks onto the stack
 * Zero external audio file dependencies - 100% self-contained.
 */

class RobotAudioEngine {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.initialized = false;
    
    // Motor sound nodes
    this.motorOsc1 = null;
    this.motorOsc2 = null;
    this.motorFilter = null;
    this.motorGain = null;
    
    // Master gain
    this.masterGain = null;
    this.prevPinching = false;
  }

  init() {
    if (this.initialized) return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx();

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(0.75, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);

      // 1. Primary Servo Motor Oscillator (Triangle wave for smooth industrial hum)
      this.motorOsc1 = this.ctx.createOscillator();
      this.motorOsc1.type = 'triangle';
      this.motorOsc1.frequency.setValueAtTime(105, this.ctx.currentTime);

      // 2. Harmonic Stepper Motor Oscillator (Sawtooth with low-pass filter)
      this.motorOsc2 = this.ctx.createOscillator();
      this.motorOsc2.type = 'sawtooth';
      this.motorOsc2.frequency.setValueAtTime(210, this.ctx.currentTime);

      // Low-pass filter for smooth motor body resonance
      this.motorFilter = this.ctx.createBiquadFilter();
      this.motorFilter.type = 'lowpass';
      this.motorFilter.frequency.setValueAtTime(450, this.ctx.currentTime);
      this.motorFilter.Q.setValueAtTime(2.0, this.ctx.currentTime);

      // Motor Gain
      this.motorGain = this.ctx.createGain();
      this.motorGain.gain.setValueAtTime(0.0001, this.ctx.currentTime);

      // Connect motor chain
      this.motorOsc1.connect(this.motorFilter);
      this.motorOsc2.connect(this.motorFilter);
      this.motorFilter.connect(this.motorGain);
      this.motorGain.connect(this.masterGain);

      this.motorOsc1.start();
      this.motorOsc2.start();

      this.initialized = true;
    } catch (e) {
      console.warn('AudioContext initialization deferred:', e);
    }
  }

  resume() {
    if (!this.initialized) this.init();
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  toggle(enable) {
    this.resume();
    if (typeof enable === 'boolean') {
      this.enabled = enable;
    } else {
      this.enabled = !this.enabled;
    }
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(this.enabled ? 0.75 : 0.0, this.ctx.currentTime, 0.05);
    }
    return this.enabled;
  }

  /**
   * Modulates motor pitch and hum volume dynamically based on motion speed and curvature
   */
  updateMotor(speed, curvature) {
    if (!this.initialized || !this.enabled || !this.ctx || this.ctx.state !== 'running') return;

    const t = this.ctx.currentTime;
    const clampedSpeed = Math.min(2.5, Math.max(0, speed));
    const isMoving = clampedSpeed > 0.02;

    // Pitch: 95Hz idle hum up to 260Hz at full transit
    const targetFreq = 95 + clampedSpeed * 85 + (curvature || 0) * 20;
    this.motorOsc1.frequency.setTargetAtTime(targetFreq, t, 0.08);
    this.motorOsc2.frequency.setTargetAtTime(targetFreq * 2.0, t, 0.08);

    // Motor filter cutoff opens up as speed increases
    const targetFilter = 320 + clampedSpeed * 350;
    this.motorFilter.frequency.setTargetAtTime(targetFilter, t, 0.08);

    // Gain: subtle quiet hum when still, audible servo whir when moving
    const targetVol = isMoving ? 0.045 + Math.min(0.07, clampedSpeed * 0.035) : 0.006;
    this.motorGain.gain.setTargetAtTime(targetVol, t, 0.08);
  }

  /**
   * Sound effect when gripper closes (clamp) or opens (release)
   */
  playGripper(isClosing) {
    if (!this.initialized || !this.enabled || !this.ctx || this.ctx.state !== 'running') return;
    const t = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    osc.type = 'sawtooth';
    filter.type = 'bandpass';
    filter.Q.setValueAtTime(3.5, t);

    if (isClosing) {
      // Clamping sound: pitch drops as grip meets resistance
      osc.frequency.setValueAtTime(780, t);
      osc.frequency.exponentialRampToValueAtTime(380, t + 0.16);
      filter.frequency.setValueAtTime(1050, t);
      filter.frequency.exponentialRampToValueAtTime(580, t + 0.16);
      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(0.08, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    } else {
      // Release sound: quick upward servo whir
      osc.frequency.setValueAtTime(440, t);
      osc.frequency.exponentialRampToValueAtTime(820, t + 0.12);
      filter.frequency.setValueAtTime(700, t);
      filter.frequency.exponentialRampToValueAtTime(1200, t + 0.12);
      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(0.06, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
    }

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    osc.start(t);
    osc.stop(t + 0.20);
  }

  /**
   * Sound effect when box contacts table / stack
   */
  playPlacementImpact() {
    if (!this.initialized || !this.enabled || !this.ctx || this.ctx.state !== 'running') return;
    const t = this.ctx.currentTime;

    // Deep damped impact thud (dense physical object touchdown)
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(135, t);
    osc.frequency.exponentialRampToValueAtTime(45, t + 0.09);

    gain.gain.setValueAtTime(0.12, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.10);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(t);
    osc.stop(t + 0.12);

    // High frequency surface click
    const clickOsc = this.ctx.createOscillator();
    const clickGain = this.ctx.createGain();
    const clickFilter = this.ctx.createBiquadFilter();

    clickOsc.type = 'triangle';
    clickFilter.type = 'highpass';
    clickFilter.frequency.setValueAtTime(1800, t);

    clickGain.gain.setValueAtTime(0.05, t);
    clickGain.gain.exponentialRampToValueAtTime(0.001, t + 0.035);

    clickOsc.connect(clickFilter);
    clickFilter.connect(clickGain);
    clickGain.connect(this.masterGain);

    clickOsc.start(t);
    clickOsc.stop(t + 0.04);
  }
}

const RobotAudio = new RobotAudioEngine();
