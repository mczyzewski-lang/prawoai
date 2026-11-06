// Prawo.ai – serwer API (bez zależności, Node 20.19+).
// • POST /api/analyze – ocena umowy przez model OpenAI (klucz tylko po stronie serwera)
// • GET  /api/status  – czy analiza AI jest skonfigurowana
// • w trybie produkcyjnym serwuje też zbudowaną aplikację z dist/
import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { extname, join, normalize, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
if (existsSync(join(ROOT, '.env'))) process.loadEnvFile(join(ROOT, '.env'))

const PORT = Number(process.env.API_PORT || process.env.PORT || 8787)
const API_KEY = process.env.OPENAI_API_KEY?.trim() || ''
const MODEL = process.env.OPENAI_MODEL?.trim() || 'gpt-5.5'
const BASE_URL = (process.env.OPENAI_BASE_URL?.trim() || 'https://api.openai.com/v1').replace(/\/$/, '')
const MAX_CHARS = 120_000
const TIMEOUT_MS = Number(process.env.OPENAI_TIMEOUT_MS || 180_000)
const DIST = join(ROOT, 'dist')

const SYSTEM_PROMPT = `Jesteś doświadczonym asystentem prawnym, który ocenia umowy zawierane w Polsce.
Twoim zadaniem jest wstępna ocena umowy i propozycje zmian. Zasady:
- Oceniasz NEUTRALNIE – wskazujesz zapisy niejasne lub nierówno rozkładające ryzyko, niezależnie od tego, której strony dotyczą. Nie działasz na korzyść żadnej strony.
- Opierasz się wyłącznie na treści dokumentu. Nie wymyślaj faktów, kwot ani dat.
- NIE powołuj się na numery artykułów, nazwy ustaw, orzeczenia ani inne źródła. Jeśli coś może wymagać szczególnej formy lub regulacji, napisz ogólnie, że warto to sprawdzić z prawnikiem.
- Pisz po polsku, prostym, zrozumiałym językiem.
- Podaj maksymalnie 12 uwag, od najpoważniejszej. Pomijaj drobiazgi redakcyjne.
- Dla uwagi dotyczącej istniejącego zapisu: clauseIndex = numer zapisu z nawiasu kwadratowego; excerpt = DOSŁOWNY cytat (fragment, najlepiej jedno zdanie) skopiowany znak w znak z tego zapisu; suggestion = nowe brzmienie, które zastąpi dokładnie ten cytat (pełne zdanie/zdania gotowe do wstawienia, wyważone dla obu stron).
- Dla brakującego postanowienia: clauseIndex = -1, category = "brak", excerpt = krótki tytuł nowego zapisu, suggestion = pełna treść nowego zapisu.
- severity: "high" – realne ryzyko istotnej szkody lub poważna nierównowaga; "medium" – warto zmienić; "low" – wskazówka lub doprecyzowanie.
- explanation: 1–3 zdania wyjaśniające, co zapis oznacza w praktyce i dlaczego warto go zmienić.
- obligations: najważniejsze obowiązki każdej ze stron (krótkie punkty). dates i payments: terminy i kwoty wynikające z umowy.
- summary: 2–4 zdania podsumowania umowy i ogólnej oceny.`

const str = { type: 'string' }
const labelValue = { type: 'object', properties: { label: str, value: str }, required: ['label', 'value'], additionalProperties: false }
const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['summary', 'contractType', 'parties', 'obligations', 'dates', 'payments', 'findings'],
  properties: {
    summary: str,
    contractType: str,
    parties: { type: 'array', items: { type: 'object', properties: { name: str, role: str }, required: ['name', 'role'], additionalProperties: false } },
    obligations: { type: 'array', items: { type: 'object', properties: { party: str, items: { type: 'array', items: str } }, required: ['party', 'items'], additionalProperties: false } },
    dates: { type: 'array', items: labelValue },
    payments: { type: 'array', items: labelValue },
    findings: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['clauseIndex', 'severity', 'category', 'title', 'explanation', 'excerpt', 'suggestion'],
        properties: {
          clauseIndex: { type: 'integer' },
          severity: { type: 'string', enum: ['high', 'medium', 'low'] },
          category: { type: 'string', enum: ['ryzyko', 'niejasność', 'brak', 'termin', 'płatność'] },
          title: str,
          explanation: str,
          excerpt: str,
          suggestion: str,
        },
      },
    },
  },
}

