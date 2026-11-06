# Prawo.ai – aplikacja demonstracyjna

Aplikacja webowa (React + TypeScript + Vite + Tailwind CSS + Lucide), która pomaga:

1. **tworzyć umowy dwustronne** z biblioteki wzorów i wysyłać je kontrahentowi,
2. **analizować i negocjować** istniejące umowy (komentarze przypięte do zapisów, propozycje zmian, historia wersji),
3. **podpisywać uzgodnione umowy na ekranie** i pobierać PDF,
4. **rozmawiać z asystentem** o sprawach prawnych (pytania doprecyzowujące → podsumowanie i kolejne kroki).

Interfejs jest po polsku, projektowany mobile-first. Wszystkie dane demo są zapisywane w `localStorage` przeglądarki.

## Uruchomienie

Wymagany Node.js **20.19+** (lub 22.12+).

```bash
npm install
cp .env.example .env   # wpisz OPENAI_API_KEY, aby włączyć ocenę umów przez OpenAI
npm run dev            # aplikacja: http://localhost:5173, API: http://localhost:8787
```

Inne skrypty:

```bash
npm run build      # sprawdzenie typów (tsc -b) + build produkcyjny do dist/
npm start          # serwer produkcyjny: API + zbudowana aplikacja z dist/ (http://localhost:8787)
npm run dev:web    # sam frontend (bez API – analiza działa w trybie podstawowym)
npm run typecheck  # tylko sprawdzenie typów
```

## Tworzenie umowy z opisu (OpenAI)

Na stronie głównej wpisujesz własnymi słowami, jaką umowę potrzebujesz (albo klikasz skrót, np. „Umowa zlecenia”). Ekran `/nowa` prowadzi rozmowę przez `POST /api/intake`:

- model dobiera wzór z katalogu, rozpoznaje strony i dane wklejone w dowolnej formie (adres, NIP/KRS/PESEL, e-mail), terminy i kwoty, i dopytuje tylko o brakujące niezbędne informacje;
- po prawej na bieżąco widać zbierany projekt; „Utwórz projekt umowy” składa umowę ze wzoru, a „Dopracuj w kreatorze” otwiera kreator krok po kroku z uzupełnionymi danymi;
- gdy podasz własne dane, aplikacja pyta, czy zapisać je w profilu – potem uzupełnia je automatycznie (także w kreatorze). Zapisane dane można usunąć w menu konta;
- bez `OPENAI_API_KEY` ekran proponuje pasujący wzór w kreatorze krok po kroku.

Zmienne: `OPENAI_INTAKE_MODEL` (domyślnie jak `OPENAI_MODEL`), `OPENAI_INTAKE_EFFORT` (domyślnie `low`), `INTAKE_LIMIT_PER_HOUR` (domyślnie 80 wiadomości na IP).

### Moje wzory i moje dane

- W widoku umowy ikoną zakładki zapisujesz ją jako **własny wzór**. Na stronie głównej wybierasz go w sekcji „Twoje wzory”, wklejasz tylko dane drugiej strony – model je rozpoznaje, a `POST /api/retarget` przeredagowuje odniesienia do poprzedniego kontrahenta (z poprawną odmianą). Pozostałości są zgłaszane do sprawdzenia.
- Gdy w rozmowie lub w analizowanej umowie pojawią się Twoje dane, aplikacja pokazuje okno „Czy to Twoje dane?” z przełącznikiem „Zapisz jako moje dane w Prawo.ai”. Zapisane dane (oraz imię w wołaczu i formy gramatyczne) edytujesz w menu konta → „Mój profil i dane”.

## Ocena umów przez OpenAI

Analiza w sekcji **Analizuj umowę** korzysta z modelu OpenAI, jeśli serwer ma ustawiony `OPENAI_API_KEY`:

