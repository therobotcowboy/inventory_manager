-- Migration v5.1: Add TRANSFER to Transaction Types
-- Run this if you are upgrading an existing database without full reset

BEGIN;

ALTER TABLE inventory_transactions DROP CONSTRAINT IF EXISTS inventory_transactions_transaction_type_check;

ALTER TABLE inventory_transactions 
ADD CONSTRAINT inventory_transactions_transaction_type_check 
CHECK (transaction_type IN ('RESTOCK', 'JOB_USAGE', 'LOSS', 'ADJUSTMENT', 'INITIAL_STOCK', 'PURCHASE', 'TRANSFER'));

COMMIT;
