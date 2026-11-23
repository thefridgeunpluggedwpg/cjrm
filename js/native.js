/* Native Android bridge. No-ops in the web PWA. */
(function (global) {
  const CJRM = global.CJRM || (global.CJRM = {});

  function isNativeApp() {
    try {
      const cap = global.Capacitor;
      return !!(cap && typeof cap.isNativePlatform === "function" && cap.isNativePlatform());
    } catch (e) {
      return false;
    }
  }

  function plugin() {
    const cap = global.Capacitor;
    if (!cap) return null;
    if (cap.Plugins && cap.Plugins.CjrmNative) return cap.Plugins.CjrmNative;
    if (typeof cap.registerPlugin === "function") {
      try { return cap.registerPlugin("CjrmNative"); } catch (e) { return null; }
    }
    return null;
  }

  /* Turn native SMS / VoIP notifications into the same pieces the mailbox hub files. */
  function nativeMessagesToPieces(messages) {
    return (messages || []).map(function (row) {
      if (!row || typeof row === "string") return null;
      const source = String(row.source || row.channel || "sms").toLowerCase();
      const voip = source === "voip" || source === "phone2" || source === "personal";
      const channel = voip ? "phone2" : "phone1";
      const from = String(row.from || row.sender || row.phone || "").trim();
      const body = String(row.body || row.text || "").trim();
      if (!body) return null;
      const name = String(row.name || "").trim() || from;
      return {
        id: String(row.id || row.sourceId || ""),
        from: from,
        subject: voip ? "Text to Toronto number" : "Text to Winnipeg number",
        body: body,
        date: row.date || row.at || "",
        channel: channel,
        name: name,
        phone: String(row.phone || from || "").trim(),
        email: "",
      };
    }).filter(Boolean);
  }

  function coerceMessages(res) {
    if (!res) return [];
    let messages = res.messages || res.mail || res.items || res;
    if (typeof messages === "string") {
      try { messages = JSON.parse(messages); } catch (e) { return []; }
    }
    if (!Array.isArray(messages)) return [];
    return messages;
  }

  function fileNativeMessages(messages, opts) {
    const pieces = nativeMessagesToPieces(coerceMessages({ messages: messages }));
    if (!pieces.length) return { filed: 0, fetched: 0, results: [] };
    const result = CJRM.filePieces(pieces);
    if (result.filed && !(opts && opts.silent) && typeof CJRM.notifyNewItems === "function") {
      const names = (result.results || []).map(function (row) { return row && row.name; }).filter(Boolean);
      CJRM.notifyNewItems(result.filed, names);
    } else if (typeof CJRM.refresh === "function") {
      CJRM.refresh();
    }
    return { filed: result.filed, fetched: pieces.length, results: result.results };
  }

  async function drainAndFile() {
    const p = plugin();
    if (!p || typeof p.drainInbox !== "function") return { filed: 0, fetched: 0 };
    const res = await p.drainInbox();
    return fileNativeMessages(coerceMessages(res));
  }

  async function getStatus() {
    const p = plugin();
    if (!p || typeof p.getStatus !== "function") return { available: false };
    const status = await p.getStatus();
    status.available = true;
    return status;
  }

  async function requestSmsPermission() {
    const p = plugin();
    if (!p) throw new Error("Not running as the Android app.");
    return p.requestSmsPermission();
  }

  async function openAppInfo() {
    const p = plugin();
    if (!p) throw new Error("Not running as the Android app.");
    return p.openAppInfo();
  }

  async function openNotificationAccess() {
    const p = plugin();
    if (!p) throw new Error("Not running as the Android app.");
    return p.openNotificationAccess();
  }

  async function listApps() {
    const p = plugin();
    if (!p) return [];
    const res = await p.listApps();
    return (res && res.apps) || [];
  }

  async function setVoipApp(packageName, label) {
    const p = plugin();
    if (!p) throw new Error("Not running as the Android app.");
    return p.setVoipApp({ packageName: packageName || "", label: label || "" });
  }

  async function setHubConfig(url, secret) {
    const p = plugin();
    if (!p || typeof p.setHubConfig !== "function") return { ok: false };
    return p.setHubConfig({ url: url || "", secret: secret || "" });
  }

  async function importRecentSms() {
    const p = plugin();
    if (!p) throw new Error("Not running as the Android app.");
    const res = await p.importRecentSms({ limit: 100, days: 14 });
    return fileNativeMessages(coerceMessages(res), { silent: true });
  }

  async function start() {
    if (!isNativeApp()) return;
    let listening = false;
    const listen = function () {
      const p = plugin();
      if (listening || !p || typeof p.addListener !== "function") return;
      listening = true;
      p.addListener("nativeMessage", function (msg) {
        try {
          fileNativeMessages([msg]);
        } catch (err) { console.error(err); }
      });
      p.addListener("appResume", function () {
        run();
        if (typeof CJRM.kickPoll === "function") CJRM.kickPoll("resume");
      });
    };
    const run = async function () {
      listen();
      try {
        await drainAndFile();
      } catch (err) {
        console.error(err);
      }
    };
    const settings = (CJRM.getState() && CJRM.getState().settings) || {};
    if (settings.hubUrl) setHubConfig(settings.hubUrl, settings.hubSecret).catch(function () {});
    await run();
    setTimeout(run, 400);
    document.addEventListener("visibilitychange", function () {
      if (document.visibilityState === "visible") run();
    });
    window.addEventListener("pageshow", function () { run(); });
  }

  CJRM.isNativeApp = isNativeApp;
  CJRM.nativeMessagesToPieces = nativeMessagesToPieces;
  CJRM.fileNativeMessages = fileNativeMessages;
  CJRM.nativeDrainAndFile = drainAndFile;
  CJRM.nativeGetStatus = getStatus;
  CJRM.nativeRequestSmsPermission = requestSmsPermission;
  CJRM.nativeOpenAppInfo = openAppInfo;
  CJRM.nativeOpenNotificationAccess = openNotificationAccess;
  CJRM.nativeListApps = listApps;
  CJRM.nativeSetVoipApp = setVoipApp;
  CJRM.nativeSetHubConfig = setHubConfig;
  CJRM.nativeImportRecentSms = importRecentSms;
  CJRM.nativeStart = start;
})(window);
