-- Generate voucher for patron at threshold
INSERT INTO public.discount_codes (venue_id, user_id, code, reward_id, reward_name, expires_at, status)
SELECT 
  '119335f3-6c25-4786-a02c-6df427b12d30',
  '3a4ce0a9-01d4-45c7-8183-dd8fe7b6c5c5',
  upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8)),
  '4c8b97f0-7c0a-405f-b347-084fabe174a6',
  'chicken',
  now() + interval '30 days',
  'active'
WHERE EXISTS (
  SELECT 1 FROM public.patron_loyalty
  WHERE user_id = '3a4ce0a9-01d4-45c7-8183-dd8fe7b6c5c5'
    AND stamps_count >= 3
);

-- Reset stamps to 0
UPDATE public.patron_loyalty
SET stamps_count = 0, updated_at = now()
WHERE user_id = '3a4ce0a9-01d4-45c7-8183-dd8fe7b6c5c5'
  AND venue_id = '119335f3-6c25-4786-a02c-6df427b12d30'
  AND stamps_count >= 3;

-- Log the reset transaction
INSERT INTO public.loyalty_transactions (user_id, venue_id, program_id, type, stamps_delta, source_type)
VALUES (
  '3a4ce0a9-01d4-45c7-8183-dd8fe7b6c5c5',
  '119335f3-6c25-4786-a02c-6df427b12d30',
  'c2c15f46-a8be-4c4c-a22f-00c0a617a560',
  'stamps_reset',
  -3,
  'reward'
);