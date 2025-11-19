-- Setup cron job to auto-cancel expired waitlist entries every 2 minutes
SELECT cron.schedule(
  'auto-cancel-expired-waitlist',
  '*/2 * * * *', -- Every 2 minutes
  $$
  SELECT net.http_post(
    url := 'https://cuoqjgahpfymxqrdlzlf.supabase.co/functions/v1/auto-cancel-expired-waitlist',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN1b3FqZ2FocGZ5bXhxcmRsemxmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc0MzcyOTUsImV4cCI6MjA3MzAxMzI5NX0.3_qlOFfvD3FOHfHVeGnF4X_fql5fWgtP5B4Sk4qAYbE"}'::jsonb,
    body := '{}'::jsonb
  ) as request_id;
  $$
);