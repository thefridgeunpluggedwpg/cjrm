# CJRM Apps Script mailbox hub

This script lives in Johnny's Google account. It does not store a password in the repo.

1. At [script.google.com](https://script.google.com), start a new project and paste `Code.gs`.
2. Project Settings → Script properties:
   - `CJRM_SECRET` — a long random string
   - optional `CJRM_SHOP_PHONE` and `CJRM_PERSONAL_PHONE` (digits only is fine) so forwarded texts are tagged by line
3. Deploy → New deployment → Web app. Execute as Me. Who has access: Anyone with the link.
4. Paste the web-app URL and the secret into CJRM → More → Mailbox hub.

The PWA calls `GET {url}?secret=...` and files each message by source, then matches it to a person by phone, email, or name.

Full walkthrough: see [ONBOARDING.md](../ONBOARDING.md).
