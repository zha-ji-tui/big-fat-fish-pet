/**
 * ============================================================================
 * 可移动 Facade —— 几何/坐标抽象层（浏览器实现）
 * ============================================================================
 * 这是本实现与参考最大的结构性差异点，也是把"纯逻辑"与"运行宿主"解耦的关键：
 *  - 浏览器：舞台是 <body> 里一个 position:fixed 的根容器，坐标 = 视口 px。
 *  - Tauri （M2）：根容器铺满透明窗口，坐标 = 显示器工作区 px，且需要同时同步
 *    主窗 + 命中窗两个原生窗口的位置。
 * controller / movement / input 只依赖这里的统一接口，因此两套宿主共享同一套
 * 动画链/漫游/拖拽逻辑。
 */

import { MOVE_MARGIN } from './config.js';
import { clampCenterRatio, bottomPad } from './pure.js';

const STORE_KEY = 'bfp.pet.pos';

/**
 * 创建浏览器宿主 facade。
 * @param {object} deps
 * @param {HTMLElement} deps.rootEl  根容器（position:fixed，承载舞台）
 * @param {HTMLElement} deps.stageEl 内部舞台（落地对齐）
 * @param {number} deps.size        舞台宽度 px
 * @param {string} deps.corner      默认角落
 */
export function createBrowserFacade({ rootEl, stageEl, size, corner }) {
  const halfW = size / 2;
  const halfH = (size * 9 / 16) / 2;

  rootEl.dataset.corner = corner;

  return {
    size, halfW, halfH, corner,

    /** 事件坐标 → 视口坐标（浏览器里 clientX 就是视口 px，原样返回） */
    toScreen(e) {
      return { x: e.clientX, y: e.clientY };
    },

    /** 可用视口尺寸 */
    viewport() {
      return { W: window.innerWidth, H: window.innerHeight };
    },

    /** 中心点可用范围（px，已预留 MOVE_MARGIN 与半舞台） */
    centerRangePx() {
      const { W, H } = this.viewport();
      return {
        minX: MOVE_MARGIN + halfW,
        maxX: W - MOVE_MARGIN - halfW,
        minY: MOVE_MARGIN + halfH,
        maxY: H - MOVE_MARGIN - halfH,
      };
    },

    /** 当前中心点（视口 px） */
    getCenter() {
      const r = rootEl.getBoundingClientRect();
      return { x: r.left + halfW, y: r.top + halfH };
    },

    /** 把中心点放到 (cx, cy)（视口 px） */
    setCenter(cx, cy) {
      rootEl.style.left = (cx - halfW) + 'px';
      rootEl.style.top = (cy - halfH) + 'px';
      rootEl.style.right = 'auto';
      rootEl.style.bottom = 'auto';
    },

    /** 按比例 (rx, ry) 定位并钳制进视口（resize 重算/恢复位置用） */
    applyRatio(rx, ry) {
      const { W, H } = this.viewport();
      const cx = Math.min(Math.max(rx * W, halfW), W - halfW);
      const cy = Math.min(Math.max(ry * H, halfH), H - halfH);
      this.setCenter(cx, cy);
    },

    /** 清除 inline 定位 → 回到 CSS data-corner 默认角落 */
    resetToCorner() {
      rootEl.style.left = '';
      rootEl.style.top = '';
      rootEl.style.right = '';
      rootEl.style.bottom = '';
    },

    /** 落地：stage 平移（null = 去掉，拖拽时） */
    setGround(px) {
      stageEl.style.transform = px == null ? 'none' : 'translateY(' + px + 'px)';
    },
    groundPad() { return bottomPad(size); },

    onResize(cb) {
      window.addEventListener('resize', cb);
      return () => window.removeEventListener('resize', cb);
    },

    // ---- 位置记忆（localStorage，浏览器宿主；Tauri 宿主另实现持久化）----
    loadPos() {
      try {
        const v = localStorage.getItem(STORE_KEY);
        return v ? JSON.parse(v) : null;
      } catch { return null; }
    },
    savePos(rx, ry) {
      try { localStorage.setItem(STORE_KEY, JSON.stringify({ rx, ry })); } catch {}
    },
    clearPos() {
      try { localStorage.removeItem(STORE_KEY); } catch {}
    },

    // 供 need of clamp on resize（复用参考的钳制公式）
    clampCenterRatio(rx, ry) {
      const { W, H } = this.viewport();
      const { left, top } = clampCenterRatio(rx, ry, W, H, size);
      return { left, top };
    },
  };
}
