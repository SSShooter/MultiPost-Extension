import type { DynamicData, SyncData } from "../common";

// 不支持发布视频
export async function DynamicBluesky(data: SyncData) {
  function waitForElement(selector: string, timeout = 10000): Promise<Element> {
    return new Promise((resolve, reject) => {
      const element = document.querySelector(selector);
      if (element) {
        resolve(element);
        return;
      }

      const observer = new MutationObserver(() => {
        const element = document.querySelector(selector);
        if (element) {
          resolve(element);
          observer.disconnect();
        }
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true,
      });

      setTimeout(() => {
        observer.disconnect();
        reject(new Error(`Element with selector "${selector}" not found within ${timeout}ms`));
      }, timeout);
    });
  }

  function findPublishButton(): HTMLButtonElement | null {
    const publishButton = document.querySelector(
      'button[aria-label="Publish post"]:not(:disabled)',
    ) as HTMLButtonElement | null;
    if (publishButton) return publishButton;

    const publishLabels = ["Publish", "Post", "发布", "发布帖子", "发布帖文", "發佈", "發佈帖子", "發佈貼文"];
    return (
      Array.from(document.querySelectorAll<HTMLButtonElement>("button:not(:disabled)")).find((button) => {
        const ariaLabel = button.getAttribute("aria-label")?.trim();
        const text = button.textContent?.trim();
        return publishLabels.includes(ariaLabel || "") || publishLabels.includes(text || "");
      }) || null
    );
  }

  function dispatchPublishShortcut(target: HTMLElement) {
    const isMac = /Mac|macOS|iPhone|iPod|iPad/.test(navigator.userAgent);
    target.focus();
    target.dispatchEvent(
      new KeyboardEvent("keydown", {
        bubbles: true,
        cancelable: true,
        key: "Enter",
        code: "Enter",
        metaKey: isMac,
        ctrlKey: !isMac,
        composed: true,
      }),
    );
  }

  // bsky 处理贴进来的文件是异步的：change 之后约 1s 撰写框里才出现缩略图
  // （[data-testid="selectedPhotoImage"] 每张一个）。不等它就点 Post，
  // 结果是文字发出去了、图片没跟上。
  async function checkImageAttached(expectedCount: number, maxAttempts = 30, interval = 1000): Promise<boolean> {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const attachedCount = document.querySelectorAll('[data-testid="selectedPhotoImage"]').length;
      if (attachedCount >= expectedCount) {
        console.log(`bsky 已贴入 ${attachedCount} 张图片`);
        return true;
      }
      await new Promise((resolve) => setTimeout(resolve, interval));
    }
    return false;
  }

  try {
    const { content, images, title } = data.data as DynamicData;

    await new Promise((resolve) => setTimeout(resolve, 3000));

    // 撰写按钮:优先 data-testid(最稳定),回退到多语言 aria-label 兜底
    const composeLabels = ["撰写新帖文", "新帖文", "撰寫新貼文", "Compose new post", "New post"];
    let newPostButton = document.querySelector('button[data-testid="composeFAB"]') as HTMLButtonElement | null;
    if (!newPostButton) {
      for (const label of composeLabels) {
        const btn = document.querySelector(`button[aria-label="${label}"]`) as HTMLButtonElement | null;
        if (btn) {
          newPostButton = btn;
          break;
        }
      }
    }
    if (newPostButton) {
      newPostButton.click();
    } else {
      console.log("未找到撰写新帖文按钮");
      return;
    }

    // 处理输入

    const contentInput = (await waitForElement('div[contenteditable="true"]')) as HTMLDivElement;
    contentInput.focus();
    contentInput.textContent = title ? `${title}\n${content}` : content;
    contentInput.dispatchEvent(new Event("input", { bubbles: true }));
    contentInput.dispatchEvent(new Event("change", { bubbles: true }));
    console.log("内容已输入:", content);

    const limitedImages = images.slice(0, 4);
    let mediaAttached = true;
    if (limitedImages.length > 0) {
      const imageData = [];
      for (const file of limitedImages) {
        const response = await fetch(file.url);
        const blob = await response.blob();
        const imageFile = new File([blob], file.name, { type: file.type });
        console.log(`文件: ${imageFile.name} ${imageFile.type} ${imageFile.size}`);
        imageData.push(imageFile);
      }
      await new Promise((resolve) => setTimeout(resolve, 1000));

      window.postMessage({ type: "BLUESKY_IMAGE_UPLOAD", images: imageData }, "*");

      mediaAttached = await checkImageAttached(limitedImages.length);
      if (!mediaAttached) {
        console.warn(`bsky 图片未确认贴入撰写框（预期 ${limitedImages.length} 张），跳过自动发布以免发出没有图的帖`);
      }
    }

    // 发布动态
    if (data.isAutoPublish) {
      if (!mediaAttached) {
        return;
      }
      const maxAttempts = 3;
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const publishButton = findPublishButton();
        if (publishButton) {
          publishButton.click();
          console.log("已点击发布按钮");
          await new Promise((resolve) => setTimeout(resolve, 3000));
          window.location.reload();
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
      dispatchPublishShortcut(contentInput);
      console.log("已触发 Bluesky 发布快捷键");
    }
  } catch (error) {
    console.error("bluesky 发布过程中出错:", error);
  }
}
