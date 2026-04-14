ALTER TABLE public.merchant_subscriptions DROP COLUMN IF EXISTS payfast_subscription_id;
ALTER TABLE public.merchant_subscriptions DROP COLUMN IF EXISTS payment_provider;
ALTER TABLE public.billing_invoices DROP COLUMN IF EXISTS payfast_reference;