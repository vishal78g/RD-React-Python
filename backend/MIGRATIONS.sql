-- ============================================================================
-- RD Agent Assistant - Database Schema Migrations & RLS Policies
-- ============================================================================

-- ============================================================================
-- 1. ALTER ACCOUNTS TABLE - Add new fields
-- ============================================================================

ALTER TABLE public.accounts
ADD COLUMN account_number TEXT UNIQUE NOT NULL DEFAULT '',
ADD COLUMN account_opening_date DATE,
ADD COLUMN month_paid_upto INTEGER DEFAULT 0,
ADD COLUMN next_emi_date DATE,
ADD COLUMN active_status BOOLEAN DEFAULT FALSE;

-- Set default for village to empty string (in case it already has NOT NULL)
ALTER TABLE public.accounts
ALTER COLUMN village SET DEFAULT '';

-- Update phone to allow 0 or 10-digit validation
-- No change needed to column, will enforce in app

-- ============================================================================
-- 2. Add index for account_number lookup
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_accounts_account_number 
ON public.accounts(account_number);

CREATE INDEX IF NOT EXISTS idx_accounts_active_status 
ON public.accounts(active_status);

CREATE INDEX IF NOT EXISTS idx_accounts_village 
ON public.accounts(village);

CREATE INDEX IF NOT EXISTS idx_emi_collections_payment_date 
ON public.emi_collections(payment_date);

-- ============================================================================
-- 3. ENABLE ROW LEVEL SECURITY (RLS)
-- ============================================================================

ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.emi_collections ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 4. RLS POLICIES FOR ACCOUNTS
-- ============================================================================

-- Allow anyone to read all accounts (for app usage)
CREATE POLICY "Enable read for all authenticated users" 
ON public.accounts FOR SELECT
USING (auth.role() = 'authenticated');

-- Allow insert for authenticated users
CREATE POLICY "Enable insert for all authenticated users" 
ON public.accounts FOR INSERT
WITH CHECK (auth.role() = 'authenticated');

-- Allow update only for authenticated users
CREATE POLICY "Enable update for authenticated users" 
ON public.accounts FOR UPDATE
USING (auth.role() = 'authenticated')
WITH CHECK (auth.role() = 'authenticated');

-- Allow delete only for authenticated users
CREATE POLICY "Enable delete for authenticated users" 
ON public.accounts FOR DELETE
USING (auth.role() = 'authenticated');

-- ============================================================================
-- 5. RLS POLICIES FOR EMI_COLLECTIONS
-- ============================================================================

-- Allow anyone to read emi collections
CREATE POLICY "Enable read for all authenticated users" 
ON public.emi_collections FOR SELECT
USING (auth.role() = 'authenticated');

-- Allow insert for authenticated users
CREATE POLICY "Enable insert for all authenticated users" 
ON public.emi_collections FOR INSERT
WITH CHECK (auth.role() = 'authenticated');

-- Allow update only for authenticated users
CREATE POLICY "Enable update for authenticated users" 
ON public.emi_collections FOR UPDATE
USING (auth.role() = 'authenticated')
WITH CHECK (auth.role() = 'authenticated');

-- Allow delete only for authenticated users
CREATE POLICY "Enable delete for authenticated users" 
ON public.emi_collections FOR DELETE
USING (auth.role() = 'authenticated');

-- ============================================================================
-- 6. HELPER FUNCTIONS
-- ============================================================================

-- Function to calculate EMI cycle based on account opening date
CREATE OR REPLACE FUNCTION calculate_emi_cycle(opening_date DATE)
RETURNS INTEGER AS $$
BEGIN
  IF EXTRACT(DAY FROM opening_date) BETWEEN 1 AND 15 THEN
    RETURN 15;
  ELSE
    RETURN 30;
  END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================================================
-- 7. ADD emis_paid COLUMN TO emi_collections
--    Run this if your table already exists from the original schema
-- ============================================================================

-- Step 1: Add the emis_paid column (number of EMIs covered by one record)
ALTER TABLE public.emi_collections
ADD COLUMN IF NOT EXISTS emis_paid INTEGER NOT NULL DEFAULT 1;

-- Step 2: The amount column now stores TOTAL amount (emi_amount * emis_paid)
--         For existing single-EMI records, amount stays the same.
COMMENT ON COLUMN public.emi_collections.amount IS
  'Total amount collected = emi_amount * emis_paid';
COMMENT ON COLUMN public.emi_collections.emis_paid IS
  'Number of EMIs paid in this single collection record';

-- Step 3: Drop the old unique-per-month constraint.
--         One record now covers potentially multiple months, so
--         uniqueness is enforced per account per payment_date.
DROP INDEX IF EXISTS public.ux_emi_one_payment_per_account_month;

CREATE UNIQUE INDEX IF NOT EXISTS ux_emi_one_collection_per_account_per_day
ON public.emi_collections(account_id, payment_date);

-- ============================================================================
-- FRESH INSTALL: Create emi_collections with the new schema from scratch
-- (Skip this block if you are ALTER-ing an existing table above)
-- ============================================================================
/*
create table if not exists public.emi_collections (
  id bigint generated by default as identity primary key,
  account_id bigint not null references public.accounts(id) on delete cascade,
  amount numeric(12,2) not null check (amount > 0),  -- total = emi_amount * emis_paid
  emis_paid integer not null default 1 check (emis_paid >= 1),
  payment_date date not null,
  month integer not null check (month between 1 and 12),
  year integer not null,
  created_at timestamptz not null default now(),
  constraint ux_emi_one_collection_per_account_per_day unique (account_id, payment_date)
);
*/