- Przeglądarka wysyła tekst umowy (podzielony na zapisy) do `POST /api/analyze` w `server/index.mjs`. Serwer wywołuje OpenAI Responses API ze strukturalnym wynikiem (JSON Schema) i strumieniowaniem. **Klucz nigdy nie trafia do przeglądarki.**
- Przed analizą użytkownik wskazuje, którą stroną umowy jest – ocena jest wykonywana z jego perspektywy (albo neutralnie). Model sprawdza nie tylko kwestie prawne, ale też finansowe (np. podział i terminy płatności, budżety, ukryte koszty), biznesowe (zakres, związanie umową, wyjście z umowy) i operacyjne (odbiory, poprawki, raportowanie).
- Model zwraca podsumowanie, strony, obowiązki, terminy, płatności oraz 6–15 uwag. Każda uwaga ma wagę (**Najważniejsze** / **Kosmetyka**), istotność 1–5, charakter (prawne/finansowe/biznesowe/operacyjne), wyjaśnienie, „co to oznacza dla Ciebie”, dosłowny cytat z zapisu i propozycję nowego brzmienia. Brakujące postanowienia mają propozycję treści nowego zapisu.
- Przed oceną można dopisać kontekst (wcześniejsze ustalenia, oferta, priorytety) – model wskaże rozbieżności między umową a ustaleniami. Wynik zawiera też ogólną ocenę, 3 priorytety do negocjacji, listę „Do sprawdzenia przed podpisaniem” oraz gotową wiadomość do drugiej strony (do skopiowania lub wysłania jako wspólny komentarz).
- Tekst z PDF/DOCX jest porządkowany przed analizą: łamane linie akapitów są łączone, a utracone oznaczenia punktów („)”) zamieniane na myślniki.
- Widok jak w edytorze dokumentów: zacytowany fragment jest zakreślony w tekście z numerem, a komentarz stoi na marginesie obok zapisu (na telefonie – pod zapisem). Kliknięcie zakreślenia otwiera komentarz i odwrotnie. Filtry: wszystkie otwarte / Najważniejsze / Kosmetyka / Rozpatrzone.
- Instrukcja dla modelu wymaga neutralności wobec obu stron i zabrania powoływania się na numery przepisów czy orzeczenia.
- Uwagi są przypinane do zapisów, a „Akceptuj” podmienia dokładnie zacytowany fragment (lub tworzy propozycję dla drugiej strony, jeśli umowa jest już udostępniona).
- Bez klucza, albo po wybraniu „Użyj analizy podstawowej” przy błędzie, działa dotychczasowa analiza regułowa (`src/lib/analyzer.ts`). Panel analizy zawsze pokazuje, kto wykonał ocenę.

Zmienne (`.env`): `OPENAI_API_KEY`, `OPENAI_MODEL` (domyślnie `gpt-5.5`), `OPENAI_REASONING_EFFORT` (`low`/`medium`/`high`), `API_PORT` (domyślnie 8787). Analiza przykładowej umowy trwa zwykle 40–60 s.

Jeśli serwer działa za proxy HTTP (np. w środowisku firmowym), uruchom go z `NODE_USE_ENV_PROXY=1`, aby Node korzystał ze zmiennych `HTTPS_PROXY`.

## Wdrożenie na Railway

Repozytorium zawiera `railway.json` (start: `node server/index.mjs`, healthcheck `/api/status`). Build wykonuje domyślny builder Railway (Railpack): `npm ci` i `npm run build` – nie dodawaj własnego `buildCommand` z `npm ci`, bo podwójna instalacja kończy się błędem `EBUSY … node_modules/.cache`. Serwer sam serwuje aplikację i API na porcie z `PORT`.

1. railway.com → **New Project** → **Deploy from GitHub repo** → wybierz `prawoai` i gałąź z aplikacją.
2. W usłudze → **Variables** dodaj `OPENAI_API_KEY` (opcjonalnie `OPENAI_MODEL`, `ANALYZE_LIMIT_PER_HOUR`). **Nie** ustawiaj `API_PORT`.
3. **Settings → Networking → Generate Domain** – otrzymasz publiczny adres `https://…up.railway.app`.

**Czy wdrożenie jest aktualne?** Numer wersji i commita widać w prawym dolnym rogu aplikacji oraz pod adresem `/api/status` (pola `version`, `commit`, `startedAt`, `node`). Jeśli się nie zmieniają: w Railway → **Deployments** sprawdź, czy ostatnie wdrożenie ma status *Success* (przy *Failed* Railway nadal serwuje poprzednią wersję – zobacz **Build Logs**), a w **Settings → Source** – gałąź i włączone automatyczne wdrażanie. Wersja Node jest ustalona w `.nvmrc` / `.node-version` (22).

