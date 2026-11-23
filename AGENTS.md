# Agent notes for CJRM

## Gestures

A mostly-horizontal left swipe on any Desk card or thread message (texts, emails, notes, and every other message) deletes it immediately: no hold and no confirm. The item slides off, and a 5-second Undo toast appears. Deleted mailbox `sourceId`s stay in `seenHubIds` so they do not come back from the mailbox.

- Delete when `|dx| > 2 * |dy|` and the swipe goes past about 35% of the item width, or on a fast leftward fling.
- A short or cancelled swipe snaps back and does not delete.
- If vertical movement dominates at any point, cancel the swipe and let the list scroll normally (`touch-action: pan-y`).
- A still press-and-hold of about 500ms (under ~10px of movement) enters multi-select and selects that item (checkmark, highlight, light vibration). Further taps toggle more items. A top bar shows “N selected”, Select all, Delete (same Undo toast), and Cancel (X). The back button also exits. Swipe-delete is disabled while multi-select is on.

## Onboarding

The app starts empty. There is no shipped demo or placeholder data. A first-run wizard must be completed before the Desk shows (`settings.onboarded`).

- Step 1, Connect your phone: on Android, request Contacts (`READ_CONTACTS`, used to put names on numbers) and SMS (`RECEIVE_SMS` / `READ_SMS`) with a why line. If denied, keep prompting with Retry and an Open settings deep link; the wizard cannot continue without both. Notification access for the Toronto VoIP number is optional on this step. On the web PWA, step 1 is “Install the Android app for texts” and may continue.
- Step 2, Connect your email: enter the hub URL and secret, test the connection, and show green on success. Continue only after a successful check (zero messages still counts as success).
- After that, the empty Desk shows “Waiting for your first message”. Existing installs drop only demo-flagged records (or the known demo lead ids) that have no real filed `sourceId`; real filed items are never removed.
- `CJRM.loadDemo()` remains a test helper and preserves `onboarded` plus hub settings.
