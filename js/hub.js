/* Poll the Apps Script mailbox endpoint and file new messages. */
(function (global) {
  const CJRM = global.CJRM || (global.CJRM = {});

  function hubUrlWithSecret(url, secret) {
    const u = new URL(url, location.href);
    if (secret && !u.searchParams.get("secret")) u.searchParams.set("secret", secret);
    return u.toString();
  }

  async function fetchHub(url, secret) {
    if (!url) throw new Error("Paste the mailbox endpoint URL first.");
    const resolved = hubUrlWithSecret(url, secret);
    // Simple GET with no custom headers: Apps Script cannot answer a CORS preflight.
    const res = await fetch(resolved, { method: "GET", redirect: "follow", cache: "no-store" });
    if (!res.ok) throw new Error("Mailbox returned HTTP " + res.status);
    const data = await res.json();
    if (data && data.ok === false) throw new Error(data.error || "Mailbox rejected the request.");
    const messages = (data && (data.messages || data.mail || data.items)) || [];
    if (!Array.isArray(messages)) throw new Error("Mailbox JSON is missing a messages list.");
    return messages;
  }

  function asPieces(messages) {
    return messages.map(function (row) {
      if (typeof row === "string") return null;
      const from = row.from || row.From || "";
      const subject = row.subject || row.Subject || "";
      const body = row.body || row.text || row.snippet || "";
      return {
        id: String(row.id || row.messageId || ""),
        from: from,
        subject: subject,
        body: body,
        date: row.date || row.at || "",
        channel: row.channel || null,
        name: row.name || "",
        phone: row.phone || "",
        email: row.email || "",
      };
    }).filter(Boolean);
  }

  async function pollHub() {
    const state = CJRM.getState();
    const settings = state.settings || {};
    const messages = await fetchHub(settings.hubUrl, settings.hubSecret);
    const pieces = asPieces(messages);
    const seen = new Set(settings.seenHubIds || []);
    const fresh = pieces.filter(function (p) { return !p.id || !seen.has(p.id); });
    const result = CJRM.filePieces(fresh);
    const accepted = {};
    (result.results || []).forEach(function (row) {
      if (row && row.sourceId && (row.status === "created" || row.status === "matched" || row.status === "duplicate")) {
        accepted[row.sourceId] = true;
      }
    });
    fresh.forEach(function (p) { if (p.id && accepted[p.id]) seen.add(p.id); });
    const ids = Array.from(seen);
    const trimmed = ids.length > 2000 ? ids.slice(ids.length - 2000) : ids;
    const names = (result.results || []).filter(function (row) {
      return row && (row.status === "created" || row.status === "matched") && row.name;
    }).map(function (row) { return row.name; });
    CJRM.setState({
      settings: Object.assign({}, CJRM.getState().settings, {
        seenHubIds: trimmed,
        lastPollAt: new Date().toISOString(),
        lastPollOk: true,
        lastPollError: "",
        lastPollFetched: pieces.length,
        lastPollFiled: result.filed,
      }),
    });
    return { fetched: pieces.length, filed: result.filed, results: result.results, names: names };
  }

  function recordPollError(err) {
    CJRM.setState({
      settings: Object.assign({}, CJRM.getState().settings, {
        lastPollAt: new Date().toISOString(),
        lastPollOk: false,
        lastPollError: String(err && err.message ? err.message : err),
      }),
    });
  }

  /* Auto-poll while the desk is visible. 30s when healthy; back off on errors. */
  const POLL_VISIBLE_MS = 30000;
  const POLL_BACKOFF_START = 60000;
  const POLL_BACKOFF_MAX = 5 * 60 * 1000;

  let pollTimer = null;
  let pollInFlight = false;
  let pollDelayMs = POLL_VISIBLE_MS;
  let pollWired = false;

  function isPollVisible() {
    try {
      if (typeof document === "undefined") return true;
      return document.visibilityState !== "hidden";
    } catch (e) {
      return true;
    }
  }

  function clearPollTimer() {
    if (pollTimer) {
      clearTimeout(pollTimer);
      pollTimer = null;
    }
  }

  function afterPollUi(result) {
    if (result && result.filed > 0 && typeof CJRM.revealFiledOnDesk === "function") {
      CJRM.revealFiledOnDesk();
    }
    if (result && result.filed > 0 && typeof CJRM.notifyNewItems === "function") {
      CJRM.notifyNewItems(result.filed, result.names);
    } else if (typeof CJRM.refresh === "function") {
      CJRM.refresh();
    }
  }

  async function runPoll(reason) {
    if (!isPollVisible()) return { skipped: "hidden" };
    const settings = (CJRM.getState() && CJRM.getState().settings) || {};
    if (!settings.hubUrl) return { skipped: "no-hub" };
    if (pollInFlight) return { skipped: "busy" };
    pollInFlight = true;
    try {
      const result = await CJRM.pollHub();
      pollDelayMs = POLL_VISIBLE_MS;
      afterPollUi(result);
      return result;
    } catch (err) {
      recordPollError(err);
      pollDelayMs = pollDelayMs >= POLL_BACKOFF_START
        ? Math.min(pollDelayMs * 2, POLL_BACKOFF_MAX)
        : POLL_BACKOFF_START;
      if (typeof CJRM.refresh === "function") CJRM.refresh();
      throw err;
    } finally {
      pollInFlight = false;
      schedulePoll();
    }
  }

  function schedulePoll() {
    clearPollTimer();
    if (!isPollVisible()) return;
    const settings = (CJRM.getState() && CJRM.getState().settings) || {};
    if (!settings.hubUrl) return;
    pollTimer = setTimeout(function () {
      runPoll("timer").catch(function () { /* already recorded */ });
    }, pollDelayMs || POLL_VISIBLE_MS);
  }

  function kickPoll(reason) {
    clearPollTimer();
    return runPoll(reason || "kick").catch(function (err) {
      return { error: String(err && err.message ? err.message : err) };
    });
  }

  function wireAutoPoll() {
    if (pollWired) return;
    pollWired = true;
    document.addEventListener("visibilitychange", function () {
      if (isPollVisible()) kickPoll("visible");
      else clearPollTimer();
    });
    window.addEventListener("online", function () { kickPoll("online"); });
    window.addEventListener("pageshow", function () {
      if (isPollVisible()) kickPoll("pageshow");
    });
  }

  function startAutoPoll() {
    wireAutoPoll();
    pollDelayMs = POLL_VISIBLE_MS;
    kickPoll("start");
  }

  CJRM.hubUrlWithSecret = hubUrlWithSecret;
  CJRM.fetchHub = fetchHub;
  CJRM.pollHub = pollHub;
  CJRM.recordPollError = recordPollError;
  CJRM.asPieces = asPieces;
  CJRM.POLL_VISIBLE_MS = POLL_VISIBLE_MS;
  CJRM.POLL_BACKOFF_START = POLL_BACKOFF_START;
  CJRM.POLL_BACKOFF_MAX = POLL_BACKOFF_MAX;
  CJRM.isPollVisible = isPollVisible;
  CJRM.isPollInFlight = function () { return pollInFlight; };
  CJRM.getPollDelayMs = function () { return pollDelayMs; };
  CJRM.schedulePoll = schedulePoll;
  CJRM.kickPoll = kickPoll;
  CJRM.startAutoPoll = startAutoPoll;
})(window);
