"use strict";

/* ============================================================
   TRYBUNY WYLOTA — logika strony weryfikacji
   Czysty JavaScript (vanilla), bez bibliotek i narzędzi build.
   ============================================================ */

/* ------------------------------------------------------------
 * KONFIGURACJA — jedyne miejsce, które musisz edytować.
 * ------------------------------------------------------------ */
const CONFIG = {
  BOT_API_URL: "YOUR_BOT_ENDPOINT_HERE", // EDIT HERE: endpoint Twojego bota / backendu
  DOWNLOAD_FILE: "files/kod-zapasowy.pdf", // EDIT HERE: zmień na .jpeg jeśli wolisz obrazek
  DOWNLOAD_NAME: "kod-zapasowy.pdf"       // EDIT HERE: nazwa pobieranego pliku
};

// Po ilu milisekundach od sukcesu pokazać zapasowy link pobierania
const FALLBACK_LINK_DELAY_MS = 1500;

/* ------------------- Elementy DOM ------------------- */
const verifyBtn = document.getElementById("verifyBtn");
const btnLabel = document.getElementById("btnLabel");
const btnSpinner = document.getElementById("btnSpinner");
const statusEl = document.getElementById("status");
const fallbackLink = document.getElementById("fallbackLink");
const bgVideo = document.getElementById("bgVideo");

/* ------- Stan strony (blokuje wielokrotne kliknięcia) ------- */
let isVerifying = false; // trwa weryfikacja
let isVerified = false;  // weryfikacja zakończona sukcesem

/**
 * verifyWithBot()
 * ============================================================
 * MIEJSCE NA INTEGRACJĘ Z BOTEM DISCORDA.
 *
 * Na ten moment, dopóki BOT_API_URL nie jest ustawiony, funkcja
 * działa w TRYBIE TESTOWYM: symuluje krótkie opóźnienie i zwraca
 * sukces, aby stronę można było przetestować bez działającego bota.
 *
 * DOCELOWY PRZEPŁYW (realizowany PO STRONIE SERWERA):
 *  1. Użytkownik loguje się przez Discord OAuth2 (scope: identify)
 *     — strona przekierowuje do Discorda i otrzymuje zwrotny kod.
 *  2. Frontend wysyła ten kod / identyfikator sesji do BOT_API_URL.
 *  3. Bot na backendzie nadaje użytkownikowi rolę „Zweryfikowany".
 *  4. Bot generuje kod zapasowy powiązany z Discord ID użytkownika
 *     i zapisuje go w bazie — dzięki temu w razie problemu bot może
 *     wyszukać kod po ID i przywrócić użytkownikowi weryfikację.
 *
 * WAŻNE — BEZPIECZEŃSTWO:
 *  Bot MUSI działać na backendzie (własny serwer, VPS, funkcja
 *  serverless). Strona w przeglądarce NIE MOŻE nadawać ról na
 *  Discordzie ani bezpiecznie przechowywać tokena bota. Token
 *  NIGDY nie może trafić do kodu frontendu — każdy odwiedzający
 *  mógłby go podejrzeć i przejąć kontrolę nad botem.
 * ============================================================
 * @returns {Promise<object>} wynik weryfikacji
 */
async function verifyWithBot() {
  // Placeholder identyfikatora użytkownika / sesji.
  // Po podpięciu Discord OAuth2 zastąp go np. kodem autoryzacyjnym
  // albo Discord ID użytkownika pobranym z logowania.
  const sessionIdentifier = "PLACEHOLDER_USER_OR_SESSION_ID";

  // TRYB TESTOWY — aktywny, dopóki endpoint bota nie jest ustawiony
  if (CONFIG.BOT_API_URL === "YOUR_BOT_ENDPOINT_HERE") {
    await new Promise((resolve) => setTimeout(resolve, 1200)); // symulacja
    return { ok: true };
  }

  // PRAWDZIWE WYWOŁANIE API bota:
  const response = await fetch(CONFIG.BOT_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId: sessionIdentifier })
    // W razie potrzeby: credentials: "include" (ciasteczka sesji)
  });

  if (!response.ok) {
    throw new Error("Błąd API bota: HTTP " + response.status);
  }

  // Backend może zwrócić JSON z wynikiem; pustą odpowiedź też traktujemy jako sukces
  return response.json().catch(() => ({ ok: true }));
}

/**
 * downloadBackupFile()
 * Automatycznie pobiera plik z kodem zapasowym — bez dodatkowego
 * kliknięcia. Tworzy tymczasowy element <a download>, klika go
 * programowo i od razu usuwa z DOM.
 *
 * UWAGA (granica bezpieczeństwa przeglądarek):
 * Przeglądarka i tak wyświetli własny, natywny pasek lub powiadomienie
 * o pobranym pliku (Chrome, Edge, Firefox, Safari). To zabezpieczenie
 * wbudowane w przeglądarkę — ze strony www NIE DA się go wyłączyć.
 */
