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
// Klucz bywa wklejany w cudzysłowie (KEY="sk-…"), razem z nazwą zmiennej albo pod nazwą
// z literówką/spacją – szukamy go odpornie. Do /api/status trafiają tylko NAZWY zmiennych.
const OPENAI_ENV_NAMES = Object.keys(process.env).filter((k) => /openai/i.test(k))
function cleanKey(v) {
  let s = String(v ?? '').trim()
  s = s.replace(/^(export\s+)?OPENAI_API_KEY\s*=\s*/i, '')
  return s.trim().replace(/^["'`]+|["'`]+$/g, '').trim()
}
const KEY_ENV =
  ['OPENAI_API_KEY', 'OPENAI_KEY', 'OPENAI_APIKEY', 'OPENAI_TOKEN'].find((k) => cleanKey(process.env[k])) ??
  OPENAI_ENV_NAMES.find((k) => /^openai_?(api_?)?key$/i.test(k.trim()) && cleanKey(process.env[k])) ??
  null
const API_KEY = KEY_ENV ? cleanKey(process.env[KEY_ENV]) : ''
const MODEL = process.env.OPENAI_MODEL?.trim() || 'gpt-5.5'
const BASE_URL = (process.env.OPENAI_BASE_URL?.trim() || 'https://api.openai.com/v1').replace(/\/$/, '')
const MAX_CHARS = 120_000
const TIMEOUT_MS = Number(process.env.OPENAI_TIMEOUT_MS || 300_000)
const DIST = join(ROOT, 'dist')
// Wersja działającego serwera – do sprawdzenia, czy wdrożenie jest aktualne (GET /api/status).
const APP_VERSION = JSON.parse(await readFile(join(ROOT, 'package.json'), 'utf8')).version
const APP_COMMIT = (process.env.RAILWAY_GIT_COMMIT_SHA || process.env.SOURCE_COMMIT || '').slice(0, 7) || null
const STARTED_AT = new Date().toISOString()
// Prosty limit analiz na adres IP (chroni klucz OpenAI na publicznym serwerze).
const LIMIT_PER_HOUR = Number(process.env.ANALYZE_LIMIT_PER_HOUR || 10)
const INTAKE_LIMIT_PER_HOUR = Number(process.env.INTAKE_LIMIT_PER_HOUR || 80)
function makeLimiter(limit) {
  const hits = new Map()
  return (req) => {
    const ip = String(req.headers['x-forwarded-for'] ?? '').split(',')[0].trim() || req.socket.remoteAddress || 'unknown'
    const now = Date.now()
    const recent = (hits.get(ip) ?? []).filter((t) => now - t < 3_600_000)
    if (recent.length >= limit) return true
    recent.push(now)
    hits.set(ip, recent)
    if (hits.size > 5000) hits.clear()
    return false
  }
}
const rateLimited = makeLimiter(LIMIT_PER_HOUR)
const intakeLimited = makeLimiter(INTAKE_LIMIT_PER_HOUR)
const INTAKE_MODEL = process.env.OPENAI_INTAKE_MODEL?.trim() || MODEL

const SYSTEM_PROMPT = `Jesteś doświadczonym doradcą, który łączy wiedzę prawnika i praktyka biznesu. Oceniasz umowy zawierane w Polsce.
Twoim zadaniem jest ocena umowy Z PERSPEKTYWY WSKAZANEJ STRONY (użytkownika) – jak dobry doradca, który pilnuje jej praw i interesu – oraz propozycje zmian, które realnie poprawią jej sytuację, a jednocześnie mają szansę zostać zaakceptowane przez drugą stronę.

Bądź KONKRETNY jak ekspert, który przeczytał każde słowo:
- Przeliczaj kwoty i procenty (np. „zaliczka 60% to 26 592 zł płatne przed montażem”), wskaż netto/brutto i VAT, jeśli to niejasne.
- Wyłapuj sprzeczności wewnątrz dokumentu (np. „5 lat gwarancji”, a dalej 3 lata na urządzenie i 2 na instalację), błędy w datach, odwołania do załączników, których nie ma w tekście, niezdefiniowane pojęcia.
- Sprawdzaj, czy płatności są powiązane z etapami i odbiorem, czy są kryteria i termin odbioru, czas reakcji serwisu, konsekwencje opóźnień, prawo odstąpienia i zwrot zaliczki, kto ponosi ryzyko i koszty dodatkowych prac.
- Jeśli użytkownik może być konsumentem (osoba prywatna wobec firmy), uwzględnij typowe uprawnienia konsumenta i zaznacz, że warto je sprawdzić – bez cytowania przepisów.
- Korzystaj z ogólnej wiedzy branżowej (np. dobór urządzeń, standardowe gwarancje producentów, typowe harmonogramy płatności w budowlance czy IT), ale formułuj ją ostrożnie („warto potwierdzić…”), bez podawania źródeł.
- Uwzględnij kontekst podany przez użytkownika (np. wcześniejsze ustalenia, oferta, na czym mu zależy) i wskaż rozbieżności między umową a tym kontekstem.

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
- Liczba uwag ma wynikać z umowy, a nie z normy: dobra, wyważona umowa może mieć 2–3 uwagi, słaba – kilkanaście. Nie dopisuj uwag na siłę i nie pomijaj niczego, co realnie uderza w pieniądze, ryzyko lub wygodę użytkownika. Sortuj od najistotniejszej.
- ZAWSZE przeanalizuj harmonogram płatności z perspektywy użytkownika (uwagę zgłoś tylko, jeśli jest powód): ile procent i ile złotych płaci przed wykonaniem/odbiorem (np. „60% = 26 592 zł przed montażem”), czy płatności są powiązane z etapami (dostawa, uruchomienie, odbiór), czy płatność końcowa zależy od odbioru bez wad. Jeśli przedpłata jest wysoka lub nie ma transz – zaproponuj konkretny podział (np. 30% przy podpisaniu / 40% po dostawie / 30% po odbiorze) w suggestion.
- Sprawdź też (jeśli dotyczy danej umowy): gwarancję i rękojmię (rozdzielenie gwarancji producenta i wykonawcy, okresy, czas reakcji serwisu), odbiór (termin, kryteria, protokół, prawo odmowy przy wadach), kompletność zakresu (czy wszystkie prace i materiały są wymienione, czy grożą dopłaty), konsekwencje opóźnień (kary, odstąpienie, zwrot zaliczki), cenę (netto/brutto, VAT, co obejmuje), obowiązki nałożone na użytkownika (np. nadzór, przygotowanie miejsca), aktualność dat i danych.
- Każda uwaga musi zawierać konkretną rekomendację w suggestion (gotowe brzmienie zapisu) – nie ogólnik „warto doprecyzować”.
- priority: "najważniejsze" – TYLKO sprawy kluczowe, o które naprawdę warto walczyć w negocjacjach, bo realnie wpływają na pieniądze, ryzyko lub możliwość wyjścia z umowy (zwykle 2–5 uwag, nigdy wszystkie; importance 4–5). Pozostałe uwagi oznacz jako "kosmetyka" (importance 1–3) – to rzeczy, które dobrze poprawić, ale bez nich umowę da się bezpiecznie podpisać. Kolejność: najpierw najważniejsze od najistotniejszej, potem kosmetyka.
- importance: 1–5 (5 = krytyczne dla użytkownika, 1 = drobiazg).
- aspect: "finansowe" | "biznesowe" | "operacyjne" | "prawne".
- impact: 1–2 zdania „co to oznacza dla Ciebie” – konkretny skutek praktyczny dla użytkownika (np. ile i kiedy może stracić, na co się naraża).
- explanation: 1–3 zdania wyjaśniające, co zapis mówi i na czym polega problem.
- Dla uwagi dotyczącej istniejącego zapisu: clauseIndex = numer zapisu z nawiasu kwadratowego; excerpt = DOSŁOWNY cytat (fragment, najlepiej jedno zdanie lub jego część) skopiowany znak w znak z tego zapisu – dokładnie ten fragment, którego dotyczy uwaga; suggestion = nowe brzmienie, które zastąpi dokładnie ten cytat (gotowe do wstawienia).
- Dla brakującego postanowienia: clauseIndex = -1, insertAfterIndex = numer zapisu, PO którym nowy zapis najlepiej wstawić (zwykle przed postanowieniami końcowymi lub obok zapisu o podobnej tematyce), category = "brak", excerpt = krótki tytuł nowego zapisu, suggestion = pełna treść nowego zapisu. Dla pozostałych uwag insertAfterIndex = -1.
- category: "ryzyko" | "niejasność" | "brak" | "termin" | "płatność".
- parties: dokładnie 2 strony w kolejności z umowy. name = sama nazwa strony lub imię i nazwisko, W MIANOWNIKU (np. „Marek Czyżewski”, nie „Panem Markiem Czyżewskim”), bez adresu; role = określenie z umowy w mianowniku (np. „Zleceniodawca”); kind = osoba lub firma; address = pełny adres w mianowniku (np. „ul. Lubowska 29A, 60-433 Poznań”); idNumber = sam numer NIP (dla firm) lub PESEL (dla osób), bez przedrostka; representative = osoba reprezentująca w mianowniku. Puste pola zostaw jako pusty tekst.
- obligations: najważniejsze obowiązki każdej ze stron (krótkie punkty). dates i payments: terminy i kwoty wynikające z umowy.
- summary: 2–4 zdania: czego dotyczy umowa (strony, przedmiot, kwota) i ogólna ocena z perspektywy użytkownika.
- verdict: jedno–dwa zdania szczerej oceny, np. „Umowa jest poprawna, ale za słabo zabezpiecza Cię jako inwestora – największe problemy to przedpłata, gwarancja i odbiór”.
- priorities: 3 najważniejsze sprawy, o które warto zawalczyć, każda jako krótkie zdanie z konkretem.
- checks: 0–6 spraw do sprawdzenia lub potwierdzenia przed podpisaniem (tylko jeśli naprawdę są potrzebne), które NIE są zmianą konkretnego zapisu (np. „Poproś o obliczenie zapotrzebowania na ciepło”, „Potwierdź status autoryzowanego instalatora”); title + detail (2–4 zdania, konkretnie, z liczbami jeśli je znasz) + source (zawsze pusty tekst).
- Opieraj się na treści umowy, kontekście od użytkownika i ogólnej wiedzy branżowej; nie cytuj przepisów ani orzeczeń.
- negotiationMessage: gotowa, uprzejma i rzeczowa wiadomość od użytkownika do drugiej strony (zwracaj się „Dzień dobry,”), z ponumerowaną listą proponowanych zmian i próśb (najważniejsze najpierw, każda w 1–2 zdaniach, z konkretnymi wartościami), zakończona zdaniem o gotowości do finalizacji. Bez podpisu imieniem.`

const str = { type: 'string' }
const labelValue = { type: 'object', properties: { label: str, value: str }, required: ['label', 'value'], additionalProperties: false }
const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['summary', 'verdict', 'priorities', 'checks', 'negotiationMessage', 'contractType', 'parties', 'obligations', 'dates', 'payments', 'findings'],
  properties: {
    summary: str,
    verdict: str,
    priorities: { type: 'array', items: str },
    checks: { type: 'array', items: { type: 'object', properties: { title: str, detail: str, source: str }, required: ['title', 'detail', 'source'], additionalProperties: false } },
    negotiationMessage: str,
    contractType: str,
    parties: { type: 'array', items: { type: 'object', properties: { name: str, role: str, kind: { type: 'string', enum: ['osoba', 'firma'] }, address: str, idNumber: str, representative: str }, required: ['name', 'role', 'kind', 'address', 'idNumber', 'representative'], additionalProperties: false } },
    obligations: { type: 'array', items: { type: 'object', properties: { party: str, items: { type: 'array', items: str } }, required: ['party', 'items'], additionalProperties: false } },
    dates: { type: 'array', items: labelValue },
    payments: { type: 'array', items: labelValue },
    findings: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['clauseIndex', 'insertAfterIndex', 'priority', 'importance', 'aspect', 'category', 'title', 'explanation', 'impact', 'excerpt', 'suggestion'],
        properties: {
          clauseIndex: { type: 'integer' },
          insertAfterIndex: { type: 'integer' },
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

function personaText(p) {
  const name = String(p?.addressAs ?? '').replace(/[\r\n]+/g, ' ').slice(0, 40).trim()
  const form = p?.form === 'f' ? 'Używaj form żeńskich (np. „otrzymałaś”, „jesteś pewna”).' : p?.form === 'm' ? 'Używaj form męskich (np. „otrzymałeś”, „jesteś pewien”).' : 'Unikaj form rodzajowych (pisz np. „masz”, „otrzymano”).'
  return `Sposób zwracania się: ${name ? `zwracaj się do użytkownika po imieniu, w wołaczu: „${name}” – w pierwszej odpowiedzi i potem od czasu do czasu, nie w każdym zdaniu.` : 'bez imienia, na „Ty”.'} ${form}`
}

function perspectiveText(p) {
  const clean = (v) => String(v ?? '').replace(/[\r\n]+/g, ' ').slice(0, 120).trim()
  if (!p?.role) return 'Użytkownik nie wskazał swojej strony – oceniaj neutralnie, wskazując ryzyka dla obu stron.'
  return `Użytkownik jest stroną: ${clean(p.role)}${p.name ? ` (${clean(p.name)})` : ''}. Druga strona: ${clean(p.otherRole) || 'kontrahent'}. Oceniaj z perspektywy użytkownika i chroń jego interes.`
}

function contextText(ctx) {
  const t = String(ctx ?? '').trim().slice(0, 3000)
  return t ? `\n\nKontekst od użytkownika (wcześniejsze ustalenia, oferta, priorytety):\n${t}` : ''
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
      { role: 'user', content: `${personaText(body?.persona)}\n${perspectiveText(body?.perspective)}${contextText(body?.context)}\n\nOceń poniższą umowę. Zapisy są ponumerowane w nawiasach kwadratowych.\n\n${doc}` },
    ],
    text: { format: { type: 'json_schema', name: 'contract_analysis', strict: true, schema: SCHEMA } },
  }
  // Wyszukiwanie w internecie – domyślnie wyłączone (OPENAI_WEB_SEARCH=1 włącza).
  if (process.env.OPENAI_WEB_SEARCH === '1') payload.tools = [{ type: 'web_search' }]
  return callModel(payload, process.env.OPENAI_REASONING_EFFORT || 'medium')
}

/** Wywołanie OpenAI Responses API ze strumieniowaniem i wynikiem JSON. */
async function callModel(payload, effort) {
  if (/^(gpt-5|o\d)/.test(payload.model)) payload.reasoning = { effort }

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
  return { model: data.model ?? payload.model, result: JSON.parse(text) }
}

// ——— Tworzenie umowy z opisu (rozmowa) ———
const S = { type: 'string' }
const PARTY_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['kind', 'name', 'address', 'idNumber', 'email', 'representative'],
  properties: { kind: { type: 'string', enum: ['osoba', 'firma', ''] }, name: S, address: S, idNumber: S, email: S, representative: S },
}
const INTAKE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['reply', 'templateId', 'title', 'myRole', 'partyA', 'partyB', 'answers', 'ready', 'ownDataInLastMessage', 'quickReplies'],
  properties: {
    reply: S,
    templateId: S,
    title: S,
    myRole: { type: 'string', enum: ['A', 'B', ''] },
    partyA: PARTY_SCHEMA,
    partyB: PARTY_SCHEMA,
    answers: {
      type: 'object',
      additionalProperties: false,
      required: ['scope', 'amount', 'amountBasis', 'paymentDays', 'startDate', 'endDate', 'deposit', 'liability', 'notice', 'ip', 'penalty', 'confidentiality', 'extra'],
      properties: {
        scope: S,
        amount: S,
        amountBasis: { type: 'string', enum: ['ryczałt', 'miesięcznie', 'za godzinę', ''] },
        paymentDays: S,
        startDate: S,
        endDate: S,
        deposit: S,
        liability: { type: 'string', enum: ['Do wysokości wynagrodzenia z umowy', 'Do 3-krotności wynagrodzenia z umowy', 'Na zasadach ogólnych (bez limitu)', ''] },
        notice: { type: 'string', enum: ['7 dni', '14 dni', '1 miesiąc', '3 miesiące', 'Bez możliwości wypowiedzenia (czas określony)', ''] },
        ip: { type: 'string', enum: ['Przeniesienie praw po zapłacie wynagrodzenia', 'Licencja niewyłączna dla zamawiającego', 'Prawa pozostają przy wykonawcy', 'Nie dotyczy', ''] },
        penalty: { type: 'string', enum: ['Brak kar umownych', '0,1% wynagrodzenia za każdy dzień opóźnienia (maks. 10%)', '10% wynagrodzenia za odstąpienie z winy strony', 'Kwotowa kara za naruszenie poufności', ''] },
        confidentiality: { type: 'string', enum: ['tak', 'nie', ''] },
        extra: S,
      },
    },
    ready: { type: 'boolean' },
    ownDataInLastMessage: { type: 'boolean' },
    quickReplies: { type: 'array', items: S },
  },
}

