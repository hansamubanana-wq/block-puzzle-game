// src/constants.js

// 盤面の設定
export const BOARD_SIZE = 8;
export const BLOCK_SIZE = 60;
export const SPACING = 4;

// ブロックの表示設定
export const PREVIEW_SCALE = 0.6;
export const DRAG_OFFSET_Y = 100;

// ブロックの形状データ
// 1: ブロックあり, 0: 空白
export const BLOCK_SHAPES = [
  { color: 0xff5252, shape: [[1, 1, 1]] },                // 横棒3
  { color: 0xff5252, shape: [[1, 1, 1, 1]] },             // 横棒4
  { color: 0xff5252, shape: [[1, 1, 1, 1, 1]] },          // 横棒5
  { color: 0x448aff, shape: [[1, 0], [1, 0], [1, 1]] },   // L字
  { color: 0x448aff, shape: [[0, 1], [0, 1], [1, 1]] },   // 逆L字
  { color: 0x69f0ae, shape: [[1, 1], [1, 1]] },           // 正方形
  { color: 0xffd740, shape: [[1]] },                      // 1マス
  { color: 0xffd740, shape: [[1, 1]] },                   // 2マス
  { color: 0xe040fb, shape: [[0, 1, 0], [1, 1, 1]] }      // 凸型
];