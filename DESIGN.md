# 蓝色大肥鱼 · 桌面宠物 — 设计与实现

> 状态：M1（前端逻辑复刻）已完成并验证；M2（Tauri 壳）脚手架就绪，待系统依赖安装后编译。
> 参考：https://github.com/PC2005-cloud/dsh-pet （交互/动画逻辑逐条复刻）
> 角色：Q 版蓝发女仆「蓝色大肥鱼」（呆毛+鳍饰+鲸鱼尾巴的海洋系美少女；其 51 段透明动画即本项目素材）

---

## 1. 定位

在**操作系统桌面**渲染一只常驻的透明无边框置顶宠物「蓝色大肥鱼」。与参考 dsh-pet 的差异：
- dsh-pet 是 DSH Web 插件（运行在浏览器页面里，`shell.overlay` 槽、双 `<video>`、React）。
- 本项目是 **Tauri v2 桌面应用**（Rust 壳 + 系统 WebKitGTK 内核），同一套 JS 前端逻辑跑在原生透明窗口里，实现真正的"桌面常驻"。
- 因此参考的 **host 半（/pet 路由）被移除**（本地静态资源由 Tauri 直接提供，无网络），**React 壳被拆除**（原生 DOM），**`shell.overlay` 挂载换成本地窗口**。**交互/动画核心逻辑 1:1 保留**。

## 2. 复刻映射（参考 lib/client.js → 本实现）

| 参考机制 | 本实现文件 | 说明 |
|---|---|---|
| 动画目录（IDLE/TURN/ACTS(42)/CLICKS(3)/DRAG/MOVES(3) + HIT_BOX/FEET_Y/MOVE_* 常量） | `src/config.js` | 数值、命名逐字一致 |
| 动画链：无常驻待机/无定时器，播完即 `pickNext` 30/10/40/20 | `src/pure.js` `decideNext` + `src/controller.js` `pickNext` | 概率表一致；移动空间不足回退动作 |
| 双缓冲 `video` A/B + `is-front` 0.18s 交叉淡入 | `src/player.js` `DoubleBufferPlayer` | 同 DOM 结构/同 CSS transition |
| genRef 代数守卫 + `old !== el` 竞态防护 | `src/player.js` | 原样保留 |
| 交互打断 → 播完回待机缓冲 → 入链 | `src/controller.js` `handleEnded` + `pure.handleEndedKind` | 一致；拖拽后回**循环**待机（忠实参考代码行为） |
| facing 镜像 `scaleX(-1)`（onReady 内联 transform） | `src/player.js` | 一致 |
| 移动：姿态=视频、位移=rAF 跟随 `currentTime`、2s 准备/6s 位移/2s 收尾、播放前检查空间 | `src/controller.js` `tryMove/startMoveDrive` + `pure.moveRatioAt` | 一致；屏幕=所在显示器工作区 |
| 点击 vs 拖拽：5px 阈值、pointer capture、抓取偏移、100ms 幽灵点击抑制 | `src/input.js` | 语义一致；几何跟随走 facade |
| HIT_BOX 命中矩形 + 视频 pointer-events:none | `src/main.js` 命中层 DOM + `hitBoxPx`（浏览器）；Tauri 下由**命中窗**承载 | 达到"透明区点击穿透"效果 |
| 落地对齐 `bottomPad = size×9/16×(360-330)/360`、比例定位、resize 重算钳制 | `src/pure.js` `bottomPad/clampCenterRatio` + `src/facade.js` | 一致 |

## 3. 架构（单窗口透明悬浮）

参考靠"命中层 vs 视频层"在一个页面内做点击穿透；Tauri 的原生窗口是矩形、没有逐像素
点击穿透资源（双窗口 + 跨窗 IPC 的坐标/拖拽链路复杂且脆弱）。**权衡后 M2 采用单窗口**：

```
pet 窗（462×260 透明、无边框、置顶、不进任务栏）
  ├─ 双缓冲 <video> A/B + 动画链状态机 + 漫游驱动 + 命中层（pointer 事件）
  ├─ 整窗位置 = 屏幕逻辑坐标由窗口 setPosition 驱动（漫游/拖拽都移动整窗）
  └─ 透明区视觉穿透；但该小矩形内的点击会被窗口拦截（参考的"点到桌面"细节未复刻）
```

- **几何隔离**：所有坐标/比例逻辑只依赖 `src/facade.js` 抽象接口
  （`viewport/centerRangePx/getCenter/setCenter/applyRatio/resetToCorner/loadPos/savePos/onResize`）。
  - 浏览器实现 `createBrowserFacade`：root 是 `position:fixed` 的 DOM，坐标=视口；
  - Tauri 实现 `createTauriFacade`：坐标=屏幕逻辑坐标（`window.screen`），
    `setCenter` 调 `getCurrentWindow().setPosition(new LogicalPosition(...))` 移动整窗，
    根容器 class `pet-window` 铺满窗（top-left）。
  - 因此 controller / movement / input 在两套宿主下共享同一逻辑（M1 浏览器即验证全集）。
- 位置记忆：浏览器与 Tauri 都走 localStorage（WebKitGTK webview 支持）。
- 已知偏差：无逐像素点击穿透（透明矩形内点击不落到桌面）。若需精确穿透，可后续升级为
  「显示窗(ignore_cursor_events) + 命中窗」双窗口，几何接口无需改动。

## 4. 素材

- 来源：npm registry `dsh-pet@0.1.4` tarball 解出 `assets/thumb/*.webm`（51 段，~35MB），
  `scripts/fetch-assets.mjs` 一键拉取。不入 git（`.gitignore`）。
- 播放：Tauri 本地资源直接喂 `<video src>`（webm/vp9-alpha，WebKitGTK 原生支持）。
- **授权**：参考仓库代码 MIT；素材授权在参考 DESIGN.md 标注"待定"。本项目为个人桌面宠物自用
  复刻，勿再分发素材；README 亦注明版权归原作者。

## 5. 测试

- 单测（`node --test tests/*.test.js`，无 DOM）：`pure.js`（概率分桶/结束分派/三段式插值/落地对齐/命中框/钳制/目录完整性）、`player.js`（双缓冲/竞态模拟/loop/facing 镜像/readyState 即回调）。16 项全绿。
- 浏览器冒烟（`scripts/smoke.mjs`，playwright-core + 系统 Chrome）：DOM 结构、无 JS 错误、webm 解码、动画链推进。
- 交互冒烟（`scripts/interact.mjs`）：真实点击→点击回应、拖拽→拖拽动画+跟手位移、松手→待机缓冲。已通过。
- M2 手工验收清单见下文。

## 6. 踩坑记录

1. **沙箱 /tmp 隔离**：不同 bash 调用共享不同 /tmp 视图，跨目录 `npm install`/下载需用工作区或显式路径。
2. **npm cache 只读**：沙箱写 `~/.npm` 报 EROFS → 用 `--cache ./.npm-cache` 项目内缓存。
3. **中文素材名**：`<video src>` 用 `encodeURIComponent` 编码（参考同款）；单测断言需 `decodeURIComponent`。
4. **`bottomPad` 位置**：偶发从错误的模块导入，rollup 报"not exported"——统一收敛到 `pure.js`。
5. **Tauri 需要系统 dev 头文件**：`libwebkit2gtk-4.1-dev` 等（运行时 .so 有、.pc/.h 无）→ 必须 apt 安装才能编译 Rust 侧。
6. **tray 依赖**：GNOME 托盘需要单独扩展，本项目不引入 tray；退出/重置走右键菜单（hit 窗 JS 菜单）。
