// src/constants.js

// 盤面の設定
export const BOARD_SIZE = 8;
export const BLOCK_SIZE = 60;
export const SPACING = 4;

// ブロックの表示設定
export const PREVIEW_SCALE = 0.6;
export const DRAG_OFFSET_Y = 100;

// ■ デザイン変更：ネオンカラーパレット
// Cyan, Magenta, Lime, Orange, Purple などを使用
export const BLOCK_SHAPES = [
  { color: 0xff0055, shape: [[1, 1, 1]] },                // Neon Red
  { color: 0xff0055, shape: [[1, 1, 1, 1]] },
  { color: 0xff0055, shape: [[1, 1, 1, 1, 1]] },
  { color: 0x00ccff, shape: [[1, 0], [1, 0], [1, 1]] },   // Neon Cyan
  { color: 0x00ccff, shape: [[0, 1], [0, 1], [1, 1]] },
  { color: 0xccff00, shape: [[1, 1], [1, 1]] },           // Neon Lime
  { color: 0xffaa00, shape: [[1]] },                      // Neon Orange
  { color: 0xffaa00, shape: [[1, 1]] },
  { color: 0xaa00ff, shape: [[0, 1, 0], [1, 1, 1]] }      // Neon Purple
];

// その他設定
export const HIT_AREA_CX = 30;
export const SLOT_WIDTH = 200;
export const SLOT_HEIGHT = 250;
export const SLOT_Y = 800;

// 振動設定
export const VIB_PICKUP = 30;
export const VIB_DROP = 40;
export const VIB_RETURN = 20;
export const VIB_CLEAR = [50, 30, 50];
export const VIB_GAMEOVER = 800;

// スコア設定
export const SCORE_PER_BLOCK = 10;
export const SCORE_PER_LINE_BASE = 100;