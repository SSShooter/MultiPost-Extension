import type { DynamicData, SyncData } from "../common";

// 只能图片或视频，不能同时上传
export async function DynamicLinkedin(data: SyncData) {
  console.log("LinkedIn 函数被调用");

  const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

  function waitForElement(selector: string, timeout = 10000): Promise<Element> {
    return new Promise((resolve, reject) => {
      const element = document.querySelector(selector);
      if (element) {
        resolve(element);
        return;
      }

      const observer = new MutationObserver(() => {
        const el = document.querySelector(selector);
        if (el) {
          resolve(el);
          observer.disconnect();
        }
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true,
      });

      setTimeout(() => {
        observer.disconnect();
        reject(new Error(`元素未找到 "${selector}" 在 ${timeout}ms 内`));
      }, timeout);
    });
  }

  function findButtonByLabel(
    labels: string[],
    root: Document | Element | ShadowRoot = document,
  ): HTMLButtonElement | null {
    const buttons = Array.from(root.querySelectorAll("button")) as HTMLButtonElement[];
    for (const label of labels) {
      const lower = label.toLowerCase();
      const found = buttons.find((b) => {
        const text = (b.innerText || "").trim().toLowerCase();
        const aria = (b.getAttribute("aria-label") || "").toLowerCase();
        const title = (b.getAttribute("title") || "").toLowerCase();
        return text === lower || aria === lower || title === lower || text.includes(lower) || aria.includes(lower);
      });
      if (found) return found as HTMLButtonElement;
    }
    return null;
  }

  try {
    const { title, content, images, videos } = data.data as DynamicData;

    // LinkedIn 2025 年后改用 Tiptap/ProseMirror 编辑器，并放在 /sharing/compose 页面（含弹层）
    const editor = (await waitForElement(
      'div.tiptap.ProseMirror[contenteditable="true"], div[contenteditable="true"][role="textbox"]',
      10000,
    )) as HTMLDivElement;
    await sleep(500);

    console.debug("editor", editor);

    // 输入文本：清空后插入，避免 ProseMirror 保留旧占位
    editor.focus();
    await sleep(200);
    document.execCommand("selectAll", false, undefined);
    document.execCommand("delete", false, undefined);
    await sleep(200);

    const tags = (data.data as DynamicData).tags || [];
    const tagSuffix = tags.length ? ` ${tags.map((t) => `#${t}`).join(" ")}` : "";
    const textContent = title ? `${title}\n${content}${tagSuffix}` : `${content || ""}${tagSuffix}`;
    document.execCommand("insertText", false, textContent);
    editor.dispatchEvent(new Event("input", { bubbles: true }));
    await sleep(300);

    // LinkedIn 不支持同一帖里同时含图片和视频；优先视频，其次图片，最多 8 个
    const mediaFiles = (videos?.length ? videos : images || []).slice(0, 8);
    if (mediaFiles.length > 0) {
      const mediaButton = findButtonByLabel(["Media", "媒体", "Add media", "添加媒体"]);
      if (!mediaButton) {
        console.debug("未找到 Media 按钮");
        return;
      }
      mediaButton.click();
      await sleep(500);

      // 等待文件输入出现并设置文件
      const fileInput = (await waitForElement(
        'input[type="file"][accept*="image"], input[type="file"]',
        10000,
      )) as HTMLInputElement;
      const dataTransfer = new DataTransfer();

      for (const fileData of mediaFiles) {
        console.debug("try upload file", fileData);
        try {
          const response = await fetch(fileData.url);
          const arrayBuffer = await response.arrayBuffer();
          const file = new File([arrayBuffer], fileData.name, { type: fileData.type || "image/png" });
          dataTransfer.items.add(file);
        } catch (error) {
          console.error("获取文件失败:", error);
        }
      }

      fileInput.files = dataTransfer.files;
      fileInput.dispatchEvent(new Event("change", { bubbles: true }));
      fileInput.dispatchEvent(new Event("input", { bubbles: true }));
      console.debug("文件上传操作完成");

      // 等待并处理图片编辑弹层（Next/Done）
      await sleep(1000);
      for (let i = 0; i < 20; i++) {
        await sleep(500);
        const nextButton = findButtonByLabel(["Next", "下一步", "继续", "Done", "完成"]);
        if (nextButton?.closest('[data-testid="dialog"], [data-sdui-screen*="sharing"]')) {
          nextButton.click();
          console.debug("点击了媒体编辑弹层的确认按钮");
          break;
        }
      }

      // 等待媒体预览进入 composer
      for (let i = 0; i < 30; i++) {
        await sleep(500);
        const compose = document.querySelector(
          '[data-sdui-screen="com.linkedin.sdui.flagshipnav.sharing.ShareCompose"]',
        );
        const realMedia = (compose || document).querySelectorAll('img[src^="blob:"], video').length;
        if (realMedia > 0) {
          console.debug("媒体已添加到 composer", { realMedia });
          break;
        }
      }
    }

    // 等待 Post 按钮可用
    let postButton: HTMLButtonElement | null = null;
    for (let i = 0; i < 30; i++) {
      postButton = findButtonByLabel(["Post", "发布", "發佈"]);
      if (postButton && !postButton.disabled) break;
      await sleep(500);
    }

    console.debug("sendButton", postButton);
    if (postButton) {
      if (data.isAutoPublish) {
        console.debug("自动发布：点击发布按钮");
        postButton.click();
      } else {
        console.debug("帖子准备就绪，等待手动发布");
      }
    } else {
      console.debug("未找到'发送'按钮");
    }
  } catch (error) {
    console.error("LinkedIn 发布过程中出错:", error);
  }
}
