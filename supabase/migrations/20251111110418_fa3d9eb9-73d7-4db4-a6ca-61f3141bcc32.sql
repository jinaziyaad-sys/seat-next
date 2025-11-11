-- Step 1: Add 'rejected' status to order_status enum
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'rejected';