# 0002. Personal Task Completion Semantics

Student task completions (marking assignments or reminders as done) are stored strictly on the student's device via `localStorage`.

Previously, marking a deadline as completed on a client device dispatched an unauthenticated POST request to `/api/complete_event`, which permanently deleted the event from Edge Config for the entire department. We eliminated global server deletions from client devices to prevent accidental class-wide data loss; deletions of department-wide events are strictly reserved for authenticated administrators via the Admin Dashboard.
