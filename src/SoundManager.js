// src/SoundManager.js
export class SoundManager {
  constructor(scene) {
    this.scene = scene;
    this.ctx = scene.sound.context;
    
    // BGM用
    this.bgmOscillators = [];
    this.bgmTimer = null;
    this.isPlaying = false;
    this.isMuted = false;
    
    // 音のテンポ（BPM）と進行管理
    this.bpm = 120;
    this.noteTime = 60 / this.bpm / 2; // 8分音符の長さ
    this.step = 0;
  }

  // --- ミュート機能 ---
  toggleMute() {
    this.isMuted = !this.isMuted;
    if (this.isMuted) {
      this.stopBGM();
    } else {
      this.playBGM();
    }
    return this.isMuted;
  }

  // --- SE再生（共通） ---
  playTone(freq, type, duration, vol = 0.1) {
    if (this.isMuted) return; // ミュートなら鳴らさない
    if (this.ctx.state === 'suspended') this.ctx.resume();

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
    
    gain.gain.setValueAtTime(vol, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start();
    osc.stop(this.ctx.currentTime + duration);
  }

  // ヒュッ（持ち上げ）
  playPickup() {
    if (this.isMuted) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(400, this.ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(600, this.ctx.currentTime + 0.1);
    
    gain.gain.setValueAtTime(0.1, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.1);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.1);
  }

  playDrop() { this.playTone(300, 'sine', 0.1, 0.15); }
  playReturn() { this.playTone(150, 'sawtooth', 0.1, 0.05); }

  playClear() {
    if (this.isMuted) return;
    const notes = [523.25, 659.25, 783.99, 1046.50];
    notes.forEach((freq, i) => {
      setTimeout(() => {
        if (!this.isMuted) this.playTone(freq, 'sine', 0.2, 0.1);
      }, i * 50);
    });
  }

  playGameOver() {
    if (this.isMuted) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();
    this.stopBGM(); // BGMは止める

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(200, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(50, this.ctx.currentTime + 1.5);
    
    gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 1.5);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 1.5);
  }

  // --- ■ BGM自動演奏機能 ---
  playBGM() {
    if (this.isMuted || this.isPlaying) return;
    this.isPlaying = true;
    if (this.ctx.state === 'suspended') this.ctx.resume();

    this.step = 0;
    // テンポに合わせて定期的に音を鳴らす
    this.bgmTimer = setInterval(() => this.tick(), this.noteTime * 1000);
  }

  stopBGM() {
    this.isPlaying = false;
    if (this.bgmTimer) {
      clearInterval(this.bgmTimer);
      this.bgmTimer = null;
    }
  }

  // シーケンサー（一定間隔で呼ばれる）
  tick() {
    const now = this.ctx.currentTime;
    
    // ベースライン（低い音）
    // ループパターン：ド・ド・ミ・ミ・ファ・ファ・ソ・ソ
    const bassPattern = [
      261.63, null, 261.63, null, // C4
      329.63, null, 329.63, null, // E4
      349.23, null, 349.23, null, // F4
      392.00, null, 392.00, null  // G4
    ];

    // メロディ（高い音・キラキラ）
    // ランダムなアルペジオ風
    const melodyPattern = [
      523.25, 659.25, 783.99, 1046.50,
      523.25, 659.25, 783.99, 1046.50,
      698.46, 880.00, 1046.50, 1396.91,
      783.99, 987.77, 1174.66, 1567.98
    ];

    const beat = this.step % 16;

    // ベース音再生
    if (bassPattern[beat]) {
      this.playTone(bassPattern[beat] / 2, 'triangle', 0.2, 0.05);
    }

    // メロディ再生（裏拍で鳴らすとおしゃれ）
    if (beat % 2 !== 0 && melodyPattern[beat]) {
      this.playTone(melodyPattern[beat], 'sine', 0.1, 0.03);
    }

    this.step++;
  }
}