function send(res, status, body, headers = {}) {
  const data = typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body)
  res.writeHead(status, { 'Content-Type': typeof body === 'object' && !Buffer.isBuffer(body) ? 'application/json; charset=utf-8' : 'text/plain; charset=utf-8', ...headers })
  res.end(data)
}

async function readJson(req, limit = 1_000_000) {
  let size = 0
  const chunks = []
  for await (const chunk of req) {
    size += chunk.length
    if (size > limit) throw Object.assign(new Error('too_large'), { status: 413 })
    chunks.push(chunk)
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'))
  } catch {
    throw Object.assign(new Error('bad_json'), { status: 400 })
  }
}

function networkError(e) {
  const timeout = e?.name === 'TimeoutError'
  console.error('[openai] połączenie:', e?.message)
  return Object.assign(new Error(timeout ? 'Analiza trwała zbyt długo.' : 'Brak połączenia z usługą AI.'), { status: 504, code: timeout ? 'timeout' : 'network' })
}

function upstreamError(status, message) {
  console.error('[openai]', status, message)
  const code = status === 401 || status === 403 ? 'auth' : status === 429 ? 'rate_limit' : 'upstream'
  const msg = code === 'auth' ? 'Klucz API OpenAI jest nieprawidłowy lub nie ma dostępu do modelu.' : code === 'rate_limit' ? 'Przekroczono limit zapytań do usługi AI. Spróbuj za chwilę.' : 'Usługa AI zwróciła błąd.'
  return Object.assign(new Error(msg), { status: 502, code })
}

