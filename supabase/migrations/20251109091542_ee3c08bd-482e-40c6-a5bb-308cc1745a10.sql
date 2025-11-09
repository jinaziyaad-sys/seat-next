-- Add 'awaiting_verification' to order_status enum
-- This must be done in a separate transaction
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumlabel = 'awaiting_verification' 
        AND enumtypid = 'order_status'::regtype
    ) THEN
        ALTER TYPE order_status ADD VALUE 'awaiting_verification' BEFORE 'placed';
    END IF;
END $$;