const INTAKE_PROMPT = `Jesteś asystentem Prawo.ai, który w rozmowie zbiera informacje potrzebne do przygotowania PROJEKTU umowy dwustronnej. Piszesz po polsku, krótko, życzliwie, zwracając się na „Ty”.

Zasady:
- Wybierz wzór WYŁĄCZNIE z katalogu (templateId). Jeśli użytkownik chce czegoś, czego nie ma, wybierz najbliższy wzór i powiedz o tym. Dokumentów jednostronnych (np. regulamin sklepu) nie tworzysz – wyjaśnij to.
- Strona A i strona B mają role z katalogu (A = pierwsza rola, B = druga). myRole: którą stroną jest użytkownik. Jeśli nie wynika to jasno z wypowiedzi, zostaw myRole puste i zapytaj. Osoby trzecie wymienione w wiadomości (np. „dla Jana Kowalskiego”, „z Janem Kowalskim”) to zwykle DRUGA strona – nigdy nie wpisuj ich jako strony użytkownika.
- Wyciągaj dane z dowolnego tekstu, także wklejonego w całości (nazwa, adres, NIP/KRS/PESEL, e-mail, osoba reprezentująca). Rozpoznawaj, czy strona to osoba czy firma (sp. z o.o., S.A., JDG z NIP → firma).
- NIGDY nie wymyślaj danych. Nieznane pola zostaw puste. Pole scope pisz zwykłym językiem, z datami słownie (np. „obsługa stoiska na targach w Poznaniu w dniach 12–14 grudnia 2026 r.”), bez kropki na końcu. Kwoty jako liczby bez waluty (np. "4500"). Daty w formacie RRRR-MM-DD (dziś jest {TODAY}; „koniec grudnia” = ostatni dzień grudnia najbliższego roku).
- Jeśli podano „zapisane dane użytkownika”, użyj ich dla strony użytkownika, gdy znasz jego rolę, i nie pytaj o nie ponownie.
- Za każdym razem zwracasz PEŁNY aktualny stan (wszystkie znane dane, także te z wcześniejszych wiadomości), poprawiony o nowe informacje.
- reply: potwierdź w jednym zdaniu, co zrozumiałeś, i zadaj 1–2 najważniejsze brakujące pytania. Nie pytaj o rzeczy opcjonalne, dopóki brakuje niezbędnych.
- Niezbędne: templateId, myRole, nazwa/imię i nazwisko obu stron, scope (przedmiot/zakres), kwota – jeśli umowa jest odpłatna. Opcjonalne: adresy, NIP/PESEL, e-maile, terminy, termin płatności, odpowiedzialność, wypowiedzenie, prawa autorskie, kary, poufność.
- ready = true, gdy masz wszystkie niezbędne dane. Wtedy w reply krótko podsumuj projekt i napisz, że można go utworzyć, ewentualnie zaproponuj 1–2 opcjonalne doprecyzowania.
- ownDataInLastMessage = true, jeśli w OSTATNIEJ wiadomości użytkownik podał własne dane identyfikacyjne (swoją nazwę/imię i nazwisko z adresem lub NIP/PESEL).
- quickReplies: do 4 krótkich podpowiedzi odpowiedzi (np. „Jestem zleceniodawcą”, „Do 31 grudnia”), lub pusta lista.
- title: krótka nazwa dokumentu, np. „Umowa zlecenia – obsługa stoiska”.
- Nie udzielasz porad prawnych w tej rozmowie – zbierasz dane do projektu.`

