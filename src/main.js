// src/main.js
import './style.css';
import Phaser from 'phaser';
import { GameScene } from './GameScene'; // 作成したGameSceneクラスを読み込む

const config = {
  type: Phaser.AUTO,
  width: 700,
  height: 1000,
  parent: 'app',
  backgroundColor: '#1a1a2e',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH
  },
  // シーンの登録方法が変わりました
  scene: [GameScene] 
};

// ゲーム開始
new Phaser.Game(config);