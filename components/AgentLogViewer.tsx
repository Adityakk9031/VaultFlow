'use client'

import { useEffect, useRef, useState } from 'react'
import { Bot, ShieldCheck, TrendingUp, CheckCircle2, AlertTriangle, Clock, Terminal, XCircle, Sparkles } from 'lucide-react'

export interface AgentLogEntry {
  agent: string
  status: 'running' | 'complete' | 'error'
  input?: string
  output?: string
  startedAt: number
  completedAt?: number
}

const agentMeta: Record<string, {
  icon: typeof Bot
  color: string
  borderColor: string
  bgGlow: string
  pillBg: string
  pillText: string
  orbColor: string
}> = {
  Categorizer: {
    icon: Bot,
    color: 'text-sky-300',
    borderColor: 'rgba(56,189,248,0.2)',
    bgGlow: 'rgba(56,189,248,0.04)',
    pillBg: 'rgba(56,189,248,0.1)',
    pillText: 'text-sky-300',
    orbColor: 'bg-sky-500',
  },
  'Risk Assessor': {
    icon: ShieldCheck,
    color: 'text-amber-300',
    borderColor: 'rgba(251,191,36,0.2)',
    bgGlow: 'rgba(251,191,36,0.04)',
    pillBg: 'rgba(251,191,36,0.1)',
    pillText: 'text-amber-300',
    orbColor: 'bg-amber-500',
  },
  'Budget Analyst': {
    icon: TrendingUp,
    color: 'text-emerald-300',
    borderColor: 'rgba(16,185,129,0.2)',
    bgGlow: 'rgba(16,185,129,0.04)',
    pillBg: 'rgba(16,185,129,0.1)',
    pillText: 'text-emerald-300',
    orbColor: 'bg-emerald-500',
  },
  System: {
    icon: XCircle,
    color: 'text-red-300',
    borderColor: 'rgba(239,68,68,0.2)',
    bgGlow: 'rgba(239,68,68,0.04)',
    pillBg: 'rgba(239,68,68,0.1)',
    pillText: 'text-red-300',
    orbColor: 'bg-red-500',
  },
}

const DEFAULT_META = agentMeta['Categorizer']

