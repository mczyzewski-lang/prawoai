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
// Prosty limit analiz na adres IP (chroni klucz OpenAI na publicznym serwerze).
const LIMIT_PER_HOUR = Number(process.env.ANALYZE_LIMIT_PER_HOUR || 10)
const hits = new Map()
function rateLimited(req) {
  const ip = String(req.headers['x-forwarded-for'] ?? '').split(',')[0].trim() || req.socket.remoteAddress || 'unknown'
  const now = Date.now()
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < 3_600_000)
  if (recent.length >= LIMIT_PER_HOUR) return true
  recent.push(now)
  hits.set(ip, recent)
  if (hits.size > 5000) hits.clear()
  return false
}

const SYSTEM_PROMPT = `Jesteś doświadczonym doradcą, który łączy wiedzę prawnika i praktyka biznesu. Oceniasz umowy zawierane w Polsce.
Twoim zadaniem jest ocena umowy Z PERSPEKTYWY WSKAZANEJ STRONY (użytkownika) i propozycje zmian, które realnie poprawią jej sytuację, a jednocześnie mają szansę zostać zaakceptowane przez drugą stronę.

Co sprawdzasz – NIE tylko kwestie prawne:
- FINANSOWE: struktura i podział płatności (np. 100% z góry lub dopiero na końcu, brak zaliczki lub transz, brak powiązania płatności z etapami/odbiorami), terminy płatności, odsetki i kary, ukryte i dodatkowe koszty, budżety (np. reklamowe) – kto płaci i do jakiej kwoty, waloryzacja i zmiana ceny, kaucje i zabezpieczenia, netto/brutto, waluta.
- BIZNESOWE: zakres i jego doprecyzowanie, ryzyko rozszerzania zakresu bez dopłaty, wyłączność, zakaz konkurencji, uzależnienie od drugiej strony, długość związania umową, automatyczne przedłużenie, łatwość wyjścia z umowy, prawa do rezultatów, dostęp do kont i danych po zakończeniu.
- OPERACYJNE: procedura odbioru i zgłaszania uwag, liczba poprawek, terminy realizacji, raportowanie, SLA, osoby kontaktowe, przekazanie materiałów.
- PRAWNE: odpowiedzialność i jej limity, jednostronne uprawnienia, kary umowne, poufność, dane osobowe, sąd właściwy, forma zmian.
Zwracaj uwagę na asymetrię – czy uprawnienia i sankcje działają tylko w jedną stronę.

Zasady:
- Opierasz się wyłącznie na treści dokumentu. Nie wymyślaj faktów, kwot ani dat.
- NIE powołuj się na numery artykułów, nazwy ustaw, orzeczenia ani inne źródła. Jeśli coś może wymagać szczególnej formy lub regulacji, napisz ogólnie, że warto to sprawdzić z prawnikiem.
- Pisz po polsku, prostym, konkretnym językiem, zwracając się do użytkownika na „Ty”.
- Podaj od 6 do 15 uwag, posortowanych od najistotniejszej.
- priority: "najważniejsze" – tylko sprawy, które realnie wpływają na pieniądze, ryzyko lub możliwość wyjścia z umowy i o które naprawdę warto negocjować (zwykle 3–7 uwag, importance 4–5); "kosmetyka" – doprecyzowania, usprawnienia i sprawy drugorzędne, które dobrze poprawić, ale nie warto o nie toczyć sporu (importance 1–3).
- importance: 1–5 (5 = krytyczne dla użytkownika, 1 = drobiazg).
- aspect: "finansowe" | "biznesowe" | "operacyjne" | "prawne".
- impact: 1–2 zdania „co to oznacza dla Ciebie” – konkretny skutek praktyczny dla użytkownika (np. ile i kiedy może stracić, na co się naraża).
- explanation: 1–3 zdania wyjaśniające, co zapis mówi i na czym polega problem.
- Dla uwagi dotyczącej istniejącego zapisu: clauseIndex = numer zapisu z nawiasu kwadratowego; excerpt = DOSŁOWNY cytat (fragment, najlepiej jedno zdanie lub jego część) skopiowany znak w znak z tego zapisu – dokładnie ten fragment, którego dotyczy uwaga; suggestion = nowe brzmienie, które zastąpi dokładnie ten cytat (gotowe do wstawienia).
- Dla brakującego postanowienia: clauseIndex = -1, category = "brak", excerpt = krótki tytuł nowego zapisu, suggestion = pełna treść nowego zapisu.
- category: "ryzyko" | "niejasność" | "brak" | "termin" | "płatność".
- parties: name = sama nazwa strony (bez adresu); role = określenie użyte w umowie w mianowniku (np. „Klient”, „Agencja”); details = siedziba/adres, NIP/KRS/PESEL i reprezentacja – tylko jeśli są w tekście, inaczej pusty tekst.
- obligations: najważniejsze obowiązki każdej ze stron (krótkie punkty). dates i payments: terminy i kwoty wynikające z umowy.
- summary: 2–4 zdania: czego dotyczy umowa i ogólna ocena z perspektywy użytkownika, z wymienieniem 2–3 najważniejszych spraw do negocjacji.`

const str = { type: 'string' }
const labelValue = { type: 'object', properties: { label: str, value: str }, required: ['label', 'value'], additionalProperties: false }
const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['summary', 'contractType', 'parties', 'obligations', 'dates', 'payments', 'findings'],
  properties: {
    summary: str,
    contractType: str,
    parties: { type: 'array', items: { type: 'object', properties: { name: str, role: str, details: str }, required: ['name', 'role', 'details'], additionalProperties: false } },
    obligations: { type: 'array', items: { type: 'object', properties: { party: str, items: { type: 'array', items: str } }, required: ['party', 'items'], additionalProperties: false } },
    dates: { type: 'array', items: labelValue },
    payments: { type: 'array', items: labelValue },
    findings: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['clauseIndex', 'priority', 'importance', 'aspect', 'category', 'title', 'explanation', 'impact', 'excerpt', 'suggestion'],
        properties: {
          clauseIndex: { type: 'integer' },
          priority: { type: 'string', enum: ['najważniejsze', 'kosmetyka'] },
          importance: { type: 'integer', enum: [1, 2, 3, 4, 5] },
          aspect: { type: 'string', enum: ['finansowe', 'biznesowe', 'operacyjne', 'prawne'] },
          category: { type: 'string', enum: ['ryzyko', 'niejasność', 'brak', 'termin', 'płatność'] },
          title: str,
          explanation: str,
          impact: str,
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

function perspectiveText(p) {
  const clean = (v) => String(v ?? '').replace(/[\r\n]+/g, ' ').slice(0, 120).trim()
  if (!p?.role) return 'Użytkownik nie wskazał swojej strony – oceniaj neutralnie, wskazując ryzyka dla obu stron.'
  return `Użytkownik jest stroną: ${clean(p.role)}${p.name ? ` (${clean(p.name)})` : ''}. Druga strona: ${clean(p.otherRole) || 'kontrahent'}. Oceniaj z perspektywy użytkownika.`
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
      { role: 'user', content: `${perspectiveText(body?.perspective)}\n\nOceń poniższą umowę. Zapisy są ponumerowane w nawiasach kwadratowych.\n\n${doc}` },
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
      if (rateLimited(req)) return send(res, 429, { error: `Wykorzystano limit ${LIMIT_PER_HOUR} analiz na godzinę. Spróbuj później lub użyj analizy podstawowej.`, code: 'rate_limited' })
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
