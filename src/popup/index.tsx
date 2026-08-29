import "~style.css";
import cssText from "data-text:~style.css";
import type { PlasmoCSConfig } from "plasmo";
import { useEffect } from "react";

export const config: PlasmoCSConfig = {
  // matches: ["https://www.plasmo.com/*"]
};

export function getShadowContainer() {
  return document.querySelector("#test-shadow").shadowRoot.querySelector("#plasmo-shadow-container");
}

export const getShadowHostId = () => "test-shadow";

export const getStyle = () => {
  const style = document.createElement("style");

  style.textContent = cssText;
  return style;
};

const IndexPopup = () => {
  useEffect(() => {
    const url = chrome.runtime.getURL("tabs/auto-publish.html");
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
};

export default IndexPopup;
