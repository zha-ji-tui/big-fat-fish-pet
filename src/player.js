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

    const onReady = () => {
      el.removeEventListener('loadeddata', onReady);
      // 过期检查：期间又有更新切换则本回调作废（防双透明/宠物消失）
      if (this.pending?.gen !== gen) return;
      // 交换前后台
      const old = this.front === 0 ? this.a : this.b;
      el.classList.add('is-front');
      if (old && old !== el) old.classList.remove('is-front');
      this.front = this.front === 0 ? 1 : 0;
      this.pending = null;
      // 按实际朝向设置新视频镜像（inline transform，不影响旧视频淡出）
      el.style.transform = this.getFacing() === 'right' ? 'scaleX(-1)' : '';
      el.play().catch(() => {});
      if (this.onReadyOnce) this.onReadyOnce(el);
    };
    el.addEventListener('loadeddata', onReady);
    if (el.readyState >= 2) onReady();
  }
}