Bez `OPENAI_API_KEY` aplikacja działa z analizą podstawową. Limit analiz AI: domyślnie 10 na godzinę na adres IP.

## Jak przetestować ścieżki demo

| Ścieżka | Jak |
|---|---|
| Ekran startowy | `/` – trzy główne akcje, „Moje umowy” z 4 przykładowymi dokumentami w różnych statusach |
| Kreator umowy | **Wzory umów** → wyszukaj/filtruj → **Utwórz** → rola → strony → warunki → edytowalny projekt z wyjaśnieniami → wyślij |
| Analiza | **Analizuj umowę** → *Wklej tekst* → „Wstaw przykładową umowę” → **Analizuj** → wybierz swoją stronę → akceptuj / edytuj / odrzuć uwagi |
| Negocjacje | W umowie kliknij **Zaproś drugą stronę do negocjacji** → „Zobacz jako kontrahent” otwiera link `/d/…` w nowej karcie (widok bez rejestracji; konto proponowane przy próbie zmian) |
| Odpowiedź na propozycję | „Obsługa marketingowa – Zielona Łąka” ma otwartą propozycję kontrahenta (status *Wymaga Twojej odpowiedzi*) |
| Podpis | „Projekt logo – Pracownia Glina” jest uzgodniona → **Przejdź do podpisu** → podpis palcem/myszką lub wpisany → PDF |
| Asystent | **Asystent AI** → wybierz temat lub opisz problem → odpowiedz na pytania → podsumowanie; spinacz dołącza dokument |
| Reset danych | Menu konta (avatar) → **Przywróć dane przykładowe** |

Linki demo kontrahenta dla danych przykładowych: `/d/demo-pixel`, `/d/demo-polna`, `/d/demo-glina`.

## Struktura

```
src/
  data/templates.ts         katalog wzorów (metadane + parametry kreatora; gotowy na ~100 pozycji)
  data/assistantTopics.ts   scenariusze asystenta (pytania, podsumowania)
  data/sampleTexts.ts       przykładowa umowa do analizy
  lib/contractGenerator.ts  składanie przykładowego projektu umowy z odpowiedzi kreatora
  lib/analyzer.ts           regułowa analiza tekstu umowy (ryzyka, braki, terminy, kwoty)
  lib/contractOps.ts        operacje na umowie: propozycje, akceptacje, wersje, podpisy
  lib/privateAssistant.ts   prywatny asystent w widoku umowy
  lib/extract.ts            odczyt PDF (pdf.js) i DOCX (mammoth) w przeglądarce
  lib/pdf.ts                generowanie PDF (canvas → jsPDF)
  store/                    stan aplikacji + localStorage + dane przykładowe
  components/               UI, układ, podpis (canvas), widok negocjacji
  pages/                    ekrany
```

## Ograniczenia wersji demonstracyjnej

Szczegóły i lista prac przed użyciem produkcyjnym: [`docs/PRODUKCJA.md`](docs/PRODUKCJA.md).

- **Wzory** mają status „przykładowy”. Treść projektu jest składana z ogólnych klauzul i **nie jest zweryfikowanym dokumentem prawnym**.
- **Analiza umowy** korzysta z modelu OpenAI (gdy ustawiono klucz) – model nie ma dostępu do aktualnych źródeł prawa i może się mylić. Bez klucza działa analiza regułowa.
- **Asystent AI**, prywatny asystent w umowie i ocena dokumentu dołączonego w czacie nadal działają według scenariuszy i reguł (bez modelu AI).
- **Negocjacje między stronami** działają w obrębie jednej przeglądarki (wspólny `localStorage`, synchronizacja między kartami). Brak backendu, prawdziwych kont i wysyłki e-mail.
- **Podpis ekranowy** to odwzorowanie podpisu odręcznego – nie jest podpisem kwalifikowanym.
