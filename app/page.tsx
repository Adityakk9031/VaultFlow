'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Upload, TrendingUp, FileText, Wallet, Database, Zap, Download,
  Cpu, AlertTriangle, CheckCircle2, RefreshCw, Trash2, FileDown, ScanLine,
  Shield, Sparkles, ChevronRight,
} from 'lucide-react'
import AgentLogViewer, { type AgentLogEntry } from '@/components/AgentLogViewer'
import FinancialStats, { type StatsData } from '@/components/FinancialStats'

interface Transaction {
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

const sampleReceipts = [
  'Purchased groceries at Walmart on March 15 total $234.56. Items: Milk $4.50, Bread $3.25, Eggs $5.99, Chicken $12.49, Vegetables $8.33',
  'Amazon order A-38472 Electronics: Wireless Headphones $89.99, USB-C Hub $34.50. Total $124.49',
  'Dinner at The Cheesecake Factory 2 entrees, 1 appetizer, 2 drinks. Total $87.42',
  'Netflix subscription renewal $15.99/month. Standard plan, next billing April 20.',
  'Shell Gas Station Regular unleaded 12.5 gallons $3.45/gal. Total $43.13',
  'Delta Airlines Round trip LAX to JFK. Economy class. Total $487.00',
  'Starbucks coffee and pastry Grande Latte $5.75, Blueberry Muffin $3.25. Total $9.00',
  'Uber trip from downtown to airport 22 miles, 35 minutes. Total $38.50',
  'Home Depot Paint supplies 2 gallons paint $72.98, paint brushes $12.50, drop cloth $8.99. Total $94.47',
  'Whole Foods Market Organic produce, grass-fed beef, artisan bread. Total $156.78',
]

function computeStats(txns: Transaction[]): StatsData {
  const total = txns.reduce((s, t) => s + t.amount, 0)
  const cats: Record<string, number> = {}
  txns.forEach((t) => { cats[t.category] = (cats[t.category] || 0) + 1 })
  let topCategory = '-'; let maxCount = 0
  for (const [c, n] of Object.entries(cats)) { if (n > maxCount) { maxCount = n; topCategory = c } }
  const anomalyCount = txns.filter((t) => t.risk_status === 'RISK_FLAGGED').length
  return { totalSpent: total, topCategory, anomalyCount, transactionCount: txns.length }
}

const formatCurrency = (n: number) => `$${n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`

/* ── Divider ──────────────────────────────────────────────────────────────── */
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <span className="text-[10px] uppercase tracking-widest text-zinc-600 font-mono font-medium">{children}</span>
      <div className="flex-1 h-px" style={{ background: 'linear-gradient(to right, rgba(255,255,255,0.05), transparent)' }} />
    </div>
  )
}

/* ── Glass card wrapper ───────────────────────────────────────────────────── */
function Card({ children, className = '', style = {} }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  return (
    <div
      className={`rounded-2xl ${className}`}
      style={{
        background: 'rgba(255,255,255,0.025)',
        border: '1px solid rgba(255,255,255,0.07)',
        backdropFilter: 'blur(20px)',
        ...style,
      }}
    >
      {children}
    </div>
  )
}

