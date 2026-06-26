import { NextResponse } from 'next/server'
import { getAllTransactions, clearAllTransactions } from '@/lib/db'

export async function GET() {
  try {
    return NextResponse.json({ transactions: getAllTransactions() })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 })
  }
}

export async function DELETE() {
  try {
    clearAllTransactions()
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 })
  }
}
