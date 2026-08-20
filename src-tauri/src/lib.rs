// 蓝色大肥鱼 桌面宠物 —— Rust 壳（极简）
// 单个透明无边框置顶窗。全部交互/动画逻辑在 WebView 前端（src/）。
// 退出方式：右键菜单 → 关闭（JS 关窗，唯一窗口关闭即整应用退出）。
#![cfg_attr(mobile, tauri::mobile_entry_point)]

pub fn run() {
    tauri::Builder::default()
        .run(tauri::generate_context!())
        .expect("error while running big-fat-fish-pet");
}
