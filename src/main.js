/**
 * 入口 —— 组装 DOM、Facade、Player、Controller、Input。
 * 按宿主选择几何立面：
 *   - 浏览器（Vite dev / 逻辑预览）：createBrowserFacade（root 为 fixed，坐标=视口）
 *   - Tauri（桌面宠物）：createTauriFacade（原生透明窗，坐标=屏幕逻辑坐标）
 * 两套宿主共享同一动画链/漫游/拖拽逻辑（controller/movement/input）。
 */
import './styles.css';
import { SIZE, CORNER } from './config.js';
import { hitBoxPx } from './pure.js';
import { createBrowserFacade } from './facade.js';
import { DoubleBufferPlayer } from './player.js';
import { startPet } from './controller.js';
import { bindInput } from './input.js';

const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

function el(tag, cls, extra) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (extra?.attrs) for (const [k, v] of Object.entries(extra.attrs)) n.setAttribute(k, v);
  if (extra?.style) Object.assign(n.style, extra.style);
  return n;
}

async function quit() {
  if (isTauri) {
    const { getCurrentWindow } = await import('@tauri-apps/api/window');
    await getCurrentWindow().close();
  } else {
    window.close();
  }
}

// 极简右键菜单（退出 / 重置位置）
const menu = document.createElement('div');
menu.style.cssText =
  'position:fixed;z-index:999;background:#fff;border:1px solid #ccc;border-radius:6px;' +
  'box-shadow:0 2px 12px rgba(0,0,0,.15);font:13px/1.6 sans-serif;padding:4px 0;display:none;' +
  'cursor:pointer;user-select:none;';
['重置位置', '关闭'].forEach((label, i) => {
  const it = document.createElement('div');
  it.textContent = label;
  it.style.cssText = 'padding:5px 18px';
  it.onmouseenter = () => (it.style.background = '#eee');
  it.onmouseleave = () => (it.style.background = '');
  it.onclick = () => { hideMenu(); if (i === 0) window.__petControl?.resetToCorner(); else quit(); };
  menu.append(it);
});
document.body.append(menu);
function openMenu(p) {
  menu.style.left = p.x + 'px';
  menu.style.top = p.y + 'px';
  menu.style.display = 'block';
}
function hideMenu() { menu.style.display = 'none'; }
window.addEventListener('pointerdown', (e) => { if (!menu.contains(e.target)) hideMenu(); });

function mountPetInto(container) {
  const root = el('div', 'pet-root', {
    attrs: { 'data-corner': CORNER },
    style: { '--pet-size': SIZE + 'px' },
  });
  const stage = el('div', 'pet-stage');
  const vattrs = { muted: '', playsinline: '', autoplay: '' };
  const videoA = el('video', 'pet-video is-front', { attrs: vattrs });
  const videoB = el('video', 'pet-video', { attrs: vattrs });
  const hp = hitBoxPx(SIZE);
  const hit = el('div', 'pet-hit', {
    style: { left: hp.left + 'px', top: hp.top + 'px', width: hp.width + 'px', height: hp.height + 'px' },
  });
  stage.append(videoA, videoB, hit);
  root.append(stage);
  container.append(root);

  const common = { rootEl: root, stageEl: stage, size: SIZE, corner: CORNER };
  const facade = isTauri
    ? null // 动态导入
    : createBrowserFacade(common);

  const player = new DoubleBufferPlayer({
    a: videoA, b: videoB,
    onEnded: () => {}, getFacing: () => 'left', // controller 覆盖
  });
  const start = (facade) => {
    const control = startPet({ facade, player, onContextMenu: openMenu });
    bindInput({ el: hit, facade, onAction: control.onAction });
    window.__petControl = control;
  };
  if (facade) {
    start(facade);
  } else {
    import('./tauri-facade.js').then((m) => start(m.createTauriFacade(common)));
  }
}

mountPetInto(document.getElementById('pet-mount'));
