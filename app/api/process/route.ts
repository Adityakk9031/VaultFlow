import { NextRequest, NextResponse } from 'next/server'
import { runAgentPipeline, type AgentLog } from '@/lib/qvac'
import { insertTransaction } from '@/lib/db'

export async function POST(req: NextRequest) {
  try {
    const { text } = await req.json()
    if (!text || typeof text !== 'string' || !text.trim()) {
      return NextResponse.json({ error: 'No text provided' }, { status: 400 })
    }

    const logs: AgentLog[] = []
    const { categorization, riskAssessment, budgetAdvice } = await runAgentPipeline(text, (log) => {
      logs.push({ ...log })
    })

    const record = insertTransaction({
      date: categorization.date || new Date().toISOString().split('T')[0],
      merchant: categorization.merchant,
      amount: categorization.amount,
      category: categorization.category,
      risk_status: riskAssessment.status,
      risk_reason: riskAssessment.justification,
      analyst_tip: budgetAdvice,
    })

    return NextResponse.json({ transaction: record, logs, categorization, riskAssessment, budgetAdvice })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
