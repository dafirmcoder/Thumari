import { createClient, type Client } from '@libsql/client';
import { drizzle, type LibSQLDatabase } from 'drizzle-orm/libsql';
import fs from 'node:fs';
import path from 'node:path';
import * as schema from './schema.js';

export type Db = LibSQLDatabase<typeof schema>;

export interface DatabaseHandle {
  db: Db;
  client: Client;
}

export function createDatabase(filePathOrUrl: string, authToken?: string): DatabaseHandle {
  const isRemoteUrl =
    filePathOrUrl.startsWith('libsql:') ||
    filePathOrUrl.startsWith('http:') ||
    filePathOrUrl.startsWith('https:');

  let url: string;
  if (isRemoteUrl || filePathOrUrl === ':memory:') {
    url = filePathOrUrl;
  } else if (filePathOrUrl.startsWith('file:')) {
    url = filePathOrUrl;
    const actualPath = url.replace(/^file:\/\//, '').replace(/^file:/, '');
    if (actualPath && !actualPath.includes(':memory:')) {
      try {
        fs.mkdirSync(path.dirname(path.resolve(actualPath)), { recursive: true });
      } catch {}
    }
  } else {
    try {
      fs.mkdirSync(path.dirname(path.resolve(filePathOrUrl)), { recursive: true });
    } catch {}
    url = `file:${path.resolve(filePathOrUrl)}`;
  }

  const token = authToken || process.env.TURSO_AUTH_TOKEN || process.env.DATABASE_AUTH_TOKEN;
  const client = createClient({
    url,
    ...(token ? { authToken: token } : {}),
  });
  const db = drizzle(client, { schema });

  return { db, client };
}

export async function applyMigrations(db: Db): Promise<void> {
  const client: Client = (db as any).session?.client;
  if (!client) return;

  await client.executeMultiple(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'member',
      status TEXT NOT NULL DEFAULT 'active',
      member_id INTEGER,
      last_login_at INTEGER,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      user_agent TEXT,
      ip TEXT,
      expires_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON sessions(user_id);
    CREATE INDEX IF NOT EXISTS sessions_expires_at_idx ON sessions(expires_at);

    CREATE TABLE IF NOT EXISTS members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      member_no TEXT NOT NULL UNIQUE,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      phone TEXT,
      email TEXT,
      national_id TEXT,
      join_date INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      exit_date INTEGER,
      notes TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS members_status_idx ON members(status);

    CREATE TABLE IF NOT EXISTS contribution_types (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      kind TEXT NOT NULL DEFAULT 'savings',
      default_amount_cents INTEGER NOT NULL DEFAULT 0,
      frequency TEXT NOT NULL DEFAULT 'monthly',
      active INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS contributions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      member_id INTEGER NOT NULL REFERENCES members(id),
      type_id INTEGER NOT NULL REFERENCES contribution_types(id),
      period TEXT,
      amount_cents INTEGER NOT NULL,
      paid_at INTEGER NOT NULL,
      method TEXT NOT NULL DEFAULT 'cash',
      reference TEXT,
      notes TEXT,
      recorded_by INTEGER REFERENCES users(id),
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS contributions_member_idx ON contributions(member_id);
    CREATE INDEX IF NOT EXISTS contributions_period_idx ON contributions(period);
    CREATE INDEX IF NOT EXISTS contributions_paid_at_idx ON contributions(paid_at);

    CREATE TABLE IF NOT EXISTS loan_products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      interest_rate_bps INTEGER NOT NULL DEFAULT 500,
      interest_method TEXT NOT NULL DEFAULT 'reducing',
      min_amount_cents INTEGER NOT NULL DEFAULT 0,
      max_amount_cents INTEGER NOT NULL DEFAULT 0,
      min_term_months INTEGER NOT NULL DEFAULT 1,
      max_term_months INTEGER NOT NULL DEFAULT 24,
      penalty_rate_bps INTEGER NOT NULL DEFAULT 200,
      grace_days INTEGER NOT NULL DEFAULT 5,
      requires_guarantors INTEGER NOT NULL DEFAULT 0,
      guarantors_required INTEGER NOT NULL DEFAULT 0,
      max_multiple_of_savings INTEGER NOT NULL DEFAULT 3,
      active INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS loans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      loan_no TEXT NOT NULL UNIQUE,
      member_id INTEGER NOT NULL REFERENCES members(id),
      product_id INTEGER NOT NULL REFERENCES loan_products(id),
      principal_cents INTEGER NOT NULL,
      interest_rate_bps INTEGER NOT NULL,
      interest_method TEXT NOT NULL,
      term_months INTEGER NOT NULL,
      purpose TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      applied_at INTEGER NOT NULL,
      decision_by INTEGER REFERENCES users(id),
      decision_at INTEGER,
      decision_notes TEXT,
      disbursed_at INTEGER,
      first_due_date INTEGER,
      total_payable_cents INTEGER NOT NULL DEFAULT 0,
      outstanding_cents INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS loans_member_idx ON loans(member_id);
    CREATE INDEX IF NOT EXISTS loans_status_idx ON loans(status);

    CREATE TABLE IF NOT EXISTS loan_schedule (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      loan_id INTEGER NOT NULL REFERENCES loans(id) ON DELETE CASCADE,
      installment_no INTEGER NOT NULL,
      due_date INTEGER NOT NULL,
      principal_cents INTEGER NOT NULL,
      interest_cents INTEGER NOT NULL,
      total_cents INTEGER NOT NULL,
      paid_cents INTEGER NOT NULL DEFAULT 0,
      penalty_cents INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'pending',
      paid_at INTEGER,
      UNIQUE(loan_id, installment_no)
    );
    CREATE INDEX IF NOT EXISTS loan_schedule_due_date_idx ON loan_schedule(due_date);

    CREATE TABLE IF NOT EXISTS loan_repayments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      loan_id INTEGER NOT NULL REFERENCES loans(id),
      member_id INTEGER NOT NULL REFERENCES members(id),
      amount_cents INTEGER NOT NULL,
      paid_at INTEGER NOT NULL,
      method TEXT NOT NULL DEFAULT 'cash',
      reference TEXT,
      notes TEXT,
      recorded_by INTEGER REFERENCES users(id),
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS loan_repayments_loan_idx ON loan_repayments(loan_id);
    CREATE INDEX IF NOT EXISTS loan_repayments_member_idx ON loan_repayments(member_id);

    CREATE TABLE IF NOT EXISTS loan_guarantors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      loan_id INTEGER NOT NULL REFERENCES loans(id) ON DELETE CASCADE,
      member_id INTEGER NOT NULL REFERENCES members(id),
      amount_cents INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'pending',
      responded_at INTEGER,
      created_at INTEGER NOT NULL,
      UNIQUE(loan_id, member_id)
    );

    CREATE TABLE IF NOT EXISTS meetings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      scheduled_at INTEGER NOT NULL,
      location TEXT,
      agenda TEXT,
      status TEXT NOT NULL DEFAULT 'scheduled',
      minutes TEXT,
      absence_fine_cents INTEGER NOT NULL DEFAULT 0,
      created_by INTEGER REFERENCES users(id),
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS meeting_attendance (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      meeting_id INTEGER NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
      member_id INTEGER NOT NULL REFERENCES members(id),
      status TEXT NOT NULL DEFAULT 'absent',
      fine_cents INTEGER NOT NULL DEFAULT 0,
      recorded_at INTEGER NOT NULL,
      UNIQUE(meeting_id, member_id)
    );

    CREATE TABLE IF NOT EXISTS fines (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      member_id INTEGER NOT NULL REFERENCES members(id),
      meeting_id INTEGER REFERENCES meetings(id),
      reason TEXT NOT NULL,
      amount_cents INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'outstanding',
      issued_at INTEGER NOT NULL,
      paid_at INTEGER,
      created_by INTEGER REFERENCES users(id)
    );
    CREATE INDEX IF NOT EXISTS fines_member_idx ON fines(member_id);
    CREATE INDEX IF NOT EXISTS fines_status_idx ON fines(status);

    CREATE TABLE IF NOT EXISTS push_subscriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      endpoint TEXT NOT NULL UNIQUE,
      p256dh TEXT NOT NULL,
      auth TEXT NOT NULL,
      user_agent TEXT,
      platform TEXT,
      failure_count INTEGER NOT NULL DEFAULT 0,
      disabled_at INTEGER,
      last_seen_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS push_subscriptions_user_idx ON push_subscriptions(user_id);

    CREATE TABLE IF NOT EXISTS notification_preferences (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      event_key TEXT NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 1,
      UNIQUE(user_id, event_key)
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      event_key TEXT NOT NULL,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      url TEXT,
      data TEXT,
      read_at INTEGER,
      pushed_at INTEGER,
      push_status TEXT NOT NULL DEFAULT 'pending',
      push_error TEXT,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS notifications_user_unread_idx ON notifications(user_id, read_at);
    CREATE INDEX IF NOT EXISTS notifications_created_idx ON notifications(created_at);

    CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      actor_user_id INTEGER REFERENCES users(id),
      action TEXT NOT NULL,
      entity TEXT NOT NULL,
      entity_id INTEGER,
      detail TEXT,
      ip TEXT,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS audit_log_entity_idx ON audit_log(entity, entity_id);
    CREATE INDEX IF NOT EXISTS audit_log_created_idx ON audit_log(created_at);

    CREATE TABLE IF NOT EXISTS coffee_produce (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      member_id INTEGER NOT NULL REFERENCES members(id),
      factory_grower_no TEXT,
      extracted_member_name TEXT,
      receipt_no TEXT,
      receipt_date INTEGER NOT NULL,
      factory_name TEXT,
      society_name TEXT,
      gross_kg REAL NOT NULL,
      tare_kg REAL DEFAULT 0,
      net_kg REAL NOT NULL,
      rate_per_kg_cents INTEGER DEFAULT 0,
      gross_amount_cents INTEGER DEFAULT 0,
      deductions_cents INTEGER DEFAULT 0,
      net_payout_cents INTEGER DEFAULT 0,
      receipt_image_path TEXT NOT NULL,
      ocr_raw_text TEXT,
      status TEXT NOT NULL DEFAULT 'pending_verification',
      recorded_by INTEGER REFERENCES users(id),
      verified_by_user_id INTEGER REFERENCES users(id),
      verified_at INTEGER,
      rejection_reason TEXT,
      notes TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS coffee_produce_member_idx ON coffee_produce(member_id);
    CREATE INDEX IF NOT EXISTS coffee_produce_date_idx ON coffee_produce(receipt_date);
    CREATE INDEX IF NOT EXISTS coffee_produce_status_idx ON coffee_produce(status);

    CREATE TABLE IF NOT EXISTS group_projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      code TEXT NOT NULL UNIQUE,
      description TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      start_date INTEGER,
      target_budget_cents INTEGER DEFAULT 0,
      created_by INTEGER REFERENCES users(id),
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS group_projects_status_idx ON group_projects(status);

    CREATE TABLE IF NOT EXISTS project_incomes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL REFERENCES group_projects(id) ON DELETE CASCADE,
      income_date INTEGER NOT NULL,
      source TEXT NOT NULL,
      amount_cents INTEGER NOT NULL,
      payment_method TEXT NOT NULL DEFAULT 'mpesa',
      receipt_no TEXT,
      recorded_by INTEGER REFERENCES users(id),
      notes TEXT,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS project_incomes_project_idx ON project_incomes(project_id);
    CREATE INDEX IF NOT EXISTS project_incomes_date_idx ON project_incomes(income_date);

    CREATE TABLE IF NOT EXISTS expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      expense_date INTEGER NOT NULL,
      category TEXT NOT NULL,
      amount_cents INTEGER NOT NULL,
      payee TEXT NOT NULL,
      purpose TEXT NOT NULL,
      payment_method TEXT NOT NULL DEFAULT 'mpesa',
      receipt_number TEXT,
      receipt_photo_url TEXT,
      project_id INTEGER REFERENCES group_projects(id),
      approved_by INTEGER REFERENCES users(id),
      recorded_by INTEGER REFERENCES users(id),
      notes TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS expenses_category_idx ON expenses(category);
    CREATE INDEX IF NOT EXISTS expenses_date_idx ON expenses(expense_date);
    CREATE INDEX IF NOT EXISTS expenses_project_idx ON expenses(project_id);

    CREATE TABLE IF NOT EXISTS factory_rates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      factory_name TEXT NOT NULL,
      society_name TEXT,
      season_year INTEGER NOT NULL,
      grade TEXT NOT NULL DEFAULT 'Cherry',
      rate_per_kg_cents INTEGER NOT NULL,
      notes TEXT,
      updated_by INTEGER REFERENCES users(id),
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      UNIQUE(factory_name, season_year, grade)
    );
    CREATE INDEX IF NOT EXISTS factory_rates_factory_idx ON factory_rates(factory_name);
    CREATE INDEX IF NOT EXISTS factory_rates_year_idx ON factory_rates(season_year);
  `);

  // Column additions for existing databases (idempotent)
  try {
    await client.execute('ALTER TABLE members ADD COLUMN photo_url TEXT;');
  } catch {}
  try {
    await client.execute('ALTER TABLE members ADD COLUMN national_id TEXT;');
  } catch {}
  try {
    await client.execute('CREATE INDEX IF NOT EXISTS members_national_id_idx ON members(national_id);');
  } catch {}
}
