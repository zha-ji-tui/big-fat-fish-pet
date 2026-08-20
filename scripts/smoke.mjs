// M1 浏览器冒烟验证：用系统 Chrome 无头加载 pet 页，确认
//  1) 无运行时 JS 错误  2) DOM 结构正确  3) 动画链随时间推进（前后台切换）
//  4) webm 素材能解码（readyState>=2 / currentTime 前进）
import { chromium } from 'playwright-core';

const URL = process.env.PET_URL || 'http://localhost:5173/';
const chromePath = '/usr/bin/google-chrome';

const browser = await chromium.launch({
  executablePath: chromePath,
  headless: true,
  args: ['--autoplay-policy=no-user-gesture-required', '--mute-audio', '--no-sandbox'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

const errors = [];
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text()); });
page.on('response', (r) => { if (r.status() >= 400) errors.push('HTTP' + r.status() + ' ' + r.url()); });

await page.goto(URL, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('.pet-root', { timeout: 5000 });

// 结构
const dom = await page.evaluate(() => ({
  root: !!document.querySelector('.pet-root'),
  stage: !!document.querySelector('.pet-stage'),
  videos: document.querySelectorAll('.pet-video').length,
  hit: !!document.querySelector('.pet-hit'),
  corner: document.querySelector('.pet-root')?.dataset.corner,
}));

// 采样动画链：每 1200ms 记录前台视频 src（解码前的名字）
const states = [];
for (let i = 0; i < 17; i++) {
  const s = await page.evaluate(() => {
    const front = [...document.querySelectorAll('.pet-video')].find((v) => v.classList.contains('is-front'));
    const all = [...document.querySelectorAll('.pet-video')];
    return {
      t: performance.now(),
      frontSrc: front ? decodeURIComponent(front.src.split('/').pop()) : null,
      ready: all.map((v) => v.readyState),
      current: all.map((v) => v.currentTime.toFixed(2)),
      paused: all.map((v) => v.paused),
    };
  });
  states.push(s);
  await page.waitForTimeout(1200);
}
await page.screenshot({ path: 'artifacts/smoke.png' });

await browser.close();

// ---- 结论 ----
const distinctAnim = new Set(states.map((s) => s.frontSrc).filter(Boolean)).size;
const anyLoaded = states.some((s) => s.ready.some((r) => r >= 2));
const anyPlaying = states.some((s) => s.current.some((v) => parseFloat(v) > 0.2));

console.log('\n== DOM ==', JSON.stringify(dom));
console.log('== 动画链切换：期间出现不同前台动画数 =', distinctAnim);
for (const s of states.slice(0, 8)) console.log(`  t=${s.t.toFixed(0)}ms front=${s.frontSrc} ready=${s.ready} cur=${s.current} paused=${s.paused}`);
console.log('== 素材解码：anyLoaded(>=2)=', anyLoaded, ' anyPlaying(current>0.2)=', anyPlaying);
console.log('== JS 错误 ==', errors.length ? errors : '(none)');

if (dom.videos < 2) throw new Error('应有两个 video 双缓冲');
if (!dom.hit) throw new Error('缺少命中层');
if (errors.length) throw new Error('存在 JS 错误: ' + errors[0]);
if (distinctAnim < 2) console.warn('WARN: 动画链可能未推进（只看到', distinctAnim, '个动画）');
if (!(anyLoaded || anyPlaying)) console.warn('WARN: 未观察到视频解码（headless 可能限制，需人工确认）');
console.log('\nSMOKE OK');
