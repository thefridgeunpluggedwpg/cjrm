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
    fresh.forEach(function (p) { if (p.id) seen.add(p.id); });
    const ids = Array.from(seen);
    const trimmed = ids.length > 2000 ? ids.slice(ids.length - 2000) : ids;
    CJRM.setState({
      settings: Object.assign({}, CJRM.getState().settings, {
        seenHubIds: trimmed,
        lastPollAt: new Date().toISOString(),
        lastPollOk: true,
        lastPollError: "",
      }),
    });
    return { fetched: pieces.length, filed: result.filed, results: result.results };
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

  CJRM.hubUrlWithSecret = hubUrlWithSecret;
  CJRM.fetchHub = fetchHub;
  CJRM.pollHub = pollHub;
  CJRM.recordPollError = recordPollError;
  CJRM.asPieces = asPieces;
})(window);
