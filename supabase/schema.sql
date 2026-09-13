-- Supabase PostgreSQL Schema for Thumari (SACCO / Group Savings & Loans)
-- Run this script in the Supabase SQL Editor: https://supabase.com/dashboard/project/_/sql

CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member',
  status TEXT NOT NULL DEFAULT 'active',
  member_id BIGINT,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS members (
  id BIGSERIAL PRIMARY KEY,
  member_no TEXT NOT NULL UNIQUE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  national_id TEXT,
  photo_url TEXT,
  join_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status TEXT NOT NULL DEFAULT 'active',
  exit_date TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS members_status_idx ON members(status);
CREATE INDEX IF NOT EXISTS members_national_id_idx ON members(national_id);

-- Foreign key link for users.member_id
ALTER TABLE users ADD CONSTRAINT fk_users_member FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_agent TEXT,
  ip TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON sessions(user_id);
CREATE INDEX IF NOT EXISTS sessions_expires_at_idx ON sessions(expires_at);

CREATE TABLE IF NOT EXISTS contribution_types (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  kind TEXT NOT NULL DEFAULT 'savings',
  default_amount_cents BIGINT NOT NULL DEFAULT 0,
  frequency TEXT NOT NULL DEFAULT 'monthly',
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS contributions (
  id BIGSERIAL PRIMARY KEY,
  member_id BIGINT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  type_id BIGINT NOT NULL REFERENCES contribution_types(id),
  period TEXT,
  amount_cents BIGINT NOT NULL,
  paid_at TIMESTAMPTZ NOT NULL,
  method TEXT NOT NULL DEFAULT 'cash',
  reference TEXT,
  notes TEXT,
  recorded_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS contributions_member_idx ON contributions(member_id);
CREATE INDEX IF NOT EXISTS contributions_period_idx ON contributions(period);
CREATE INDEX IF NOT EXISTS contributions_paid_at_idx ON contributions(paid_at);

CREATE TABLE IF NOT EXISTS loan_products (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  interest_rate_bps INT NOT NULL DEFAULT 500,
  interest_method TEXT NOT NULL DEFAULT 'reducing',
  min_amount_cents BIGINT NOT NULL DEFAULT 0,
  max_amount_cents BIGINT NOT NULL DEFAULT 0,
  min_term_months INT NOT NULL DEFAULT 1,
  max_term_months INT NOT NULL DEFAULT 24,
  penalty_rate_bps INT NOT NULL DEFAULT 200,
  grace_days INT NOT NULL DEFAULT 5,
  requires_guarantors BOOLEAN NOT NULL DEFAULT FALSE,
  guarantors_required INT NOT NULL DEFAULT 0,
  max_multiple_of_savings INT NOT NULL DEFAULT 3,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS loans (
  id BIGSERIAL PRIMARY KEY,
  loan_no TEXT NOT NULL UNIQUE,
  member_id BIGINT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  product_id BIGINT NOT NULL REFERENCES loan_products(id),
  principal_cents BIGINT NOT NULL,
  interest_rate_bps INT NOT NULL,
  interest_method TEXT NOT NULL,
  term_months INT NOT NULL,
  purpose TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  decision_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  decision_at TIMESTAMPTZ,
  decision_notes TEXT,
  disbursed_at TIMESTAMPTZ,
  first_due_date TIMESTAMPTZ,
  total_payable_cents BIGINT NOT NULL DEFAULT 0,
  outstanding_cents BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS loans_member_idx ON loans(member_id);
CREATE INDEX IF NOT EXISTS loans_status_idx ON loans(status);

CREATE TABLE IF NOT EXISTS loan_schedule (
  id BIGSERIAL PRIMARY KEY,
  loan_id BIGINT NOT NULL REFERENCES loans(id) ON DELETE CASCADE,
  installment_no INT NOT NULL,
  due_date TIMESTAMPTZ NOT NULL,
  principal_cents BIGINT NOT NULL,
  interest_cents BIGINT NOT NULL,
  total_cents BIGINT NOT NULL,
  paid_cents BIGINT NOT NULL DEFAULT 0,
  penalty_cents BIGINT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  paid_at TIMESTAMPTZ,
  UNIQUE(loan_id, installment_no)
);
CREATE INDEX IF NOT EXISTS loan_schedule_due_date_idx ON loan_schedule(due_date);

CREATE TABLE IF NOT EXISTS loan_repayments (
  id BIGSERIAL PRIMARY KEY,
  loan_id BIGINT NOT NULL REFERENCES loans(id) ON DELETE CASCADE,
  member_id BIGINT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  amount_cents BIGINT NOT NULL,
  paid_at TIMESTAMPTZ NOT NULL,
  method TEXT NOT NULL DEFAULT 'cash',
  reference TEXT,
  notes TEXT,
  recorded_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS loan_repayments_loan_idx ON loan_repayments(loan_id);
CREATE INDEX IF NOT EXISTS loan_repayments_member_idx ON loan_repayments(member_id);

CREATE TABLE IF NOT EXISTS loan_guarantors (
  id BIGSERIAL PRIMARY KEY,
  loan_id BIGINT NOT NULL REFERENCES loans(id) ON DELETE CASCADE,
  member_id BIGINT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  amount_cents BIGINT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  responded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(loan_id, member_id)
);
CREATE INDEX IF NOT EXISTS loan_guarantor_member_idx ON loan_guarantors(member_id);

CREATE TABLE IF NOT EXISTS meetings (
  id BIGSERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  scheduled_at TIMESTAMPTZ NOT NULL,
  location TEXT,
  agenda TEXT,
  status TEXT NOT NULL DEFAULT 'scheduled',
  minutes TEXT,
  absence_fine_cents BIGINT NOT NULL DEFAULT 0,
  created_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS meeting_attendance (
  id BIGSERIAL PRIMARY KEY,
  meeting_id BIGINT NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  member_id BIGINT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'absent',
  fine_cents BIGINT NOT NULL DEFAULT 0,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(meeting_id, member_id)
);

CREATE TABLE IF NOT EXISTS fines (
  id BIGSERIAL PRIMARY KEY,
  member_id BIGINT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  meeting_id BIGINT REFERENCES meetings(id) ON DELETE SET NULL,
  reason TEXT NOT NULL,
  amount_cents BIGINT NOT NULL,
  status TEXT NOT NULL DEFAULT 'outstanding',
  issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  paid_at TIMESTAMPTZ,
  created_by BIGINT REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS fines_member_idx ON fines(member_id);
CREATE INDEX IF NOT EXISTS fines_status_idx ON fines(status);

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  user_agent TEXT,
  platform TEXT,
  failure_count INT NOT NULL DEFAULT 0,
  disabled_at TIMESTAMPTZ,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS push_subscriptions_user_idx ON push_subscriptions(user_id);

CREATE TABLE IF NOT EXISTS notification_preferences (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_key TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE(user_id, event_key)
);

CREATE TABLE IF NOT EXISTS notifications (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_key TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  url TEXT,
  data TEXT,
  read_at TIMESTAMPTZ,
  pushed_at TIMESTAMPTZ,
  push_status TEXT NOT NULL DEFAULT 'pending',
  push_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS notifications_user_unread_idx ON notifications(user_id, read_at);
CREATE INDEX IF NOT EXISTS notifications_created_idx ON notifications(created_at);

CREATE TABLE IF NOT EXISTS audit_log (
  id BIGSERIAL PRIMARY KEY,
  actor_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity TEXT NOT NULL,
  entity_id BIGINT,
  detail TEXT,
  ip TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS audit_log_entity_idx ON audit_log(entity, entity_id);
CREATE INDEX IF NOT EXISTS audit_log_created_idx ON audit_log(created_at);

CREATE TABLE IF NOT EXISTS coffee_produce (
  id BIGSERIAL PRIMARY KEY,
  member_id BIGINT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  factory_grower_no TEXT,
  extracted_member_name TEXT,
  receipt_no TEXT,
  receipt_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  factory_name TEXT,
  society_name TEXT,
  gross_kg DOUBLE PRECISION NOT NULL,
  tare_kg DOUBLE PRECISION DEFAULT 0,
  net_kg DOUBLE PRECISION NOT NULL,
  rate_per_kg_cents BIGINT DEFAULT 0,
  gross_amount_cents BIGINT DEFAULT 0,
  deductions_cents BIGINT DEFAULT 0,
  net_payout_cents BIGINT DEFAULT 0,
  receipt_image_path TEXT NOT NULL,
  ocr_raw_text TEXT,
  status TEXT NOT NULL DEFAULT 'pending_verification',
  recorded_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  verified_by_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  verified_at TIMESTAMPTZ,
  rejection_reason TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS coffee_produce_member_idx ON coffee_produce(member_id);
CREATE INDEX IF NOT EXISTS coffee_produce_date_idx ON coffee_produce(receipt_date);
CREATE INDEX IF NOT EXISTS coffee_produce_status_idx ON coffee_produce(status);

CREATE TABLE IF NOT EXISTS group_projects (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  start_date TIMESTAMPTZ,
  target_budget_cents BIGINT DEFAULT 0,
  created_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS group_projects_status_idx ON group_projects(status);

CREATE TABLE IF NOT EXISTS project_incomes (
  id BIGSERIAL PRIMARY KEY,
  project_id BIGINT NOT NULL REFERENCES group_projects(id) ON DELETE CASCADE,
  income_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  source TEXT NOT NULL,
  amount_cents BIGINT NOT NULL,
  payment_method TEXT NOT NULL DEFAULT 'mpesa',
  receipt_no TEXT,
  recorded_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS project_incomes_project_idx ON project_incomes(project_id);
CREATE INDEX IF NOT EXISTS project_incomes_date_idx ON project_incomes(income_date);

CREATE TABLE IF NOT EXISTS expenses (
  id BIGSERIAL PRIMARY KEY,
  expense_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  category TEXT NOT NULL,
  amount_cents BIGINT NOT NULL,
  payee TEXT NOT NULL,
  purpose TEXT NOT NULL,
  payment_method TEXT NOT NULL DEFAULT 'mpesa',
  receipt_number TEXT,
  receipt_photo_url TEXT,
  project_id BIGINT REFERENCES group_projects(id) ON DELETE SET NULL,
  approved_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  recorded_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS expenses_category_idx ON expenses(category);
CREATE INDEX IF NOT EXISTS expenses_date_idx ON expenses(expense_date);
CREATE INDEX IF NOT EXISTS expenses_project_idx ON expenses(project_id);

CREATE TABLE IF NOT EXISTS factory_rates (
  id BIGSERIAL PRIMARY KEY,
  factory_name TEXT NOT NULL,
  society_name TEXT,
  season_year INT NOT NULL,
  grade TEXT NOT NULL DEFAULT 'Cherry',
  rate_per_kg_cents BIGINT NOT NULL,
  notes TEXT,
  updated_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(factory_name, season_year, grade)
);
CREATE INDEX IF NOT EXISTS factory_rates_factory_idx ON factory_rates(factory_name);
CREATE INDEX IF NOT EXISTS factory_rates_year_idx ON factory_rates(season_year);
