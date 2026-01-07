// src/GameScene.js
import Phaser from 'phaser';
import { 
  BOARD_SIZE, 
  BLOCK_SIZE, 
  SPACING, 
  PREVIEW_SCALE, 
  DRAG_OFFSET_Y, 
  BLOCK_SHAPES 
} from './constants';

export class GameScene extends Phaser.Scene {
  constructor() {
    super('GameScene');

    // クラス内の変数を初期化
    this.gridData = [];
    this.boardStartX = 0;
    this.boardStartY = 0;
    this.currentHand = [];
    this.isGameOver = false;
    this.particleManager = null;
  }

  preload() {
    // 画像などのロードが必要ならここに記述
  }

  create() {
    this.isGameOver = false;
    this.currentHand = [];
    this.gridData = [];

    // --- 0. パーティクル用テクスチャ生成 ---
    if (!this.textures.exists('particle_texture')) {
      const graphics = this.make.graphics({x: 0, y: 0, add: false});
      graphics.fillStyle(0xffffff, 1);
      graphics.fillCircle(10, 10, 10);
      graphics.generateTexture('particle_texture', 20, 20);
    }

    this.particleManager = this.add.particles(0, 0, 'particle_texture', {
      lifetime: 500,
      speed: { min: 150, max: 350 },
      scale: { start: 0.6, end: 0 },
      blendMode: 'ADD',
      emitting: false
    });
    this.particleManager.setDepth(200);

    // --- 1. 盤面の描画 ---
    const boardWidth = (BLOCK_SIZE + SPACING) * BOARD_SIZE + SPACING;
    const boardHeight = (BLOCK_SIZE + SPACING) * BOARD_SIZE + SPACING;
    
    this.boardStartX = (this.scale.width - boardWidth) / 2;
    this.boardStartY = 150;

    this.add.rectangle(
      this.boardStartX + boardWidth / 2, 
      this.boardStartY + boardHeight / 2, 
      boardWidth, 
      boardHeight, 
      0x16213e
    ).setStrokeStyle(4, 0x0f3460);

    for (let row = 0; row < BOARD_SIZE; row++) {
      this.gridData[row] = [];
      for (let col = 0; col < BOARD_SIZE; col++) {
        const x = this.boardStartX + SPACING + (BLOCK_SIZE / 2) + col * (BLOCK_SIZE + SPACING);
        const y = this.boardStartY + SPACING + (BLOCK_SIZE / 2) + row * (BLOCK_SIZE + SPACING);
        
        // 背景のマス目
        this.add.rectangle(x, y, BLOCK_SIZE, BLOCK_SIZE, 0x0f3460);
        
        // データを保存
        this.gridData[row][col] = { x, y, filled: false, sprite: null };
      }
    }

    this.add.text(this.scale.width / 2, 60, 'BLOCK PUZZLE', { 
      fontSize: '48px', color: '#ffffff', fontStyle: 'bold' 
    }).setOrigin(0.5);

    // --- 2. ブロック生成 ---
    this.spawnBlocks();

    // --- 3. ドラッグ操作イベント ---
    this.input.on('dragstart', (pointer, gameObject) => {
      if (this.isGameOver) return;
      
      gameObject.setScale(1.0);
      gameObject.setDepth(100);
      
      // 指の上に移動
      this.tweens.add({
        targets: gameObject,
        y: pointer.y - DRAG_OFFSET_Y,
        duration: 100
      });
    });

    this.input.on('drag', (pointer, gameObject, dragX, dragY) => {
      if (this.isGameOver) return;
      gameObject.x = dragX;
      gameObject.y = dragY - DRAG_OFFSET_Y;
    });

    this.input.on('dragend', (pointer, gameObject) => {
      if (this.isGameOver) return;

      if (this.tryPlaceBlock(gameObject)) {
        // 配置成功
        this.currentHand = this.currentHand.filter(item => item !== gameObject);
        gameObject.destroy();

        this.checkAndClearLines();

        if (this.currentHand.length === 0) {
          this.time.delayedCall(300, () => {
            this.spawnBlocks();
            this.checkGameOver();
          });
        } else {
          this.checkGameOver();
        }

      } else {
        // 配置失敗（戻す）
        gameObject.setScale(PREVIEW_SCALE);
        gameObject.setDepth(0);
        this.tweens.add({
          targets: gameObject,
          x: gameObject.input.dragStartX,
          y: gameObject.input.dragStartY,
          duration: 300,
          ease: 'Back.out'
        });
      }
    });

    this.input.on('pointerdown', () => {
      if (this.isGameOver) {
        this.scene.restart();
      }
    });
  }

  update() {
    // 今回は特に毎フレーム処理なし
  }

  // --- ヘルパーメソッド ---

  spawnBlocks() {
    const spawnPositions = [150, 350, 550];
    this.currentHand = [];

    spawnPositions.forEach((posX, index) => {
      const shapeData = Phaser.Utils.Array.GetRandom(BLOCK_SHAPES);
      const block = this.createDraggableBlock(posX, 800, shapeData);
      this.currentHand.push(block);
    });
  }

