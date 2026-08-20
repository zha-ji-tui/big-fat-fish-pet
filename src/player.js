/**
 * 双缓冲播放器 —— 复刻 dsh-pet 的双 <video> 交叉淡入 + genRef 竞态防护。
 * 两个 video 层叠：一个显示、一个预加载，切换时交叉淡入，永无空白帧。
 */
import { animSrc } from './config.js';

export class DoubleBufferPlayer {
  /**
   * @param {object} o
   * @param {HTMLVideoElement} o.a 视频 A
   * @param {HTMLVideoElement} o.b 视频 B
   * @param {()=>void} o.onEnded 一次性动画播完回调
   * @param {()=>'left'|'right'} o.getFacing 读取当前朝向
   */
  constructor({ a, b, onEnded, getFacing }) {
    this.a = a;
    this.b = b;
    this.onEnded = onEnded;
    this.getFacing = getFacing;
    this.front = 0;        // 当前显示：0=A, 1=B
    this.pending = null;   // 加载中的 {name, once, gen}
    this.gen = 0;          // 代数守卫
    this.onReadyOnce = null; // 外部（移动驱动）在加载完成时挂的钩子
  }

  /**
   * 切换到目标动画。
   * @param {string} name 动画名
   * @param {boolean} once 是否一次性（链式模型全部一次性）
   */
  switchTo(name, once) {
    // 目标动画已在加载中：跳过（避免重复加载）
    if (this.pending && this.pending.name === name && this.pending.once === once) return;
    const gen = ++this.gen;
    this.pending = { name, once, gen };

    const target = this.front === 0 ? this.b : this.a;
    const el = target;
    el.src = animSrc(name);
    el.loop = !once;
    el.muted = true;
    el.autoplay = true;
    el.playsInline = true;
    el.onended = once ? () => this.onEnded() : undefined;
    el.load();
    // 立即尝试播放，确保 playing 事件触发（否则切换时机依赖 loadeddata 兜底）
    el.play().catch(() => {});

    // 切换时机：等视频真正开始播放输出第一帧（playing），而不是 loadeddata。
    // loadeddata 只表示数据就绪，第一帧可能还没渲染——此时淡入会露出半透明黑底
    // （WebKitGTK 不合成 video alpha），产生"切换闪烁"。playing 确保有画面再切换。
    const onReady = () => {
      el.removeEventListener('playing', onReady);
      el.removeEventListener('loadeddata', onReady);
      // 过期检查：期间又有更新切换则本回调作废（防双透明/宠物消失）
      if (this.pending?.gen !== gen) return;
      // 交换前后台：新视频立即显示，旧视频立即隐藏（不做交叉淡入，
      // 避免新旧黑底半透明叠加变暗闪烁——alpha 失效环境下叠加=闪烁）
      const old = this.front === 0 ? this.a : this.b;
      if (old && old !== el) {
        old.classList.remove('is-front');
        // 旧视频瞬间隐藏（绕过 0.18s 淡出 transition，避免黑底叠加闪烁）
        old.style.transition = 'none';
        old.style.opacity = '0';
        const restore = () => { old.style.transition = ''; };
        if (typeof requestAnimationFrame === 'function') requestAnimationFrame(restore);
        else setTimeout(restore, 0);
      }
      // 新视频：先以 opacity:0 播放约一帧（给 WebKitGTK 合成器预热首帧，
      // 否则瞬间显示会是黑帧；而淡入又会让黑底渐显闪烁）。预热后瞬间显示。
      el.classList.add('is-front');
      el.style.transition = 'none'; // 预热后瞬间显示，不做淡入
      el.play().catch(() => {});
      const commit = () => {
        if (this.pending?.gen !== gen) return; // 预热期间又切走了
        el.style.opacity = ''; // 清除残留 inline opacity → 回到 CSS is-front{opacity:1}
        this.front = this.front === 0 ? 1 : 0;
        this.pending = null;
        // 按实际朝向设置新视频镜像
        el.style.transform = this.getFacing() === 'right' ? 'scaleX(-1)' : '';
        if (this.onReadyOnce) this.onReadyOnce(el);
      };
      // 预热一帧（rAF）。Node 测试环境无 rAF → 同步 commit，保证测试可断言。
      if (typeof requestAnimationFrame === 'function') requestAnimationFrame(commit);
      else commit();
    };
    el.addEventListener('playing', onReady);
    el.addEventListener('loadeddata', onReady);
    if (el.readyState >= 2 && !el.paused) onReady();
  }
}
