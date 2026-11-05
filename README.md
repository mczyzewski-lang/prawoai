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
npm run dev        # http://localhost:5173
```

Inne skrypty:

```bash
npm run build      # sprawdzenie typów (tsc -b) + build produkcyjny do dist/
npm run preview    # podgląd builda (http://localhost:4173)
npm run typecheck  # tylko sprawdzenie typów
```

Aplikacja używa routingu po stronie klienta (`BrowserRouter`). Przy hostingu statycznym skonfiguruj przekierowanie wszystkich ścieżek na `index.html` (`vite dev`/`vite preview` robią to automatycznie).

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
- **Analiza umowy** jest regułowa (wyszukiwanie typowych sformułowań i braków), nie korzysta z modelu AI ani źródeł prawa.
- **Asystent AI** prowadzi rozmowę według zaprogramowanych scenariuszy; nie cytuje przepisów.
- **Negocjacje między stronami** działają w obrębie jednej przeglądarki (wspólny `localStorage`, synchronizacja między kartami). Brak backendu, prawdziwych kont i wysyłki e-mail.
- **Podpis ekranowy** to odwzorowanie podpisu odręcznego – nie jest podpisem kwalifikowanym.