  createDraggableBlock(x, y, shapeData) {
    const container = this.add.container(x, y);
    container.shapeData = shapeData; 

    const matrix = shapeData.shape;
    const rows = matrix.length;
    const cols = matrix[0].length;
    const width = cols * BLOCK_SIZE;
    const height = rows * BLOCK_SIZE;
    
    // 中心オフセット計算
    const offsetX = -width / 2 + BLOCK_SIZE / 2;
    const offsetY = -height / 2 + BLOCK_SIZE / 2;

    container.gridOffsetX = offsetX;
    container.gridOffsetY = offsetY;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (matrix[r][c] === 1) {
          const block = this.add.rectangle(
            c * BLOCK_SIZE + offsetX, 
            r * BLOCK_SIZE + offsetY, 
            BLOCK_SIZE - 2, 
            BLOCK_SIZE - 2, 
            shapeData.color
          );
          container.add(block);
        }
      }
    }

    container.setSize(width, height);
    container.setInteractive({ draggable: true });
    container.setScale(PREVIEW_SCALE);
    
    return container;
  }

  canPlaceAt(matrix, baseRow, baseCol) {
    for (let r = 0; r < matrix.length; r++) {
      for (let c = 0; c < matrix[0].length; c++) {
        if (matrix[r][c] === 1) {
          const targetRow = baseRow + r;
          const targetCol = baseCol + c;
          
          if (targetRow < 0 || targetRow >= BOARD_SIZE || targetCol < 0 || targetCol >= BOARD_SIZE) {
            return false;
          }
          if (this.gridData[targetRow][targetCol].filled) {
            return false;
          }
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

    if (!this.canPlaceAt(shapeData.shape, baseRow, baseCol)) {
      return false;
    }

    // 配置実行
    const matrix = shapeData.shape;
    for (let r = 0; r < matrix.length; r++) {
      for (let c = 0; c < matrix[0].length; c++) {
        if (matrix[r][c] === 1) {
          const targetRow = baseRow + r;
          const targetCol = baseCol + c;
          const targetCell = this.gridData[targetRow][targetCol];

          targetCell.filled = true;
          targetCell.sprite = this.add.rectangle(
            targetCell.x, 
            targetCell.y, 
            BLOCK_SIZE - 2, 
            BLOCK_SIZE - 2, 
            shapeData.color
          );
        }
      }
    }
    return true;
  }

  checkAndClearLines() {
    let linesToClear = [];

    // 横方向
    for (let row = 0; row < BOARD_SIZE; row++) {
      let isFull = true;
      for (let col = 0; col < BOARD_SIZE; col++) {
        if (!this.gridData[row][col].filled) {
          isFull = false;
          break;
        }
      }
      if (isFull) {
        for (let col = 0; col < BOARD_SIZE; col++) linesToClear.push(this.gridData[row][col]);
      }
    }

    // 縦方向
    for (let col = 0; col < BOARD_SIZE; col++) {
      let isFull = true;
      for (let row = 0; row < BOARD_SIZE; row++) {
        if (!this.gridData[row][col].filled) {
          isFull = false;
          break;
        }
      }
      if (isFull) {
        for (let row = 0; row < BOARD_SIZE; row++) linesToClear.push(this.gridData[row][col]);
      }
    }

    if (linesToClear.length > 0) {
      // 画面シェイク
      this.cameras.main.shake(100, 0.01);

      const uniqueCells = [...new Set(linesToClear)];
      
      uniqueCells.forEach(cell => {
        cell.filled = false;
        if (cell.sprite) {
          // パーティクル発生
          this.particleManager.emitParticleAt(cell.sprite.x, cell.sprite.y, 10);

          // 消滅アニメーション
          this.tweens.add({
            targets: cell.sprite,
            scaleX: 1.2,
            scaleY: 1.2,
            alpha: 0,
            duration: 150,
            onComplete: () => {
              if (cell.sprite) cell.sprite.destroy();
              cell.sprite = null;
            }
          });
        }
      });
    }
  }

  checkGameOver() {
    for (let i = 0; i < this.currentHand.length; i++) {
      const block = this.currentHand[i];
      const matrix = block.shapeData.shape;

      for (let row = 0; row < BOARD_SIZE; row++) {
        for (let col = 0; col < BOARD_SIZE; col++) {
          if (this.canPlaceAt(matrix, row, col)) {
            return; // 置ける場所があるのでセーフ
          }
        }
      }
    }

    // ゲームオーバー
    this.isGameOver = true;
    
    this.add.rectangle(
      this.scale.width/2, 
      this.scale.height/2, 
      this.scale.width, 
      this.scale.height, 
      0x000000, 0.7
    ).setDepth(200);
    
    this.add.text(
      this.scale.width/2, 
      this.scale.height/2 - 50, 
      'GAME OVER', 
      { fontSize: '64px', color: '#ff0000', fontStyle: 'bold' }
    ).setOrigin(0.5).setDepth(201);

    this.add.text(
      this.scale.width/2, 
      this.scale.height/2 + 50, 
      'Click to Restart', 
      { fontSize: '32px', color: '#ffffff' }
    ).setOrigin(0.5).setDepth(201);
  }
}