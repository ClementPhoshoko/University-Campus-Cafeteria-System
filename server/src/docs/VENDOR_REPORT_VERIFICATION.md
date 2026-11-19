# Live vendor reporting — verification runbook

Run these checks against the target Supabase project after deploying server build 031+. This slice needs no database migration; it reads existing order data through the service role and rechecks manager membership in the controller.

## 1. Authorization boundaries

| Caller / payload | Expected |
|---|---|
| Staff account on `/vendor/reports` | `403 VENDOR_MANAGER_REQUIRED` |
| Manager with another vendor's `vendor_id` | `403 VENDOR_MANAGER_REQUIRED` |
| Manager with another vendor's `vendor_location_id` | `404 VENDOR_LOCATION_NOT_FOUND` |
| `range=decade` | `400 INVALID_REPORT_RANGE` |
| `range=custom` with `to < from` or a span over 366 days | `400 INVALID_REPORT_RANGE` |

The same matrix applies to `/vendor/reports/export`.

## 2. Date boundaries

```text
GET /vendor/reports?vendor_id={own}&range=7d
```

Expected: `report.range.from` is 00:00 UTC seven days before today, and `report.range.to` is 00:00 UTC tomorrow. For `ytd`, `from` is 1 January of the current UTC year. For `range=custom&from=2026-06-01&to=2026-06-03`, `to` is `2026-06-04T00:00:00.000Z`. Trend buckets are the UTC days from `from` up to (not including) `to`.

## 3. Aggregation cross-check

Pick a known location and `range=custom` around one settled order. Compare the API with SQL:

```sql
select
  count(*) as orders,
  sum(total) filter (where status not in ('cancelled', 'rejected')) as gross_revenue
from public.orders
where vendor_id = '{vendor-id}'
  and created_at >= '{from}'::timestamptz
  and created_at < '{to}'::timestamptz;
```

```sql
select coalesce(sum(amount), 0) as refunded
from public.refunds
where status = 'succeeded'
  and order_id in (
    select id from public.orders
    where vendor_id = '{vendor-id}'
      and created_at >= '{from}'::timestamptz
      and created_at < '{to}'::timestamptz
  );
```

Expected: API `summary.grossRevenue` matches gross revenue, `summary.refunded` matches refunded, and `summary.revenue = grossRevenue - refunded`. Cancelled/rejected orders still count in `summary.orders` and `statusBreakdown` but contribute no revenue. `topItems` totals should reconcile with `order_items.line_total` for the same order set.

## 4. Timezone and pagination

- With a site in `Africa/Johannesburg`, a 12:00 UTC order appears in the `14` peak-hours bucket (UTC+2) while its row timestamp shows 14:00.
- Request `page=1&limit=5`, then `page=2&limit=5`. Expected: different order references, stable ordering by `created_at` desc then `id` desc, and `pagination.total` unchanged.
- A vendor with more than 5000 orders in range returns `limits.truncated = true`; the UI shows a narrowing hint.

## 5. CSV export and audit

```text
GET /vendor/reports/export?vendor_id={own}&range=custom&from=...&to=...
```

Expected: `text/csv` attachment with UTF-8 BOM, quoted references containing commas or quotes, and one row per order in the range. Then confirm the audit row:

```sql
select actor_user_id, action, table_name, record_key, reason, category, created_at
from public.audit_logs
where action = 'EXPORT'
  and table_name = 'public.orders'
order by created_at desc
limit 5;
```

`actor_user_id` must be the manager, `record_key` the vendor id, and `category` `data`.

## 6. UI smoke check

- Sidebar shows **Reports** only to managers; staff navigating directly to `/vendor?view=reports` is redirected to `/vendor`.
- Range chips and custom date inputs refetch the server report (no local re-aggregation of a previously loaded page).
- Location dropdown lists only the manager's active locations.
- KPI tiles, trend bars, status badges, top items, peak hours, and recent orders match the API response.
- Pagination fetches a new server page. Export downloads a CSV and shows the audit notice.
- No admin mock figures appear anywhere in the vendor reports view.
