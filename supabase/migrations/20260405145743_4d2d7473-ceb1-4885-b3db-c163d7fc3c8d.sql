
INSERT INTO public.subscription_plans (name, description, monthly_price, annual_price, included_features, sort_order) VALUES
  ('Starter', 'Food Ready + Table Ready features', 499.00, 4990.00, '["food_ordering", "waitlist", "reservations"]'::jsonb, 1),
  ('Pro', 'All Starter features plus Loyalty and Analytics', 999.00, 9990.00, '["food_ordering", "waitlist", "reservations", "loyalty", "analytics"]'::jsonb, 2),
  ('Enterprise', 'Full platform access with priority support', 1999.00, 19990.00, '["food_ordering", "waitlist", "reservations", "loyalty", "analytics", "kitchen_board"]'::jsonb, 3);

INSERT INTO public.subscription_addons (name, feature_key, monthly_price, annual_price) VALUES
  ('Loyalty Program', 'loyalty', 299.00, 2990.00),
  ('Analytics & Reports', 'analytics', 299.00, 2990.00);
