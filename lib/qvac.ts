export interface QvacResult {
  text: string
  latencyMs: number
}

export interface AgentLog {
  agent: string
  status: 'running' | 'complete' | 'error'
  input?: string
  output?: string
  startedAt: number
  completedAt?: number
}

// ── QVAC Engine Singleton ──────────────────────────────────────────────────────

export class QvacEngine {
  private static instance: QvacEngine
  private sdk: any = null
  private llmModelId: string | null = null
  private ocrModelId: string | null = null
  private initialized = false
  private providerStarted = false

  private constructor() {}

  static getInstance(): QvacEngine {
    if (!QvacEngine.instance) QvacEngine.instance = new QvacEngine()
    return QvacEngine.instance
  }

  private async ensureProvider() {
    if (this.providerStarted || !this.sdk) return
    try {
      await this.sdk.startQVACProvider()
      this.providerStarted = true
      console.log('[QVAC] Provider started.')
    } catch (err) {
      console.warn('[QVAC] Provider start failed (may already be running).', err)
      this.providerStarted = true
    }
  }

  async init() {
    if (this.initialized) return
    if (process.env.USE_QVAC_SDK === 'true') {
      try {
        this.sdk = await import('@qvac/sdk')
        await this.ensureProvider()

        console.log('[QVAC] Loading LLM: LLAMA_3_2_1B_INST_Q4_0...')
        this.llmModelId = await this.sdk.loadModel({
          modelSrc: this.sdk.LLAMA_3_2_1B_INST_Q4_0,
          modelType: 'llm',
          onProgress: (p: number) => console.log(`[QVAC] LLM load: ${Math.round(p * 100)}%`),
        })
        console.log('[QVAC] LLM ready.')
      } catch (err) {
        console.warn('[QVAC] SDK unavailable, using offline rule-based fallback.', err)
        this.sdk = null
      }
    } else {
      console.log('[QVAC] Offline rule-based mode (set USE_QVAC_SDK=true to enable local LLM).')
    }
    this.initialized = true
  }

  async initOcr(): Promise<string | null> {
    if (!this.sdk) return null
    if (this.ocrModelId) return this.ocrModelId
    try {
      await this.ensureProvider()
      console.log('[QVAC] Loading OCR model: OCR_0_6B_MULTIMODAL_Q4_K_M...')
      this.ocrModelId = await this.sdk.loadModel({
        modelSrc: this.sdk.OCR_0_6B_MULTIMODAL_Q4_K_M,
        onProgress: (p: number) => console.log(`[QVAC] OCR load: ${Math.round(p * 100)}%`),
      })
      console.log('[QVAC] OCR model ready.')
      return this.ocrModelId
    } catch (err) {
      console.warn('[QVAC] OCR model failed to load.', err)
      return null
    }
  }

  async runOcr(imagePathOrBuffer: string | Buffer): Promise<string> {
    await this.init()
    const modelId = await this.initOcr()
    if (!modelId || !this.sdk) throw new Error('OCR model unavailable')

    const chunks: string[] = []
    const stream = this.sdk.ocr({ modelId, image: imagePathOrBuffer })
    for await (const chunk of stream) {
      if (chunk?.text) chunks.push(chunk.text)
      else if (typeof chunk === 'string') chunks.push(chunk)
    }
    return chunks.join('').trim()
  }

