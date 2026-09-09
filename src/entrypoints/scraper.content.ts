import scrapeContent from "../contents/scraper/default";

export default defineContentScript({
  matches: ["<all_urls>"],
  exclude_matches: ["https://*.xiaohongshu.com/*"],
  runAt: "document_start",
  main() {
    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (message.type === "MULTIPOST_EXTENSION_REQUEST_SCRAPER_START") {
        let hasStarted = false;
        let timeoutId: ReturnType<typeof setTimeout> | undefined;

        const scrapeOnce = async () => {
          if (hasStarted) return;
          hasStarted = true;
          let response: Awaited<ReturnType<typeof scrapeContent>> | { error: string };

          try {
            const requestedWait = Number(new URLSearchParams(window.location.search).get("wait") || 0);
            if (Number.isFinite(requestedWait) && requestedWait > 0) {
              await new Promise((resolve) => setTimeout(resolve, Math.min(requestedWait, 30) * 1000));
            }

            response = await scrapeContent();
            await new Promise((resolve) => setTimeout(resolve, 1000));
          } catch (error) {
            response = { error: String(error instanceof Error ? error.message : error) };
          } finally {
            window.removeEventListener("scroll", checkScrollEnd);
            if (timeoutId) clearTimeout(timeoutId);
            sendResponse(response);
          }
        };

        const checkScrollEnd = () => {
          const body = document.body;
          if (body && window.innerHeight + window.pageYOffset >= body.offsetHeight - 2) {
            scrapeOnce();
          }
        };

        const startScraping = async () => {
          for (let attempt = 0; attempt < 50 && !document.body; attempt++) {
            await new Promise((resolve) => setTimeout(resolve, 100));
          }
          await new Promise((resolve) => setTimeout(resolve, 1000));

          if (window.location.hostname === "x.com") {
            timeoutId = setTimeout(scrapeOnce, 3000);
            return;
          }

          window.addEventListener("scroll", checkScrollEnd);
          const body = document.body;
          if (body) {
            window.scrollTo({
              top: body.scrollHeight,
              behavior: "smooth",
            });
          }
          timeoutId = setTimeout(scrapeOnce, 5000);
          checkScrollEnd();
        };

        startScraping().catch(scrapeOnce);

        return true;
      }
      return false;
    });
  },
});