function clip(v, n = 4000) {
  return String(v ?? '').slice(0, n)
}

async function intake(body) {
  const catalog = Array.isArray(body?.catalog) ? body.catalog.slice(0, 200) : []
  const messages = Array.isArray(body?.messages) ? body.messages.slice(-20) : []
  if (!messages.length) throw Object.assign(new Error('Brak wiadomości.'), { status: 400, code: 'empty' })
  const catalogText = catalog.map((t) => `${clip(t.id, 60)} | ${clip(t.name, 120)} | A: ${clip(t.roles?.[0], 60)} | B: ${clip(t.roles?.[1], 60)} | ${clip(t.category, 60)}`).join('\n')
  const today = new Date().toISOString().slice(0, 10)
  const mt = body?.myTemplate
  const myTemplateText = mt?.name
    ? `\n\nWAŻNE: Użytkownik tworzy umowę z WŁASNEGO wzoru „${clip(mt.name, 120)}” (templateId: "${clip(mt.templateId ?? '', 60)}"). Treść umowy jest gotowa – NIE pytaj o przedmiot, kwoty ani warunki, chyba że użytkownik sam chce coś zmienić. Użytkownik jest stroną ${mt.myRole === 'B' ? 'B' : 'A'} (${clip(mt.myRoleName, 60)}); druga strona: ${clip(mt.otherRoleName, 60)}. Zbierz dane drugiej strony z tekstu (nazwa, adres, NIP/PESEL, e-mail, reprezentacja). ready = true, gdy znasz nazwę drugiej strony. W answers.scope wpisz „(z Twojego wzoru)”.`
    : ''
  const context = `${personaText(body?.persona)}${myTemplateText}\n\nKatalog wzorów (id | nazwa | rola strony A | rola strony B | kategoria):\n${catalogText}\n\nAktualny stan projektu (JSON):\n${clip(JSON.stringify(body?.state ?? {}), 6000)}\n\nZapisane dane użytkownika (profil):\n${body?.savedOwnParty ? clip(JSON.stringify(body.savedOwnParty), 1500) : 'brak'}`
  const payload = {
    model: INTAKE_MODEL,
    input: [
      { role: 'system', content: INTAKE_PROMPT.replace('{TODAY}', today) },
      { role: 'system', content: context },
      ...messages.map((m) => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: clip(m.text, 6000) })),
    ],
    text: { format: { type: 'json_schema', name: 'contract_intake', strict: true, schema: INTAKE_SCHEMA } },
  }
  return callModel(payload, process.env.OPENAI_INTAKE_EFFORT || 'low')
}