function AgentStep({ entry, index }: { entry: AgentLogEntry; index: number }) {
  const meta = agentMeta[entry.agent] ?? DEFAULT_META
  const Icon = meta.icon
  const isRunning = entry.status === 'running'
  const isError = entry.status === 'error'

  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    if (!isRunning) return
    const id = setInterval(() => setNow(Date.now()), 100)
    return () => clearInterval(id)
  }, [isRunning])

  const elapsed = entry.completedAt
    ? ((entry.completedAt - entry.startedAt) / 1000).toFixed(2)
    : ((now - entry.startedAt) / 1000).toFixed(2)

  let reasoning = ''
  let data = ''
  if (entry.output) {
    const parts = entry.output.split('[DATA]:')
    if (parts.length > 1) {
      reasoning = parts[0].replace('[REASONING]:', '').trim()
      data = parts[1].trim()
    } else {
      data = entry.output.trim()
    }
  }

  return (
    <div
      className="rounded-xl p-4 transition-all duration-500 animate-fade-up"
      style={{
        animationDelay: `${index * 60}ms`,
        background: isRunning
          ? 'rgba(255,255,255,0.03)'
          : isError
          ? 'rgba(239,68,68,0.04)'
          : meta.bgGlow,
        border: `1px solid ${isRunning ? 'rgba(255,255,255,0.08)' : isError ? 'rgba(239,68,68,0.25)' : meta.borderColor}`,
        boxShadow: isRunning ? '0 0 20px -8px rgba(255,255,255,0.05)' : 'none',
      }}
    >
      {/* Header row */}
      <div className="flex items-center gap-3 mb-3">
        {/* Agent icon */}
        <div className="relative">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: 'rgba(255,255,255,0.05)', border: `1px solid ${meta.borderColor}` }}
          >
            <Icon className={`w-4 h-4 ${isRunning ? 'text-zinc-400' : meta.color}`} />
          </div>
          {isRunning && (
            <span className={`absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full ${meta.orbColor} animate-ping opacity-75`} />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <span className={`text-sm font-semibold ${isRunning ? 'text-zinc-300' : meta.color}`}>
            {entry.agent}
          </span>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {isRunning && (
            <span className="text-[10px] font-mono text-amber-400/80 flex items-center gap-1">
              <span className="w-1 h-1 rounded-full bg-amber-400 animate-pulse" />
              evaluating
            </span>
          )}
          <span className="flex items-center gap-1 text-[10px] text-zinc-500 font-mono">
            <Clock className="w-2.5 h-2.5" />
            {elapsed}s
          </span>
          {entry.status === 'complete' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
          {isError && <AlertTriangle className="w-3.5 h-3.5 text-red-400" />}
        </div>
      </div>

      {/* Context input */}
      {entry.input && (
        <div className="mb-3 rounded-lg overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.05)' }}>
          <div className="flex items-center gap-1.5 px-3 py-1.5" style={{ background: 'rgba(255,255,255,0.03)' }}>
            <Terminal className="w-2.5 h-2.5 text-zinc-600" />
            <span className="text-[9px] uppercase tracking-widest text-zinc-600 font-mono">Context Input</span>
          </div>
          <p className="text-[10px] text-zinc-500 font-mono px-3 py-2 break-all max-h-12 overflow-y-auto leading-relaxed">
            {entry.input}
          </p>
        </div>
      )}

      {/* Reasoning block */}
      {reasoning && (
        <div
          className="mb-3 rounded-lg p-3"
          style={{ background: meta.bgGlow, border: `1px solid ${meta.borderColor}` }}
        >
          <div className="flex items-center gap-1.5 mb-2">
            <Sparkles className={`w-2.5 h-2.5 ${meta.pillText}`} />
            <span className={`text-[9px] uppercase tracking-widest font-mono font-bold ${meta.pillText} opacity-70`}>
              Reasoning
            </span>
          </div>
          <p className={`text-[11px] font-mono leading-relaxed whitespace-pre-line ${meta.color} opacity-80`}>
            {reasoning}
          </p>
        </div>
      )}

      {/* Structured output */}
      {data && (
        <div className="rounded-lg overflow-hidden" style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.05)' }}>
          <div className="flex items-center gap-1.5 px-3 py-1.5" style={{ background: 'rgba(255,255,255,0.03)' }}>
            <span className="text-[9px] uppercase tracking-widest text-zinc-500 font-mono font-bold">Output</span>
          </div>
          <pre className={`text-[11px] font-mono px-3 py-2 overflow-x-auto scrollbar-thin whitespace-pre-wrap break-all leading-relaxed ${meta.color}`}>
            {data}
          </pre>
        </div>
      )}
    </div>
  )
}

export default function AgentLogViewer({ logs }: { logs: AgentLogEntry[] }) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs.length])

  if (logs.length === 0) {
    return (
      <div
        className="rounded-2xl p-10 text-center"
        style={{ background: 'rgba(255,255,255,0.015)', border: '1px solid rgba(255,255,255,0.05)' }}
      >
        <div className="relative w-12 h-12 mx-auto mb-4">
          <div className="w-12 h-12 rounded-full bg-zinc-800/60 flex items-center justify-center border border-zinc-700/40">
            <Bot className="w-6 h-6 text-zinc-600" />
          </div>
          <div className="absolute inset-0 rounded-full border border-emerald-500/10 animate-ping" />
        </div>
        <p className="text-sm font-semibold text-zinc-400 font-mono mb-1">Awaiting Intake</p>
        <p className="text-xs text-zinc-600 font-mono max-w-xs mx-auto leading-relaxed">
          Submit a receipt to trigger the air-gapped 3-agent QVAC pipeline.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between pb-3 mb-1" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <h3 className="text-xs font-bold font-mono tracking-widest text-zinc-300 uppercase">
            QVAC Pipeline Logs
          </h3>
        </div>
        <span className="text-[10px] text-zinc-600 font-mono">{logs.length} ops</span>
      </div>
      <div className="space-y-2 max-h-[520px] overflow-y-auto pr-1 scrollbar-thin">
        {logs.map((entry, i) => (
          <AgentStep key={`${entry.agent}-${i}`} entry={entry} index={i} />
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  )
}
