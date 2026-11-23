/* Pure logic: pinning, matching, mail classification, search, sort. */
(function (global) {
  const CJRM = global.CJRM || (global.CJRM = {});

  const SLIP_HOURS = () => CJRM.SLIP_HOURS || 2;

  function nowMs(now) {
    return now == null ? Date.now() : now;
  }

  function hoursSince(iso, now) {
    return (nowMs(now) - new Date(iso).getTime()) / 36e5;
  }

  function shortAge(iso, now) {
    const mins = Math.max(0, Math.round((nowMs(now) - new Date(iso).getTime()) / 60000));
    if (mins < 1) return "now";
    if (mins < 60) return mins + "m";
    const hours = Math.round(mins / 60);
    if (hours < 36) return hours + "h";
    const days = Math.round(hours / 24);
    return days + "d";
  }

  function timerLabel(ms) {
    const total = Math.max(0, Math.round(ms / 60000));
    const days = Math.floor(total / 1440);
    const hours = Math.floor((total % 1440) / 60);
    const mins = total % 60;
    if (days > 0) return days + "d " + hours + "h";
    if (hours > 0) return mins ? hours + "h " + mins + "m" : hours + "h";
    return mins + "m";
  }

  function money(value) {
    if (value == null || value === "") return "";
    const n = Number(value);
    if (!Number.isFinite(n)) return "";
    return new Intl.NumberFormat("en-CA", {
      style: "currency",
      currency: "CAD",
      maximumFractionDigits: 0,
    }).format(n);
  }

  function isClosed(lead) {
    return (CJRM.CLOSED_STAGES || ["done", "lost"]).indexOf(lead.stage) !== -1;
  }

  function isSnoozed(lead, now) {
    return Boolean(lead.snoozeUntil && new Date(lead.snoozeUntil).getTime() > nowMs(now));
  }

  function threadOf(messages, personId) {
    return messages
      .filter(function (m) { return m.personId === personId; })
      .slice()
      .sort(function (a, b) { return a.at.localeCompare(b.at); });
  }

  function spoken(messages) {
    return messages.filter(function (m) { return m.direction !== "note"; });
  }

  function lastSpoken(messages, personId) {
    const talk = spoken(threadOf(messages, personId));
    return talk[talk.length - 1] || null;
  }

  /* slip: unanswered 2h+ on last inbound, or a follow-up that is due.
     Closed and snoozed people do not pin. */
  function slipOf(person, messages, now) {
    if (isClosed(person) || isSnoozed(person, now)) return null;
    const t = nowMs(now);
    if (person.followUpAt && new Date(person.followUpAt).getTime() <= t) return "followup";
    const last = lastSpoken(messages, person.id);
    if (last && last.direction === "in" && hoursSince(last.at, t) >= SLIP_HOURS()) return "unanswered";
    return null;
  }

  function slipTimer(person, messages, now) {
    const slip = slipOf(person, messages, now);
    if (!slip) return "";
    const t = nowMs(now);
    if (slip === "followup") {
      const due = new Date(person.followUpAt).getTime();
      const late = t - due;
      if (late < 60 * 1000) return "Follow-up due now";
      return "Follow-up due " + timerLabel(late) + " ago";
    }
    const last = lastSpoken(messages, person.id);
    if (!last) return "Unanswered";
    return "Unanswered " + timerLabel(t - new Date(last.at).getTime());
  }

  function isWaiting(person, messages, now) {
    if (isClosed(person) || isSnoozed(person, now)) return false;
    const last = lastSpoken(messages, person.id);
    return Boolean(last && last.direction === "in");
  }

  function channelsUsed(person, messages) {
    const used = {};
    spoken(threadOf(messages, person.id)).forEach(function (m) {
      used[m.channel] = true;
    });
    if (Object.keys(used).length === 0 && person.channel) used[person.channel] = true;
    return (CJRM.CHANNELS || []).filter(function (c) { return used[c]; });
  }

  function previewText(messages, personId) {
    const last = lastSpoken(messages, personId);
    if (last) return last.body;
    const notes = threadOf(messages, personId);
    return notes.length ? notes[notes.length - 1].body : "";
  }

  function slipStamp(person, messages, now) {
    const slip = slipOf(person, messages, now);
    if (slip === "followup" && person.followUpAt) return new Date(person.followUpAt).getTime();
    const last = lastSpoken(messages, person.id);
    if (last) return new Date(last.at).getTime();
    return new Date(person.lastMessageAt || person.createdAt).getTime();
  }

  function sortPeople(people, messages, now) {
    const t = nowMs(now);
    return people.slice().sort(function (a, b) {
      const sa = slipOf(a, messages, t);
      const sb = slipOf(b, messages, t);
      if (sa && !sb) return -1;
      if (!sa && sb) return 1;
      if (sa && sb) return slipStamp(a, messages, t) - slipStamp(b, messages, t);
      if (a.unread !== b.unread) return a.unread ? -1 : 1;
      return String(b.lastMessageAt || "").localeCompare(String(a.lastMessageAt || ""));
    });
  }

  function searchBlob(person, messages) {
    const bodies = messages
      .filter(function (m) { return m.personId === person.id; })
      .map(function (m) { return m.body; })
      .join(" ");
    return [
      person.name,
      person.listing,
      person.city,
      person.phone,
      person.phone2,
      person.email,
      person.notes,
      person.channel,
      person.address,
      person.igHandle,
      person.fbHandle,
      bodies,
    ].join(" ").toLowerCase();
  }

  function matchesFilter(person, messages, filter, now, query) {
    const q = String(query || "").trim().toLowerCase();
    if (q && searchBlob(person, messages).indexOf(q) === -1) return false;
    const t = nowMs(now);
    const kind = (filter && filter.kind) || "open";
    switch (kind) {
      case "all":
        return true;
      case "open":
        return !isClosed(person) && !isSnoozed(person, t);
      case "waiting":
        return isWaiting(person, messages, t);
      case "slipping":
        return slipOf(person, messages, t) !== null;
      case "starred":
        return Boolean(person.starred);
      case "snoozed":
        return isSnoozed(person, t);
      case "stage":
        return person.stage === filter.stage;
      case "channel":
        return person.channel === filter.channel || channelsUsed(person, messages).indexOf(filter.channel) !== -1;
      default:
        return true;
    }
  }

  function plusDays(days, from, hour) {
    const d = new Date(from == null ? Date.now() : from);
    d.setDate(d.getDate() + days);
    d.setHours(hour == null ? 9 : hour, 0, 0, 0);
    return d.toISOString();
  }

  /* --- phones, emails, names --- */

  function onlyDigits(value) {
    return String(value || "").replace(/\D/g, "");
  }

  function phoneKey(value) {
    let d = onlyDigits(value);
    if (d.length >= 11 && d.charAt(0) === "1") d = d.slice(1);
    if (d.length >= 10) return d.slice(-10);
    if (d.length >= 7) return d.slice(-7);
    return d;
  }

  function phonesMatch(a, b) {
    const ka = phoneKey(a);
    const kb = phoneKey(b);
    if (!ka || !kb || ka.length < 7 || kb.length < 7) return false;
    return ka === kb || (ka.length !== kb.length && (ka.slice(-7) === kb.slice(-7)));
  }

  function normalizeEmail(value) {
    const s = String(value || "").trim().toLowerCase();
    if (!s || s.indexOf("@") === -1) return "";
    return s.replace(/^mailto:/, "");
  }

  function emailsMatch(a, b) {
    const ea = normalizeEmail(a);
    const eb = normalizeEmail(b);
    return Boolean(ea && eb && ea === eb);
  }

  function extractPhones(text) {
    const src = String(text || "");
    const found = src.match(/(?:\+?1[\s.-]?)?(?:\(?\d{3}\)?[\s.-]?)\d{3}[\s.-]?\d{4}/g) || [];
    const keys = [];
    found.forEach(function (raw) {
      const k = phoneKey(raw);
      if (k.length >= 7 && keys.indexOf(k) === -1) keys.push(k);
    });
    return keys;
  }

  function extractEmails(text) {
    const src = String(text || "");
    const found = src.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || [];
    const out = [];
    found.forEach(function (raw) {
      const e = normalizeEmail(raw);
      if (e && out.indexOf(e) === -1) out.push(e);
    });
    return out;
  }

  function isGenericName(name) {
    const n = String(name || "").trim().toLowerCase();
    if (!n) return true;
    return (CJRM.GENERIC_NAMES || []).indexOf(n) !== -1 || / lead$/.test(n);
  }

  function namesMatch(a, b) {
    const na = String(a || "").trim().toLowerCase();
    const nb = String(b || "").trim().toLowerCase();
    if (!na || !nb || isGenericName(na) || isGenericName(nb)) return false;
    return na === nb;
  }

  function personPhones(person) {
    return [person.phone, person.phone2].filter(Boolean);
  }

  /* Match an inbound message to a person: phone, then email, then exact name. */
  function matchPerson(people, hint) {
    const list = people || [];
    const hintPhones = [];
    if (hint.phone) hintPhones.push(phoneKey(hint.phone));
    extractPhones(hint.body || "").forEach(function (p) { hintPhones.push(p); });
    const hintEmails = [];
    if (hint.email) hintEmails.push(normalizeEmail(hint.email));
    extractEmails(hint.body || "").forEach(function (e) { hintEmails.push(e); });

    for (let i = 0; i < list.length; i++) {
      const person = list[i];
      const phones = personPhones(person);
      for (let p = 0; p < phones.length; p++) {
        for (let h = 0; h < hintPhones.length; h++) {
          if (phonesMatch(phones[p], hintPhones[h])) return person;
        }
      }
    }
    for (let i = 0; i < list.length; i++) {
      const person = list[i];
      if (hintEmails.some(function (e) { return emailsMatch(person.email, e); })) return person;
    }
    if (hint.name) {
      for (let i = 0; i < list.length; i++) {
        if (namesMatch(list[i].name, hint.name)) return list[i];
      }
    }
    return null;
  }

  /* --- mailbox --- */

  const CHANNEL_ALIASES = {
    email: "email",
    mail: "email",
    gmail: "email",
    kijiji: "kijiji",
    kj: "kijiji",
    facebook: "facebook",
    fb: "facebook",
    messenger: "facebook",
    instagram: "instagram",
    ig: "instagram",
    insta: "instagram",
    phone1: "phone1",
    "phone 1": "phone1",
    shop: "phone1",
    "shop phone": "phone1",
    "shop line": "phone1",
    winnipeg: "phone1",
    "winnipeg number": "phone1",
    "winnipeg phone": "phone1",
    "text to winnipeg": "phone1",
    sms: "phone1",
    text: "phone1",
    phone2: "phone2",
    "phone 2": "phone2",
    personal: "phone2",
    "personal phone": "phone2",
    "personal line": "phone2",
    toronto: "phone2",
    "toronto number": "phone2",
    "toronto phone": "phone2",
    "text to toronto": "phone2",
    whatsapp: "whatsapp",
    wa: "whatsapp",
    web: "web",
    website: "web",
    form: "web",
    manual: "manual",
  };

  function normalizeChannel(value) {
    if (!value) return null;
    return CHANNEL_ALIASES[String(value).trim().toLowerCase()] || null;
  }

  function classifyMail(piece, phones) {
    const blob = [piece.from, piece.subject, piece.body].join("\n").toLowerCase();
    if (blob.indexOf("kijiji") !== -1) return "kijiji";
    if (blob.indexOf("instagram") !== -1 || blob.indexOf("mail.instagram") !== -1) return "instagram";
    if (blob.indexOf("facebook") !== -1 || blob.indexOf("messenger") !== -1 || blob.indexOf("facebookmail") !== -1) {
      return "facebook";
    }
    if (blob.indexOf("whatsapp") !== -1) return "whatsapp";
    const hay = onlyDigits([piece.from, piece.subject, piece.body].join(" "));
    const personal = onlyDigits((phones && phones.phone2) || "");
    const shop = onlyDigits((phones && phones.phone1) || "");
    if (personal.length >= 7 && hay.indexOf(personal) !== -1) return "phone2";
    if (shop.length >= 7 && hay.indexOf(shop) !== -1) return "phone1";
    if (/\b(personal (phone|line)|toronto (number|phone|line)|text to toronto)\b/.test(blob)) return "phone2";
    if (/\b(shop (phone|line)|winnipeg (number|phone|line)|text to winnipeg|sms|text message|smsforwarder|sms-forwarder)\b/.test(blob)) return "phone1";
    if (blob.indexOf("contact form") !== -1 || blob.indexOf("website") !== -1) return "web";
    return "email";
  }

  function parseMailbox(raw) {
    const text = String(raw || "").replace(/\r\n/g, "\n").trim();
    if (!text) return [];
    const parts = /^from:/im.test(text)
      ? text.split(/\n(?=From:)/i).map(function (p) { return p.trim(); }).filter(Boolean)
      : [text];
    const out = [];
    parts.forEach(function (chunk) {
      const from = (chunk.match(/^From:\s*(.+)$/im) || [])[1] || "";
      const subject = (chunk.match(/^Subject:\s*(.+)$/im) || [])[1] || "";
      const body = chunk
        .split("\n")
        .filter(function (line) { return !/^(from|to|subject|date):/i.test(line.trim()); })
        .join("\n")
        .trim();
      if (!body && !subject) return;
      out.push({ from: from.trim(), subject: subject.trim(), body: body || subject });
    });
    return out;
  }

  function nameFromMail(piece, channel) {
    const subject = String(piece.subject || "").trim();
    const fromSubject = subject.match(/(?:reply|message|text) from\s+(.+)/i);
    if (fromSubject) return fromSubject[1].split(/[—–-]/)[0].trim();
    const sent = subject.match(/^(.+?)\s+sent you a message/i);
    if (sent) return sent[1].trim();
    const dash = String(piece.body || "").match(/[—–-]\s*([A-Za-z][A-Za-z0-9 .''-]{1,60})\s*$/);
    if (dash) return dash[1].trim();
    const fromName = String(piece.from || "").replace(/<[^>]+>/g, "").replace(/"/g, "").trim();
    if (fromName && !/no-?reply|kijiji|facebook|instagram|notification|sms@|forwarder|mailer/i.test(fromName)) {
      return fromName;
    }
    const meta = (CJRM.CHANNEL_META || {})[channel];
    return (meta ? meta.name : "New") + " lead";
  }

  function emailFromHeader(from) {
    const angled = String(from || "").match(/<([^>]+)>/);
    if (angled && angled[1] && !/kijiji|facebook|instagram|facebookmail|example\.invalid|cjrm\.test/i.test(angled[1])) {
      return angled[1].trim();
    }
    const bare = normalizeEmail(from);
    if (bare && !/kijiji|facebook|instagram|facebookmail|example\.invalid|cjrm\.test/i.test(bare)) return bare;
    return "";
  }

  function smsHref(phone, body) {
    const d = onlyDigits(phone);
    if (!d) return "";
    const text = body ? "?body=" + encodeURIComponent(body) : "";
    return "sms:" + d + text;
  }

  function telHref(phone) {
    const d = onlyDigits(phone);
    return d ? "tel:+" + (d.length === 10 ? "1" + d : d) : "";
  }

  function waHref(phone, body) {
    let d = onlyDigits(phone);
    if (!d) return "";
    if (d.length === 10) d = "1" + d;
    const text = body ? "?text=" + encodeURIComponent(body) : "";
    return "https://wa.me/" + d + text;
  }

  function messengerHref(handle) {
    if (!handle) return "https://www.facebook.com/messages/";
    const h = String(handle).replace(/^https?:\/\/(m|www)\.facebook\.com\/|^(m\.me\/)/, "").replace(/^\//, "");
    if (/^https?:/i.test(handle)) return handle;
    return "https://m.me/" + encodeURIComponent(h);
  }

  function instagramHref(handle) {
    if (!handle) return "https://www.instagram.com/direct/inbox/";
    if (/^https?:/i.test(handle) || /^instagram:/.test(handle)) return handle;
    const h = String(handle).replace(/^@/, "");
    return "https://ig.me/m/" + encodeURIComponent(h);
  }

  function openLinkFor(channel, person, body) {
    if (channel === "whatsapp") return waHref(person.phone || person.phone2, body);
    if (channel === "phone1" || channel === "phone2" || channel === "manual") {
      const phone = channel === "phone2" ? (person.phone2 || person.phone) : (person.phone || person.phone2);
      return smsHref(phone, body);
    }
    if (channel === "facebook") return messengerHref(person.fbHandle);
    if (channel === "instagram") return instagramHref(person.igHandle);
    if (channel === "email" || channel === "web" || channel === "kijiji") {
      const email = person.email;
      if (!email) return "";
      const q = "mailto:" + encodeURIComponent(email) + (body ? "?body=" + encodeURIComponent(body) : "");
      return q;
    }
    return "";
  }

  function uid() {
    if (global.crypto && crypto.randomUUID) return crypto.randomUUID();
    return "id-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
  }

  function formatWhen(iso) {
    try {
      return new Date(iso).toLocaleString("en-CA", {
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
    } catch (e) {
      return String(iso || "");
    }
  }

  CJRM.hoursSince = hoursSince;
  CJRM.shortAge = shortAge;
  CJRM.timerLabel = timerLabel;
  CJRM.money = money;
  CJRM.isClosed = isClosed;
  CJRM.isSnoozed = isSnoozed;
  CJRM.threadOf = threadOf;
  CJRM.spoken = spoken;
  CJRM.lastSpoken = lastSpoken;
  CJRM.slipOf = slipOf;
  CJRM.slipTimer = slipTimer;
  CJRM.isWaiting = isWaiting;
  CJRM.channelsUsed = channelsUsed;
  CJRM.previewText = previewText;
  CJRM.sortPeople = sortPeople;
  CJRM.matchesFilter = matchesFilter;
  CJRM.plusDays = plusDays;
  CJRM.onlyDigits = onlyDigits;
  CJRM.phoneKey = phoneKey;
  CJRM.phonesMatch = phonesMatch;
  CJRM.normalizeEmail = normalizeEmail;
  CJRM.extractPhones = extractPhones;
  CJRM.extractEmails = extractEmails;
  CJRM.isGenericName = isGenericName;
  CJRM.matchPerson = matchPerson;
  CJRM.normalizeChannel = normalizeChannel;
  CJRM.classifyMail = classifyMail;
  CJRM.parseMailbox = parseMailbox;
  CJRM.nameFromMail = nameFromMail;
  CJRM.emailFromHeader = emailFromHeader;
  CJRM.smsHref = smsHref;
  CJRM.telHref = telHref;
  CJRM.waHref = waHref;
  CJRM.messengerHref = messengerHref;
  CJRM.instagramHref = instagramHref;
  CJRM.openLinkFor = openLinkFor;
  CJRM.uid = uid;
  CJRM.formatWhen = formatWhen;
  CJRM.searchBlob = searchBlob;
})(window);
