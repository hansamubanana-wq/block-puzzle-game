// src/GameScene.js
import Phaser from 'phaser';
import { 
  BOARD_SIZE, BLOCK_SIZE, SPACING, PREVIEW_SCALE, DRAG_OFFSET_Y, 
  BLOCK_SHAPES, SLOT_WIDTH, SLOT_HEIGHT, SLOT_Y,
  VIB_PICKUP, VIB_DROP, VIB_RETURN, VIB_CLEAR, VIB_GAMEOVER,
  SCORE_PER_BLOCK, SCORE_PER_LINE_BASE
} from './constants';
import { SoundManager } from './SoundManager';

export class GameScene extends Phaser.Scene {
  constructor() {
    super('GameScene');
    this.gridData = [];
    this.boardStartX = 0;
    this.boardStartY = 0;
    this.currentHand = [null, null, null]; 
    this.isGameOver = false;
    this.particleManager = null;
    this.activeBlock = null;
    
    this.score = 0;
    this.highScore = 0;
    this.scoreText = null;
    this.highScoreText = null;
    
    this.soundManager = null;
    this.muteButton = null;
  }

  create() {
    this.isGameOver = false;
    this.currentHand = [null, null, null];
    this.gridData = [];
    this.activeBlock = null;
    this.score = 0;

    const savedScore = localStorage.getItem('block_puzzle_highscore');
    this.highScore = savedScore ? parseInt(savedScore, 10) : 0;

    this.soundManager = new SoundManager(this);

    // --- 0. パーティクル準備 ---
    if (!this.textures.exists('particle_texture')) {
      const graphics = this.make.graphics({x: 0, y: 0, add: false});
      graphics.fillStyle(0xffffff, 1);
      graphics.fillCircle(10, 10, 10);
      graphics.generateTexture('particle_texture', 20, 20);
    }
    // パーティクルも「加算合成（ADD）」で光るように
    this.particleManager = this.add.particles(0, 0, 'particle_texture', {
      lifetime: 600, speed: { min: 150, max: 400 }, scale: { start: 0.8, end: 0 }, 
      blendMode: 'ADD', emitting: false
    });
    this.particleManager.setDepth(200);

    // --- 1. 盤面描画 ---
    const boardWidth = (BLOCK_SIZE + SPACING) * BOARD_SIZE + SPACING;
    const boardHeight = (BLOCK_SIZE + SPACING) * BOARD_SIZE + SPACING;
    this.boardStartX = (this.scale.width - boardWidth) / 2;
    this.boardStartY = 180;

    // ■ 盤面の背景：少し透明なダークブルーに
    this.add.rectangle(this.boardStartX + boardWidth / 2, this.boardStartY + boardHeight / 2, boardWidth, boardHeight, 0x000000, 0.3)
      .setStrokeStyle(2, 0x4444ff); // 青い枠線

    for (let row = 0; row < BOARD_SIZE; row++) {
      this.gridData[row] = [];
      for (let col = 0; col < BOARD_SIZE; col++) {
        const x = this.boardStartX + SPACING + (BLOCK_SIZE / 2) + col * (BLOCK_SIZE + SPACING);
        const y = this.boardStartY + SPACING + (BLOCK_SIZE / 2) + row * (BLOCK_SIZE + SPACING);
        // ■ マス目：暗い色で控えめに
        this.add.rectangle(x, y, BLOCK_SIZE, BLOCK_SIZE, 0xffffff, 0.05);
        this.gridData[row][col] = { x, y, filled: false, sprite: null };
      }
    }

    // --- UI ---
    // タイトルに影をつけてリッチに
    this.add.text(this.scale.width / 2, 40, 'BLOCK PUZZLE', { 
      fontSize: '32px', color: '#ffffff', fontStyle: 'bold',
      shadow: { offsetX: 2, offsetY: 2, color: '#00ccff', blur: 10, stroke: true, fill: true }
    }).setOrigin(0.5);

    this.add.text(20, 80, 'SCORE', { fontSize: '20px', color: '#00ccff' });
    this.scoreText = this.add.text(20, 105, '0', { fontSize: '32px', color: '#ffffff', fontStyle: 'bold' });

    this.add.text(this.scale.width - 20, 80, 'BEST', { fontSize: '20px', color: '#00ccff' }).setOrigin(1, 0);
    this.highScoreText = this.add.text(this.scale.width - 20, 105, this.highScore.toString(), { fontSize: '32px', color: '#ffd700', fontStyle: 'bold' }).setOrigin(1, 0);

    this.muteButton = this.add.text(this.scale.width - 40, 40, '🔊', { fontSize: '32px' })
      .setOrigin(0.5).setInteractive()
      .on('pointerdown', () => {
        const isMuted = this.soundManager.toggleMute();
        this.muteButton.setText(isMuted ? '🔇' : '🔊');
      });

    // --- 2. ブロック生成 ---
    this.spawnBlocks();

    // --- 3. 操作スロット ---
    const spawnPositions = [150, 350, 550];
    for (let i = 0; i < 3; i++) {
      const zone = this.add.zone(spawnPositions[i], SLOT_Y, SLOT_WIDTH, SLOT_HEIGHT);
      zone.setSize(SLOT_WIDTH, SLOT_HEIGHT);
      zone.setInteractive({ draggable: true });
      zone.slotIndex = i;
    }

    // --- 4. ドラッグイベント ---
    this.input.on('dragstart', (pointer, zone) => {
      if (this.isGameOver) return;
      if (!this.soundManager.isPlaying && !this.soundManager.isMuted) this.soundManager.playBGM();

      const block = this.currentHand[zone.slotIndex];
      if (block) {
        this.activeBlock = block; 
        this.soundManager.playPickup();
        this.vibrate(VIB_PICKUP);
        block.setScale(1.0);
        block.setDepth(100);
        this.tweens.add({ targets: block, y: pointer.y - DRAG_OFFSET_Y, x: pointer.x, duration: 100 });
      }
    });

    this.input.on('drag', (pointer, zone, dragX, dragY) => {
      if (this.isGameOver) return;
      if (this.activeBlock) {
        this.activeBlock.x = dragX;
        this.activeBlock.y = dragY - DRAG_OFFSET_Y;
      }
    });

    this.input.on('dragend', (pointer, zone) => {
      if (this.isGameOver) return;
      const block = this.activeBlock;
      if (!block) return;

      if (this.tryPlaceBlock(block)) {
        this.soundManager.playDrop();
        this.vibrate(VIB_DROP);
        this.currentHand[zone.slotIndex] = null;
        block.destroy();
        this.activeBlock = null;
        this.addScore(SCORE_PER_BLOCK);
        this.checkAndClearLines();

        const allSlotsEmpty = this.currentHand.every(slot => slot === null);
        if (allSlotsEmpty) {
          this.time.delayedCall(300, () => {
            this.spawnBlocks();
            this.checkGameOver();
          });
        } else {
          this.checkGameOver();
        }
      } else {
        this.soundManager.playReturn();
        this.vibrate(VIB_RETURN);
        block.setScale(PREVIEW_SCALE);
        block.setDepth(0);
        this.tweens.add({ targets: block, x: block.spawnX, y: block.spawnY, duration: 300, ease: 'Back.out' });
        this.activeBlock = null;
      }
    });

    this.input.on('pointerdown', () => {
      if (this.isGameOver) {
        this.soundManager.stopBGM();
        this.scene.restart();
      }
    });
  }

