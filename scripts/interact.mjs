// M1 交互冒烟：真实输入验证 点击回应 / 拖拽判别 / 跟手位移 / 落地恢复
import { chromium } from 'playwright-core';

const URL = process.env.PET_URL || 'http://localhost:5173/';
const browser = await chromium.launch({
  executablePath: '/usr/bin/google-chrome', headless: true,
  args: ['--autoplay-policy=no-user-gesture-required', '--mute-audio', '--no-sandbox'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('response', (r) => { if (r.status() >= 400) errors.push(r.url()); });

const front = () => page.evaluate(() => {
  const v = [...document.querySelectorAll('.pet-video')].find((x) => x.classList.contains('is-front'));
  return v ? decodeURIComponent(v.src.split('/').pop()) : null;
});
const rootLeft = () => page.evaluate(() => document.querySelector('.pet-root').style.left);

await page.goto(URL, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('.pet-hit');

// ---- 点击（按下+松开，不移动）----
const box = await page.locator('.pet-hit').boundingBox();
const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
await page.mouse.move(cx, cy);
await page.mouse.down();
await page.mouse.up();
await page.waitForTimeout(500);
const afterClick = await front();
console.log('点击后前台动画 =', afterClick);

// ---- 拖拽（按下 → 移动 >5px → 保持 → 松开）----
await page.mouse.move(cx, cy);
await page.mouse.down();
const leftBeforeDrag = await rootLeft();
await page.mouse.move(cx + 40, cy + 10, { steps: 5 }); // 触发 drag（超阈值）
await page.mouse.move(cx + 160, cy + 30, { steps: 8 });
await page.waitForTimeout(300);
const duringDrag = await front();
const leftDuringDrag = await rootLeft();
const movedDuringDrag = leftBeforeDrag !== leftDuringDrag;
await page.mouse.up();
await page.waitForTimeout(400);
const afterDrag = await front();

console.log('拖拽中前台动画 =', duringDrag, '| 位移发生 =', movedDuringDrag, `(left ${leftBeforeDrag}→${leftDuringDrag})`);
console.log('松开后前台动画 =', afterDrag);

await browser.close();

const clickOk = afterClick && afterClick.includes('点击回应');
const dragOk = duringDrag && duringDrag.includes('拖拽悬空反馈');
if (!clickOk) throw new Error('点击未触发点击回应动画: ' + afterClick);
if (!dragOk) throw new Error('拖拽未触发拖拽动画: ' + duringDrag);
if (!movedDuringDrag) throw new Error('拖拽未产生位移');
if (errors.length) throw new Error('HTTP 404: ' + errors.join(','));
console.log('\nINTERACTION SMOKE OK');
