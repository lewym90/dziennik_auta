# 🚗 Dziennik Auta

Aplikacja PWA dla kierowców: terminy OC, przeglądu i wymiany oleju, historia tankowań i spalanie, koszty serwisów i napraw, wiele pojazdów oraz raport serwisowy do sprzedaży auta.

Działa **offline**, otwiera się z ekranu startowego jak zwykła aplikacja, nie wymaga konta ani serwera. Wszystkie dane zostają **wyłącznie na Twoim urządzeniu**.

## Funkcje

- **Terminy z odliczaniem** – OC, przegląd techniczny, wymiana oleju (data *i/lub* przebieg), AC/NNW, assistance, opony, rozrząd oraz własne. Kolorowe pierścienie (zielony / żółty / czerwony), ostrzeżenia z wyprzedzeniem, ikona z licznikiem na aplikacji.
- **Odnawianie jednym kliknięciem** – po odnowieniu OC lub wymianie oleju nowy termin liczy się sam, a wpis trafia do historii serwisowej.
- **Eksport terminów do kalendarza (.ics)** – z alarmami 14 dni, 7 dni i 1 dzień przed terminem (działają nawet przy wyłączonej aplikacji).
- **Tankowania i spalanie** – metoda „od pełnego do pełnego”, osobno dla każdego rodzaju paliwa (Pb95, Pb98, diesel, LPG, prąd). Wykres trendu, najlepsze/najgorsze spalanie, średnia cena, koszt kilometra.
- **Koszty serwisów i napraw** – kategorie, wyszukiwarka, filtry, podsumowania roczne.
- **Wiele pojazdów** – przełączanie z poziomu garażu, osobne terminy i statystyki.
- **Raport do sprzedaży auta** – pełna historia serwisowa do PDF (lub HTML), z opcją ukrycia kosztów, informacją o spójności przebiegu i miejscem na podpisy.
- **Skaner paragonów** – zrób zdjęcie paragonu ze stacji, a aplikacja odczyta litry, cenę, kwotę, datę, stację i rodzaj paliwa. Rozpoznawanie działa lokalnie na telefonie (folder `ocr/`), zdjęcie nigdzie nie jest wysyłane.
- **Zdjęcia faktur i dokumentów** przy wpisach serwisowych i tankowaniach, zdjęcie auta na pulpicie, opcjonalne dołączenie zdjęć do raportu sprzedażowego.
- **Katalog warsztatów** – ocena, telefon, nawigacja, liczba wizyt i suma wydatków z historii serwisowej.
- **Typy nadwozia** – hatchback, sedan, kombi, SUV, van z własną sylwetką na pulpicie.
- **Dodatkowo**: wnioski i podpowiedzi, kalkulator kosztu trasy, kopia zapasowa/przywracanie (JSON), eksport do Excela (CSV), motyw jasny/ciemny/auto, dane demonstracyjne, szybkie skróty z ikony aplikacji (Dodaj tankowanie / Serwis / Terminy), linki do UFG (sprawdzenie OC) i Historia Pojazdu.

## Publikacja na GitHub Pages (5 minut)

1. Utwórz nowe repozytorium na GitHubie (np. `dziennik-auta`) – publiczne.
2. Wgraj zawartość tego folderu **do głównego katalogu** repozytorium:

   ```bash
   git init
   git add .
   git commit -m "Dziennik Auta"
   git branch -M main
   git remote add origin https://github.com/TWOJ-LOGIN/dziennik-auta.git
   git push -u origin main
   ```

3. W repozytorium wejdź w **Settings → Pages**, w sekcji *Build and deployment* wybierz **Source: Deploy from a branch**, gałąź **main**, folder **/ (root)** i zapisz.
4. Po minucie aplikacja będzie pod adresem `https://TWOJ-LOGIN.github.io/dziennik-auta/`.

> Aplikacja używa wyłącznie ścieżek względnych, więc działa w podkatalogu GitHub Pages bez żadnych zmian.

## Instalacja na telefonie

- **iPhone / iPad (Safari):** otwórz adres aplikacji → przycisk **Udostępnij** → **Do ekranu początkowego**.
- **Android (Chrome):** otwórz adres → menu ⋮ → **Zainstaluj aplikację** (lub użyj przycisku „Zainstaluj” w aplikacji).
- **Komputer (Chrome/Edge):** ikona instalacji w pasku adresu.

## Ważne informacje

- **Kopie zapasowe.** Dane i zdjęcia są w pamięci przeglądarki (kopia JSON zawiera też zdjęcia). Wyczyszczenie danych witryny lub odinstalowanie aplikacji je usuwa – zrób okresową kopię (*Więcej → Kopia zapasowa*) i przechowuj ją np. w chmurze. Tą samą kopią przenosisz dane na nowy telefon.
- **Powiadomienia.** Statyczny hosting (GitHub Pages) nie może wysyłać powiadomień push w tle. Aplikacja pokazuje powiadomienia przy otwarciu, a niezawodne przypomnienia daje eksport terminów do kalendarza (.ics).
- **Aktualizacje.** Po zmianie plików zwiększ numer w `VERSION` w pliku `sw.js` (np. `dziennik-auta-v1.0.1`), aby urządzenia pobrały nową wersję.
- **Raport nie jest dokumentem urzędowym.** To zestawienie danych wprowadzonych przez właściciela.

## Struktura

```
index.html              szkielet aplikacji
styles.css              style, animacje, motywy
app.js                  cała logika (bez zależności)
sw.js                   service worker (offline)
manifest.webmanifest    manifest PWA (ikony, skróty)
receipt.js              parser paragonów
ocr/                    lokalny silnik OCR (tesseract.js, ~15 MB)
icons/                  ikony (PNG + SVG)
tools/gen_icons.py      generator ikon (Pillow)
```

Lokalny podgląd: `python3 -m http.server 8000` i wejście na `http://localhost:8000`.