  // runInference matches the spec: runInference(systemPrompt, userPrompt)
  async runInference(systemPrompt: string, userPrompt: string): Promise<QvacResult> {
    await this.init()
    const start = performance.now()

    if (this.sdk && this.llmModelId) {
      try {
        const result = await this.sdk.completion({
          modelId: this.llmModelId,
          history: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          stream: false,
        })
        return { text: result.text || '', latencyMs: Math.round(performance.now() - start) }
      } catch (err) {
        console.error('[QVAC] Inference error, using fallback.', err)
      }
    }

    // Rule-based fallback — detect agent by system prompt keyword
    let text = ''
    if (systemPrompt.includes('Categorizer')) {
      const data = this.fallbackCategorize(userPrompt)
      const reasoning = [
        `1. Scanned raw transaction input for merchant keywords and price patterns.`,
        `2. Matched vendor "${data.merchant}" from known lists or natural language syntax.`,
        `3. Detected total charge of $${data.amount.toFixed(2)} and extracted itemized pricing elements.`,
        `4. Classified purchase into category "${data.category}" using semantic rules.`,
      ].join('\n')
      text = `[REASONING]:\n${reasoning}\n\n[DATA]:\n${JSON.stringify(data)}`
    } else if (systemPrompt.includes('Risk Assessor')) {
      const result = this.fallbackAssessRisk(userPrompt)
      const reasoning = [
        `1. Evaluating parsed transaction details for financial anomalies.`,
        `2. Comparing transaction total against the $500.00 single-transaction hard budget cap.`,
        `3. Checking category-specific risk guidelines and vendor validation flags.`,
        `4. Result determined: ${result.status}.`,
      ].join('\n')
      text = `[REASONING]:\n${reasoning}\n\n[DATA]:\n[STATUS: ${result.status}] ${result.justification}`
    } else if (systemPrompt.includes('Financial Analyst') || systemPrompt.includes('Budget Analyst')) {
      const tip = this.fallbackGenerateAdvice(userPrompt)
      const reasoning = [
        `1. Analyzing combined categorization and risk assessment data.`,
        `2. Pinpointing category habits and budget variance.`,
        `3. Tailoring exactly one highly specific actionable financial optimization tip.`,
      ].join('\n')
      text = `[REASONING]:\n${reasoning}\n\n[DATA]:\n${tip}`
    } else {
      text = `[REASONING]:\nUnknown agent type.\n\n[DATA]:\nnull`
    }
    return { text, latencyMs: Math.round(performance.now() - start) }
  }

  // ── Fallback Rule Engines ─────────────────────────────────────────────────────

