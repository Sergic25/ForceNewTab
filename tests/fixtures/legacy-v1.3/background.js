/**
 * background.js
 * Receives messages from content.js and opens URLs in new background tabs.
 */

let lastOpenedUrl = null;
let lastOpenedTime = 0;

browser.runtime.onMessage.addListener(function (message) {
  if (message.action === "openTab" && message.url) {
    const now = Date.now();

    // Deduplicate: ignore the same URL opened within 500ms
    if (message.url === lastOpenedUrl && (now - lastOpenedTime) < 250) {
      return;
    }

    lastOpenedUrl = message.url;
    lastOpenedTime = now;

    browser.tabs.create({
      url: message.url,
      active: false
    });
  }
});
