'use client'

import { CreditCard, TrendingUp, ShieldAlert, LayoutList } from 'lucide-react'

export interface StatsData {
  totalSpent: number
  topCategory: string
  anomalyCount: number
  transactionCount: number
}

interface StatCardProps {
  icon: React.ReactNode
  label: string
  value: string
  sub?: string
  gradient: string
  glow: string
  borderColor: string
  badge?: React.ReactNode
}

function StatCard({ icon, label, value, sub, gradient, glow, borderColor, badge }: StatCardProps) {
  return (
    <div
      className={`relative rounded-2xl p-5 overflow-hidden transition-all duration-300 hover:-translate-y-0.5 ${glow}`}
      style={{ background: 'rgba(255,255,255,0.025)', border: `1px solid ${borderColor}`, backdropFilter: 'blur(20px)' }}
    >
      {/* Gradient orb background */}
      <div className={`absolute -top-6 -right-6 w-24 h-24 rounded-full blur-2xl opacity-20 ${gradient}`} />

      <div className="relative z-10">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className={`p-1.5 rounded-lg ${gradient} bg-opacity-10`} style={{ background: 'rgba(255,255,255,0.05)' }}>
              {icon}
            </div>
            <span className="text-[10px] uppercase tracking-widest text-zinc-500 font-mono font-medium">{label}</span>
          </div>
          {badge}
        </div>
        <p className="text-2xl font-bold text-zinc-50 tracking-tight leading-none mb-1.5">{value}</p>
        {sub && <p className="text-[10px] text-zinc-600 font-mono">{sub}</p>}
      </div>

      {/* Bottom shimmer line */}
      <div className={`absolute bottom-0 left-0 right-0 h-px ${gradient} opacity-30`} />
    </div>
  )
}

export default function FinancialStats({ stats }: { stats: StatsData }) {
  const formatCurrency = (n: number) =>
    `$${n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <StatCard
        icon={<CreditCard className="w-3.5 h-3.5 text-emerald-400" />}
        label="Total Spent"
        value={formatCurrency(stats.totalSpent)}
        gradient="bg-emerald-500"
        glow="hover:shadow-[0_0_24px_-6px_rgba(16,185,129,0.35)]"
        borderColor="rgba(16,185,129,0.15)"
        badge={
          stats.totalSpent > 0 ? (
            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              LIVE
            </span>
          ) : null
        }
      />
      <StatCard
        icon={<TrendingUp className="w-3.5 h-3.5 text-sky-400" />}
        label="Top Category"
        value={stats.topCategory === '-' ? '—' : stats.topCategory}
        sub="by frequency"
        gradient="bg-sky-500"
        glow="hover:shadow-[0_0_24px_-6px_rgba(56,189,248,0.3)]"
        borderColor="rgba(56,189,248,0.12)"
      />
      <StatCard
        icon={<ShieldAlert className="w-3.5 h-3.5 text-amber-400" />}
        label="Anomalies"
        value={String(stats.anomalyCount)}
        sub="risk flagged"
        gradient="bg-amber-500"
        glow={stats.anomalyCount > 0 ? "hover:shadow-[0_0_24px_-6px_rgba(251,191,36,0.4)] shadow-[0_0_16px_-8px_rgba(251,191,36,0.3)]" : "hover:shadow-[0_0_24px_-6px_rgba(251,191,36,0.2)]"}
        borderColor={stats.anomalyCount > 0 ? "rgba(251,191,36,0.25)" : "rgba(251,191,36,0.1)"}
        badge={
          stats.anomalyCount > 0 ? (
            <span className="flex items-center gap-1 text-[9px] font-mono px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/25 animate-pulse">
              ALERT
            </span>
          ) : null
        }
      />
      <StatCard
        icon={<LayoutList className="w-3.5 h-3.5 text-violet-400" />}
        label="Transactions"
        value={String(stats.transactionCount)}
        sub="in local ledger"
        gradient="bg-violet-500"
        glow="hover:shadow-[0_0_24px_-6px_rgba(139,92,246,0.3)]"
        borderColor="rgba(139,92,246,0.12)"
      />
    </div>
  )
}
