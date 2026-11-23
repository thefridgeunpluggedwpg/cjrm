# Agent notes for CJRM

## Gestures

Delete on a Desk card or thread message (any type — texts, emails, notes, and every other message) must activate only after a deliberate press-and-hold, then a horizontal left swipe that reveals the Delete control. A confirm still runs before anything is removed.

- Arm after a hold of about 500ms with less than about 10px of movement.
- Then reveal Delete only on a mostly-horizontal leftward swipe: `|dx| > 2 * |dy|` and `dx < -60px`.
- If vertical movement dominates at any point, cancel the arm and let the list scroll normally (`touch-action: pan-y`).
- A plain swipe without the hold, or a hold without the swipe, must not reveal Delete or delete anything.
