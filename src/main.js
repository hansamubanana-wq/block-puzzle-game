import './style.css'
import Phaser from 'phaser'

// --- 設定 ---
const BOARD_SIZE = 8;
const BLOCK_SIZE = 60;
const SPACING = 4;
const PREVIEW_SCALE = 0.6; 
// スマホ操作時に指よりどれくらい上に表示するか（ピクセル）
const DRAG_OFFSET_Y = 100;

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
  scene: {
    preload: preload,
    create: create,
    update: update
  }
};

const game = new Phaser.Game(config);

let gridData = [];
let boardStartX = 0;
let boardStartY = 0;
let currentHand = []; 
let isGameOver = false;
let particleManager = null; // パーティクル管理用

const BLOCK_SHAPES = [
  { color: 0xff5252, shape: [[1, 1, 1]] }, 
  { color: 0xff5252, shape: [[1, 1, 1, 1]] }, 
  { color: 0xff5252, shape: [[1, 1, 1, 1, 1]] }, 
  { color: 0x448aff, shape: [[1, 0], [1, 0], [1, 1]] }, 
  { color: 0x448aff, shape: [[0, 1], [0, 1], [1, 1]] }, 
  { color: 0x69f0ae, shape: [[1, 1], [1, 1]] }, 
  { color: 0xffd740, shape: [[1]] }, 
  { color: 0xffd740, shape: [[1, 1]] }, 
  { color: 0xe040fb, shape: [[0, 1, 0], [1, 1, 1]] }
];

function preload() { }

