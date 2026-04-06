UPDATE public.merchant_subscriptions 
SET 
  stripe_subscription_id = 'sub_1TJFUTRrnmiHUS0LvDJCaOl6',
  plan_id = '96b0d81d-5c39-46d2-9bae-01967ab5790b',
  status = 'trial',
  trial_ends_at = to_timestamp(1776095703),
  current_period_start = to_timestamp(1775490903),
  current_period_end = to_timestamp(1776095703),
  updated_at = now()
WHERE venue_id = '119335f3-6c25-4786-a02c-6df427b12d30';