// MAIN world 上传 helper 入口。
// 这里的逻辑必须在页面自己的 JS 环境里跑（劫持 document.createElement、直接改 input.files、
// 触发原生 change 让各站点 SDK 自己上传），所以 world 必须是 "MAIN"。
// matches 需与 src/contents/helper.ts 里各平台的处理分支保持一致：
// bilibili 图文、bluesky 图文/视频、v2ex 编辑器、xiaoheihe 图文/视频、weibo 视频。
import "../contents/helper";

export default defineContentScript({
  matches: [
    "https://t.bilibili.com/*",
    "https://bsky.app/*",
    "https://www.v2ex.com/write*",
    "https://v2ex.com/write*",
    "https://www.xiaoheihe.cn/creator/editor/*",
    "https://weibo.com/upload/channel*",
  ],
  world: "MAIN",
  runAt: "document_start",
  main() {},
});
