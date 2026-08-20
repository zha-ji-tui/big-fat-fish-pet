/**
 * 指针交互层 —— 复刻 dsh-pet 的"点击 vs 拖拽区分"。
 * 按下只记录；移动超 DRAG_THRESHOLD(5px) 判定为拖拽（跟手+保持抓取偏移）；
 * 松手时若没拖过则交给 click 事件（点击回应）；拖拽后的"幽灵点击"被抑制。
 *
 * 语义事件通过 onAction 回调发出，几何跟随直接走 facade.setCenter（60fps 平滑）。
 */
export const DRAG_THRESHOLD = 5;

export function bindInput({ el, facade, onAction }) {
  const state = {
    active: false,
    dragging: false,
    sx: 0, sy: 0,       // 按下点（屏幕坐标）
    lastX: 0, lastY: 0, // 上次 onMove 的屏幕坐标（delta 用）
  };
  let justDragged = false;

  const onDown = (e) => {
    el.classList.add('dragging');
    el.setPointerCapture(e.pointerId);
    const s = facade.toScreen(e);
    onAction('down', { x: s.x, y: s.y });
    state.active = true;
    state.dragging = false;
    state.sx = s.x;
    state.sy = s.y;
    state.lastX = s.x;
    state.lastY = s.y;
  };

  const onMove = (e) => {
    if (!state.active) return;
    const s = facade.toScreen(e);
    const dx = s.x - state.sx;
    const dy = s.y - state.sy;
    if (!state.dragging) {
      if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return; // 仍是点击候选
      state.dragging = true;
      onAction('dragstart');
    }
    // 跟手：舞台中心 = 鼠标 - 偏移（用相对上次位置的增量，抗 clientX 漂移）
    const c = facade.getCenter();
    facade.setCenter(c.x + (s.x - state.lastX), c.y + (s.y - state.lastY));
    state.lastX = s.x;
    state.lastY = s.y;
    onAction('drag', { x: s.x, y: s.y });
  };

  const onUp = (e) => {
    const wasDragging = state.dragging;
    state.active = false;
    state.dragging = false;
    el.classList.remove('dragging');
    if (wasDragging) {
      // 抑制拖拽结束后的"幽灵点击"
      justDragged = true;
      setTimeout(() => { justDragged = false; }, 100);
      const c = facade.getCenter();
      onAction('dragend', { x: c.x, y: c.y });
    }
    // 没拖过：等 click 事件
  };

  const onClick = (e) => {
    if (state.active || state.dragging || justDragged) return;
    onAction('click');
  };

  const onContext = (e) => {
    e.preventDefault();
    onAction('contextmenu', { x: e.clientX, y: e.clientY });
  };

  el.addEventListener('pointerdown', onDown);
  el.addEventListener('pointermove', onMove);
  el.addEventListener('pointerup', onUp);
  el.addEventListener('pointercancel', onUp);
  el.addEventListener('click', onClick);
  el.addEventListener('contextmenu', onContext);

  return () => {
    el.removeEventListener('pointerdown', onDown);
    el.removeEventListener('pointermove', onMove);
    el.removeEventListener('pointerup', onUp);
    el.removeEventListener('pointercancel', onUp);
    el.removeEventListener('click', onClick);
    el.removeEventListener('contextmenu', onContext);
  };
}
