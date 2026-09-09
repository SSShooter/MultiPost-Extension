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
    // 公司管理页弹窗里部分"按钮"是 div[role="button"]，一并纳入查找
    const buttons = Array.from(root.querySelectorAll('button, [role="button"]')) as HTMLButtonElement[];
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

  // 媒体编辑弹层的容器：/sharing/compose 用 data-sdui-screen，公司管理页弹窗只有 role="dialog"
  const dialogSelector = '[data-testid="dialog"], [data-sdui-screen*="sharing"], [role="dialog"], [role="alertdialog"]';
  const editorSelector = 'div.tiptap.ProseMirror[contenteditable="true"], div[contenteditable="true"][role="textbox"]';

  try {
    const { title, content, images, videos } = data.data as DynamicData;

    const tags = (data.data as DynamicData).tags || [];
    const tagSuffix = tags.length ? ` ${tags.map((t) => `#${t}`).join(" ")}` : "";
    const textContent = title ? `${title}\n${content}${tagSuffix}` : `${content || ""}${tagSuffix}`;

    // LinkedIn 不支持同一帖里同时含图片和视频；优先视频，其次图片，最多 8 个
    // 注意：必须先传媒体再填文字 —— 公司管理页弹窗在上传媒体后会重渲染编辑器，先填的文字会被清空
    const mediaFiles = (videos?.length ? videos : images || []).slice(0, 8);
    if (mediaFiles.length > 0) {
      // 先等分享弹窗的编辑器出现（公司管理页 ?share=true 会自动弹出）
      await waitForElement(editorSelector, 10000);

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

      // 等待并处理媒体编辑弹层（Next/Done），公司页弹窗可能有多步，遇到就点
      let dialogClicks = 0;
      for (let i = 0; i < 30 && dialogClicks < 10; i++) {
        await sleep(500);
        const nextButton = findButtonByLabel(["Next", "下一步", "继续", "Done", "完成"]);
        if (nextButton?.closest(dialogSelector)) {
          nextButton.click();
          dialogClicks++;
          console.debug("点击了媒体编辑弹层的确认按钮", { dialogClicks });
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

    // 媒体处理完后再填文字。
    // 公司管理页弹窗（share-box-v2）用的是 Quill 编辑器（ql-editor），传媒体后有短暂处理期，
    // 期间编辑器可能被禁用或重挂载，所以采用"查找 → 聚焦 → 写入 → 校验 → 失败重试"循环
    const findEditor = (): HTMLDivElement | null => {
      const dialog = document.querySelector('[role="dialog"], [role="alertdialog"]');
      const scope = dialog || document;
      return (
        (scope.querySelector(editorSelector) as HTMLDivElement) ||
        (document.querySelector(editorSelector) as HTMLDivElement)
      );
    };

    let inserted = false;
    if (textContent.trim()) {
      const marker = textContent
        .replace(/\u00a0/g, " ")
        .trim()
        .slice(0, 20);
      for (let attempt = 1; attempt <= 15 && !inserted; attempt++) {
        const editor = findEditor();
        if (!editor) {
          console.debug(`第 ${attempt} 次未找到编辑器，等待重试`);
          await sleep(1000);
          continue;
        }

        // 确保焦点真正落在编辑器上（mousedown 触发编辑器视图聚焦）
        editor.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
        editor.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
        editor.focus();
        await sleep(300);
        const focused = document.activeElement === editor || editor.contains(document.activeElement);
        if (!focused) {
          console.debug(`第 ${attempt} 次焦点未落入编辑器`, document.activeElement);
          await sleep(700);
          continue;
        }

        // 仅当已有文字时才清空，避免 selectAll+delete 把弹窗里的其他内容一起删掉
        if ((editor.textContent || "").replace(/\u00a0/g, " ").trim().length > 0) {
          document.execCommand("selectAll", false, undefined);
          document.execCommand("delete", false, undefined);
          await sleep(200);
        }

        document.execCommand("insertText", false, textContent);
        editor.dispatchEvent(new Event("input", { bubbles: true }));
        await sleep(500);

        const current = (editor.textContent || "").replace(/\u00a0/g, " ").trim();
        if (current.includes(marker)) {
          inserted = true;
          console.debug(`第 ${attempt} 次写入成功`);
          break;
        }

        // insertText 未生效，用 paste 事件兜底（Quill/ProseMirror 对 paste 兼容性都好）
        console.debug(`第 ${attempt} 次 insertText 未生效（当前内容: ${current.slice(0, 40)}），改用 paste 兜底`);
        const dt = new DataTransfer();
        dt.setData("text/plain", textContent);
        editor.dispatchEvent(new ClipboardEvent("paste", { clipboardData: dt, bubbles: true, cancelable: true }));
        await sleep(500);
        if (
          (editor.textContent || "")
            .replace(/\u00a0/g, " ")
            .trim()
            .includes(marker)
        ) {
          inserted = true;
          console.debug(`第 ${attempt} 次 paste 兜底成功`);
        } else {
          await sleep(1000);
        }
      }
      if (!inserted) console.error("文字写入失败：重试 15 次均未生效");
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