// ——— Asystent w umowie: rozmowa i edycja ———
const PARTY_UPDATE = {
  type: 'object',
  additionalProperties: false,
  required: ['partyId', 'kind', 'name', 'address', 'idNumber', 'email', 'representative'],
  properties: { partyId: { type: 'string', enum: ['A', 'B'] }, kind: { type: 'string', enum: ['osoba', 'firma', ''] }, name: S, address: S, idNumber: S, email: S, representative: S },
}
const CONTRACT_CHAT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['reply', 'edits', 'partyUpdates', 'title', 'quickReplies'],
  properties: {
    reply: S,
    edits: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['op', 'index', 'title', 'text', 'summary'],
        properties: { op: { type: 'string', enum: ['update', 'insert', 'delete'] }, index: { type: 'integer' }, title: S, text: S, summary: S },
      },
    },
    partyUpdates: { type: 'array', items: PARTY_UPDATE },
    title: S,
    quickReplies: { type: 'array', items: S },
  },
}

const CONTRACT_CHAT_PROMPT = `Jesteś asystentem Prawo.ai pracującym nad konkretną umową razem z użytkownikiem (jedną ze stron). Rozmowa jest prywatna – druga strona jej nie widzi.
Możesz: odpowiadać na pytania o umowę, wyjaśniać zapisy, doradzać (z perspektywy użytkownika, ale uczciwie) oraz WPROWADZAĆ ZMIANY, gdy użytkownik o to prosi lub podaje dane do uzupełnienia.
Zasady zmian:
- edits: lista zmian zapisów. op="update" – nowa pełna treść zapisu o numerze index (numeracja z nawiasów kwadratowych); op="insert" – nowy zapis wstawiany PO zapisie index (title = tytuł nowego paragrafu); op="delete" – usunięcie zapisu index. summary = krótki opis zmiany (np. „Dodano płatność w dwóch transzach”).
- Zmieniaj tylko to, o co chodzi; zachowaj numerację ustępów („1.”, „2.”) i styl. Nie wymyślaj danych – jeśli czegoś brakuje, zapytaj.
- partyUpdates: gdy użytkownik podaje dane stron (także przez @wzmiankę z danymi), uzupełnij je tu (pełne aktualne dane strony; puste pola = bez zmian). Strona A i B jak w umowie.
- title: nowy tytuł dokumentu tylko jeśli warto go zmienić, inaczej pusty tekst.
- reply: krótko, po polsku. Gdy coś zmieniasz, napisz co i gdzie, odwołując się do numerów paragrafów w formie „§ N” – używaj numerów § widocznych w treści (NIE indeksów w nawiasach kwadratowych); nowy zapis wstawiony po [k] otrzyma § k+2, a paragrafy za nim przesuną się o jeden. Gdy czegoś brakuje do kompletnej umowy (np. dane drugiej strony, kwota, termin), wskaż to i poproś o te informacje.
- Jeśli umowa jest już udostępniona drugiej stronie, Twoje zmiany zostaną wysłane jako propozycje do akceptacji – napisz to.
- Nie powołuj się na numery przepisów ani orzeczenia.
- quickReplies: do 3 krótkich podpowiedzi następnej wiadomości użytkownika.`

