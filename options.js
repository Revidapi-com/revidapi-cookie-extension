const $ = (s) => document.querySelector(s);

function setStatus(text, kind = "") {
  const el = $("#status");
  el.textContent = text;
  el.className = `status ${kind}`;
}
async function bg(type, payload = {}) {
  const res = await chrome.runtime.sendMessage({ type, ...payload });
  if (!res?.ok) throw new Error(res?.error || "extension không phản hồi");
  return res;
}

async function init() {
  const { settings } = await bg("GET_CONTEXT");
  $("#server-url").value = settings.serverUrl;
  setStatus(`Đang dùng ${settings.serverUrl}`);
}

$("#btn-save").onclick = async () => {
  let url = $("#server-url").value.trim();
  if (!/^https?:\/\//.test(url)) url = `http://${url}`;
  url = url.replace(/\/+$/, "");
  try {
    await bg("SAVE_SETTINGS", { patch: { serverUrl: url } });
    $("#server-url").value = url;
    setStatus(`Đã lưu ${url}`, "ok");
  } catch (err) {
    setStatus(err.message, "err");
  }
};

$("#btn-test").onclick = async () => {
  setStatus("Đang kiểm tra…");
  try {
    const { health } = await bg("PING_DASHBOARD");
    setStatus(`Kết nối được (pid ${health.pid})`, "ok");
  } catch (err) {
    setStatus(`Không kết nối được: ${err.message}. Hãy chạy "npm start" trong thư mục app.`, "err");
  }
};

$("#btn-open").onclick = () => bg("OPEN_DASHBOARD").catch((e) => setStatus(e.message, "err"));
init();
