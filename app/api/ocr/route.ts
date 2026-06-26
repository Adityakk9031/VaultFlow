import { NextRequest, NextResponse } from 'next/server'
import { QvacEngine } from '@/lib/qvac'
import { writeFile, unlink } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'

export async function POST(req: NextRequest) {
  let tmpPath: string | null = null
  try {
    const form = await req.formData()
    const file = form.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/bmp', 'application/pdf']
    if (!allowed.includes(file.type) && !file.type.startsWith('image/')) {
      // Plain text file — just return the text directly
      const text = await file.text()
      return NextResponse.json({ text: text.trim() })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const ext = file.name.split('.').pop() || 'jpg'
    tmpPath = join(tmpdir(), `vaultflow-ocr-${Date.now()}.${ext}`)
    await writeFile(tmpPath, buffer)

    const engine = QvacEngine.getInstance()
    const text = await engine.runOcr(tmpPath)

    if (!text) return NextResponse.json({ error: 'OCR produced no output' }, { status: 422 })
    return NextResponse.json({ text })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'OCR failed'
    const status = message.includes('unavailable') ? 503 : 500
    return NextResponse.json({ error: message }, { status })
  } finally {
    if (tmpPath) unlink(tmpPath).catch(() => {})
  }
}
