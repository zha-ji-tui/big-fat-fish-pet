/**
 * ============================================================================
 * 动画目录（animation catalog）与常量 —— 事实来源（single source of truth）
 * ============================================================================
 * 数值逐条复刻自 dsh-pet 的 lib/client.js（https://github.com/PC2005-cloud/dsh-pet），
 * 保证交互/动画逻辑行为一致。角色：Q 版蓝发女仆「蓝色大肥鱼」。
 */

// 对齐说明：thumb 视频是 640×360（16:9）画布，人物"脚底"在 y=330 处。
// (360-330)/360 = 30/360 = 0.0833，与 2160×1215 母版 (1215-1115)/1215 比例一致，
// 用此比例做落地对齐，缩放后依然准确。
export const CANVAS_H = 360; // thumb 画布高度
export const FEET_Y = 330;   // thumb 画布上"脚底"的 y 坐标

// 点击/拖拽命中矩形（thumb 640×360 像素坐标）
export const HIT_BOX = { x0: 200, y0: 50, x1: 440, y1: 335 };

// 主体待机动画（链中一环）
export const IDLE = '待机呼吸休闲';
// 转向动画（东张西望：内容就是从偏左看到偏右，播完翻转 facing）
export const TURN = '东张西望';

// 随机动作池：42 段，全部等概率抽取
export const ACTS = [
  '悠闲哼歌', '超大伸懒腰', '原地专心玩魔方', '原地敲击桌面互动',
  '原地重力下蹲压缩', '哈欠连天', '原地小憩沉眠', '原地蹲下玩玩具汽车',
  '鲸鱼吐泡泡特效', '女仆屈膝礼仪', '被吓一跳（炸毛）',
  '原地跳跃抓碎头顶物品', '小幅度原地 360 度旋转展示', '偷吃零食被抓住',
  '玩游戏气急败坏', '用鲸鱼尾巴拍打地面', '打瞌睡被惊醒', '玩水枪',
  '小提琴演奏', '蓝鲸现世', '吃白饭', '照镜子', '优雅女仆舞', '轻快摇摆舞',
  '可爱宅舞', '整体换装试色', '大口吃零食', '吹气球', '动物环绕',
  '深度思考碎碎念', '轻快记录', '写代码', '吃Token', '吃早餐', '吃午餐',
  '吃晚餐', '放风筝', '摇扇纳凉', '吃冰淇淋融化', '被落叶淹没',
  '中秋赏月吃月饼', '堆雪人',
];

// 点击回应动画池（3 选 1）
export const CLICKS = [
  '点击回应 - 开心跃动', '点击回应 - 害羞惊讶', '点击回应 - 傲娇生气（侧身展示）',
];

// 拖拽动画（按住时播放）
export const DRAG = '被鼠标拖拽悬空反馈';

// 移动动画池：动画只提供"走路姿态"，实际位置移动由代码（rAF）驱动
export const MOVES = ['螃蟹走路', '原地漂浮踏步', '原地左转奔跑'];

// 移动参数
export const MOVE_MIN_PX = 60;  // 每次移动最短距离（px）
export const MOVE_MAX_PX = 240; // 每次移动最长距离（px）
export const MOVE_MARGIN = 20;  // 屏幕边缘安全边距（px）
export const MOVE_LEAD_SEC = 2; // 动画开头 2s 准备动作，位置不动
export const MOVE_TAIL_SEC = 2; // 动画结尾 2s 收尾动作，位置不动

// 动画链概率（pickNext 用，roll 越大越靠后）
export const ROLL_IDLE = 0.3;   // <0.3 待机
export const ROLL_TURN = 0.4;   // <0.4 转向
export const ROLL_ACTS = 0.8;   // <0.8 动作
// >=0.8 移动（空间不够回退动作）

// 显示参数
export const SIZE = 462;           // 舞台宽度（px），高 = 462×9/16 ≈ 260
export const CORNER = 'bottom-right'; // 默认角落

// 素材路径（Vite dev 与 Tauri dev 都以 /thumb/... 可访问）
export const THUMB_PATH = '/thumb/';

/** 动画文件名 URL（中文名做 URL 编码） */
export function animSrc(name) {
  return THUMB_PATH + encodeURIComponent(name) + '.webm';
}

/** 生成 [min, max) 随机整数 */
export function randomBetween(min, max) {
  return Math.floor(min + Math.random() * (max - min));
}

/**
 * 从字符串池等概率随机抽一个；exclude 排除某名字（避免连续重复）。
 * @param {(string|string[])} pool 单个也算数组
 * @param {string} [exclude]
 */
export function pick(pool, exclude) {
  const arr = Array.isArray(pool) ? pool : [pool];
  const entries = exclude ? arr.filter((n) => n !== exclude) : arr;
  return entries[Math.floor(Math.random() * entries.length)];
}
