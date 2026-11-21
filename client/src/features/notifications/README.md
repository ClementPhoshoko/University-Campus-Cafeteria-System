# Notification centre (client)

The inbox lives at `/notifications` behind `ProtectedRoute`, inside the existing
app shell. The header bell links there and reflects the global unread summary
from `NotificationsContext`.

## Backend contract

All calls go through `services/notificationApi.js` → `services/api.js` with the
bearer token, an abort signal and `cache: 'no-store'`.

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/notifications?page=1&limit=20&filter=all\|unread\|read&eventKey=&orderId=&q=` | Paginated inbox; response includes `notifications`, `unreadCount`, `level`, `pagination` |
| GET | `/notifications/unread-count` | Header summary: `unreadCount`, `level` |
| PATCH | `/notifications/:id/read` / `/:id/unread` | Flip read state; returns updated DTO |
| DELETE | `/notifications/:id` | Delete one |
| PATCH | `/notifications/read-all` | Mark all read; returns `updated` |
| DELETE | `/notifications/read` | Clear read; returns `deleted` |

`NotificationDTO`: `id`, `eventKey`, `category`, `level`, `orderId`, `title`,
`body`, `metadata`, `channel`, `status`, `sentAt`, `readAt`, `createdAt`,
`isRead`. Metadata is `{ category, level, actionPath, context }`;
`actionPath` is already server-resolved and is only rendered as a link when it
is an internal path. Categories are singular: `order`, `payment`, `cart`,
`vendor`, `promotion`, `account`, `system`. Levels are `none`, `info`,
`warning`, `alert`.

Preference APIs are not used by this page; the Profile preferences screen is
unchanged.

## Polling and freshness

- There is no interval polling. `NotificationsProvider` fetches
  `/notifications/unread-count` once when a session exists and again when the
  token changes. Concurrent callers are coalesced; requests are aborted on
  sign-out or unmount.
- The list uses `useFetch` with `staleTime: 0` and a user-scoped cache key. It
  revalidates on window focus / tab visibility like other lists.
- The inbox "Refresh" action and every mutation invalidate the notification
  cache and force an authoritative unread-count re-read. Optimistic local
  changes only reconcile visible state; persistence is entirely server-side.
- `q` is always sent. If a backend ignores it, the loaded page is additionally
  filtered locally and the UI says "Search filters the loaded page."
