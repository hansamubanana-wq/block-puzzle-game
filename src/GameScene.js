// src/GameScene.js
import Phaser from 'phaser';
import { 
  BOARD_SIZE, BLOCK_SIZE, SPACING, PREVIEW_SCALE, DRAG_OFFSET_Y, 
  BLOCK_SHAPES, SLOT_WIDTH, SLOT_HEIGHT, SLOT_Y,
  // 振動設定を読み込み
  VIB_PICKUP, VIB_DROP, VIB_RETURN, VIB_CLEAR, VIB_GAMEOVER
} from './constants';

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
  }

  preload() { }

  create() {
    this.isGameOver = false;
    this.currentHand = [null, null, null];
    this.gridData = [];
    this.activeBlock = null;

    // --- 0. パーティクル準備 ---
    if (!this.textures.exists('particle_texture')) {
      const graphics = this.make.graphics({x: 0, y: 0, add: false});
      graphics.fillStyle(0xffffff, 1);
      graphics.fillCircle(10, 10, 10);
      graphics.generateTexture('particle_texture', 20, 20);
    }
    this.particleManager = this.add.particles(0, 0, 'particle_texture', {
      lifetime: 500, speed: { min: 150, max: 350 }, scale: { start: 0.6, end: 0 }, blendMode: 'ADD', emitting: false
    });
    this.particleManager.setDepth(200);

    // --- 1. 盤面描画 ---
    const boardWidth = (BLOCK_SIZE + SPACING) * BOARD_SIZE + SPACING;
    const boardHeight = (BLOCK_SIZE + SPACING) * BOARD_SIZE + SPACING;
    this.boardStartX = (this.scale.width - boardWidth) / 2;
    this.boardStartY = 150;
    this.add.rectangle(this.boardStartX + boardWidth / 2, this.boardStartY + boardHeight / 2, boardWidth, boardHeight, 0x16213e).setStrokeStyle(4, 0x0f3460);

    for (let row = 0; row < BOARD_SIZE; row++) {
      this.gridData[row] = [];
      for (let col = 0; col < BOARD_SIZE; col++) {
        const x = this.boardStartX + SPACING + (BLOCK_SIZE / 2) + col * (BLOCK_SIZE + SPACING);
        const y = this.boardStartY + SPACING + (BLOCK_SIZE / 2) + row * (BLOCK_SIZE + SPACING);
        this.add.rectangle(x, y, BLOCK_SIZE, BLOCK_SIZE, 0x0f3460);
        this.gridData[row][col] = { x, y, filled: false, sprite: null };
      }
    }
    this.add.text(this.scale.width / 2, 60, 'BLOCK PUZZLE', { fontSize: '48px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5);

    // --- 2. ブロック生成 ---
    this.spawnBlocks();

    // --- 3. 透明な操作スロット(Zone)の作成 ---
    const spawnPositions = [150, 350, 550];
    for (let i = 0; i < 3; i++) {
      const zone = this.add.zone(spawnPositions[i], SLOT_Y, SLOT_WIDTH, SLOT_HEIGHT)
                           .setRectangleDropZone(SLOT_WIDTH, SLOT_HEIGHT);
      zone.setInteractive({ draggable: true });
      zone.slotIndex = i;
    }

    // --- 4. ドラッグ操作イベント ---
    this.input.on('dragstart', (pointer, zone) => {
      if (this.isGameOver) return;
      
      const block = this.currentHand[zone.slotIndex];
      if (block) {
        this.activeBlock = block; 
        
        // ■ 振動：持ち上げた時
        this.vibrate(VIB_PICKUP);

        block.setScale(1.0);
        block.setDepth(100);
        
        this.tweens.add({
          targets: block,
          y: pointer.y - DRAG_OFFSET_Y,
          x: pointer.x, 
          duration: 100
        });
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
        // ■ 振動：置いた時
        this.vibrate(VIB_DROP);

        this.currentHand[zone.slotIndex] = null;
        block.destroy();
        this.activeBlock = null;

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
        // ■ 振動：戻る時
        this.vibrate(VIB_RETURN);

        block.setScale(PREVIEW_SCALE);
        block.setDepth(0);
        this.tweens.add({
          targets: block,
          x: block.spawnX,
          y: block.spawnY,
          duration: 300,
          ease: 'Back.out'
        });
        this.activeBlock = null;
      }
    });

    this.input.on('pointerdown', () => {
      if (this.isGameOver) this.scene.restart();
    });
  }

  update() { }

  // --- ヘルパーメソッド ---

  // 安全に振動させるためのラッパー関数
  vibrate(pattern) {
    if (navigator.vibrate) {
      navigator.vibrate(pattern);
    }
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
          const block = this.add.rectangle(
            c * BLOCK_SIZE + offsetX, r * BLOCK_SIZE + offsetY, 
            BLOCK_SIZE - 2, BLOCK_SIZE - 2, shapeData.color
          );
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
          targetCell.sprite = this.add.rectangle(
            targetCell.x, targetCell.y, BLOCK_SIZE - 2, BLOCK_SIZE - 2, shapeData.color
          );
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
      // ■ 振動：ライン消去（激しく！）
      this.vibrate(VIB_CLEAR);

      this.cameras.main.shake(100, 0.01);
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

    // ■ 振動：ゲームオーバー（長めに）
    this.vibrate(VIB_GAMEOVER);

    this.add.rectangle(this.scale.width/2, this.scale.height/2, this.scale.width, this.scale.height, 0x000000, 0.7).setDepth(200);
    this.add.text(this.scale.width/2, this.scale.height/2 - 50, 'GAME OVER', { fontSize: '64px', color: '#ff0000', fontStyle: 'bold' }).setOrigin(0.5).setDepth(201);
    this.add.text(this.scale.width/2, this.scale.height/2 + 50, 'Click to Restart', { fontSize: '32px', color: '#ffffff' }).setOrigin(0.5).setDepth(201);
  }
}