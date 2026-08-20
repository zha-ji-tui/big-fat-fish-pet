import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  decideNext, handleEndedKind, moveRatioAt, bottomPad, hitBoxPx, clampCenterRatio, bucketOf,
} from '../src/pure.js';
import { IDLE, TURN, ACTS, CLICKS, DRAG, MOVES } from '../src/config.js';

test('bucketOf 概率分桶边界', () => {
  assert.equal(bucketOf(0.0), 'IDLE');
  assert.equal(bucketOf(0.29), 'IDLE');
  assert.equal(bucketOf(0.3), 'TURN');
  assert.equal(bucketOf(0.39), 'TURN');
  assert.equal(bucketOf(0.4), 'ACTS');
  assert.equal(bucketOf(0.79), 'ACTS');
  assert.equal(bucketOf(0.8), 'MOVE');
  assert.equal(bucketOf(1.0 - 1e-6), 'MOVE');
});

test('decideNext 四类分支', () => {
  const ctx = { currentAnim: 'X', moveAvailable: false };
  assert.deepEqual(decideNext(0.1, ctx), { kind: 'IDLE', name: IDLE });
  assert.deepEqual(decideNext(0.35, ctx), { kind: 'TURN', name: TURN });
  // ACTS：名字来自池且排除 currentAnim
  const a = decideNext(0.5, ctx);
  assert.equal(a.kind, 'ACTS');
  assert.ok(ACTS.includes(a.name));
  assert.notEqual(a.name, 'X');
  // MOVE + 无空间 → 回退动作
  const m = decideNext(0.9, ctx);
  assert.equal(m.kind, 'ACTS');
  assert.ok(ACTS.includes(m.name));
  // MOVE + 有空间 → MOVES 占位
  const ok = decideNext(0.9, { currentAnim: 'Y', moveAvailable: true });
  assert.equal(ok.kind, 'MOVES');
});

test('ACTS 排除 currentAnim 生效', () => {
  for (let i = 0; i < 200; i++) {
    const d = decideNext(0.5, { currentAnim: '照镜子', moveAvailable: false });
    assert.notEqual(d.name, '照镜子');
  }
});

test('handleEndedKind 分派', () => {
  assert.deepEqual(handleEndedKind(TURN, false), { type: 'turn-flip' });
  assert.deepEqual(handleEndedKind(DRAG, false), { type: 'idle-buffer' });
  assert.deepEqual(handleEndedKind(CLICKS[0], false), { type: 'idle-buffer' });
  assert.deepEqual(handleEndedKind(IDLE, false), { type: 'pickNext' });
  assert.deepEqual(handleEndedKind(ACTS[0], false), { type: 'pickNext' });
  assert.deepEqual(handleEndedKind(DRAG, true), { type: 'ignore' }); // 拖拽中忽略
});

test('moveRatioAt 三段式插值', () => {
  const plan = {
    duration: 10, startRatio: 0.3, targetRatio: 0.6, dir: 1, totalRatio: 0.3,
    lead: 2, tail: 2,
  };
  assert.equal(moveRatioAt(0, plan), 0.3);   // 准备动作：原地
  assert.equal(moveRatioAt(2, plan), 0.3);   // 临界
  assert.equal(moveRatioAt(5, plan), 0.3 + 0.3 * (3 / 6)); // 中间
  assert.equal(moveRatioAt(6, plan), 0.5);  // 中间 (6-2)/6*0.3+0.3
  assert.equal(moveRatioAt(8, plan), 0.6);   // 到终点
  assert.equal(moveRatioAt(10, plan), 0.6);  // 收尾
  // 负方向
  const back = { ...plan, dir: -1, totalRatio: 0.3, targetRatio: 0.0, startRatio: 0.3 };
  assert.equal(moveRatioAt(6, back), 0.3 + (-1) * 0.3 * (4 / 6));
});

test('bottomPad 落地偏移数值', () => {
  // 462 * 9/16 * (360-330)/360 = 462*0.5625*0.0833333 = 21.65625
  assert.ok(Math.abs(bottomPad(462) - 21.65625) < 1e-6);
  assert.ok(bottomPad(0) === 0);
});

test('hitBoxPx 命中框换算', () => {
  const hp = hitBoxPx(462);
  const stageH = 462 * 9 / 16;
  assert.ok(Math.abs(hp.left - (200 / 640) * 462) < 1e-6);
  assert.ok(Math.abs(hp.top - (50 / 360) * stageH) < 1e-6);
  assert.ok(Math.abs(hp.width - (240 / 640) * 462) < 1e-6);
  assert.ok(Math.abs(hp.height - (285 / 360) * stageH) < 1e-6);
});

test('clampCenterRatio 钳制', () => {
  const size = 462;
  const halfW = size / 2, halfH = (size * 9 / 16) / 2;
  // 居中
  let r = clampCenterRatio(0.5, 0.5, 1000, 600, size);
  assert.equal(r.left, 500 - halfW);
  assert.equal(r.top, 300 - halfH);
  // 越界钳到 0
  r = clampCenterRatio(0.02, 0.02, 1000, 600, size);
  assert.equal(r.left, 0);
  assert.equal(r.top, 0);
  // 越界钳到最大
  r = clampCenterRatio(0.98, 0.98, 1000, 600, size);
  assert.equal(r.left, 1000 - size);
  assert.equal(r.top, 600 - size * 9 / 16);
});

test('目录完整性', () => {
  assert.equal(ACTS.length, 42);
  assert.equal(CLICKS.length, 3);
  assert.equal(MOVES.length, 3);
  assert.equal(new Set(ACTS).size, ACTS.length); // 不重复
  assert.ok(!ACTS.includes(IDLE));
  assert.ok(!ACTS.includes(TURN));
});