async function contractChat(body) {
  const c = body?.contract ?? {}
  const clauses = Array.isArray(c.clauses) ? c.clauses.slice(0, 80) : []
  const parties = Array.isArray(c.parties) ? c.parties.slice(0, 2) : []
  const messages = Array.isArray(body?.messages) ? body.messages.slice(-14) : []
  if (!messages.length) throw Object.assign(new Error('Brak wiadomości.'), { status: 400, code: 'empty' })
  const doc = clauses.map((x, i) => `[${i}] § ${i + 1}. ${clip(x.title, 200)}\n${clip(x.text, 6000)}`).join('\n\n')
  if (doc.length > MAX_CHARS) throw Object.assign(new Error('Umowa jest za długa.'), { status: 413, code: 'too_long' })
  const mentions = Array.isArray(body?.mentions) && body.mentions.length ? `\n\nDane osób wskazanych przez @wzmianki:\n${clip(JSON.stringify(body.mentions), 3000)}` : ''
  const payload = {
    model: INTAKE_MODEL,
    input: [
      { role: 'system', content: CONTRACT_CHAT_PROMPT },
      {
        role: 'system',
        content: `${personaText(body?.persona)}\nUżytkownik jest stroną ${body?.viewer === 'B' ? 'B' : 'A'}. Umowa ${body?.stage === 'draft' ? 'jest szkicem (zmiany wchodzą od razu)' : 'jest udostępniona drugiej stronie (zmiany = propozycje)'}.\n\nTytuł: ${clip(c.title, 200)}\nStrony: ${clip(JSON.stringify(parties), 2000)}${mentions}\n\nTreść umowy:\n${doc}`,
      },
      ...messages.map((m) => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: clip(m.text, 6000) })),
    ],
    text: { format: { type: 'json_schema', name: 'contract_chat', strict: true, schema: CONTRACT_CHAT_SCHEMA } },
  }
  return callModel(payload, process.env.OPENAI_CHAT_EFFORT || 'low')
}

