/**
 * Tauri 宿主 facade —— 坐标 = 屏幕逻辑坐标（window.screen，CSS px），
 * setCenter 通过原生窗口 setPosition 移动整窗；根容器在窗内固定 top-left。
 * 与浏览器 facade 接口一致，因此 controller/movement/input 零改动复用。
 *
 * 说明（单窗口方案）：透明区在矩形窗内视觉穿透，但点击会被该小窗拦截。
 * （参考的逐像素点击穿透需双窗口，作为可选的后续升级。）
 */
import { getCurrentWindow } from '@tauri-apps/api/window';
import { LogicalPosition } from '@tauri-apps/api/dpi';
import { MOVE_MARGIN } from './config.js';
import { clampCenterRatio, bottomPad } from './pure.js';

const STORE_KEY = 'bfp.pet.pos';

export function createTauriFacade({ rootEl, stageEl, size, corner }) {
  const win = getCurrentWindow();
  // 运行时强制：总是置顶 / 不进任务栏 / 不抢焦点（点宠物不打断当前窗口）。
  // 比 config 里的声明更可靠（在某些 WM/合成器下 config 不生效）。
  win.setAlwaysOnTop(true);
  win.setSkipTaskbar(true);
  win.setFocusable(false);
  // 所有工作区可见：切换虚拟桌面/工作区后宠物不消失（tao 走 GTK stick → _NET_WM_DESKTOP=0xFFFFFFFF）。
  win.setVisibleOnAllWorkspaces(true);
  const halfW = size / 2;
  const halfH = (size * 9 / 16) / 2;
  // 缓存最近一次中心（window API 异步，rAF 中同步读）
  let last = { x: -1, y: -1 };
  // 缓存窗口左上角（屏幕坐标）：WebView 里 e.clientX 是窗口内坐标，
  // 拖拽/点击需要换算成屏幕坐标才能与 setCenter 对齐（否则角色会左右乱跳）。
  let winPos = { x: 0, y: 0 };
  // 初次拖拽瞬移根因：事件自带的 screenX/Y 在 pointer capture 建立的瞬间
  // （首个 pointerdown/move）会返回 0 或窗口内坐标，用它算出的"屏幕坐标"是错的，
  // 导致首次 delta 巨大 → 宠物闪现到远处。所以这里统一用 clientX + 窗口位置，
  // 不信任 screenX。窗口位置在 controller 启动时经 fireMoveTo 同步初始化，
  // 此处的 outerPosition 仅作启动前的兜底（不覆盖 fireMoveTo 已更新的新值）。
  let winPosInit = false;
  win.outerPosition().then((p) => {
    if (winPosInit) return; // fireMoveTo 已给出新值，别用旧值覆盖
    winPos = { x: p.x, y: p.y };
    last = { x: p.x + halfW, y: p.y + halfH };
  }).catch(() => {});

  // 根容器铺满透明窗（top-left）
  rootEl.classList.add('pet-window');
  rootEl.dataset.corner = corner;

  function fireMoveTo(cx, cy) {
    last = { x: cx, y: cy };
    winPos = { x: Math.round(cx - halfW), y: Math.round(cy - halfH) };
    winPosInit = true;
    win.setPosition(new LogicalPosition(winPos.x, winPos.y));
  }

  return {
    size, halfW, halfH, corner,

    /** 事件坐标 → 屏幕坐标：统一用 clientX + 窗口位置。
     * 不用事件自带 screenX/Y——初次拖拽（pointer capture 建立瞬间）它们的值
     * 会变成 0 或窗口内坐标，导致首次 delta 巨大、宠物闪现到远处。 */
    toScreen(e) {
      return { x: e.clientX + winPos.x, y: e.clientY + winPos.y };
    },

    viewport() {
      return { W: window.screen.width, H: window.screen.height };
    },

    centerRangePx() {
      const a = window.screen;
      return {
        minX: a.availLeft + MOVE_MARGIN + halfW,
        maxX: a.availLeft + a.availWidth - MOVE_MARGIN - halfW,
        minY: a.availTop + MOVE_MARGIN + halfH,
        maxY: a.availTop + a.availHeight - MOVE_MARGIN - halfH,
      };
    },

    getCenter() {
      return { ...last };
    },

    setCenter(cx, cy) {
      fireMoveTo(cx, cy);
    },

    applyRatio(rx, ry) {
      const { W, H } = this.viewport();
      const cx = Math.min(Math.max(rx * W, halfW), W - halfW);
      const cy = Math.min(Math.max(ry * H, halfH), H - halfH);
      fireMoveTo(cx, cy);
    },

    resetToCorner() {
      const { W, H } = this.viewport();
      fireMoveTo(W - 24 - halfW, H - halfH); // 默认右下角（屏幕逻辑坐标）
    },

    setGround(px) {
      stageEl.style.transform = px == null ? 'none' : 'translateY(' + px + 'px)';
    },
    groundPad() { return bottomPad(size); },

    onResize(cb) {
      window.addEventListener('resize', cb);
      return () => window.removeEventListener('resize', cb);
    },

    loadPos() {
      try { const v = localStorage.getItem(STORE_KEY); return v ? JSON.parse(v) : null; } catch { return null; }
    },
    savePos(rx, ry) {
      try { localStorage.setItem(STORE_KEY, JSON.stringify({ rx, ry })); } catch {}
    },
    clearPos() { try { localStorage.removeItem(STORE_KEY); } catch {} },

    clampCenterRatio(rx, ry) {
      const { W, H } = this.viewport();
      const { left, top } = clampCenterRatio(rx, ry, W, H, size);
      return { left, top };
    },
  };
}
