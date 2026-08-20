# 蓝色大肥鱼 · 桌面宠物 🐋

常驻操作系统桌面的透明无边框置顶宠物「蓝色大肥鱼」（Q 版蓝发女仆：呆毛+鳍饰+鲸鱼尾巴），
基于 Tauri v2 + 原生 JS，**逐条复刻 [dsh-pet](https://github.com/PC2005-cloud/dsh-pet) 的交互与动画逻辑**：
待机呼吸、随机动作（含打瞌睡）、偶尔转向、屏幕漫游、点击回应、可拖拽、透明区点击穿透。

## 🙏 致谢

本项目基于 **[dsh-pet](https://github.com/PC2005-cloud/dsh-pet)** 开发，衷心感谢原作者（PC2005-cloud）的杰出工作：

- **交互逻辑**：动画链概率（30% 待机 / 10% 转向 / 40% 动作 / 20% 移动）、点击回应、拖拽判别、屏幕漫游、朝向翻转、落地对齐等行为，均**逐条复刻**自 dsh-pet 的 `lib/client.js`。
- **动画素材**：全部 51 段 Q 版蓝发女仆透明动画（`.webm`）均来自 dsh-pet 的 `assets/thumb/`，由 `npm run fetch:assets` 自动拉取。
- **版权声明**：代码部分本项目为 MIT 许可；**动画素材版权归 dsh-pet 原作者所有**，仅供个人桌面宠物自用，请勿二次分发素材。如需商用或分发，请直接联系 dsh-pet 原作者获取授权。

## 功能（与参考一致）

- **动画链**：每个动画（含待机）播完立即按概率选下一个——30% 待机 / 10% 转向 / 40% 动作 / 20% 移动，首尾相接永不停。
- **屏幕漫游**：朝 facing 方向行走，先检查空间、不走出屏幕工作区。
- **点击/拖拽**：点击有回应动画（3 段随机）；按下移动超 5px 判定拖拽，可拖到任意位置（保持抓取偏移、抑制拖后的误触）。
- **左右朝向**：东张西望播完翻转；所有动画可镜像。
- **落地对齐**：双缓冲交叉淡入无空白帧、genRef 竞态防护、脚底对齐。
- **透明窗口**：鱼身外透明区视觉穿透（单窗口 462×260 透明无边框置顶窗）。

## 运行

> 前置：Rust + 系统 dev 依赖（见下"系统依赖"）。确保本机 `DISPLAY` 为 X11 且已装好依赖。

```sh
# 1) 安装 JS 依赖（npm 官方 registry 可用时）
npm install
# 2) 拉取 51 段透明素材（npm registry 拉 dsh-pet tarball → public/thumb/）
npm run fetch:assets
# 3) 开发运行（透明悬浮窗）
npm run tauri:dev
# 4) 生产打包（AppImage / deb）
npm run tauri:build
```

## Windows 安装包（Win10 / Win11）

Tauri 不支持从 Linux 交叉编译 Windows 目标，提供两种方式在 Windows 上产出 exe 安装包：

**方式 A：GitHub Actions（推荐，无需 Windows 机器）**
把本仓库推到 GitHub 后：
```sh
git push origin main
# 在 GitHub 仓库页 → Actions → "Build Windows Installers" → Run workflow
# 或在本地打 tag：git tag v0.1.0 && git push origin v0.1.0
```
构建产物（`src-tauri/target/release/bundle/nsis/*-setup.exe` 与 `*.msi`）自动上传为 artifact，打 tag 时还会生成 GitHub Release 草稿。

**方式 B：Windows 本机构建**
在 Win10/11 机器上装 Rust + Node 20 + VS Build Tools（含 WebView2 由系统自带），然后：
```sh
npm install && npm run fetch:assets && npm run tauri:build
```
产物在 `src-tauri/target/release/bundle/nsis/*-setup.exe`（NSIS 安装器）与 `msi/*.msi`。

> 说明：Windows 端用系统自带 WebView2 播放 VP9-alpha 透明视频，无需额外组件；`fetch:assets` 已改为跨平台（node tar 解包），Windows 上可直接运行。


> 仅调试前端逻辑而不起 Rust 壳：`npm run dev` 后浏览器打开 `http://localhost:5173`
> （会自动从默认动画链开始；此模式下透明区点击穿透由命中层模拟，仅作逻辑预览）。

## 系统依赖（Linux/Ubuntu）

Tauri Rust 侧编译需要系统 webkit/gtk dev 头文件，**运行还需要 gstreamer1.0-plugins-bad**（解码带 alpha 通道的 VP9 透明动画，缺它角色渲染不出来）：

```sh
sudo apt-get update && sudo apt-get install -y \
  libwebkit2gtk-4.1-dev libsoup-3.0-dev javascriptcoregtk-4.1-dev \
  libayatana-appindicator3-dev librsvg2-dev \
  gstreamer1.0-plugins-bad
```

> 若启动后窗口透明但角色空白，先 `gst-inspect-1.0 vp9alphadecodebin` 确认
> plugins-bad 已装；GPU 异常机器可用 `LIBGL_ALWAYS_SOFTWARE=1 ./run.sh` 软件渲染。

## 测试

```sh
npm test                       # 单测（概率表/竞态/几何，16 项）
npm run dev &                  # 起 vite dev
node scripts/smoke.mjs         # 无头 Chrome：DOM/解码/动画链
node scripts/interact.mjs      # 无头 Chrome：点击/拖拽交互
```

## 项目结构

```
src/config.js      动画目录与常量（来自参考，逐值一致）
src/pure.js        纯逻辑：概率分桶/结束分派/三段式插值/落地对齐/命中框/钳制
src/player.js      双缓冲 <video> + genRef 竞态防护
src/controller.js  状态机编排（动画链/移动/点击拖拽）
src/facade.js      几何抽象（浏览器实现）；src/tauri-facade.js（Tauri 双窗实现）
src/input.js       点击 vs 拖拽判别、pointer capture、幽灵点击抑制
src/main.js        入口（组装 + host 判定）；src/tauri-facade.js（Tauri 单窗实现）
src/input.js       点击 vs 拖拽判别、pointer capture、幽灵点击抑制
src-tauri/         Rust 壳（单透明窗/退出）
public/thumb/      51 段透明动画（gitignore，fetch:assets 拉取）
scripts/           素材拉取 + 浏览器/交互冒烟
```

## 许可与素材版权

- 代码：MIT。
- 动画素材：版权归 [dsh-pet](https://github.com/PC2005-cloud/dsh-pet) 原作者，
  LICENSE 状态下标注"待定"；本项目仅供个人桌面宠物自用，请勿二次分发素材。
