# Prawo.ai – co należy zrobić przed użyciem produkcyjnym

Ten dokument opisuje, które elementy demo wymagają backendu, modelu AI, bezpiecznego przechowywania dokumentów lub integracji z dostawcą podpisu, oraz co sprawdzić prawnie.

## 1. Backend i konta

- Uwierzytelnianie (e-mail + link/hasło, opcjonalnie SSO), weryfikacja adresu e-mail.
- Baza danych zamiast `localStorage` (`src/store/AppStore.tsx` – interfejs `Store` można zastąpić klientem API).
- Model uprawnień: właściciel dokumentu, kontrahent z linkiem (tylko odczyt), kontrahent z kontem (komentarze, propozycje, akceptacja, podpis).
- Linki udostępniania: długie, losowe tokeny, możliwość unieważnienia, data wygaśnięcia, opcjonalnie kod PIN; log dostępu.
- Serwerowa walidacja reguł negocjacji (np. tylko druga strona może zaakceptować propozycję; zmiana treści zeruje akceptacje) – dziś egzekwowane w `src/lib/contractOps.ts` po stronie klienta.
- Wysyłka e-mail (zaproszenia, powiadomienia o propozycjach i podpisach) – dziś generowany jest tylko link i `mailto:`.
- Synchronizacja w czasie rzeczywistym (WebSocket/SSE) oraz obsługa konfliktów równoległych edycji.

## 2. Bezpieczne przechowywanie dokumentów

- Szyfrowanie w spoczynku i w transmisji, izolacja danych klientów, kopie zapasowe.
- Rozdzielenie danych **wspólnych** (treść, wersje, komentarze, propozycje) i **prywatnych** (rozmowy z asystentem, prywatne uwagi z analizy) na poziomie bazy i API – druga strona nie może mieć do nich dostępu nawet przez API.
- Retencja i usuwanie danych, eksport danych użytkownika, rejestr czynności przetwarzania, umowy powierzenia z podwykonawcami (hosting, model AI).
- Skanowanie antywirusowe wgrywanych plików; OCR dla skanów (dziś PDF bez warstwy tekstowej jest odrzucany).

## 3. Model AI i źródła prawa

- Analiza umowy jest już wykonywana przez model OpenAI po stronie serwera (`server/index.mjs`, `src/lib/aiAnalysis.ts`), z analizą regułową jako zapasem. Przed produkcją: uwierzytelnienie i limity zapytań na `/api/analyze` (dziś endpoint jest otwarty), kolejka dla długich dokumentów, rejestrowanie kosztów, umowa powierzenia przetwarzania z dostawcą modelu i ustawienia retencji danych po stronie OpenAI, informacja dla użytkownika, że treść umowy jest przesyłana do zewnętrznego dostawcy.
- Asystent (`src/data/assistantTopics.ts`) i prywatny asystent w umowie (`src/lib/privateAssistant.ts`) to nadal logika regułowa – do podłączenia do modelu w ten sam sposób.
- Źródła prawa: aktualne teksty aktów prawnych i orzecznictwa z wiarygodnego źródła; odpowiedzi z odwołaniami tylko do faktycznie pobranych źródeł (bez generowania cytatów z pamięci modelu).
- Zasady neutralności: asystent w negocjacjach nie może działać na korzyść jednej strony w sposób ukryty ani zmieniać dokumentu – każda zmiana przechodzi przez propozycję i akceptację drugiej strony (zachowane w obecnym przepływie).
- Ewaluacja jakości (zestaw testowych umów, przegląd prawników), monitorowanie błędów, jasne komunikaty o ograniczeniach i informacja, że to nie jest porada prawna.

## 4. Wzory umów

- Każdy z ~100 docelowych wzorów musi zostać przygotowany i zatwierdzony przez prawnika. Struktura `TemplateDefinition` ma pole `status` (`przykładowy` | `zatwierdzony`) i `review` (kto, kiedy, wersja).
- Treść klauzul powinna pochodzić z zatwierdzonych wzorów (np. z CMS), a nie z ogólnego generatora `generateClauses`.
- Wersjonowanie wzorów i informacja, z której wersji wzoru powstała umowa.
- Weryfikacja, czy dla danego typu umowy prawo nie wymaga szczególnej formy (np. akt notarialny, forma pisemna z podpisem własnoręcznym) – w takim przypadku aplikacja nie powinna oferować podpisu ekranowego jako wystarczającego.

## 5. Podpis

- Obecny podpis ekranowy (`src/components/SignaturePad.tsx`) zapisuje obraz podpisu, imię i nazwisko, datę oraz skrót SHA-256 treści. Nie jest to kwalifikowany podpis elektroniczny i nie należy przypisywać mu konkretnej mocy prawnej.
- Przed produkcją: integracja z dostawcą usług zaufania (podpis zaawansowany / kwalifikowany, pieczęć, znacznik czasu), weryfikacja tożsamości sygnatariuszy, ścieżka audytu (IP, urządzenie, zdarzenia), zamrożenie wersji dokumentu przed podpisem.
- Do oceny prawnej: jaka forma podpisu jest wymagana lub zalecana dla poszczególnych typów umów oraz jak komunikować to użytkownikom.

### Podpis kodem SMS (obecnie demonstracja)

- Na komputerze podpis pod umową potwierdza się kodem SMS. W demo kod jest generowany w przeglądarce i pokazywany w podglądzie wiadomości – **nic nie jest wysyłane**.
- Produkcyjnie: endpoint serwera generujący jednorazowy kod (np. 6 cyfr, ważny 5 min, limit prób), wysyłka przez bramkę SMS (np. SMSAPI), weryfikacja kodu po stronie serwera, zapis w ścieżce audytu (numer telefonu, czas, IP, wersja i skrót dokumentu). Klucz bramki SMS tylko po stronie serwera.
- Podpis kodem SMS to forma potwierdzenia tożsamości i woli, ale nadal nie jest kwalifikowanym podpisem elektronicznym.

## 6. PDF

- Obecnie PDF powstaje w przeglądarce jako obrazy stron (pełna obsługa polskich znaków). W produkcji zalecany jest PDF/A z warstwą tekstową generowany po stronie serwera, z osadzonymi fontami, metadanymi podpisów i pieczęcią czasu.

## 7. Jakość i dostępność

- Testy jednostkowe (`contractOps`, `analyzer`) i e2e (Playwright) w CI.
- Audyt WCAG 2.1 AA (czytniki ekranu, kontrast w trybie wysokiego kontrastu), testy na urządzeniach dotykowych.
- Regulamin, polityka prywatności, zgody marketingowe, informacja o charakterze usługi (nie jest to porada prawna).
