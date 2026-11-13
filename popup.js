const $ = (s) => document.querySelector(s);
let ctx = { platform: null, info: null };

function toast(msg, bad = false) {
  const el = $("#toast");
  el.textContent = msg;
  el.className = `toast show ${bad ? "bad" : ""}`;
  clearTimeout(el._t);
  el._t = setTimeout(() => (el.className = "toast"), 3200);
}

async function bg(type, payload = {}) {
  const res = await chrome.runtime.sendMessage({ type, ...payload });
  if (!res) throw new Error("extension không phản hồi");
  if (!res.ok) throw new Error(res.error || "lỗi không xác định");
  return res;
}

async function refresh() {
  try {
    ctx = await bg("GET_CONTEXT");
  } catch (err) {
    $("#platform-name").textContent = "Không xác định";
    return toast(err.message, true);
  }
  const info = ctx.info;
  const pill = $("#login-pill");
  const missingEl = $("#missing");
  $("#platform-name").textContent = info ? info.label : "Không phải Facebook / TikTok / Zalo";
  if (!info) {
    pill.className = "pill";
    pill.textContent = "—";
    missingEl.classList.add("hidden");
    $("#btn-sync").disabled = true;
  } else {
    pill.className = `pill ${info.loggedIn ? "ok" : "bad"}`;
    pill.textContent = info.loggedIn ? `đã đăng nhập · ${info.cookieCount} cookie` : "chưa đăng nhập";
    $("#btn-sync").disabled = !info.loggedIn;
    missingEl.textContent = info.missing.length ? `Thiếu cookie bắt buộc: ${info.missing.join(", ")}. Hãy đăng nhập rồi mở lại.` : "";
    missingEl.classList.toggle("hidden", !info.missing.length);
  }
  try {
    const h = await bg("PING_DASHBOARD");
    $("#dot").className = "dot ok";
    $("#server-line").textContent = h.settings.serverUrl.replace(/^https?:\/\//, "");
  } catch {
    $("#dot").className = "dot bad";
    $("#server-line").textContent = "dashboard chưa chạy";
  }
}

$("#btn-sync").onclick = async () => {
  const btn = $("#btn-sync");
  const original = btn.textContent;
  btn.disabled = true;
  btn.textContent = "Đang đồng bộ…";
  try {
    const { result: r } = await bg("SYNC", { platform: ctx.platform, label: $("#label").value.trim() || undefined });
    const name = r.account?.profileName || r.account?.label || "";
    toast(r.updated ? `Đã cập nhật ${name}` : `Đã thêm ${name}`);
  } catch (err) {
    toast(err.message, true);
  } finally {
    btn.textContent = original;
    await refresh();
  }
};

$("#btn-sync-all").onclick = async () => {
  try {
    const { results } = await bg("SYNC_ALL");
    const ok = results.filter((r) => !r.error).length;
    toast(`Đã đồng bộ ${ok}/${results.length} nền tảng đang đăng nhập`, ok === 0);
    await refresh();
  } catch (err) {
    toast(err.message, true);
  }
};

$("#btn-open-dashboard").onclick = () => bg("OPEN_DASHBOARD").catch((e) => toast(e.message, true));
$("#btn-options").onclick = () => chrome.runtime.openOptionsPage();
refresh();
