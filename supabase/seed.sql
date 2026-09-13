-- Supabase Seed Data for Thumari
-- Run this script in the Supabase SQL Editor: https://supabase.com/dashboard/project/_/sql

-- 1. Insert Initial Contribution Types
INSERT INTO contribution_types (name, kind, default_amount_cents, frequency, active)
VALUES 
  ('Monthly Savings', 'savings', 200000, 'monthly', TRUE),
  ('Welfare Fund', 'welfare', 50000, 'monthly', TRUE),
  ('Share Capital', 'shares', 1000000, 'one_off', TRUE),
  ('Emergency / Social Fund', 'social', 30000, 'monthly', TRUE),
  ('Coffee Produce Levy', 'savings', 20000, 'monthly', TRUE)
ON CONFLICT (name) DO NOTHING;

-- 2. Insert Standard Loan Products
INSERT INTO loan_products (
  name, interest_rate_bps, interest_method, min_amount_cents, max_amount_cents,
  min_term_months, max_term_months, penalty_rate_bps, grace_days,
  requires_guarantors, guarantors_required, max_multiple_of_savings, active
)
VALUES 
  ('Normal Development Loan', 150, 'reducing', 1000000, 50000000, 3, 24, 200, 5, TRUE, 2, 3, TRUE),
  ('Emergency / Farm Input Loan', 200, 'flat', 500000, 5000000, 1, 6, 300, 3, FALSE, 0, 2, TRUE)
ON CONFLICT (name) DO NOTHING;
