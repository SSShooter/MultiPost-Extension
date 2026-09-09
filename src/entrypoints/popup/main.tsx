import "../../style.css";
import { useEffect } from "react";
import { createRoot } from "react-dom/client";

function IndexPopup() {
  useEffect(() => {
    const url = chrome.runtime.getURL("/auto-publish.html");
    chrome.tabs.query({}, (tabs) => {
      const existing = tabs.find((tab) => tab.url === url);
      if (existing?.id) {
        chrome.tabs.update(existing.id, { active: true });
      } else {
        chrome.tabs.create({ url });
      }
    });
  }, []);

  return <div />;
}

const root = document.getElementById("root");
if (root) {
  createRoot(root).render(<IndexPopup />);
}
