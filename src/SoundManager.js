// src/SoundManager.js
export class SoundManager {
  constructor(scene) {
    this.scene = scene;
    // Phaserが管理しているオーディオシステムを使います
    this.ctx = scene.sound.context; 
  }

  // 音を鳴らすための基本関数（シンセサイザー）
  playTone(freq, type, duration, vol = 0.1) {
    // ブラウザの制限で音がミュートされている場合の対策
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = type; // 'sine', 'square', 'sawtooth', 'triangle'
    osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
    
    // 音量設定（フェードアウトさせてプツッというノイズを防ぐ）
    gain.gain.setValueAtTime(vol, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start();
    osc.stop(this.ctx.currentTime + duration);
  }

  // ■ ブロックを持った音（「ヒュッ」：高い音へ上がる）
  playPickup() {
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

  // ■ ブロックを置いた音（「トン」：低い音）
  playDrop() {
    this.playTone(300, 'sine', 0.1, 0.15);
  }

  // ■ 元に戻る音（「ブッ」：失敗音）
  playReturn() {
    this.playTone(150, 'sawtooth', 0.1, 0.05);
  }

  // ■ ライン消去音（「キラリーン」：和音アルペジオ）
  playClear() {
    // ド・ミ・ソ・高いド を順番に鳴らす
    const notes = [523.25, 659.25, 783.99, 1046.50];
    notes.forEach((freq, i) => {
      setTimeout(() => {
        this.playTone(freq, 'sine', 0.2, 0.1);
      }, i * 50); // 50ミリ秒ずつずらして鳴らす
    });
  }

  // ■ ゲームオーバー音（「ズゥゥゥーン...」：低く下がる音）
  playGameOver() {
    if (this.ctx.state === 'suspended') this.ctx.resume();
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
}