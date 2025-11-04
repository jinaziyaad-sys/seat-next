# Analytics Setup Instructions

This document outlines the setup required for the advanced analytics features.

## Daily Snapshot Generation

The system includes an automated daily snapshot feature that captures venue metrics at midnight each day. This powers the comparative analytics (week-over-week, month-over-month) in the Customer Insights and Operations dashboards.

### Setup Required

#### 1. Enable pg_cron Extension (One-time setup)

Run this in the Supabase SQL Editor:

```sql
-- Enable pg_cron extension
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Enable pg_net extension for HTTP calls
CREATE EXTENSION IF NOT EXISTS pg_net;
```

#### 2. Create Cron Job (One-time setup)

Run this in the Supabase SQL Editor to schedule the daily snapshot generation at midnight UTC:

```sql
SELECT cron.schedule(
  'generate-daily-venue-snapshots',
  '0 0 * * *', -- Run at midnight UTC every day
  $$
  SELECT net.http_post(
    url:='https://cuoqjgahpfymxqrdlzlf.supabase.co/functions/v1/generate-daily-snapshots',
    headers:='{"Content-Type": "application/json"}'::jsonb,
    body:='{}'::jsonb
  );
  $$
);
```

#### 3. Verify Cron Job

Check that the cron job was created successfully:

```sql
SELECT * FROM cron.job WHERE jobname = 'generate-daily-venue-snapshots';
```

#### 4. Manual Trigger (Optional for testing)

To manually trigger the snapshot generation for testing:

```sql
SELECT net.http_post(
  url:='https://cuoqjgahpfymxqrdlzlf.supabase.co/functions/v1/generate-daily-snapshots',
  headers:='{"Content-Type": "application/json"}'::jsonb,
  body:='{}'::jsonb
);
```

Or call it directly from the Supabase Functions dashboard.

### Customer Segment Update

The `update-customer-segments` edge function should also run daily to update customer segment classifications. Add this cron job:

```sql
SELECT cron.schedule(
  'update-customer-segments',
  '30 0 * * *', -- Run at 00:30 UTC every day (after snapshots)
  $$
  SELECT net.http_post(
    url:='https://cuoqjgahpfymxqrdlzlf.supabase.co/functions/v1/update-customer-segments',
    headers:='{"Content-Type": "application/json"}'::jsonb,
    body:='{}'::jsonb
  );
  $$
);
```

### Monitoring

1. **Check Cron Job Logs**:
   ```sql
   SELECT * FROM cron.job_run_details 
   WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'generate-daily-venue-snapshots')
   ORDER BY start_time DESC 
   LIMIT 10;
   ```

2. **Verify Snapshots Are Being Created**:
   ```sql
   SELECT venue_id, snapshot_date, total_orders, total_customers
   FROM daily_venue_snapshots
   ORDER BY snapshot_date DESC, venue_id
   LIMIT 20;
   ```

3. **Check Edge Function Logs**:
   - View logs in Supabase Dashboard: Functions > generate-daily-snapshots > Logs

### Troubleshooting

**Problem**: Cron jobs not running
- Verify `pg_cron` extension is enabled
- Check cron job is active: `SELECT * FROM cron.job;`
- Review cron job run details: `SELECT * FROM cron.job_run_details;`

**Problem**: Snapshots not created
- Manually trigger the function to test
- Check edge function logs for errors
- Verify venues exist in the database
- Ensure there's activity data (orders/waitlist) to snapshot

**Problem**: Comparative analytics not showing
- Ensure daily snapshots have been running for at least the comparison period (7+ days for weekly, 30+ for monthly)
- Check that snapshots contain valid data
- Review browser console for client-side errors

## Features Enabled by Daily Snapshots

1. **Comparative Analytics**: Week-over-week and month-over-month trend indicators
2. **Historical Reporting**: Long-term venue performance tracking
3. **Data Export**: Comprehensive Excel exports with historical data
4. **Predictive Insights**: Foundation for future ML-based predictions

## Data Retention

Daily snapshots are stored indefinitely by default. Consider implementing a data retention policy based on your needs:

```sql
-- Example: Delete snapshots older than 2 years
DELETE FROM daily_venue_snapshots 
WHERE snapshot_date < NOW() - INTERVAL '2 years';
```

## Security & Privacy

- All customer data in snapshots is anonymized and aggregated
- No PII (Personally Identifiable Information) is stored in snapshots
- Compliant with POPIA requirements
- Only accessible to venue staff and super admins via RLS policies
