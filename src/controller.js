/**
 * 控制器 —— 把 Player / 纯逻辑 / Facade / 输入 编排成完整的宠物生命周期。
 * 逐条镜像 dsh-pet 的 Pet 组件行为（动画链、交互打断、移动驱动、拖拽语义）。
 */
import {
  IDLE, TURN, DRAG, CLICKS, MOVES, pick, randomBetween,
  MOVE_MIN_PX, MOVE_MAX_PX, MOVE_LEAD_SEC, MOVE_TAIL_SEC, ROLL_ACTS,
} from './config.js';
import { decideNext, handleEndedKind, moveRatioAt } from './pure.js';

export function startPet({ facade, player, onContextMenu }) {
  const st = {
    anim: IDLE,
    once: true,
    facing: 'left',
    dragging: false,
    customPos: null,     // {rx, ry}|null（相对视口比例）
    pendingMove: null,   // 计划中的移动
    moveRef: null,       // rAF id
    moveToken: 0,
  };
  const animRef = { current: IDLE };
  const facingRef = { current: 'left' };

  const ensure = (name) => { st.anim = name; animRef.current = name; };
  const switchTo = (name, once) => player.switchTo(name, once);

  player.getFacing = () => facingRef.current;
  player.onEnded = handleEnded;
  player.onReadyOnce = startMoveDrive;

  // ============ 动画链 ============
  function pickNext() {
    const roll = Math.random();
    const moved = roll >= ROLL_ACTS ? tryMove() : false;
    const d = decideNext(roll, { currentAnim: animRef.current, moveAvailable: moved });
    if (d.kind !== 'MOVES') ensure(d.name); // MOVES 的 anim 已由 tryMove 设置
    st.once = true;                          // 链式全部一次性
    switchTo(st.anim, st.once);
  }

  function handleEnded() {
    const k = handleEndedKind(animRef.current, st.dragging);
    if (k.type === 'ignore') return;
    if (k.type === 'turn-flip') {
      facingRef.current = facingRef.current === 'left' ? 'right' : 'left';
    }
    if (k.type === 'idle-buffer') {
      ensure(IDLE);
      st.once = true;
      switchTo(IDLE, true);
      return;
    }
    pickNext();
  }

  // ============ 移动（朝当前 facing 方向） ============
  function tryMove() {
    if (st.moveRef !== null || st.pendingMove) return true; // 已在移动/已计划
    // 方向按"实际朝向"；若刚播完东张西望（animRef 仍为 TURN），方向取反
    const dir = (facingRef.current === 'right') !== (animRef.current === TURN) ? 1 : -1;
    const { W, H } = facade.viewport();
    const cx = facade.getCenter().x;
    const distance = randomBetween(MOVE_MIN_PX, MOVE_MAX_PX);
    const target = cx + dir * distance;
    const range = facade.centerRangePx();
    if (target < range.minX || target > range.maxX) return false; // 空间不够
    st.pendingMove = {
      startRatio: cx / W,
      startYRatio: facade.getCenter().y / H,
      targetRatio: target / W,
      dir,
      totalRatio: Math.abs(target - cx) / W,
    };
    st.once = true;
    ensure(pick(MOVES));
    return true; // switchTo 由 pickNext 统一调用
  }

  function startMoveDrive(el) {
    const pm = st.pendingMove;
    if (!pm || st.moveRef !== null) return; // 没有计划或已在移动
    st.pendingMove = null;
    const duration = el.duration;
    const token = ++st.moveToken;
    const step = () => {
      if (st.moveToken !== token) return;
      const t = el.currentTime || 0;
      const ratioX = moveRatioAt(t, {
        duration, ...pm, lead: MOVE_LEAD_SEC, tail: MOVE_TAIL_SEC,
      });
      const { W, H } = facade.viewport();
      facade.setCenter(ratioX * W, pm.startYRatio * H);
      const T = (Number.isFinite(duration) && duration > 0) ? duration : 10.09;
      if (t < T - MOVE_TAIL_SEC) {
        st.moveRef = requestAnimationFrame(step);
      } else {
        st.moveRef = null;
        st.customPos = { rx: pm.targetRatio, ry: pm.startYRatio };
        facade.savePos(pm.targetRatio, pm.startYRatio);
      }
    };
    st.moveRef = requestAnimationFrame(step);
  }

  function stopMove() {
    st.pendingMove = null;
    st.moveToken++;
    if (st.moveRef !== null) {
      cancelAnimationFrame(st.moveRef);
      st.moveRef = null;
    }
  }

  // ============ 输入（语义事件来自 bindInput） ============
  function onAction(type, payload) {
    if (type === 'down') {
      stopMove(); // 用户交互打断移动
    } else if (type === 'dragstart') {
      st.dragging = true;
      facade.setGround(null);      // 拖拽时去掉落地偏移
      st.once = true;
      ensure(DRAG);
      switchTo(DRAG, true);
    } else if (type === 'drag') {
      // 几何由 input 直接 facade.setCenter 驱动（60fps）
    } else if (type === 'dragend') {
      const { x, y } = payload; // 当前窗口中心（屏幕坐标，input 已用 delta 保持跟手）
      st.dragging = false;
      const { W, H } = facade.viewport();
      const cx = x, cy = y;
      facade.setCenter(cx, cy);        // 停在松手处
      st.customPos = { rx: cx / W, ry: cy / H };
      facade.savePos(st.customPos.rx, st.customPos.ry);
      facade.setGround(facade.groundPad()); // 恢复落地对齐
      ensure(IDLE);
      st.once = false;                 // 拖拽后回"循环待机缓冲"（忠实复刻参考代码行为）
      switchTo(IDLE, false);
    } else if (type === 'click') {
      // 正在播一次性非待机动画时不打断
      if (st.once && animRef.current !== IDLE) return;
      stopMove();
      st.once = true;
      ensure(pick(CLICKS));
      switchTo(st.anim, true);
    } else if (type === 'contextmenu') {
      onContextMenu(payload);
    }
  }

  // ============ 窗口尺寸变化：按比例重定位 ============
  const offResize = facade.onResize(() => {
    if (st.customPos) facade.applyRatio(st.customPos.rx, st.customPos.ry);
  });

  // ============ 启动 ============
  // 初始：优先恢复上次位置，否则回默认角落
  const saved = facade.loadPos();
  if (saved) { st.customPos = saved; facade.applyRatio(saved.rx, saved.ry); }
  else { facade.resetToCorner(); }
  facade.setGround(facade.groundPad());
  // 首帧直接进入动画链（待机一次性，播完即 pickNext）
  st.once = true;
  switchTo(IDLE, true);

  return {
    onAction,
    /** 供外部（菜单）复位到默认角落 */
    resetToCorner() {
      stopMove();
      facade.resetToCorner();
      facade.clearPos();
      st.customPos = null;
    },
    destroy() {
      stopMove();
      offResize();
    },
  };
}