  public fallbackCategorize(text: string): {
    merchant: string; amount: number; date: string; category: string
    items: { name: string; price: number }[]
  } {
    const norm = text.replace(/[–—―]/g, '-').replace(/\s+/g, ' ').trim()

    // Normalize European comma-decimal notation (94,75 → 94.75) before parsing
    const normAmounts = norm.replace(/(\d{1,3}),(\d{2})\b/g, '$1.$2')
    
    let kwAmt = null;
    const primaryPats = [
      /\b(?:receipt\s*total|grand\s*total|net\s*total|total\s*amount|total|sum|paid|charged)[:\s]*\$?\s*([\d,]+\.\d{2})\b/i,
      /\b(?:receipt\s*total|grand\s*total|net\s*total|total\s*amount|total|sum|paid|charged)[:\s]*\$?\s*([\d,]+\.?\d*)/i,
      /\b(?:amount|amt)[:\s]*\$?\s*([\d,]+\.\d{2})\b/i,
      /\b(?:amount|amt)[:\s]*\$?\s*([\d,]+\.?\d*)/i,
      /\b(?:gross|subtotal)[:\s]*\$?\s*([\d,]+\.\d{2})\b/i,
      /\b(?:gross|subtotal)[:\s]*\$?\s*([\d,]+\.?\d*)/i
    ]
    for (const pat of primaryPats) {
      const match = normAmounts.match(pat)
      if (match) {
        kwAmt = match
        break
      }
    }

    const bareAmt = normAmounts.match(/\$?\s*([\d,]+\.\d{2})\b/)
    const anyAmt = normAmounts.match(/\$?\s*([\d,]+\.?\d*)/)
    const amount = kwAmt
      ? parseFloat(kwAmt[1].replace(/,/g, ''))
      : bareAmt
        ? parseFloat(bareAmt[1].replace(/,/g, ''))
        : anyAmt ? parseFloat(anyAmt[1].replace(/,/g, '')) : 0

    let merchant: string | null = null

    // 1. Explicit merchant prefix patterns
    const explicitMerchantPats = [
      /\b(?:company\s*name|merchant\s*name|store\s*name|seller\s*name)[:\s]+([A-Za-z0-9\t &.'-]+)/i,
      /\b(?:company|merchant|store|seller|vendor)[:\s]+([A-Za-z0-9\t &.'-]+)/i
    ]

    for (const pat of explicitMerchantPats) {
      const match = text.match(pat)
      if (match) {
        const candidate = match[1].trim()
        if (candidate && !/^(name|address|phone|email|website|date|zip)$/i.test(candidate)) {
          merchant = candidate
          break
        }
      }
    }

    // 2. Prepositional matching in natural language
    if (!merchant) {
      const prep = text.match(/(?:at|from|paid\s+to|purchased\s+(?:from|at))[:\s]+([A-Za-z0-9\t &.'-]+)/i)
      if (prep) {
        const candidate = prep[1].trim()
        const endWords = candidate.split(/\s+/)
        let cleanedCandidate = ''
        for (const w of endWords) {
          if (/^(on|for|total|amount|\$|\d)/i.test(w)) break
          cleanedCandidate += (cleanedCandidate ? ' ' : '') + w
        }
        if (cleanedCandidate) merchant = cleanedCandidate
      }
    }

    // 3. Known merchant lists (prioritized)
    if (!merchant) {
      const knownMerchants: [RegExp, string][] = [
        [/walmart/i, 'Walmart'], [/amazon/i, 'Amazon'], [/target/i, 'Target'],
        [/costco/i, 'Costco'], [/whole\s*foods/i, 'Whole Foods'], [/starbucks/i, 'Starbucks'],
        [/netflix/i, 'Netflix'], [/spotify/i, 'Spotify'], [/uber\s*eats/i, 'UberEats'],
        [/uber/i, 'Uber'], [/lyft/i, 'Lyft'], [/doordash/i, 'DoorDash'],
        [/mcdonalds|mcdonald's/i, "McDonald's"], [/shell/i, 'Shell'],
        [/exxon/i, 'ExxonMobil'], [/chevron/i, 'Chevron'], [/hilton/i, 'Hilton'],
        [/marriott/i, 'Marriott'], [/delta/i, 'Delta Airlines'],
        [/american\s*airlines/i, 'American Airlines'], [/best\s*buy/i, 'Best Buy'],
        [/home\s*depot/i, 'Home Depot'], [/cheesecake\s*factory/i, 'The Cheesecake Factory'],
        [/east\s*repair/i, 'East Repair Inc.'],
      ]
      for (const [pat, name] of knownMerchants) {
        if (pat.test(norm)) { merchant = name; break }
      }
    }

    // Helper to check if a word is generic
    const isGenericWord = (w: string) => {
      return /^(company|order|information|billing|shipping|items|pricing|invoice|receipt|details|summary|tax|total|date|page|cash|change|service|product|store|merchant|unknown|footer)$/i.test(w)
    }

    // 4. Fallback: Parse line-by-line, skipping generic headers, metadata, prices
    if (!merchant) {
      const rawLines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0)
      const cleanLines = rawLines.filter(line => {
        if (!/[A-Za-z]/.test(line)) return false
        if (/^[#=\-*+._\s]+$/.test(line)) return false
        if (/\$\s*\d|\d+\.\d{2}/.test(line)) return false
        if (/^\d+\s*x\b/i.test(line)) return false
        if (/^(invoice|receipt|bill|summary|items|pricing|details|information|shipping|billing|statement|payment|terms|conditions|thank\s*you|footer)$/i.test(line)) return false
        if (/^(company\s*&\s*order\s*information|items\s*&\s*pricing|billing\s*&\s*shipping|details\s*from.*)$/i.test(line)) return false
        if (/\b(?:street|lane|road|avenue|ave|st|ln|zip|road|highway|box)\b/i.test(line)) return false
        if (/\b(?:new\s*york|cambridge|london|paris|berlin)\b/i.test(line)) return false
        return true
      })

      if (cleanLines.length > 0) {
        const candidate = cleanLines[0].replace(/^[#=\-*+._\s]+|[#=\-*+._\s]+$/g, '').trim()
        const wordsInCandidate = candidate.split(/\s+/)
        const allGeneric = wordsInCandidate.every(w => isGenericWord(w))
        if (wordsInCandidate.length <= 5 && candidate.length <= 40 && !allGeneric) {
          merchant = candidate
        }
      }
    }

    // 5. Final fallback to first non-generic words
    if (!merchant) {
      const words = norm.split(/[\s,]+/).filter(w => w.length > 2 && /^[A-Za-z]/.test(w))
      let candidate = ''
      let count = 0
      for (const w of words) {
        if (!isGenericWord(w)) {
          candidate += (candidate ? ' ' : '') + w
          count++
          if (count >= 2) break
        }
      }
      merchant = candidate.replace(/[.:;,!-]+$/, '').trim() || 'Unknown Merchant'
    }

    const categoryMap: [RegExp, string][] = [
      [/\bgrocery|\bsupermarket|food\s*market|\bwalmart|whole\s*foods|\bcostco|\bkroger|\bsafeway/i, 'Groceries'],
      [/\brestaurant|\bdining|\bcafe|\bstarbucks|\bmcdonalds|\bdoordash|\bubereats|\bgrubhub|\bpizza|\bcheesecake|\bnightclub|\bbar\b|\blounge/i, 'Dining'],
      [/\btransport|\buber\b|\blyft|\bgas\s*station|\bfuel|\bshell\s*gas|\bexxon|\bchevron|\bparking|\btoll|\btransit/i, 'Transportation'],
      [/\bhotel|\bhilton|\bmarriott|\bairbnb|\btravel|\bflight|\bdelta|\bamerican\s*airlines|\bunited/i, 'Travel'],
      [/\bshopping|\bamazon|\btarget|\bmall|\bclothing|\bapparel|\bfashion|\belectronics|\bbest\s*buy|\bhome\s*depot|\bt-shirt|\bjeans?\b|\bshirt|\btrouser|\bdress|\bskirt|\bshoe|\bsneaker|\bboot|\bjacket|\bcoat|\bsuit\b|\bblouse|\bsweater|\bpdk\b|\barticle\b/i, 'Shopping'],
      [/\bentertainment|\bnetflix|\bspotify|\bhulu|\bdisney|\bhbo|\bmovie|\bconcert|\bgames?\b/i, 'Entertainment'],
      [/\bsubscription|\bicloud|\bmicrosoft\s*365|\bdropbox/i, 'Subscriptions'],
      [/\butility|\belectric|\bwater\s*bill|\binternet|\bphone\s*bill|\bverizon|\batt\b|\bt-mobile|\bcomcast/i, 'Utilities'],
      [/\bhealth|\bpharmacy|\bdoctor|\bhospital|\bcvs|\bwalgreens|\bmedical|\bdental/i, 'Health'],
      [/\bsalary|\bincome|\bpayroll|\bdeposit|\bpayment\s*received|\brefund/i, 'Income'],
    ]
    let category = 'Other'
    for (const [pat, cat] of categoryMap) {
      if (pat.test(norm)) { category = cat; break }
    }

    const isoMatch = norm.match(/\d{4}-\d{2}-\d{2}/)
    const longMatch = norm.match(/(?:january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2},?\s*\d{4}/i)
    let date = new Date().toISOString().split('T')[0]
    if (isoMatch) {
      date = isoMatch[0]
    } else if (longMatch) {
      const parsed = new Date(longMatch[0])
      if (!isNaN(parsed.getTime())) date = parsed.toISOString().split('T')[0]
    }

    const items: { name: string; price: number }[] = []
    const itemRe = /([A-Za-z][A-Za-z\s.&'-]{1,40}?)\s+\$?\s*([\d,]+\.?\d*)/g
    const usedPrices = new Set<number>()
    let m
    while ((m = itemRe.exec(norm)) !== null) {
      const name = m[1].trim()
      const price = parseFloat(m[2].replace(/,/g, ''))
      const looksLikePrice = price % 1 !== 0 || m[0].includes('$')
      if (name.length > 1 && price > 0 && price <= amount * 5 && !usedPrices.has(price) && looksLikePrice) {
        usedPrices.add(price)
        items.push({ name, price })
      }
    }
    if (items.length > 0 && Math.abs(items.reduce((s, i) => s + i.price, 0) - amount) < 0.01) {
      items.pop()
    }
    return { merchant: merchant!, amount, date, category, items: items.length > 0 ? items : [{ name: merchant!, price: amount }] }
  }

  public fallbackAssessRisk(jsonText: string): { status: 'APPROVED' | 'RISK_FLAGGED'; justification: string } {
    try {
      const { merchant, amount, category } = JSON.parse(jsonText)
      const reasons: string[] = []
      if (amount > 500) reasons.push(`Transaction amount $${amount.toFixed(2)} exceeds the $500 single-transaction budget threshold`)
      if (amount > 1000) reasons.push(`High-value transaction above $1,000 requires manual review per local policy`)
      if (category === 'Entertainment' && amount > 200) reasons.push(`Entertainment spending of $${amount.toFixed(2)} exceeds the $200 soft cap`)
      if (category === 'Dining' && amount > 150) reasons.push(`Single dining expense of $${amount.toFixed(2)} exceeds the $150 recommended limit`)
      if (merchant?.toLowerCase() === 'unknown merchant') reasons.push('Unrecognized merchant — unable to verify vendor reputation')
      if (reasons.length > 0) return { status: 'RISK_FLAGGED', justification: reasons[0] }
      return { status: 'APPROVED', justification: `Transaction of $${amount.toFixed(2)} at ${merchant} (${category}) is within all local policy limits.` }
    } catch {
      return { status: 'RISK_FLAGGED', justification: 'Failed to parse transaction data for risk assessment.' }
    }
  }

  public fallbackGenerateAdvice(jsonText: string): string {
    try {
      const { merchant, amount, category, status } = JSON.parse(jsonText)
      if (category === 'Dining') return `You spent $${amount.toFixed(2)} at ${merchant}. Consider setting a weekly dining budget of $75 and using meal prep to reduce restaurant spending by up to 40%.`
      if (category === 'Entertainment') return `$${amount.toFixed(2)} on entertainment — rotate subscriptions monthly instead of holding all active simultaneously to save ~$30-50/month.`
      if (category === 'Shopping') return `Shopping purchase of $${amount.toFixed(2)} at ${merchant}. Apply the 48-hour rule: wait 2 days before any non-essential purchase over $50 to reduce impulse spending.`
      if (category === 'Transportation') return `Transportation cost of $${amount.toFixed(2)}. Compare monthly transit pass vs. pay-per-ride to optimize commute costs.`
      if (category === 'Groceries') return `Groceries totaling $${amount.toFixed(2)}. A weekly meal plan and shopping list can reduce grocery bills by 20-30% on average.`
      if (category === 'Travel') return `Travel expense of $${amount.toFixed(2)}. Book flights on Tuesday afternoons and use incognito mode to avoid dynamic price inflation.`
      if (category === 'Subscriptions') return `$${amount.toFixed(2)} on subscriptions. Audit all active subscriptions quarterly — the average household wastes $45/month on unused services.`
      if (category === 'Utilities') return `Utility payment of $${amount.toFixed(2)}. Switching to LED bulbs and smart power strips can reduce electricity bills by 10-15% annually.`
      if (status === 'RISK_FLAGGED') return `Flagged transaction at ${merchant}. Set up a spending alert at $300 to catch overages before they reach the $500 policy limit.`
      return `Approved $${amount.toFixed(2)} at ${merchant}. Consider rounding up each transaction to the nearest $10 and auto-transferring the difference to savings.`
    } catch {
      return 'Track all expenses for 30 days to identify one small recurring cost you can eliminate — small leaks sink big ships.'
    }
  }
}

// ── Agent System Prompts (from spec) ──────────────────────────────────────────

const CATEGORIZER_PROMPT = `You are the VaultFlow Categorizer. Read the raw text of the parsed receipt. Extract the Merchant Name, Date (YYYY-MM-DD format), Total Amount, and core category. Return raw data formatted strictly as minified JSON matching this schema: {"merchant": string, "amount": number, "date": string, "category": string}. Do not include markdown codeblocks or wrap in backticks.`

const riskAssessorPrompt = (transactionJson: string) =>
  `You are the VaultFlow Risk Assessor. Evaluate the incoming transaction data: ${transactionJson}. Contrast the total amount against our local hard threshold limit of $500 per single transaction. Explicitly return a single block formatted as [STATUS: APPROVED] or [STATUS: RISK_FLAGGED] followed by exactly one sentence justifying your risk metric.`

const budgetAnalystPrompt = (transactionJson: string, riskStatus: string) =>
  `You are the VaultFlow Senior Financial Analyst. Review this transaction: ${transactionJson} and its risk status: ${riskStatus}. Generate exactly one hyper-specific, actionable tip for optimizing personal spending based on this expense.`

// ── Parsing helpers ────────────────────────────────────────────────────────────

export function extractDataSection(text: string): string {
  const parts = text.split('[DATA]:')
  return parts.length > 1 ? parts[1].trim() : text.trim()
}

function parseRiskOutput(text: string): { status: 'APPROVED' | 'RISK_FLAGGED'; justification: string } {
  const data = extractDataSection(text)
  const match = data.match(/\[STATUS:\s*(APPROVED|RISK_FLAGGED)\]\s*([^\n\r]*)/)
  if (match) return { status: match[1] as 'APPROVED' | 'RISK_FLAGGED', justification: match[2].trim() }
  try {
    const parsed = JSON.parse(data)
    if (parsed.risk_status) return { status: parsed.risk_status, justification: parsed.justification || '' }
  } catch {}
  return { status: 'APPROVED', justification: data }
}

// ── Main Pipeline ──────────────────────────────────────────────────────────────

export async function runAgentPipeline(
  rawText: string,
  onLog: (log: AgentLog) => void
): Promise<{
  categorization: { merchant: string; amount: number; date: string; category: string; items: { name: string; price: number }[] }
  riskAssessment: { status: 'APPROVED' | 'RISK_FLAGGED'; justification: string }
  budgetAdvice: string
}> {
  const engine = QvacEngine.getInstance()

  // 1. Categorizer
  const catLog: AgentLog = { agent: 'Categorizer', status: 'running', input: rawText, startedAt: Date.now() }
  onLog({ ...catLog })
  const catResult = await engine.runInference(CATEGORIZER_PROMPT, rawText)
  const catDataText = extractDataSection(catResult.text)
  let categorization: ReturnType<QvacEngine['fallbackCategorize']>
  try {
    const parsed = JSON.parse(catDataText)
    categorization = { items: [{ name: parsed.merchant, price: parsed.amount }], ...parsed }
  } catch {
    categorization = engine.fallbackCategorize(rawText)
  }
  catLog.status = 'complete'; catLog.output = catResult.text; catLog.completedAt = Date.now()
  onLog({ ...catLog })

  // 2. Risk Assessor
  const catJson = JSON.stringify(categorization)
  const riskLog: AgentLog = { agent: 'Risk Assessor', status: 'running', input: catJson, startedAt: Date.now() }
  onLog({ ...riskLog })
  const riskResult = await engine.runInference(riskAssessorPrompt(catJson), catJson)
  const riskAssessment = parseRiskOutput(riskResult.text)
  riskLog.status = 'complete'; riskLog.output = riskResult.text; riskLog.completedAt = Date.now()
  onLog({ ...riskLog })

  // 3. Budget Analyst
  const combinedJson = JSON.stringify({ ...categorization, status: riskAssessment.status })
  const budgetLog: AgentLog = { agent: 'Budget Analyst', status: 'running', input: combinedJson, startedAt: Date.now() }
  onLog({ ...budgetLog })
  const budgetResult = await engine.runInference(budgetAnalystPrompt(catJson, `[STATUS: ${riskAssessment.status}]`), combinedJson)
  const budgetAdvice = extractDataSection(budgetResult.text).replace(/^["']|["']$/g, '')
  budgetLog.status = 'complete'; budgetLog.output = budgetResult.text; budgetLog.completedAt = Date.now()
  onLog({ ...budgetLog })

  return { categorization, riskAssessment, budgetAdvice }
}