async function analyze(body) {
  const clauses = Array.isArray(body?.clauses) ? body.clauses : []
  if (!clauses.length) throw Object.assign(new Error('Brak treści umowy do analizy.'), { status: 400, code: 'empty' })
  const doc = clauses.map((c, i) => `[${i}] ${String(c.title ?? '').slice(0, 200)}\n${String(c.text ?? '')}`).join('\n\n')
  if (doc.length > MAX_CHARS) throw Object.assign(new Error('Umowa jest za długa do analizy w jednym kroku.'), { status: 413, code: 'too_long' })

  const payload = {
    model: MODEL,
    input: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: `Oceń poniższą umowę. Zapisy są ponumerowane w nawiasach kwadratowych.\n\n${doc}` },
    ],
    text: { format: { type: 'json_schema', name: 'contract_analysis', strict: true, schema: SCHEMA } },
  }
  if (/^(gpt-5|o\d)/.test(MODEL)) payload.reasoning = { effort: process.env.OPENAI_REASONING_EFFORT || 'medium' }

  // Strumieniowanie (SSE): dane płyną na bieżąco, więc pośrednie proxy nie zrywają długich analiz.
  payload.stream = true
  let r
  try {
    r = await fetch(`${BASE_URL}/responses`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${API_KEY}`, 'Content-Type': 'application/json', Accept: 'text/event-stream' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
  } catch (e) {
    throw networkError(e)
  }
  if (!r.ok) {
    const data = await r.json().catch(() => ({}))
    throw upstreamError(r.status, data?.error?.message)
  }

  let final = null
  let text = ''
  let buffer = ''
  const decoder = new TextDecoder()
  try {
    for await (const chunk of r.body) {
      buffer += decoder.decode(chunk, { stream: true })
      let sep
      while ((sep = buffer.indexOf('\n\n')) !== -1) {
        const block = buffer.slice(0, sep)
        buffer = buffer.slice(sep + 2)
        const dataLine = block.split('\n').filter((l) => l.startsWith('data:')).map((l) => l.slice(5).trim()).join('')
        if (!dataLine || dataLine === '[DONE]') continue
        const ev = JSON.parse(dataLine)
        if (ev.type === 'response.output_text.delta') text += ev.delta
        else if (ev.type === 'response.refusal.delta' || ev.type === 'response.refusal.done') throw Object.assign(new Error('Model odmówił analizy tego dokumentu.'), { status: 422, code: 'refusal' })
        else if (ev.type === 'response.completed') final = ev.response
        else if (ev.type === 'response.incomplete') throw Object.assign(new Error('Analiza została przerwana (zbyt długi dokument lub limit odpowiedzi).'), { status: 502, code: 'incomplete' })
        else if (ev.type === 'response.failed' || ev.type === 'error') {
          console.error('[openai]', JSON.stringify(ev.response?.error ?? ev.error ?? ev).slice(0, 500))
          throw Object.assign(new Error('Usługa AI zwróciła błąd.'), { status: 502, code: 'upstream' })
        }
      }
    }
  } catch (e) {
    if (e.status) throw e
    throw networkError(e)
  }
  if (!final && !text) throw Object.assign(new Error('Usługa AI nie zwróciła wyniku.'), { status: 502, code: 'empty_output' })
  const data = final ?? {}
  if (!text) text = data.output?.flatMap((o) => o.content ?? []).find((c) => c.type === 'output_text')?.text ?? ''
  return { model: data.model ?? MODEL, result: JSON.parse(text) }
}

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.woff': 'font/woff', '.json': 'application/json', '.ico': 'image/x-icon' }

async function serveStatic(req, res) {
  if (!existsSync(DIST)) return send(res, 404, 'Brak zbudowanej aplikacji – uruchom „npm run build” albo „npm run dev”.')
  const url = new URL(req.url, 'http://x')
  const target = normalize(join(DIST, decodeURIComponent(url.pathname)))
  if (!target.startsWith(DIST)) return send(res, 403, 'Forbidden')
  let file = target
  try {
    if (!(await stat(file)).isFile()) file = join(DIST, 'index.html')
  } catch {
    file = join(DIST, 'index.html') // SPA fallback
  }
  const ext = extname(file)
  res.writeHead(200, { 'Content-Type': MIME[ext] ?? 'application/octet-stream', 'Cache-Control': file.includes('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache' })
  res.end(await readFile(file))
}

createServer(async (req, res) => {
  try {
    if (req.url === '/api/status' && req.method === 'GET') return send(res, 200, { ai: !!API_KEY, provider: 'openai', model: API_KEY ? MODEL : null })
    if (req.url === '/api/analyze' && req.method === 'POST') {
      if (!API_KEY) return send(res, 503, { error: 'Analiza AI nie jest skonfigurowana.', code: 'not_configured' })
      const body = await readJson(req)
      const started = Date.now()
      const out = await analyze(body)
      console.log(`[analyze] ${out.model} · ${body.clauses.length} zapisów · ${out.result.findings?.length ?? 0} uwag · ${((Date.now() - started) / 1000).toFixed(1)} s`)
      return send(res, 200, out)
    }
    if (req.url?.startsWith('/api/')) return send(res, 404, { error: 'Nie znaleziono', code: 'not_found' })
    return serveStatic(req, res)
  } catch (e) {
    if (!e.status) console.error(e)
    return send(res, e.status ?? 500, { error: e.status ? e.message : 'Wewnętrzny błąd serwera.', code: e.code ?? 'internal' })
  }
}).listen(PORT, () => {
  console.log(`Prawo.ai API: http://localhost:${PORT}  (analiza AI: ${API_KEY ? `włączona, model ${MODEL}` : 'wyłączona – brak OPENAI_API_KEY'})`)
})
