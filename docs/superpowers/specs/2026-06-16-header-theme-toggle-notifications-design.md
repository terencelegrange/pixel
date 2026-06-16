# Header Theme Toggle + General Notifications

## Purpose

Add a theme (light/dark) toggle icon to the header (currently the toggle only
lives in Settings → Appearance) and a new general-purpose notifications icon
next to it, backed by a new `notifications` table. No creation form is built
for notifications — rows are seeded directly for now; a future iteration may
add an admin/automation path for creating them.

## Existing State (context)

- `Header.tsx` already has an admin-only `Bell` icon tied to support-request
  submissions (`/api/support`, polled every 60s, badge = count of `status ===
  'New'`). This is left completely unchanged.
- No theme toggle currently exists in the header; `ThemeContext` (`useTheme()`
  hook) already provides `toggleTheme()` and the current theme, used today
  only by the Settings → Appearance page.
- API routes in this codebase have no server-side auth middleware — they
  trust a `userId` passed by the client (see `/api/support`). The new
  notifications routes follow the same trust model for consistency.

## Data Model

```sql
CREATE TABLE notifications (
  id          CHAR(36)     NOT NULL,
  title       VARCHAR(255) NOT NULL,
  message     TEXT         NULL,
  type        ENUM('info','warning','error','success') NOT NULL DEFAULT 'info',
  link        VARCHAR(500) NULL,
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE notification_reads (
  notification_id CHAR(36) NOT NULL,
  user_id          CHAR(36) NOT NULL,
  read_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (notification_id, user_id),
  KEY idx_notification_reads_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

- `notifications` is global — every authenticated user sees the same rows.
  No `user_id`/recipient column.
- `notification_reads` is the per-user read-state join table: a row's
  presence means that user has read that notification. Durable across
  devices/browsers (unlike a localStorage-only approach).
- Both tables are added to `lib/db.ts`'s `runSetup()` as
  `CREATE TABLE IF NOT EXISTS` statements, in the same style as every
  existing table (UUID `CHAR(36)` PK, `InnoDB`, `utf8mb4_unicode_ci`).
- Seed data: 3 sample rows inserted via `INSERT IGNORE` immediately after
  the `CREATE TABLE` statements (e.g. a welcome message, a maintenance
  notice, a feature announcement), matching the existing seed pattern used
  for `diagram_types` and `industry_sectors`.

## API

New file `app/api/notifications/route.ts`:

- **`GET /api/notifications?userId=<id>`**
  - Validates `userId` is present; 401 if missing (same convention as
    `/api/support`'s `POST`).
  - Returns the latest 20 notifications, `ORDER BY created_at DESC`, each
    row annotated with `isRead: boolean` via a `LEFT JOIN notification_reads
    ON notification_reads.notification_id = notifications.id AND
    notification_reads.user_id = ?`.
  - Also returns `unreadCount` — a separate `COUNT(*)` of notifications with
    no matching `notification_reads` row for this user.
  - Response shape: `{ notifications: NotificationDTO[], unreadCount: number }`
    where `NotificationDTO = { id, title, message, type, link, createdAt, isRead }`.

- **`POST /api/notifications/mark-read`** (new file
  `app/api/notifications/mark-read/route.ts`)
  - Body: `{ userId: string, notificationIds: string[] }`.
  - Bulk `INSERT IGNORE INTO notification_reads (notification_id, user_id)
    VALUES (?, ?), (?, ?), ...` for each id.
  - Called once when the notifications dropdown is opened, passing the ids
    of whatever was just fetched, so the badge clears and the read state
    persists.
  - No `DELETE`/`PUT`/creation endpoint — out of scope per requirements.

Both routes follow the existing try/catch → `console.error(...)` + 500 JSON
error pattern used throughout `app/api/**/route.ts`.

## UI — Header Changes

Icon order in `Header.tsx`'s right-hand cluster (left to right):

**theme toggle → general notifications → existing admin feedback bell → avatar dropdown**

1. **`ThemeToggleButton`** (new, small, in `components/layout/`) — uses the
   existing `useTheme()` hook; renders lucide-react `Sun` (light mode active)
   or `Moon` (dark mode active), calls `toggleTheme()` on click. No new
   state — wires up what `ThemeContext` already provides. The existing
   Settings → Appearance toggle is untouched (both remain functional,
   talking to the same context).

2. **`NotificationsBell`** (new, in `components/layout/`) — visible to
   **all** authenticated users (unlike the admin-only feedback bell).
   - Uses lucide-react's `Megaphone` icon, deliberately different from the
     existing feedback bell's `Bell` icon, so the two are visually
     distinguishable sitting next to each other.
   - Polls `GET /api/notifications?userId=<user.id>` every 60s via
     `useCallback` + `setInterval`, mirroring the existing feedback-bell
     polling code exactly.
   - Red badge shows `unreadCount` (caps at `9+`, same as the existing bell).
   - Dropdown panel (same visual treatment as the existing feedback
     dropdown — rounded card, border, shadow): lists up to 20 notifications,
     each showing a colored icon by `type` (info=blue, warning=amber,
     error=red, success=emerald), title, message, and relative created time.
     A notification with a `link` is wrapped in a `<Link>`; clicking it
     navigates there.
   - On opening the dropdown (`setNotifOpen(true)`), immediately calls
     `POST /api/notifications/mark-read` with the currently-loaded
     notification ids, then refetches to confirm `isRead`/`unreadCount` from
     the DB (not just optimistic local state).
   - Outside-click-to-close via the same `useRef` + `mousedown` listener
     pattern already used for the other two header dropdowns.

The existing admin feedback bell (`Bell` icon, support-request count) is
left completely unchanged — same position relative to the avatar dropdown,
same polling, same logic.

## Error Handling

- `GET`/`POST` use the existing try/catch → `console.error` + 500 JSON
  pattern from every other route in this codebase.
- Missing `userId` on either endpoint → 401, matching `/api/support`'s
  existing convention.
- Client-side: both new header components fail silently on fetch errors
  (catch and no-op), exactly like the existing feedback-bell poll — a
  transient API error shouldn't crash the header.

## Testing / Verification

This codebase has no automated test suite. Manual verification:

1. Start the dev server, log in as a non-admin user.
2. Confirm the new theme toggle icon appears in the header and switching it
   updates the page immediately and persists on reload (via `ThemeContext`'s
   existing localStorage persistence).
3. Confirm the new notifications (`Megaphone`) icon appears for a non-admin
   user, with a badge showing the seeded unread count.
4. Open the dropdown — confirm the 3 seeded notifications render with
   correct type-colored icons, and the badge clears.
5. Reload the page — confirm the badge stays cleared (read state persisted
   in `notification_reads`, not just client state).
6. Log in as an Admin user — confirm both the new notifications icon and the
   existing feedback bell appear side by side, visually distinct, and the
   feedback bell's behavior (support-request count) is unaffected.
