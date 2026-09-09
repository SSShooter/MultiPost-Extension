import "../../style.css";
import { useEffect } from "react";
import { createRoot } from "react-dom/client";

const BASE_URL = "https://multipost.app";

function Options() {
  useEffect(() => {
    chrome.tabs.getCurrent((tab) => {
      chrome.tabs.create({ url: `${BASE_URL}/dashboard/publish` });
      if (tab?.id) {
        chrome.tabs.remove(tab.id);
      }
    });
  }, []);

  return <div />;
}

const root = document.getElementById("root");
if (root) {
  createRoot(root).render(<Options />);
}
