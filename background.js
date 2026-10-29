"use strict";
let enabled = true;
let lastChangelogVersion = null;
const ready = browser.storage.local.get({enabled: true, lastChangelogVersion: null})
  .then(saved => {
    enabled = saved.enabled !== false;
    lastChangelogVersion = saved.lastChangelogVersion;
  }, () => {}); // Default to the protective ON mode if storage cannot be read.

async function paintToolbar() {
  await Promise.allSettled([
    browser.action.setIcon({path: enabled
      ? {16: "icons/enabled/icon-16.png", 20: "icons/enabled/icon-20.png", 24: "icons/enabled/icon-24.png", 28: "icons/enabled/icon-28.png", 32: "icons/enabled/icon-32.png", 40: "icons/enabled/icon-40.png", 48: "icons/enabled/icon-48.png", 56: "icons/enabled/icon-56.png", 64: "icons/enabled/icon-64.png", 96: "icons/enabled/icon-96.png", 128: "icons/enabled/icon-128.png"}
      : {16: "icons/disabled/icon-16.png", 20: "icons/disabled/icon-20.png", 24: "icons/disabled/icon-24.png", 28: "icons/disabled/icon-28.png", 32: "icons/disabled/icon-32.png", 40: "icons/disabled/icon-40.png", 48: "icons/disabled/icon-48.png", 56: "icons/disabled/icon-56.png", 64: "icons/disabled/icon-64.png", 96: "icons/disabled/icon-96.png", 128: "icons/disabled/icon-128.png"}}),
    browser.action.setTitle({title: "Force New Tab: " + (enabled ? "ON — click to turn off" : "OFF — click to turn on")})
  ]);
}


// Serialize rapid toolbar clicks, and only show a new mode after saving it.
let toggleQueue = ready.then(paintToolbar).catch(() => {});
browser.action.onClicked.addListener(() => {
  toggleQueue = toggleQueue.then(async () => {
    const next = !enabled;
    try {
      await browser.storage.local.set({enabled: next});
      enabled = next;
      if (!enabled) discovery.cancelAll();
      await paintToolbar();
    } catch {
      // Keep the previous mode if the preference cannot be saved.
    }
  });
  return toggleQueue;
});

async function openDestination(url, sourceTab) {
  const options = {url, active: false, windowId: sourceTab.windowId, openerTabId: sourceTab.id};
  if (sourceTab.cookieStoreId) options.cookieStoreId = sourceTab.cookieStoreId;
  try { await browser.tabs.create(options); return {ok: true}; }
  catch { return {ok: false}; }
}
const discovery = FNTDiscovery.install(browser, {
  isEnabled: () => enabled,
  open: openDestination
});
browser.runtime.onMessage.addListener((message, sender) => {
  if (sender?.id !== browser.runtime.id || !sender.tab ||
      !Number.isInteger(sender.tab.id) || sender.tab.id < 0 ||
      !Number.isInteger(sender.tab.windowId) || sender.tab.windowId < 0) return;
  if (message?.type === "fnt-arm") return ready.then(() => {
    if (!enabled) return {ok: false, reason: "disabled"};
    return discovery.arm(message, sender);
  });
  if (message?.type === "fnt-captured") return ready.then(() => discovery.capture(message, sender));
  if (message?.type === "fnt-cancel") return Promise.resolve(discovery.cancel(message, sender));
  if (message?.type !== "fnt-open" || typeof message.url !== "string") return;
  let url;
  try {
    url = new URL(message.url);
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) return;
  } catch { return; }
  return ready.then(() => {
    if (!enabled) return {ok: false, reason: "disabled"};
    return openDestination(url.href, sender.tab);
  });
});

let changelogQueue = ready;
browser.runtime.onInstalled.addListener(details => {
  if (!["install", "update"].includes(details.reason)) return;
  changelogQueue = changelogQueue.then(async () => {
    const version = browser.runtime.getManifest().version;
    if (lastChangelogVersion === version) return;
    try {
      await browser.storage.local.set({lastChangelogVersion: version});
      lastChangelogVersion = version;
      await browser.tabs.create({url: browser.runtime.getURL("changelog.html"), active: false});
    } catch {} // Never retry and unexpectedly open multiple update tabs.
  });
  return changelogQueue;
});


