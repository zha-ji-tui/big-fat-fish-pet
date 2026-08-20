import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DoubleBufferPlayer } from '../src/player.js';

/** 最小 <video> 假实现，可控地触发 loadeddata 以测竞态 */
function fakeVideo() {
  const listeners = {};
  return {
    src: '',
    loop: false,
    muted: false,
    autoplay: false,
    playsInline: false,
    onended: undefined,
    readyState: 0,
    currentTime: 0,
    duration: 10,
    style: { transform: '' },
    classList: {
      set: new Set(),
      add(c) { this.set.add(c); },
      remove(c) { this.set.delete(c); },
      contains(c) { return this.set.has(c); },
    },
    addEventListener(type, fn) { (listeners[type] ||= []).push(fn); },
    removeEventListener(type, fn) {
      if (!listeners[type]) return;
      listeners[type] = listeners[type].filter((f) => f !== fn);
    },
    fire(type) { (listeners[type] || []).slice().forEach((f) => f()); },
    load() {},
    play() { return Promise.resolve(); },
  };
}

function makePlayer(facing = () => 'left') {
  const a = fakeVideo(), b = fakeVideo();
  let ended = null;
  const p = new DoubleBufferPlayer({
    a, b, onEnded: () => { ended = (ended || 0) + 1; }, getFacing: facing,
  });
  return { p, a, b, getEnded: () => ended };
}

test('switchTo 首次切换：目标=B，loadeddata 后置 front', () => {
  const { p, a, b } = makePlayer();
  assert.equal(p.front, 0);
  p.switchTo('待机呼吸休闲', true);
  assert.ok(b.src.startsWith('/thumb/') && b.src.endsWith('.webm'));
  assert.equal(decodeURIComponent(b.src), '/thumb/待机呼吸休闲.webm');
  assert.equal(b.loop, false);
  assert.equal(p.pending.gen, 1);
  b.fire('loadeddata');
  assert.equal(b.classList.contains('is-front'), true);
  assert.equal(a.classList.contains('is-front'), false);
  assert.equal(p.front, 1);
  assert.equal(p.pending, null);
});

test('loop 语义：once=false 时 loop=true 且不接 onended', () => {
  const { p, a, b } = makePlayer();
  p.switchTo('待机呼吸休闲', false);
  assert.equal(b.loop, true);
  assert.equal(b.onended, undefined);
});

test('竞态：快速连切时旧回调作废，最终只留新动画', () => {
  const { p, a, b } = makePlayer();
  p.switchTo('A', true);
  const gen1 = p.pending.gen;
  p.switchTo('B', true);
  const gen2 = p.pending.gen;
  assert.ok(gen2 > gen1);
  // 模拟 only 一次 loadeddata（真实浏览器同一事件会调用所有监听）
  b.fire('loadeddata');
  // 只有 gen2 的 onReady 生效（B 显示、front 翻转、A 移除）
  assert.equal(b.classList.contains('is-front'), true);
  assert.equal(a.classList.contains('is-front'), false);
  assert.equal(p.front, 1);
  assert.equal(p.pending, null);
});

test('同一目标动画在加载中：跳过不重复加载', () => {
  const { p, a, b } = makePlayer();
  p.switchTo('X', true);
  const srcBefore = b.src;
  p.switchTo('X', true); // pending 相同 → 直接 return
  assert.equal(b.src, srcBefore);
});

test('已就绪（readyState>=2）立即回调', () => {
  const { p, a, b } = makePlayer();
  b.readyState = 4; // 模拟已缓存
  p.switchTo('Y', true);
  assert.equal(p.pending, null); // onReady 同步执行过
  assert.equal(b.classList.contains('is-front'), true);
});

test('facing=right 镜像：onReady 里给新视频 scaleX(-1)', () => {
  const { p, a, b } = makePlayer(() => 'right');
  p.switchTo('Z', true);
  b.fire('loadeddata');
  assert.equal(b.style.transform, 'scaleX(-1)');
});

test('一次性动画播完触发 onEnded', () => {
  const { p, a, b, getEnded } = makePlayer();
  p.switchTo('待机呼吸休闲', true);
  b.onended(); // 模拟视频 ended
  assert.equal(getEnded(), 1);
});