export default function Home() {
  const [text, setText] = useState('')
  const [logs, setLogs] = useState<AgentLogEntry[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [processing, setProcessing] = useState(false)
  const [dragActive, setDragActive] = useState(false)
  const [ocrStatus, setOcrStatus] = useState<string | null>(null)
  const [clearing, setClearing] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [stats, setStats] = useState<StatsData>({ totalSpent: 0, topCategory: '-', anomalyCount: 0, transactionCount: 0 })
  const fileInputRef = useRef<HTMLInputElement>(null)

  const refreshMetrics = useCallback(async () => {
    setRefreshing(true)
    try {
      const res = await fetch('/api/transactions')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      if (data.transactions) {
        const txns: Transaction[] = data.transactions
        setTransactions(txns)
        setStats(computeStats(txns))
      }
    } catch (err) {
      console.error('[VaultFlow] refreshMetrics failed:', err)
    } finally {
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { refreshMetrics() }, [refreshMetrics])

  const runPipeline = async (inputText: string) => {
    if (!inputText.trim()) return
    setProcessing(true)
    setLogs([])
    try {
      const res = await fetch('/api/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: inputText }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)

      const serverLogs: AgentLogEntry[] = data.logs || []
      const showAnimated = (index: number) => {
        if (index >= serverLogs.length) {
          setProcessing(false)
          refreshMetrics()
          return
        }
        const entry = serverLogs[index]
        const delay = entry.status === 'running' ? 400 + Math.random() * 300 : 300 + Math.random() * 200
        if (entry.status === 'running') {
          setLogs((prev) => [...prev, entry])
        } else {
          setLogs((prev) => {
            const updated = [...prev]
            if (updated.length > 0) updated[updated.length - 1] = entry
            return updated
          })
        }
        setTimeout(() => showAnimated(index + 1), delay)
      }
      showAnimated(0)
    } catch (err) {
      setLogs([{ agent: 'System', status: 'error', input: String(err), startedAt: Date.now(), completedAt: Date.now() }])
      setProcessing(false)
    }
  }

  const handleSubmit = () => runPipeline(text)
  const handleSample = () => {
    const sample = sampleReceipts[Math.floor(Math.random() * sampleReceipts.length)]
    setText(sample)
    runPipeline(sample)
  }

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation()
    setDragActive(e.type === 'dragenter' || e.type === 'dragover')
  }
  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation(); setDragActive(false)
    if (e.dataTransfer.files?.[0]) await handleFile(e.dataTransfer.files[0])
  }
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) await handleFile(e.target.files[0])
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleFile = async (file: File) => {
    setOcrStatus(`Reading ${file.name}…`)
    try {
      const form = new FormData()
      form.append('file', file)
      setOcrStatus('Running local OCR via QVAC…')
      const res = await fetch('/api/ocr', { method: 'POST', body: form })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      const extracted: string = data.text
      setOcrStatus(null)
      setText(extracted)
      runPipeline(extracted)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'OCR failed'
      // Do NOT silently fall back to fake sample data — that would process
      // the wrong receipt entirely. Instead, surface the error so the user
      // can paste the receipt text manually.
      setOcrStatus(`OCR unavailable: ${msg.includes('unavailable') ? 'QVAC model not loaded' : msg}. Paste text below manually.`)
      await new Promise((r) => setTimeout(r, 3000))
      setOcrStatus(null)
    }
  }

  const handleClearAll = async () => {
    if (!confirm('Delete all transactions from the local ledger? This cannot be undone.')) return
    setClearing(true)
    try {
      await fetch('/api/transactions', { method: 'DELETE' })
      await refreshMetrics()
      setLogs([])
      setText('')
    } finally {
      setClearing(false)
    }
  }

  const handleExport = () => {
    const a = document.createElement('a')
    a.href = '/api/transactions/export'
    a.download = `vaultflow-${new Date().toISOString().split('T')[0]}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  const latestTip = (() => {
    const tip = transactions[0]?.analyst_tip
    return tip && tip !== 'null' ? tip : null
  })()

  return (
    <div className="min-h-screen" style={{ background: '#03040a', color: '#f4f4f5' }}>

      {/* ── Ambient mesh background ─────────────────────────────────────────── */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 0 }}>
        <div className="blob absolute -top-32 -left-32 w-[500px] h-[500px] rounded-full blur-[120px] opacity-30"
          style={{ background: 'radial-gradient(circle, rgba(16,185,129,0.15) 0%, transparent 70%)' }} />
        <div className="blob blob-delay-2 absolute top-1/2 -right-64 w-[600px] h-[600px] rounded-full blur-[120px] opacity-20"
          style={{ background: 'radial-gradient(circle, rgba(139,92,246,0.2) 0%, transparent 70%)' }} />
        <div className="blob blob-delay-4 absolute -bottom-32 left-1/3 w-[400px] h-[400px] rounded-full blur-[100px] opacity-20"
          style={{ background: 'radial-gradient(circle, rgba(56,189,248,0.1) 0%, transparent 70%)' }} />
      </div>

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <header
        className="sticky top-0 z-50"
        style={{
          background: 'rgba(3,4,10,0.8)',
          backdropFilter: 'blur(24px)',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">

            {/* Logo */}
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                  style={{ background: 'linear-gradient(135deg, #10b981, #059669)', boxShadow: '0 0 12px -2px rgba(16,185,129,0.5)' }}>
                  <Wallet className="w-4 h-4 text-white" />
                </div>
              </div>
              <div>
                <span className="text-base font-bold tracking-tight text-zinc-50">VaultFlow</span>
                <span className="hidden sm:inline ml-2 text-[10px] font-mono text-zinc-600 border border-zinc-800 rounded px-1.5 py-0.5">v1.0</span>
              </div>
            </div>

            {/* Right side */}
            <div className="flex items-center gap-3">
              {/* Air-gap badge */}
              <div
                className="airgap-badge flex items-center gap-2 px-3 py-1.5 rounded-xl text-[11px] font-mono"
                style={{
                  background: 'rgba(16,185,129,0.07)',
                  border: '1px solid rgba(16,185,129,0.2)',
                  color: '#34d399',
                }}
              >
                <Shield className="w-3 h-3 shrink-0" />
                <span className="font-semibold tracking-wide hidden lg:inline">AIR-GAPPED · ZERO CLOUD · LOCAL COMPUTE</span>
                <span className="font-semibold tracking-wide lg:hidden">AIR-GAPPED</span>
              </div>

              {/* Record count */}
              <div className="hidden sm:flex items-center gap-2 text-[11px] text-zinc-600 font-mono">
                <Database className={`w-3.5 h-3.5 ${refreshing ? 'animate-pulse text-emerald-500' : ''}`} />
                {refreshing ? 'syncing…' : `${stats.transactionCount} records`}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* ── Main ────────────────────────────────────────────────────────────── */}
      <main className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* ── Left column ───────────────────────────────────────────────── */}
          <div className="lg:col-span-2 space-y-5">

            {/* Intake card */}
            <Card>
              <div className="p-6">
                <SectionLabel>Transaction Intake</SectionLabel>

                {/* Drop zone */}
                <div
                  onDragEnter={handleDrag}
                  onDragOver={handleDrag}
                  onDragLeave={handleDrag}
                  onDrop={handleDrop}
                  onClick={() => !ocrStatus && fileInputRef.current?.click()}
                  className={`rounded-xl p-6 text-center transition-all duration-300 mb-4 ${ocrStatus ? 'cursor-wait' : 'cursor-pointer'}`}
                  style={{
                    border: dragActive
                      ? '1.5px dashed rgba(16,185,129,0.5)'
                      : '1.5px dashed rgba(255,255,255,0.08)',
                    background: dragActive ? 'rgba(16,185,129,0.04)' : 'rgba(0,0,0,0.3)',
                    boxShadow: dragActive ? '0 0 20px -8px rgba(16,185,129,0.3)' : 'none',
                  }}
                >
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    className="hidden"
                    accept="image/*,application/pdf,text/*,.txt,.csv"
                  />
                  {ocrStatus ? (
                    <div className="space-y-2 py-1">
                      <ScanLine className="w-5 h-5 text-emerald-400 mx-auto animate-pulse" />
                      <p className="text-xs text-emerald-400 font-mono">{ocrStatus}</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="w-10 h-10 rounded-xl mx-auto flex items-center justify-center"
                        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
                        <Upload className="w-5 h-5 text-zinc-500" />
                      </div>
                      <p className="text-sm text-zinc-400">
                        Drop receipt, image, or PDF —{' '}
                        <span className="text-emerald-400 underline underline-offset-2">browse files</span>
                      </p>
                      <p className="text-[10px] text-zinc-600 font-mono">Local OCR via QVAC · zero cloud upload</p>
                    </div>
                  )}
                </div>

                {/* Textarea */}
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Or paste transaction text directly…"
                  className="w-full h-24 rounded-xl p-3.5 text-sm text-zinc-300 placeholder-zinc-700 font-mono resize-none transition-all input-glow"
                  style={{
                    background: 'rgba(0,0,0,0.4)',
                    border: '1px solid rgba(255,255,255,0.07)',
                    outline: 'none',
                  }}
                  disabled={processing || !!ocrStatus}
                />

                {/* Actions */}
                <div className="flex items-center gap-3 mt-4">
                  <button
                    onClick={handleSubmit}
                    disabled={processing || !text.trim()}
                    className="btn-press flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-40"
                    style={{
                      background: processing || !text.trim()
                        ? 'rgba(255,255,255,0.08)'
                        : 'linear-gradient(135deg, #10b981, #059669)',
                      boxShadow: processing || !text.trim() ? 'none' : '0 0 16px -4px rgba(16,185,129,0.5)',
                    }}
                  >
                    {processing ? (
                      <>
                        <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Processing…
                      </>
                    ) : (
                      <>
                        <Zap className="w-4 h-4" />
                        Analyze Offline
                      </>
                    )}
                  </button>

                  <button
                    onClick={handleSample}
                    disabled={processing}
                    className="btn-press flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-mono text-zinc-400 hover:text-zinc-200 transition-all disabled:opacity-40"
                    style={{ border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)' }}
                  >
                    <Download className="w-3.5 h-3.5" />
                    Load Sample
                  </button>
                </div>
              </div>
            </Card>

            {/* Stats */}
            <FinancialStats stats={stats} />

            {/* Agent log */}
            <Card className="p-6">
              <AgentLogViewer logs={logs} />
            </Card>
          </div>

          {/* ── Right column ──────────────────────────────────────────────── */}
          <div className="space-y-5">

            {/* Agent Insight card */}
            <div
              className="rounded-2xl p-5 relative overflow-hidden"
              style={{
                background: 'linear-gradient(135deg, rgba(16,185,129,0.08) 0%, rgba(255,255,255,0.02) 60%, rgba(139,92,246,0.05) 100%)',
                border: '1px solid rgba(16,185,129,0.15)',
                boxShadow: latestTip ? '0 0 24px -8px rgba(16,185,129,0.2)' : 'none',
              }}
            >
              {/* Orb */}
              <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full blur-3xl opacity-30"
                style={{ background: 'radial-gradient(circle, rgba(16,185,129,0.4) 0%, transparent 70%)' }} />

              <div className="relative z-10">
                <div className="flex items-center gap-2 mb-4">
                  <Sparkles className="w-4 h-4 text-emerald-400" />
                  <h3 className="text-xs uppercase tracking-widest font-mono font-semibold text-zinc-400">
                    Agent Insight
                  </h3>
                </div>

                <p className="text-sm text-zinc-300 leading-relaxed min-h-[3.5rem]">
                  {latestTip || (
                    <span className="text-zinc-600">
                      Submit a transaction to receive AI-generated budget optimization advice from the local QVAC pipeline.
                    </span>
                  )}
                </p>

                {latestTip && (
                  <div className="mt-4 pt-3 flex items-center gap-2 text-[10px] text-zinc-600 font-mono"
                    style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                    <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                    Budget Analyst · local inference
                  </div>
                )}
              </div>
            </div>

            {/* Recent Transactions */}
            <Card className="p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xs uppercase tracking-widest text-zinc-500 font-mono font-semibold">
                  Recent Transactions
                </h2>
                <span className="text-[10px] text-zinc-700 font-mono">{transactions.length}</span>
              </div>

              <div className="space-y-2 max-h-[400px] overflow-y-auto scrollbar-thin pr-0.5">
                {transactions.length === 0 ? (
                  <div className="py-10 text-center">
                    <div className="w-12 h-12 rounded-2xl mx-auto mb-3 flex items-center justify-center"
                      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                      <Wallet className="w-6 h-6 text-zinc-700" />
                    </div>
                    <p className="text-xs text-zinc-600 font-mono">No transactions yet</p>
                    <p className="text-[10px] text-zinc-700 mt-1 font-mono">Process a receipt to see results</p>
                  </div>
                ) : (
                  transactions.map((tx) => {
                    const isFlagged = tx.risk_status === 'RISK_FLAGGED'
                    return (
                      <div
                        key={tx.id}
                        className="rounded-xl p-3.5 transition-all duration-200 group"
                        style={{
                          background: isFlagged
                            ? 'rgba(251,191,36,0.04)'
                            : 'rgba(255,255,255,0.02)',
                          border: isFlagged
                            ? '1px solid rgba(251,191,36,0.18)'
                            : '1px solid rgba(255,255,255,0.05)',
                        }}
                      >
                        <div className="flex items-start justify-between mb-1.5">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-zinc-200 truncate">{tx.merchant}</p>
                            <p className="text-[10px] font-mono text-zinc-600 mt-0.5">
                              {tx.date} · {tx.category}
                            </p>
                          </div>
                          <div className="text-right flex-shrink-0 ml-3">
                            <p className={`text-sm font-bold font-mono ${isFlagged ? 'text-amber-300' : 'text-zinc-100'}`}>
                              {formatCurrency(tx.amount)}
                            </p>
                            <span
                              className={`inline-flex items-center gap-1 text-[9px] font-mono px-1.5 py-0.5 rounded-full mt-1 ${
                                isFlagged
                                  ? 'text-amber-300'
                                  : 'text-emerald-400'
                              }`}
                              style={{
                                background: isFlagged ? 'rgba(251,191,36,0.1)' : 'rgba(16,185,129,0.08)',
                                border: isFlagged ? '1px solid rgba(251,191,36,0.2)' : '1px solid rgba(16,185,129,0.15)',
                              }}
                            >
                              {isFlagged ? (
                                <><AlertTriangle className="w-2 h-2" />FLAGGED</>
                              ) : (
                                <><CheckCircle2 className="w-2 h-2" />CLEAR</>
                              )}
                            </span>
                          </div>
                        </div>

                        {tx.analyst_tip && tx.analyst_tip !== 'null' && (
                          <p className="text-[10px] text-zinc-600 mt-2 leading-relaxed"
                            style={{ borderTop: '1px solid rgba(255,255,255,0.04)', paddingTop: '0.5rem' }}>
                            {tx.analyst_tip}
                          </p>
                        )}
                        {isFlagged && tx.risk_reason && (
                          <p className="text-[10px] text-amber-600/80 mt-1 leading-relaxed font-mono">
                            {tx.risk_reason.length > 120 ? tx.risk_reason.slice(0, 120) + '…' : tx.risk_reason}
                          </p>
                        )}
                      </div>
                    )
                  })
                )}
              </div>
            </Card>

            {/* Action grid */}
            <div className="grid grid-cols-2 gap-3">
              {[
                {
                  icon: <RefreshCw className="w-4 h-4 text-emerald-400" />,
                  label: 'Quick Sample',
                  sub: 'Auto-fill test receipt',
                  accent: 'rgba(16,185,129,0.08)',
                  border: 'rgba(16,185,129,0.15)',
                  hoverGlow: 'rgba(16,185,129,0.2)',
                  onClick: handleSample,
                  disabled: processing,
                },
                {
                  icon: <Database className={`w-4 h-4 text-sky-400 ${refreshing ? 'animate-pulse' : ''}`} />,
                  label: refreshing ? 'Syncing…' : 'Refresh',
                  sub: 'Sync local ledger',
                  accent: 'rgba(56,189,248,0.06)',
                  border: 'rgba(56,189,248,0.12)',
                  hoverGlow: 'rgba(56,189,248,0.2)',
                  onClick: refreshMetrics,
                  disabled: refreshing,
                },
                {
                  icon: <FileDown className="w-4 h-4 text-violet-400" />,
                  label: 'Export CSV',
                  sub: 'Download ledger',
                  accent: 'rgba(139,92,246,0.06)',
                  border: 'rgba(139,92,246,0.12)',
                  hoverGlow: 'rgba(139,92,246,0.2)',
                  onClick: handleExport,
                  disabled: transactions.length === 0,
                },
                {
                  icon: <Trash2 className={`w-4 h-4 text-red-400 ${clearing ? 'animate-pulse' : ''}`} />,
                  label: 'Clear All',
                  sub: 'Wipe local ledger',
                  accent: 'rgba(239,68,68,0.05)',
                  border: 'rgba(239,68,68,0.12)',
                  hoverGlow: 'rgba(239,68,68,0.18)',
                  onClick: handleClearAll,
                  disabled: clearing || transactions.length === 0,
                },
              ].map((item) => (
                <button
                  key={item.label}
                  onClick={item.onClick}
                  disabled={item.disabled}
                  className="btn-press rounded-xl p-4 text-left transition-all duration-200 disabled:opacity-40 group"
                  style={{
                    background: item.accent,
                    border: `1px solid ${item.border}`,
                  }}
                  onMouseEnter={(e) => {
                    if (!item.disabled) (e.currentTarget as HTMLElement).style.boxShadow = `0 0 16px -6px ${item.hoverGlow}`
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.boxShadow = 'none'
                  }}
                >
                  <div className="mb-2">{item.icon}</div>
                  <p className="text-xs font-semibold text-zinc-200">{item.label}</p>
                  <p className="text-[9px] text-zinc-600 mt-0.5 font-mono">{item.sub}</p>
                </button>
              ))}
            </div>

            {/* Pipeline info badge */}
            <div
              className="rounded-xl p-4"
              style={{
                background: 'rgba(255,255,255,0.015)',
                border: '1px solid rgba(255,255,255,0.05)',
              }}
            >
              <p className="text-[10px] text-zinc-600 font-mono uppercase tracking-widest mb-3">Pipeline</p>
              <div className="space-y-2">
                {[
                  { label: 'Categorizer', color: 'bg-sky-500', desc: 'Merchant · category · amount' },
                  { label: 'Risk Assessor', color: 'bg-amber-500', desc: 'Anomaly · fraud detection' },
                  { label: 'Budget Analyst', color: 'bg-emerald-500', desc: 'Optimization · advice' },
                ].map((step, i) => (
                  <div key={step.label} className="flex items-center gap-3">
                    <div className="flex items-center gap-2 flex-1">
                      <div className={`w-1.5 h-1.5 rounded-full ${step.color} flex-shrink-0`} />
                      <span className="text-[10px] font-mono text-zinc-400 font-medium">{step.label}</span>
                    </div>
                    <span className="text-[9px] text-zinc-700 font-mono">{step.desc}</span>
                    {i < 2 && <ChevronRight className="w-2.5 h-2.5 text-zinc-800 flex-shrink-0" />}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* ── Footer ──────────────────────────────────────────────────────────── */}
      <footer className="relative z-10 mt-10" style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
        <div className="max-w-7xl mx-auto px-6 py-6 flex items-center justify-between">
          <p className="text-[10px] font-mono text-zinc-700">
            VaultFlow · MIT Licensed · QVAC Edge AI Hackathon
          </p>
          <div className="flex items-center gap-2">
            <Cpu className="w-3 h-3 text-zinc-800" />
            <p className="text-[10px] font-mono text-zinc-700">100% local · zero cloud dependencies</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
