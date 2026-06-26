import { NextResponse } from 'next/server'
import { getAllTransactions } from '@/lib/db'

export async function GET() {
  try {
    const rows = getAllTransactions()

    const headers = ['id', 'date', 'merchant', 'amount', 'category', 'risk_status', 'risk_reason', 'analyst_tip', 'created_at']
    const escape = (v: unknown) => {
      const s = String(v ?? '').replace(/"/g, '""')
      return /[,"\n\r]/.test(s) ? `"${s}"` : s
    }

    const csv = [
      headers.join(','),
      ...rows.map(r => headers.map(h => escape(r[h as keyof typeof r])).join(',')),
    ].join('\r\n')

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="vaultflow-${new Date().toISOString().split('T')[0]}.csv"`,
      },
    })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 })
  }
}
