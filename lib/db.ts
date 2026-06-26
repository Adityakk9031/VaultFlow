import type Database from 'better-sqlite3'

export interface Transaction {
  id: string
  date: string
  merchant: string
  amount: number
  category: string
  risk_status: string
  risk_reason: string | null
  analyst_tip: string
  created_at: string
}

// Persist the connection across Next.js hot-reloads in dev mode.
// Without this, every HMR cycle creates a new Database instance while
// the previous one still holds the WAL lock → SQLITE_BUSY crashes.
const g = global as typeof global & { __vaultflowDb?: Database.Database }


function generateId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

// ── JSON fallback ──────────────────────────────────────────────────────────────

function getJsonStore(): Transaction[] {
  const fs = require('fs')
  const path = require('path')
  const file = path.join(process.cwd(), 'data', 'transactions.json')
  try {
    const dir = path.dirname(file)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    if (!fs.existsSync(file)) fs.writeFileSync(file, '[]', 'utf-8')
    return JSON.parse(fs.readFileSync(file, 'utf-8'))
  } catch {
    return []
  }
}

function saveJsonStore(txns: Transaction[]): void {
  const fs = require('fs')
  const path = require('path')
  const file = path.join(process.cwd(), 'data', 'transactions.json')
  const dir = path.dirname(file)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(file, JSON.stringify(txns, null, 2), 'utf-8')
}

// ── SQLite ─────────────────────────────────────────────────────────────────────

const SCHEMA_SQL = `CREATE TABLE IF NOT EXISTS transactions (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  merchant TEXT NOT NULL,
  amount REAL NOT NULL,
  category TEXT NOT NULL,
  risk_status TEXT NOT NULL,
  risk_reason TEXT,
  analyst_tip TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)`

function migrateIfNeeded(d: Database.Database): void {
  const cols = (d.pragma('table_info(transactions)') as { name: string }[]).map((c) => c.name)
  if (cols.length > 0 && !cols.includes('analyst_tip')) {
    // Old schema — drop and recreate
    d.exec('DROP TABLE IF EXISTS transactions')
  }
  d.exec(SCHEMA_SQL)
}

function useSqlite(): Database.Database {
  const DatabaseLib: typeof import('better-sqlite3') = require('better-sqlite3')
  const path = require('path')
  const fs = require('fs')
  const dbPath = path.join(process.cwd(), 'data', 'vaultflow.db')
  const dir = path.dirname(dbPath)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  const d = new DatabaseLib(dbPath)
  d.pragma('journal_mode = WAL')
  migrateIfNeeded(d)
  return d
}

function getDb(): Database.Database {
  if (g.__vaultflowDb) return g.__vaultflowDb
  g.__vaultflowDb = useSqlite()
  return g.__vaultflowDb
}

// ── Public API ─────────────────────────────────────────────────────────────────

export function insertTransaction(t: Omit<Transaction, 'id' | 'created_at'>): Transaction {
  const id = generateId()
  try {
    const d = getDb()
    d.prepare(
      'INSERT INTO transactions (id, date, merchant, amount, category, risk_status, risk_reason, analyst_tip) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(id, t.date, t.merchant, t.amount, t.category, t.risk_status, t.risk_reason ?? null, t.analyst_tip)
    return d.prepare('SELECT * FROM transactions WHERE id = ?').get(id) as Transaction
  } catch {
    const txns = getJsonStore()
    const record: Transaction = { id, created_at: new Date().toISOString(), ...t }
    txns.push(record)
    saveJsonStore(txns)
    return record
  }
}

export function getAllTransactions(): Transaction[] {
  try {
    return getDb().prepare('SELECT * FROM transactions ORDER BY created_at DESC').all() as Transaction[]
  } catch {
    return getJsonStore().reverse()
  }
}

export function clearAllTransactions(): void {
  try {
    getDb().prepare('DELETE FROM transactions').run()
  } catch { /* ignore */ }
  // Always wipe JSON fallback too so both stores stay in sync
  try { saveJsonStore([]) } catch { /* ignore */ }
}
