import { createdInputs } from "../helper";
import { waitForElement } from "./common";

// bsky 的图片/视频共用一个 file input（accept 同时含 image/* 与 video/*），
// 优先取当前 DOM 里最后创建的那个；createdInputs 作为兜底（input 可能不在文档里）。
function findFileInput(): HTMLInputElement | null {
  const inDom = document.querySelectorAll<HTMLInputElement>('input[type="file"]');
  if (inDom.length > 0) {
    return inDom[inDom.length - 1];
  }
  const created = createdInputs.filter((input) => input.type === "file");
  return created.length > 0 ? created[created.length - 1] : null;
}

// 2026-09 改版：媒体按钮的 data-testid 由 openGalleryBtn 变为 openMediaBtn
// （旧选择器找不到元素，waitForElement 会 reject，导致 isProcessingImage 卡死在 true）。
// 点击后同步创建 input[type=file]，图片、视频走同一个入口；该 input 是临时节点，
// 文件选择器一关就被 bsky 摘掉，所以拿到之后要马上塞文件。
async function openMediaPicker(): Promise<HTMLInputElement | null> {
  const mediaButton = (await waitForElement('button[data-testid="openMediaBtn"]')) as HTMLElement | null;
  if (!mediaButton) {
    console.error("未找到上传媒体按钮");
    return null;
  }

  mediaButton.click();

  const uploadInput = (await waitForElement('input[type="file"]').catch(() => null)) as HTMLInputElement | null;
  if (!uploadInput) {
    console.error("未找到上传输入框");
    return null;
  }

  return uploadInput;
}

// 派发必须趁 input 还挂在 DOM 上：摘掉之后再派发 change 不会冒泡到 bsky 的容器监听，
// 结果就是图片静默丢失（实测延迟 1s 以上派发必失败）。
function attachFiles(uploadInput: HTMLInputElement, files: File[]): boolean {
  const target = uploadInput.isConnected ? uploadInput : findFileInput();
  if (!target) {
    console.error("未找到上传输入框");
    return false;
  }

  const dataTransfer = new DataTransfer();
  for (const file of files) {
    dataTransfer.items.add(file);
  }
  target.files = dataTransfer.files;

  target.dispatchEvent(new Event("input", { bubbles: true }));
  target.dispatchEvent(new Event("change", { bubbles: true }));

  return true;
}

let isProcessingVideo = false;

export async function handleBlueskyVideoUpload(event: MessageEvent) {
  if (isProcessingVideo) {
    return;
  }
  isProcessingVideo = true;

  try {
    const video = event.data.video;
    if (!video) {
      console.error("未找到视频");
      return;
    }

    const uploadInput = await openMediaPicker();
    if (!uploadInput) {
      return;
    }

    attachFiles(uploadInput, [video]);
  } catch (error) {
    console.error("bluesky 视频上传出错:", error);
  } finally {
    isProcessingVideo = false;
  }
}

let isProcessingImage = false;

export async function handleBlueskyImageUpload(event: MessageEvent) {
  if (isProcessingImage) {
    return;
  }
  isProcessingImage = true;

  try {
    const images: File[] = event.data.images;
    if (!images || images.length === 0) {
      console.error("未找到图片");
      return;
    }

    const uploadInput = await openMediaPicker();
    if (!uploadInput) {
      return;
    }

    attachFiles(uploadInput, images);
  } catch (error) {
    console.error("bluesky 图片上传出错:", error);
  } finally {
    isProcessingImage = false;
  }
}
