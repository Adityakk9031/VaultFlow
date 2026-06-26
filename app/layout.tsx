import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'VaultFlow — Air-Gapped Finance Agent',
  description: '100% local multi-agent finance processing powered by QVAC Edge Inference',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased bg-zinc-950 text-zinc-100 min-h-screen">{children}</body>
    </html>
  )
}