function create() {
  isGameOver = false;
  currentHand = [];
  gridData = [];

  // --- 0. パーティクル用テクスチャの生成（プログラムで描く） ---
  const graphics = this.make.graphics({x: 0, y: 0, add: false});
  graphics.fillStyle(0xffffff, 1);
  graphics.fillCircle(10, 10, 10); // 白い円を描く
  graphics.generateTexture('particle_texture', 20, 20); // 'particle_texture'という名前でメモリに保存

  // パーティクルマネージャーの作成
  particleManager = this.add.particles(0, 0, 'particle_texture', {
    lifetime: 500,
    speed: { min: 150, max: 350 },
    scale: { start: 0.6, end: 0 },
    blendMode: 'ADD',
    emitting: false // 最初は出さない
  });
  // パーティクルを一番手前に表示
  particleManager.setDepth(200);

  // --- 1. 盤面の描画 ---
  const boardWidth = (BLOCK_SIZE + SPACING) * BOARD_SIZE + SPACING;
  const boardHeight = (BLOCK_SIZE + SPACING) * BOARD_SIZE + SPACING;
  
  boardStartX = (this.scale.width - boardWidth) / 2;
  boardStartY = 150;

  this.add.rectangle(boardStartX + boardWidth / 2, boardStartY + boardHeight / 2, boardWidth, boardHeight, 0x16213e).setStrokeStyle(4, 0x0f3460);

  for (let row = 0; row < BOARD_SIZE; row++) {
    gridData[row] = [];
    for (let col = 0; col < BOARD_SIZE; col++) {
      const x = boardStartX + SPACING + (BLOCK_SIZE / 2) + col * (BLOCK_SIZE + SPACING);
      const y = boardStartY + SPACING + (BLOCK_SIZE / 2) + row * (BLOCK_SIZE + SPACING);
      this.add.rectangle(x, y, BLOCK_SIZE, BLOCK_SIZE, 0x0f3460);
      gridData[row][col] = { x, y, filled: false, sprite: null };
    }
  }

  this.add.text(this.scale.width / 2, 60, 'BLOCK PUZZLE', { fontSize: '48px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5);

  // --- 2. ブロック生成 ---
  spawnBlocks(this);

  // --- 3. ドラッグ操作 ---
  this.input.on('dragstart', (pointer, gameObject) => {
    if (isGameOver) return;
    gameObject.setScale(1.0);
    gameObject.setDepth(100);
    
    // 持ち上げた瞬間、指の上に移動させるアニメーション
    this.tweens.add({
      targets: gameObject,
      y: pointer.y - DRAG_OFFSET_Y,
      duration: 100
    });
  });

  this.input.on('drag', (pointer, gameObject, dragX, dragY) => {
    if (isGameOver) return;
    
    // 【重要】指の位置(dragX, dragY)よりも上に表示する
    gameObject.x = dragX;
    gameObject.y = dragY - DRAG_OFFSET_Y;
  });

  this.input.on('dragend', (pointer, gameObject) => {
    if (isGameOver) return;

    if (tryPlaceBlock(this, gameObject)) {
      currentHand = currentHand.filter(item => item !== gameObject);
      gameObject.destroy();

      checkAndClearLines(this);

      if (currentHand.length === 0) {
        this.time.delayedCall(300, () => {
          spawnBlocks(this);
          checkGameOver(this);
        });
      } else {
        checkGameOver(this);
      }

    } else {
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
    if (isGameOver) {
      this.scene.restart();
    }
  });
}

function update() { }

function spawnBlocks(scene) {
  const spawnPositions = [150, 350, 550];
  currentHand = [];

  spawnPositions.forEach((posX, index) => {
    const shapeData = Phaser.Utils.Array.GetRandom(BLOCK_SHAPES);
    const block = createDraggableBlock(scene, posX, 800, shapeData);
    currentHand.push(block);
  });
}

function createDraggableBlock(scene, x, y, shapeData) {
  const container = scene.add.container(x, y);
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
        const block = scene.add.rectangle(
          c * BLOCK_SIZE + offsetX, 
          r * BLOCK_SIZE + offsetY, 
          BLOCK_SIZE - 2, BLOCK_SIZE - 2, shapeData.color
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

function canPlaceAt(matrix, baseRow, baseCol) {
  for (let r = 0; r < matrix.length; r++) {
    for (let c = 0; c < matrix[0].length; c++) {
      if (matrix[r][c] === 1) {
        const targetRow = baseRow + r;
        const targetCol = baseCol + c;
        if (targetRow < 0 || targetRow >= BOARD_SIZE || targetCol < 0 || targetCol >= BOARD_SIZE) return false;
        if (gridData[targetRow][targetCol].filled) return false;
      }
    }
  }
  return true;
}

function tryPlaceBlock(scene, container) {
  const shapeData = container.shapeData;
  const startX = container.x + container.gridOffsetX;
  const startY = container.y + container.gridOffsetY;

  const baseCol = Math.round((startX - (boardStartX + SPACING + BLOCK_SIZE/2)) / (BLOCK_SIZE + SPACING));
  const baseRow = Math.round((startY - (boardStartY + SPACING + BLOCK_SIZE/2)) / (BLOCK_SIZE + SPACING));

  if (!canPlaceAt(shapeData.shape, baseRow, baseCol)) {
    return false;
  }

  const matrix = shapeData.shape;
  for (let r = 0; r < matrix.length; r++) {
    for (let c = 0; c < matrix[0].length; c++) {
      if (matrix[r][c] === 1) {
        const targetRow = baseRow + r;
        const targetCol = baseCol + c;
        const targetCell = gridData[targetRow][targetCol];
        targetCell.filled = true;
        targetCell.sprite = scene.add.rectangle(
          targetCell.x, targetCell.y, 
          BLOCK_SIZE - 2, BLOCK_SIZE - 2, 
          shapeData.color
        );
      }
    }
  }
  return true;
}

function checkAndClearLines(scene) {
  let linesToClear = [];

  // 横方向チェック
  for (let row = 0; row < BOARD_SIZE; row++) {
    let isFull = true;
    for (let col = 0; col < BOARD_SIZE; col++) {
      if (!gridData[row][col].filled) {
        isFull = false;
        break;
      }
    }
    if (isFull) {
      for (let col = 0; col < BOARD_SIZE; col++) linesToClear.push(gridData[row][col]);
    }
  }

  // 縦方向チェック
  for (let col = 0; col < BOARD_SIZE; col++) {
    let isFull = true;
    for (let row = 0; row < BOARD_SIZE; row++) {
      if (!gridData[row][col].filled) {
        isFull = false;
        break;
      }
    }
    if (isFull) {
      for (let row = 0; row < BOARD_SIZE; row++) linesToClear.push(gridData[row][col]);
    }
  }

  if (linesToClear.length > 0) {
    // ■ 画面を揺らす（強さ0.01、時間100ms）
    scene.cameras.main.shake(100, 0.01);

    const uniqueCells = [...new Set(linesToClear)];
    
    uniqueCells.forEach(cell => {
      cell.filled = false;
      
      if (cell.sprite) {
        // ■ パーティクルを発生させる
        // ブロックの中心位置から10個くらい飛び散らせる
        particleManager.emitParticleAt(cell.sprite.x, cell.sprite.y, 10);

        // ブロック消滅アニメーション
        scene.tweens.add({
          targets: cell.sprite,
          scaleX: 1.2, // 一瞬膨らんでから
          scaleY: 1.2,
          alpha: 0,    // 消える
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

function checkGameOver(scene) {
  for (let i = 0; i < currentHand.length; i++) {
    const block = currentHand[i];
    const matrix = block.shapeData.shape;
    for (let row = 0; row < BOARD_SIZE; row++) {
      for (let col = 0; col < BOARD_SIZE; col++) {
        if (canPlaceAt(matrix, row, col)) return; 
      }
    }
  }

  isGameOver = true;
  scene.add.rectangle(scene.scale.width/2, scene.scale.height/2, scene.scale.width, scene.scale.height, 0x000000, 0.7).setDepth(200);
  scene.add.text(scene.scale.width/2, scene.scale.height/2 - 50, 'GAME OVER', {
    fontSize: '64px', color: '#ff0000', fontStyle: 'bold'
  }).setOrigin(0.5).setDepth(201);
  scene.add.text(scene.scale.width/2, scene.scale.height/2 + 50, 'Click to Restart', {
    fontSize: '32px', color: '#ffffff'
  }).setOrigin(0.5).setDepth(201);
}