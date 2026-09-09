// 注意：这个 MAIN world 内容脚本在 Plasmo 构建产物中从未被注册进 manifest（dev/prod 均无），
// 迁移到 WXT 后保持现状（未注册）。如需启用，将本文件移到 src/entrypoints/helper.content.ts
// 并导出 defineContentScript({ matches, world: "MAIN", runAt: "document_start", main() {...} })。
import { handleBilibiliImageUpload } from "./helper/bilibili";
import { handleBlueskyImageUpload, handleBlueskyVideoUpload } from "./helper/bluesky";
import { handleWeiboVideoUpload, prepareWeiboVideoInput } from "./helper/weibo";
import { handleXiaoheiheImageUpload, handleXiaoheiheVideoUpload } from "./helper/xiaoheihe";

interface CodeMirrorElement extends HTMLDivElement {
  CodeMirror: {
    setValue: (content: string) => void;
  };
}

const originalCreateElement = document.createElement.bind(document);
export const createdInputs: HTMLInputElement[] = [];

document.createElement = (tagName, options) => {
  const element = originalCreateElement(tagName, options);

  if (tagName.toLowerCase() === "input") {
    createdInputs.push(element);
    prepareWeiboVideoInput(element);
    console.log("element", element);
  }
  return element;
};

function handleMessage(event: MessageEvent) {
  if (event.source !== window || !event.data || typeof event.data !== "object") {
    return;
  }

  const data = event.data;

  if (data.type === "BILIBILI_DYNAMIC_UPLOAD_IMAGES") {
    handleBilibiliImageUpload(event);
  } else if (data.type === "BLUESKY_VIDEO_UPLOAD") {
    handleBlueskyVideoUpload(event);
  } else if (data.type === "BLUESKY_IMAGE_UPLOAD") {
    handleBlueskyImageUpload(event);
  } else if (data.type === "V2EX_DYNAMIC_UPLOAD") {
    const editor = document.querySelector(".CodeMirror") as CodeMirrorElement;
    if (editor) {
      editor.CodeMirror.setValue(data.content);
    }
  } else if (data.type === "XIAOHEIHE_IMAGE_UPLOAD") {
    handleXiaoheiheImageUpload(event);
  } else if (data.type === "XIAOHEIHE_VIDEO_UPLOAD") {
    handleXiaoheiheVideoUpload(event);
  } else if (data.type === "WEIBO_UPLOAD_VIDEO") {
    handleWeiboVideoUpload(event);
  }
}

// 添加事件监听器
window.addEventListener("message", handleMessage);
