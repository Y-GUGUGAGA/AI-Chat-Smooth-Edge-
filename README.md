# AI Chat Smooth — Edge 防卡顿插件

针对 **GPT (chatgpt.com)** 和 **DeepSeek (chat.deepseek.com / deepseek.com)** 网页端在模型流式回答时页面严重卡顿的问题。

## 卡顿原因与原理

流式回答时每吐出一个 token：
1. 消息 DOM 更新 → 触发整页 **reflow/repaint**
2. 页面自动跟随滚动，大量调用 `scrollTo({behavior:'smooth'})` → 每个调用都启动一次滚动动画，动画叠加导致主线程持续繁忙

本插件通过三重优化解决：

| 优化项 | 做法 | 效果 |
|--------|------|------|
| 滚动节流 | 劫持 `scrollTo`/`scroll`/`scrollIntoView`，每 200ms 最多执行一次（可调），并强制瞬时滚动 | 消除平滑滚动动画叠加 |
| 布局隔离 | 消息元素加 `contain: layout style` | 消息内部文本变化只在该消息内重排，不再牵连整页 |
| 禁用动画 | 流式期间关闭全部 CSS animation/transition | 减少合成层开销 |

## 安装方法（Edge）

1. 打开 Edge，地址栏输入 `edge://extensions/` 回车
2. 打开左下角 **开发人员模式**
3. 点击 **加载解压缩的扩展**，选择本文件夹（`smooth-chat-edge`）
4. 完成。访问 chatgpt.com / deepseek.com 时自动生效

## 使用

- 网页 **右下角 ⚡ 按钮**：点击开关优化，按住可拖动到任意位置
- 点击工具栏图标打开设置面板，可独立开关每一项优化、调整滚动节流间隔（50–500ms）
- 所有设置通过 `chrome.storage.sync` 保存，多设备同步

## 文件说明

```
manifest.json   MV3 扩展清单（自动注入 GPT/DeepSeek 域名）
content.js      核心逻辑：滚动节流补丁 + 开关按钮
content.css     性能优化 CSS + 悬浮按钮样式
popup.html/js   工具栏设置面板
```

## 备注

- 若 DeepSeek 使用了其他域名（如 API 域名），可自行在 `manifest.json` 的 `matches` 中追加
- 如需在其他 AI 站点使用，同样往 `matches` 添加对应域名即可
- 优化关闭后所有补丁完全恢复，对页面零副作用