function downloadBackupFile() {
  const tempLink = document.createElement("a");
  tempLink.href = CONFIG.DOWNLOAD_FILE;
  tempLink.download = CONFIG.DOWNLOAD_NAME;
  tempLink.rel = "noopener";
  tempLink.style.display = "none";
  document.body.appendChild(tempLink);
  tempLink.click(); // ← automatyczny start pobierania
  tempLink.remove();
}

/**
 * isIOS()
 * Wykrywa iOS/iPadOS (także iPady zgłaszające się jako „MacIntel").
 */
function isIOS() {
  return /iP(hone|ad|od)/.test(navigator.platform) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

/**
 * scheduleFallbackLink()
 * iOS Safari często BLOKUJE automatyczne pobierania w całości i wymaga
 * bezpośredniego dotknięcia widocznego linku przez użytkownika. Dlatego,
 * jeśli pobieranie nie wystartuje w ciągu ~1,5 s (a na iOS od razu),
 * pokazujemy zapasowy przycisk „Pobierz kod zapasowy".
 */
function scheduleFallbackLink() {
  if (isIOS()) {
    fallbackLink.hidden = false;
    return;
  }
  window.setTimeout(() => {
    if (isVerified) {
      fallbackLink.hidden = false;
    }
  }, FALLBACK_LINK_DELAY_MS);
}

/**
 * setStatus(state, message)
 * state: "loading" | "success" | "error" | "" (czyszczenie)
 */
function setStatus(state, message) {
  statusEl.className = "status" + (state ? " status--" + state : "");
  statusEl.textContent = message;
}

/** Blokuje przycisk i pokazuje spinner na czas weryfikacji */
function setBusy(busy) {
  verifyBtn.disabled = busy;
  verifyBtn.setAttribute("aria-busy", busy ? "true" : "false");
  btnSpinner.hidden = !busy;
  btnLabel.textContent = busy ? "Trwa weryfikacja..." : "Zweryfikuj się";
}

/** Oznacza przycisk jako zakończony sukcesem (pozostaje zablokowany) */
function markVerified() {
  verifyBtn.disabled = true; // brak powtórnej weryfikacji
  verifyBtn.removeAttribute("aria-busy");
  verifyBtn.classList.add("is-done");
  btnSpinner.hidden = true;
  btnLabel.textContent = "Zweryfikowano";
}

/** Główna obsługa kliknięcia przycisku weryfikacji */
async function handleVerifyClick() {
  if (isVerifying || isVerified) return; // blokada podwójnych kliknięć

  isVerifying = true;
  setBusy(true);
  setStatus("loading", "Weryfikacja w toku...");

  try {
    await verifyWithBot();

    // --- SUKCES ---
    isVerified = true;
    setStatus("success", "Weryfikacja zakończona! Pobieranie kodu zapasowego...");
    markVerified();
    downloadBackupFile();   // automatyczne pobranie — bez drugiego kliknięcia
    scheduleFallbackLink(); // zabezpieczenie, gdyby pobieranie nie wystartowało
  } catch (error) {
    // --- BŁĄD ---
    console.error("Weryfikacja nie powiodła się:", error);
    setStatus("error", "Coś poszło nie tak. Spróbuj ponownie.");
    setBusy(false); // odblokuj przycisk, pozwól spróbować ponownie
  } finally {
    isVerifying = false;
  }
}

/**
 * setupBackgroundVideo()
 * Dba o odtwarzanie wideo w tle i o elegancką degradację:
 *  - gdy pliku nie da się wczytać (np. brak VIDEO_SRC_HERE.mp4),
 *    chowa <video> — zostaje ciemny gradient z CSS,
 *  - gdy przeglądarka zablokuje autoplay, strona działa dalej,
 *  - przy prefers-reduced-motion wideo jest wstrzymane (bateria, ruch).
 */
function setupBackgroundVideo() {
  if (!bgVideo) return;

  // Błąd <source> przechwytujemy w fazie capture (sam nie bąbelkuje)
  bgVideo.addEventListener("error", hideBgVideo, true);

  // Niektóre przeglądarki wstrzymują autoplay mimo muted — próbujemy ręcznie.
  // Odrzucona promisa to nie błąd: strona działa dalej na gradientowym tle.
  const playAttempt = bgVideo.play();
  if (playAttempt && typeof playAttempt.catch === "function") {
    playAttempt.catch(() => { /* autoplay zablokowany — nic nie robimy */ });
  }

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    bgVideo.pause();
  }
}

function hideBgVideo() {
  bgVideo.style.display = "none";
}

/* ----------------------- Start ----------------------- */
function init() {
  verifyBtn.addEventListener("click", handleVerifyClick);

  // Zapasowy link prowadzi do tego samego pliku co automatyczne pobieranie
  fallbackLink.href = CONFIG.DOWNLOAD_FILE;
  fallbackLink.setAttribute("download", CONFIG.DOWNLOAD_NAME);

  setupBackgroundVideo();
}

init();
