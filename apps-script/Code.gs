/**
 * CJRM mailbox hub - Google Apps Script
 *
 * Install this in Johnny's own Google account (see ONBOARDING.md).
 * It labels lead emails and serves them as JSON to the CJRM PWA.
 *
 * Setup:
 *  1. File → Project properties → Script properties
 *     - CJRM_SECRET = a long random string (also paste it into the app)
 *  2. Deploy → New deployment → Web app
 *     - Execute as: Me
 *     - Who has access: Anyone with the link
 *  3. Paste the web-app URL and the secret into CJRM → More → Mailbox hub
 *
 * Never put a real secret, phone number, or address in this file.
 */

var LABEL_NAME = 'CJRM';
var SEARCH = [
  'newer_than:14d (',
  'from:kijiji.ca OR from:kijiji.com',
  'OR from:facebookmail.com OR from:mail.instagram.com',
  'OR subject:"sent you a message" OR subject:"reply from"',
  'OR subject:"contact form" OR subject:"text to shop"',
  'OR subject:"text to personal" OR subject:SmsForwarder',
  'OR label:sms-forwarder OR list:kijiji OR subject:Kijiji)'
].join(' ');

function doGet(e) {
  var secret = PropertiesService.getScriptProperties().getProperty('CJRM_SECRET') || '';
  var given = (e && e.parameter && e.parameter.secret) || '';
  if (!secret || given !== secret) {
    return json_({ ok: false, error: 'unauthorized' });
  }
  var limit = 50;
  if (e && e.parameter && e.parameter.limit) {
    limit = Math.min(100, Math.max(1, Number(e.parameter.limit) || 50));
  }
  return json_({ ok: true, messages: collect_(limit) });
}

function collect_(limit) {
  var label = getLabel_();
  var threads = GmailApp.search(SEARCH, 0, 30);
  var phones = {
    phone1: PropertiesService.getScriptProperties().getProperty('CJRM_SHOP_PHONE') || '',
    phone2: PropertiesService.getScriptProperties().getProperty('CJRM_PERSONAL_PHONE') || '',
  };
  var out = [];
  for (var t = 0; t < threads.length && out.length < limit; t++) {
    var thread = threads[t];
    var msgs = thread.getMessages();
    for (var i = 0; i < msgs.length && out.length < limit; i++) {
      var msg = msgs[i];
      var piece = {
        from: msg.getFrom(),
        subject: msg.getSubject(),
        body: String(msg.getPlainBody() || msg.getBody() || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(),
      };
      var channel = classify_(piece, phones);
      out.push({
        id: msg.getId(),
        from: piece.from,
        subject: piece.subject,
        body: piece.body.slice(0, 4000),
        date: msg.getDate().toISOString(),
        channel: channel,
      });
    }
    try {
      thread.addLabel(label);
    } catch (err) {
      /* labelling is helpful but not required */
    }
  }
  return out;
}

function getLabel_() {
  var label = GmailApp.getUserLabelByName(LABEL_NAME);
  if (!label) label = GmailApp.createLabel(LABEL_NAME);
  return label;
}

function classify_(piece, phones) {
  var blob = (piece.from + '\n' + piece.subject + '\n' + piece.body).toLowerCase();
  if (blob.indexOf('kijiji') !== -1) return 'kijiji';
  if (blob.indexOf('instagram') !== -1) return 'instagram';
  if (blob.indexOf('facebook') !== -1 || blob.indexOf('messenger') !== -1) return 'facebook';
  if (blob.indexOf('whatsapp') !== -1) return 'whatsapp';
  var hay = (piece.from + ' ' + piece.subject + ' ' + piece.body).replace(/\D/g, '');
  var personal = String(phones.phone2 || '').replace(/\D/g, '');
  var shop = String(phones.phone1 || '').replace(/\D/g, '');
  if (personal.length >= 7 && hay.indexOf(personal) !== -1) return 'phone2';
  if (shop.length >= 7 && hay.indexOf(shop) !== -1) return 'phone1';
  if (/\bpersonal (phone|line)\b/.test(blob)) return 'phone2';
  if (/\b(shop (phone|line)|sms|text message|smsforwarder)\b/.test(blob)) return 'phone1';
  if (blob.indexOf('contact form') !== -1 || blob.indexOf('website') !== -1) return 'web';
  return 'email';
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
