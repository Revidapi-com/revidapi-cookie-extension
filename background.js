/**
 * RevidAPI Social – Cookie Sync (service worker).
 * Reads the Facebook / TikTok / Zalo session cookies and sends them only to the
 * dashboard running on this machine (127.0.0.1 / localhost).
 */

const DEFAULT_SETTINGS = { serverUrl: "http://127.0.0.1:8788", lastSyncAt: null };

const PLATFORMS = {
  facebook: { label: "Facebook", cookieDomain: "facebook.com", hosts: ["facebook.com"], required: ["c_user", "xs"], loginUrl: "https://www.facebook.com/" },
  tiktok: { label: "TikTok", cookieDomain: "tiktok.com", hosts: ["tiktok.com"], required: ["sessionid"], loginUrl: "https://www.tiktok.com/" },
  zalo: { label: "Zalo", cookieDomain: "zalo.me", hosts: ["zalo.me"], required: ["zpsid"], loginUrl: "https://chat.zalo.me/" },
};

/** Cookies are sent only to a local dashboard; anything else is refused. */
export function isLocalUrl(url) {
  try {
    const u = new URL(url);
    return u.protocol === "http:" && ["127.0.0.1", "localhost"].includes(u.hostname);
  } catch {
    return false;
  }
}

function platformFromUrl(url) {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    for (const [key, p] of Object.entries(PLATFORMS)) {
      if (p.hosts.some((h) => host === h || host.endsWith(`.${h}`))) return key;
    }
  } catch {
    /* not a URL */
  }
  return null;
}

async function getSettings() {
  const stored = await chrome.storage.local.get("settings");
  const s = { ...DEFAULT_SETTINGS, ...(stored.settings || {}) };
  if (!isLocalUrl(s.serverUrl)) s.serverUrl = DEFAULT_SETTINGS.serverUrl;
  return s;
}

async function setSettings(patch) {
  if (patch.serverUrl !== undefined && !isLocalUrl(patch.serverUrl)) {
    throw new Error("Chỉ cho phép địa chỉ http://127.0.0.1 hoặc http://localhost");
  }
  const next = { ...(await getSettings()), ...patch };
  await chrome.storage.local.set({ settings: next });
  return next;
}

async function api(method, path, body) {
  const { serverUrl } = await getSettings();
  const res = await fetch(`${serverUrl}${path}`, {
    method,
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }
  if (!res.ok) throw new Error(data.error || `dashboard HTTP ${res.status}`);
  return data;
}

async function cookiesFor(platform) {
  const p = PLATFORMS[platform];
  const cookies = await chrome.cookies.getAll({ domain: p.cookieDomain });
  // When a name exists on several subdomains, keep the one on the root domain.
  const rank = (c) => (c.domain.replace(/^\./, "") === p.cookieDomain ? 0 : 1);
  const best = {};
  for (const c of cookies) {
    if (!c.name) continue;
    if (!best[c.name] || rank(c) < rank(best[c.name])) best[c.name] = c;
  }
  return Object.fromEntries(Object.entries(best).map(([k, c]) => [k, c.value]));
}

const missingRequired = (platform, cookies) => PLATFORMS[platform].required.filter((n) => cookies[n] === undefined);

async function syncPlatform(platform, { label } = {}) {
  if (!PLATFORMS[platform]) throw new Error("Nền tảng không được hỗ trợ");
  const cookies = await cookiesFor(platform);
  const missing = missingRequired(platform, cookies);
  if (missing.length) throw new Error(`${PLATFORMS[platform].label} chưa đăng nhập (thiếu ${missing.join(", ")})`);
  // mode "upsert": the dashboard updates the account with the same login instead of adding a duplicate.
  const result = await api("POST", "/api/extension/sync", { platform, label, cookies, userAgent: navigator.userAgent, mode: "upsert" });
  await setSettings({ lastSyncAt: new Date().toISOString() });
  return { ...result, cookieCount: Object.keys(cookies).length, platform };
}

async function activeTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab || null;
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (sender.id !== chrome.runtime.id) return false;
  (async () => {
    try {
      switch (msg.type) {
        case "GET_CONTEXT": {
          const tab = await activeTab();
          const platform = tab?.url ? platformFromUrl(tab.url) : null;
          let info = null;
          if (platform) {
            const cookies = await cookiesFor(platform);
            const missing = missingRequired(platform, cookies);
            info = { platform, label: PLATFORMS[platform].label, loginUrl: PLATFORMS[platform].loginUrl, cookieCount: Object.keys(cookies).length, missing, loggedIn: !missing.length };
          }
          return sendResponse({ ok: true, platform, info, settings: await getSettings() });
        }
        case "SYNC":
          return sendResponse({ ok: true, result: await syncPlatform(msg.platform, { label: msg.label }) });
        case "SYNC_ALL": {
          const results = [];
          for (const platform of Object.keys(PLATFORMS)) {
            try {
              results.push(await syncPlatform(platform));
            } catch (err) {
              results.push({ platform, error: err.message });
            }
          }
          return sendResponse({ ok: true, results });
        }
        case "PING_DASHBOARD":
          return sendResponse({ ok: true, health: await api("GET", "/api/health"), settings: await getSettings() });
        case "SAVE_SETTINGS":
          return sendResponse({ ok: true, settings: await setSettings(msg.patch || {}) });
        case "OPEN_DASHBOARD":
          await chrome.tabs.create({ url: (await getSettings()).serverUrl });
          return sendResponse({ ok: true });
        default:
          return sendResponse({ ok: false, error: `unknown message: ${msg.type}` });
      }
    } catch (err) {
      sendResponse({ ok: false, error: err.message });
    }
  })();
  return true;
});

function ensureAlarm() {
  chrome.alarms.get("ping-dashboard", (a) => { if (!a) chrome.alarms.create("ping-dashboard", { periodInMinutes: 5 }); });
}
chrome.runtime.onInstalled.addListener(ensureAlarm);
chrome.runtime.onStartup.addListener(ensureAlarm);

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== "ping-dashboard") return;
  try {
    await api("GET", "/api/health");
    await chrome.action.setBadgeText({ text: "" });
  } catch {
    await chrome.action.setBadgeText({ text: "!" });
    await chrome.action.setBadgeBackgroundColor({ color: "#ef4444" });
  }
});