// ——— Własny wzór: dostosowanie treści do nowego kontrahenta ———
const RETARGET_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['clauses'],
  properties: { clauses: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['index', 'text'], properties: { index: { type: 'integer' }, text: S } } } },
}

async function retarget(body) {
  const clauses = Array.isArray(body?.clauses) ? body.clauses.slice(0, 40) : []
  if (!clauses.length) return { model: null, result: { clauses: [] } }
  const payload = {
    model: INTAKE_MODEL,
    input: [
      {
        role: 'system',
        content:
          'Przenosisz gotową umowę na nowego kontrahenta. W podanych zapisach zamień WSZYSTKIE odniesienia do poprzedniego kontrahenta (nazwa w dowolnej odmianie, skróty nazwy, adres, NIP/KRS/PESEL, e-mail, osoba reprezentująca) na dane nowego kontrahenta, z poprawną polską odmianą i składnią. Jeśli jakiegoś elementu nowego kontrahenta brak, usuń odniesienie albo zastąp je neutralnym określeniem roli (np. „Zamawiający”). Nie zmieniaj niczego innego (kwot, terminów, warunków, numeracji, formatowania i podziału na linie). Zwróć pełny tekst tylko tych zapisów, które zmieniłeś.',
      },
      {
        role: 'user',
        content: `Poprzedni kontrahent: ${clip(JSON.stringify(body?.oldParty ?? {}), 1000)}\nNowy kontrahent: ${clip(JSON.stringify(body?.newParty ?? {}), 1000)}\n\nZapisy:\n${clauses.map((c) => `[${Number(c.index)}]\n${clip(c.text, 6000)}`).join('\n\n')}`,
      },
    ],
    text: { format: { type: 'json_schema', name: 'retarget', strict: true, schema: RETARGET_SCHEMA } },
  }
  return callModel(payload, 'low')
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
    if (req.url === '/api/status' && req.method === 'GET') return send(res, 200, { ai: !!API_KEY, provider: 'openai', model: API_KEY ? MODEL : null, keyEnv: KEY_ENV, openaiEnvNames: OPENAI_ENV_NAMES, keyLooksValid: API_KEY ? /^sk-[A-Za-z0-9_-]{20,}$/.test(API_KEY) : null, version: APP_VERSION, commit: APP_COMMIT, startedAt: STARTED_AT, node: process.version }, { 'Cache-Control': 'no-store' })
    if (req.url === '/api/analyze' && req.method === 'POST') {
      if (!API_KEY) return send(res, 503, { error: 'Analiza AI nie jest skonfigurowana.', code: 'not_configured' })
      if (rateLimited(req)) return send(res, 429, { error: `Wykorzystano limit ${LIMIT_PER_HOUR} analiz na godzinę. Spróbuj później lub użyj analizy podstawowej.`, code: 'rate_limited' })
      const body = await readJson(req)
      const started = Date.now()
      const out = await analyze(body)
      console.log(`[analyze] ${out.model} · ${body.clauses.length} zapisów · ${out.result.findings?.length ?? 0} uwag · ${((Date.now() - started) / 1000).toFixed(1)} s`)
      return send(res, 200, out)
    }
    if (req.url === '/api/contract-chat' && req.method === 'POST') {
      if (!API_KEY) return send(res, 503, { error: 'Asystent wymaga skonfigurowanego modelu AI.', code: 'not_configured' })
      if (intakeLimited(req)) return send(res, 429, { error: 'Wykorzystano godzinny limit wiadomości. Spróbuj później.', code: 'rate_limited' })
      const body = await readJson(req, 2_000_000)
      const started = Date.now()
      const out = await contractChat(body)
      console.log(`[contract-chat] ${out.model} · ${out.result.edits?.length ?? 0} zmian · ${((Date.now() - started) / 1000).toFixed(1)} s`)
      return send(res, 200, out)
    }
    if (req.url === '/api/retarget' && req.method === 'POST') {
      if (!API_KEY) return send(res, 503, { error: 'Brak skonfigurowanego modelu AI.', code: 'not_configured' })
      if (intakeLimited(req)) return send(res, 429, { error: 'Wykorzystano godzinny limit.', code: 'rate_limited' })
      const out = await retarget(await readJson(req))
      return send(res, 200, out)
    }
    if (req.url === '/api/intake' && req.method === 'POST') {
      if (!API_KEY) return send(res, 503, { error: 'Tworzenie umowy z opisu wymaga skonfigurowanego modelu AI.', code: 'not_configured' })
      if (intakeLimited(req)) return send(res, 429, { error: 'Wykorzystano godzinny limit wiadomości. Spróbuj później lub skorzystaj z kreatora krok po kroku.', code: 'rate_limited' })
      const body = await readJson(req)
      const started = Date.now()
      const out = await intake(body)
      console.log(`[intake] ${out.model} · ${body.messages?.length ?? 0} wiad. · ${((Date.now() - started) / 1000).toFixed(1)} s`)
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
