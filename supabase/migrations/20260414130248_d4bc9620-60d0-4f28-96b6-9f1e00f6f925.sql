ALTER TABLE public.merchant_subscriptions 
ADD COLUMN IF NOT EXISTS pending_plan_id uuid REFERENCES public.subscription_plans(id),
ADD COLUMN IF NOT EXISTS pending_billing_cycle text,
ADD COLUMN IF NOT EXISTS pending_change_at timestamptz;