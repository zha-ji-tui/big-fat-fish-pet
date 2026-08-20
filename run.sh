#!/usr/bin/env bash
# ============================================================================
# 蓝色大肥鱼 启动器 —— 带 WebKitGTK 环境容错，避免部分机器上的启动闪退
# ============================================================================
# 现象：双击 .deb 安装的 big-fat-fish-pet 立即闪退。
# 原因：WebKitGTK 在部分 GPU/合成器/沙箱环境下初始化崩溃（多为 dmabuf 渲染
#       或加速合成模式），与宠物代码无关（沙箱无 GPU 环境实测可正常运行）。
# 本脚本逐级尝试：先默认启动，若 3 秒内退出则逐级加兼容变量重试。
set -u
cd "$(dirname "$0")"

# DISPLAY 自动探测：登录会话的 X 编号可能不是 :0（本机 gdm 动态分配）。
# $DISPLAY 无效时依次尝试现有 X socket，避免开机自启找不到显示。
if [ -z "${DISPLAY:-}" ] || [ ! -S "/tmp/.X11-unix/X${DISPLAY#:}" ]; then
  for d in :0 :1 :2; do
    if [ -S "/tmp/.X11-unix/X${d#:}" ]; then
      export DISPLAY=$d
      break
    fi
  done
fi

BIN=./.target/release/big-fat-fish-pet
[ -x "$BIN" ] || BIN=$(command -v big-fat-fish-pet || echo "./target/release/big-fat-fish-pet")
LOG=./.pet.err

try() {
  env "$@" "$BIN" 2> "$LOG" &
  local pid=$!
  sleep 3
  if kill -0 "$pid" 2>/dev/null; then return 0; fi
  wait "$pid" 2>/dev/null
  return 1
}

if try; then exit 0; fi
if try WEBKIT_DISABLE_DMABUF_RENDERER=1; then exit 0; fi
if try WEBKIT_DISABLE_COMPOSITING_MODE=1; then exit 0; fi
if try LIBGL_ALWAYS_SOFTWARE=1 GDK_BACKEND=x11; then exit 0; fi

echo "启动失败，错误信息（见 $LOG）：" >&2
tail -n 20 "$LOG" >&2
exit 1