  addScore(points) {
    this.score += points;
    this.scoreText.setText(this.score.toString());
    if (this.score > this.highScore) {
      this.highScore = this.score;
      this.highScoreText.setText(this.highScore.toString());
    }
  }

  vibrate(pattern) {
    if (navigator.vibrate) { try { navigator.vibrate(pattern); } catch (e) { } }
  }

  spawnBlocks() {
    const spawnPositions = [150, 350, 550];
    for (let i = 0; i < 3; i++) {
      if (this.currentHand[i] === null) {
        const shapeData = Phaser.Utils.Array.GetRandom(BLOCK_SHAPES);
        const block = this.createDraggableBlock(spawnPositions[i], SLOT_Y, shapeData);
        block.spawnX = spawnPositions[i];
        block.spawnY = SLOT_Y;
        this.currentHand[i] = block;
      }
    }
  }

  createDraggableBlock(x, y, shapeData) {
    const container = this.add.container(x, y);
    container.shapeData = shapeData; 
    const matrix = shapeData.shape;
    const rows = matrix.length;
    const cols = matrix[0].length;
    const width = cols * BLOCK_SIZE;
    const height = rows * BLOCK_SIZE;
    const offsetX = -width / 2 + BLOCK_SIZE / 2;
    const offsetY = -height / 2 + BLOCK_SIZE / 2;
    container.gridOffsetX = offsetX;
    container.gridOffsetY = offsetY;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (matrix[r][c] === 1) {
          // ■ ブロック装飾：枠線（Stroke）を追加してネオン風に
          const block = this.add.rectangle(
            c * BLOCK_SIZE + offsetX, r * BLOCK_SIZE + offsetY, 
            BLOCK_SIZE - 2, BLOCK_SIZE - 2, 
            shapeData.color
          ).setStrokeStyle(3, 0xffffff); // 3pxの白い枠線
          container.add(block);
        }
      }
    }
    container.setScale(PREVIEW_SCALE);
    return container;
  }

  canPlaceAt(matrix, baseRow, baseCol) {
    for (let r = 0; r < matrix.length; r++) {
      for (let c = 0; c < matrix[0].length; c++) {
        if (matrix[r][c] === 1) {
          const targetRow = baseRow + r;
          const targetCol = baseCol + c;
          if (targetRow < 0 || targetRow >= BOARD_SIZE || targetCol < 0 || targetCol >= BOARD_SIZE) return false;
          if (this.gridData[targetRow][targetCol].filled) return false;
        }
      }
    }
    return true;
  }

  tryPlaceBlock(container) {
    const shapeData = container.shapeData;
    const startX = container.x + container.gridOffsetX;
    const startY = container.y + container.gridOffsetY;
    const baseCol = Math.round((startX - (this.boardStartX + SPACING + BLOCK_SIZE/2)) / (BLOCK_SIZE + SPACING));
    const baseRow = Math.round((startY - (this.boardStartY + SPACING + BLOCK_SIZE/2)) / (BLOCK_SIZE + SPACING));
    if (!this.canPlaceAt(shapeData.shape, baseRow, baseCol)) return false;
    const matrix = shapeData.shape;
    for (let r = 0; r < matrix.length; r++) {
      for (let c = 0; c < matrix[0].length; c++) {
        if (matrix[r][c] === 1) {
          const targetRow = baseRow + r;
          const targetCol = baseCol + c;
          const targetCell = this.gridData[targetRow][targetCol];
          targetCell.filled = true;
          // ■ 配置後のブロックにも枠線を追加
          targetCell.sprite = this.add.rectangle(
            targetCell.x, targetCell.y, 
            BLOCK_SIZE - 2, BLOCK_SIZE - 2, 
            shapeData.color
          ).setStrokeStyle(3, 0xffffff);
        }
      }
    }
    return true;
  }

  checkAndClearLines() {
    let linesToClear = [];
    for (let row = 0; row < BOARD_SIZE; row++) {
      let isFull = true;
      for (let col = 0; col < BOARD_SIZE; col++) {
        if (!this.gridData[row][col].filled) { isFull = false; break; }
      }
      if (isFull) for (let col = 0; col < BOARD_SIZE; col++) linesToClear.push(this.gridData[row][col]);
    }
    for (let col = 0; col < BOARD_SIZE; col++) {
      let isFull = true;
      for (let row = 0; row < BOARD_SIZE; row++) {
        if (!this.gridData[row][col].filled) { isFull = false; break; }
      }
      if (isFull) for (let row = 0; row < BOARD_SIZE; row++) linesToClear.push(this.gridData[row][col]);
    }

    if (linesToClear.length > 0) {
      this.soundManager.playClear();
      this.vibrate(VIB_CLEAR);
      this.cameras.main.shake(100, 0.01);
      const totalLines = linesToClear.length / BOARD_SIZE;
      const bonusScore = (totalLines * (totalLines + 1) / 2) * SCORE_PER_LINE_BASE;
      this.addScore(bonusScore);
      const comboText = this.add.text(this.scale.width / 2, this.scale.height / 2, `+${bonusScore}`, {
        fontSize: '64px', color: '#ffd700', fontStyle: 'bold', stroke: '#000000', strokeThickness: 6
      }).setOrigin(0.5).setDepth(300);
      this.tweens.add({ targets: comboText, y: comboText.y - 100, alpha: 0, duration: 800, onComplete: () => comboText.destroy() });
      const uniqueCells = [...new Set(linesToClear)];
      uniqueCells.forEach(cell => {
        cell.filled = false;
        if (cell.sprite) {
          this.particleManager.emitParticleAt(cell.sprite.x, cell.sprite.y, 10);
          this.tweens.add({
            targets: cell.sprite, scaleX: 1.2, scaleY: 1.2, alpha: 0, duration: 150,
            onComplete: () => { if (cell.sprite) cell.sprite.destroy(); cell.sprite = null; }
          });
        }
      });
    }
  }

  checkGameOver() {
    for (let i = 0; i < 3; i++) {
      const block = this.currentHand[i];
      if (block) {
        const matrix = block.shapeData.shape;
        for (let row = 0; row < BOARD_SIZE; row++) {
          for (let col = 0; col < BOARD_SIZE; col++) {
            if (this.canPlaceAt(matrix, row, col)) return; 
          }
        }
      }
    }
    this.isGameOver = true;
    localStorage.setItem('block_puzzle_highscore', this.highScore.toString());
    this.soundManager.playGameOver();
    this.vibrate(VIB_GAMEOVER);
    
    // ゲームオーバー画面も少しリッチに
    this.add.rectangle(this.scale.width/2, this.scale.height/2, this.scale.width, this.scale.height, 0x000000, 0.8).setDepth(200);
    this.add.text(this.scale.width/2, this.scale.height/2 - 80, 'GAME OVER', { 
      fontSize: '64px', color: '#ff0055', fontStyle: 'bold',
      shadow: { offsetX: 2, offsetY: 2, color: '#ff0000', blur: 10, stroke: true, fill: true }
    }).setOrigin(0.5).setDepth(201);
    
    this.add.text(this.scale.width/2, this.scale.height/2 + 10, `SCORE: ${this.score}`, { fontSize: '40px', color: '#ffffff' }).setOrigin(0.5).setDepth(201);
    this.add.text(this.scale.width/2, this.scale.height/2 + 60, `BEST: ${this.highScore}`, { fontSize: '32px', color: '#ffd700' }).setOrigin(0.5).setDepth(201);
    this.add.text(this.scale.width/2, this.scale.height/2 + 130, 'Click to Restart', { fontSize: '32px', color: '#ffffff' }).setOrigin(0.5).setDepth(201);
  }
}