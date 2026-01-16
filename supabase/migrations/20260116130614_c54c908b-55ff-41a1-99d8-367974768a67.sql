-- Backfill default settings for venues with empty or null settings
UPDATE venues 
SET settings = jsonb_build_object(
  'business_hours', jsonb_build_object(
    'monday', jsonb_build_object('open', '09:00', 'close', '22:00', 'is_closed', false, 'breaks', '[]'::jsonb),
    'tuesday', jsonb_build_object('open', '09:00', 'close', '22:00', 'is_closed', false, 'breaks', '[]'::jsonb),
    'wednesday', jsonb_build_object('open', '09:00', 'close', '22:00', 'is_closed', false, 'breaks', '[]'::jsonb),
    'thursday', jsonb_build_object('open', '09:00', 'close', '22:00', 'is_closed', false, 'breaks', '[]'::jsonb),
    'friday', jsonb_build_object('open', '09:00', 'close', '22:00', 'is_closed', false, 'breaks', '[]'::jsonb),
    'saturday', jsonb_build_object('open', '09:00', 'close', '22:00', 'is_closed', false, 'breaks', '[]'::jsonb),
    'sunday', jsonb_build_object('open', '09:00', 'close', '22:00', 'is_closed', true, 'breaks', '[]'::jsonb)
  ),
  'holiday_closures', '[]'::jsonb,
  'grace_periods', jsonb_build_object('last_reservation', 0, 'last_order', 15, 'last_waitlist_join', 30),
  'venue_capacity', '40',
  'tables_per_interval', '4',
  'default_prep_time', '10',
  'max_extension_time', '45',
  'pickup_instructions', 'Please collect your order from the main counter. Show your order number to staff.',
  'auto_no_show_time', '15',
  'order_number_refresh_minutes', '15',
  'cob_time', '23:00',
  'auto_cleanup_cancelled_waitlist', true,
  'auto_cleanup_rejected', true,
  'prep_time_mode', 'analytics',
  'table_configuration', '[]'::jsonb
)
WHERE settings IS NULL OR settings = '{}'::jsonb;