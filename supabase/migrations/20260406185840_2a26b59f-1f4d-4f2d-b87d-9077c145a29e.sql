-- Restore La-tayy subscription to current active Stripe subscription
UPDATE public.merchant_subscriptions
SET 
  stripe_subscription_id = 'sub_1TJGJJRrnmiHUS0Lkgw2BZV3',
  plan_id = '37763276-6d0a-43d6-b337-d656301b3505',
  status = 'trial',
  current_period_start = '2026-04-06T15:47:35+00:00',
  current_period_end = '2026-04-12T15:47:35+00:00',
  trial_ends_at = '2026-04-13T15:47:35+00:00',
  cancelled_at = NULL,
  updated_at = now()
WHERE venue_id = '119335f3-6c25-4786-a02c-6df427b12d30';