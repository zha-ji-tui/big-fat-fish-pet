/**
 * ============================================================================
 * 纯逻辑层（无 DOM，可单元测试）—— 复刻 dsh-pet 的状态机/概率/几何决策
 * ============================================================================
 * 把参考 client.js 里内嵌在 React 组件中的可测逻辑抽成纯函数：
 *  - 概率分桶 decideNext
 *  - 动画结束分派 handleEndedKind
 *  - 移动插值 moveRatioAt
 *  - 落地对齐 / 命中框 / 钳制 的几何换算
 * 其余 DOM/状态/副作用在 controller.js 等"薄壳"里。
 */

import {
  IDLE, TURN, ACTS, MOVES, CLICKS, DRAG, pick,
  ROLL_IDLE, ROLL_TURN, ROLL_ACTS,
  MOVE_LEAD_SEC, MOVE_TAIL_SEC, CANVAS_H, FEET_Y, HIT_BOX,
} from './config.js';

/** 返回"链类型"标签（无副作用） */
export function bucketOf(roll) {
  if (roll < ROLL_IDLE) return 'IDLE';
  if (roll < ROLL_TURN) return 'TURN';
  if (roll < ROLL_ACTS) return 'ACTS';
  return 'MOVE';
}

/**
 * 动画链核心决策（纯）：给定 roll 与上下文，选下一个动画。
 * 与参考 pickNext 逐行等价；tryMove 的副作用位置由调用方注入 moveAvailable。
 *
 * @param {number} roll  Math.random()
 * @param {object} ctx   { currentAnim, moveAvailable }
 * @returns {{kind:string, name:string|'__MOVE__'}}
 *          kind ∈ IDLE|TURN|ACTS|MOVES；name 为具体动画名。
 *          MOVES 分支返回 '__MOVE__' 占位（实际移动动画由 tryMove 决定），
 *          由控制器替换为随机移动动画名。
 */
export function decideNext(roll, ctx) {
  const { currentAnim, moveAvailable } = ctx;
  const kind = bucketOf(roll);
  if (kind === 'IDLE') return { kind: 'IDLE', name: IDLE };
  if (kind === 'TURN') return { kind: 'TURN', name: TURN };
  if (kind === 'ACTS' || !moveAvailable) {
    // 移动分支但空间不够 → 回退随机动作（参考：tryMove false → pick(ACTS)）
    return { kind: 'ACTS', name: pick(ACTS, currentAnim) };
  }
  return { kind: 'MOVES', name: '__MOVE__' };
}

/**
 * 一次性动画播完后的分派（纯）：返回要怎么走。
 * @param {string} animRef  当前动画名
 * @param {boolean} dragging 是否拖拽中
 * @returns {{type:'ignore'} | {type:'turn-flip'} | {type:'idle-buffer'} | {type:'pickNext'}}
 */
export function handleEndedKind(animRef, dragging) {
  if (dragging) return { type: 'ignore' };
  if (animRef === TURN) return { type: 'turn-flip' };
  if (animRef === DRAG || CLICKS.includes(animRef)) return { type: 'idle-buffer' };
  return { type: 'pickNext' };
}

/**
 * 移动插值（纯）：给定播放时间 t（秒）与移动计划，返回这次应处的中心比例 x。
 * 参考 startMoveDrive 的插值：前 LEAD 原地、中间线性、后 TAIL 到终点。
 * @param {number} t  video.currentTime（秒）
 * @param {object} plan { duration, startRatio, dir, totalRatio, lead=2, tail=2 }
 * @returns {number} ratioX（视口比例，0~1）
 */
export function moveRatioAt(t, plan) {
  const duration = Number.isFinite(plan.duration) && plan.duration > 0 ? plan.duration : 10.09;
  const lead = plan.lead ?? MOVE_LEAD_SEC;
  const tail = plan.tail ?? MOVE_TAIL_SEC;
  const window = Math.max(0.1, duration - lead - tail);
  if (t <= lead) return plan.startRatio;
  if (t >= duration - tail) return plan.targetRatio;
  const progress = (t - lead) / window;
  return plan.startRatio + plan.dir * plan.totalRatio * progress;
}

/** 落地对齐：舞台下移量（px），让人物"脚"正好落在视口底线 */
export function bottomPad(size) {
  return (size * 9 / 16 * (CANVAS_H - FEET_Y)) / CANVAS_H;
}

/** 命中框在舞台（尺寸为 size 宽）内的像素矩形 */
export function hitBoxPx(size) {
  return {
    left: (HIT_BOX.x0 / 640) * size,
    top: (HIT_BOX.y0 / 360) * (size * 9 / 16),
    width: ((HIT_BOX.x1 - HIT_BOX.x0) / 640) * size,
    height: ((HIT_BOX.y1 - HIT_BOX.y0) / 360) * (size * 9 / 16),
  };
}

/**
 * 把中心比例 (rx, ry) 钳制进视口（保证整个舞台在窗口内）。
 * 参考 rootStyle 的 clamp。
 * @returns {{left,top}} root 左上角 px
 */
export function clampCenterRatio(rx, ry, W, H, size) {
  const halfW = size / 2;
  const halfH = (size * 9 / 16) / 2;
  const left = Math.min(Math.max(rx * W - halfW, 0), W - size);
  const top = Math.min(Math.max(ry * H - halfH, 0), H - size * 9 / 16);
  return { left, top, right: 'auto', bottom: 'auto' };
}
