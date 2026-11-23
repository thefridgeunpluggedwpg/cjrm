var LABEL_NAME = 'CJRM';
var SEARCH = [
  'newer_than:14d (',
  'from:kijiji.ca OR from:kijiji.com',
  'OR from:facebookmail.com',
  'OR from:mail.instagram.com',
  'OR subject:"sent you a message"',
  'OR subject:"reply from"',
  'OR subject:"contact form"',
  'OR subject:"text to shop"',
  'OR subject:"text to personal"',
  'OR subject:SmsForwarder',
  'OR label:sms-forwarder',
  'OR list:kijiji OR subject:Kijiji)'
].join(' ');

function prop_(name) {
  var p = PropertiesService.getScriptProperties();
  return p.getProperty(name) || '';
}

function doGet(e) {
  var secret = prop_('CJRM_SECRET');
  var q = (e && e.parameter) || {};
  var given = q.secret || '';
  if (!secret || given !== secret) {
    return json_({ ok: false, error: 'unauthorized' });
  }
  var limit = Number(q.limit) || 50;
  limit = Math.min(100, Math.max(1, limit));
  var list = collect_(limit);
  return json_({ ok: true, messages: list });
}

function clean_(text) {
  var s = String(text || '');
  s = s.replace(/<[^>]+>/g, ' ');
  s = s.replace(/\s+/g, ' ');
  return s.trim();
}

function digits_(text) {
  return String(text || '').replace(/\D/g, '');
}

function collect_(limit) {
  var label = getLabel_();
  var threads = GmailApp.search(SEARCH, 0, 30);
  var phones = {
    phone1: prop_('CJRM_SHOP_PHONE'),
    phone2: prop_('CJRM_PERSONAL_PHONE')
  };
  var out = [];
  for (var t = 0; t < threads.length; t++) {
    if (out.length >= limit) break;
    var thread = threads[t];
    var msgs = thread.getMessages();
    for (var i = 0; i < msgs.length; i++) {
      if (out.length >= limit) break;
      var msg = msgs[i];
      var raw = msg.getPlainBody() || msg.getBody();
      var piece = {
        from: msg.getFrom(),
        subject: msg.getSubject(),
        body: clean_(raw)
      };
      out.push({
        id: msg.getId(),
        from: piece.from,
        subject: piece.subject,
        body: piece.body.slice(0, 4000),
        date: msg.getDate().toISOString(),
        channel: classify_(piece, phones)
      });
    }
    try {
      thread.addLabel(label);
    } catch (err) {
    }
  }
  return out;
}

function getLabel_() {
  var label = GmailApp.getUserLabelByName(LABEL_NAME);
  if (!label) label = GmailApp.createLabel(LABEL_NAME);
  return label;
}

function has_(blob, words) {
  for (var i = 0; i < words.length; i++) {
    if (blob.indexOf(words[i]) !== -1) return true;
  }
  return false;
}

function classify_(piece, phones) {
  var all = [piece.from, piece.subject, piece.body];
  var blob = all.join(' ').toLowerCase();
  if (has_(blob, ['kijiji'])) return 'kijiji';
  if (has_(blob, ['instagram'])) return 'instagram';
  var fb = ['facebook', 'messenger'];
  if (has_(blob, fb)) return 'facebook';
  if (has_(blob, ['whatsapp'])) return 'whatsapp';
  var hay = digits_(all.join(' '));
  var mine = digits_(phones.phone2);
  var shop = digits_(phones.phone1);
  if (mine.length >= 7 && hay.indexOf(mine) !== -1) {
    return 'phone2';
  }
  if (shop.length >= 7 && hay.indexOf(shop) !== -1) {
    return 'phone1';
  }
  var p2 = ['personal phone', 'personal line'];
  if (has_(blob, p2)) return 'phone2';
  var p1 = ['shop phone', 'shop line', 'sms',
    'text message', 'smsforwarder'];
  if (has_(blob, p1)) return 'phone1';
  if (has_(blob, ['contact form', 'website'])) {
    return 'web';
  }
  return 'email';
}

function json_(obj) {
  var s = JSON.stringify(obj);
  var out = ContentService.createTextOutput(s);
  return out.setMimeType(ContentService.MimeType.JSON);
}
