/* =========================================================
   RRIT Core – Shared state and helpers for Simple/Custom builds
   - Consolidates duplicated globals, helpers, and storage logic
   - ES module; consumers should import what they need
   - Dispatches 'rrit:lang-changed' for variants to re-render
   ========================================================= */

/* -------------------------
   Shared state
------------------------- */
export const STORAGE_KEY = "rrit_savedScenario_v2";

// QUESTIONS is expected to be populated by the variant or data loader
export let QUESTIONS = [];

/** Current language code: 'en' or 'fr' */
export let currentLang = (() => {
  try {
    const saved = localStorage.getItem("rrit_lang");
    if (saved === "fr" || saved === "en") return saved;
  } catch {}
  const lang = (navigator.languages?.[0] || navigator.language || "en")
    .toLowerCase()
    .startsWith("fr") ? "fr" : "en";
  return lang;
})();

/* -------------------------
   DOM helpers
------------------------- */
export const qs  = (sel, root = document) => root.querySelector(sel);
export const qsa = (sel, root = document) => Array.from(root.querySelectorAll(sel));
export const setText = (el, txt) => { if (el) el.textContent = txt; };

/* -------------------------
   i18n helpers
------------------------- */
export function t(obj) {
  return (typeof obj === "string") ? obj : (obj?.[currentLang] ?? obj?.en ?? "");
}

export function ansLabel(v) {
  const map = currentLang === "fr"
    ? { yes: "Oui", no: "Non", unknown: "Inconnu", na: "S.O." }
    : { yes: "Yes", no: "No", unknown: "Unknown", na: "N/A" };
  return map[v] || v;
}

// Language-agnostic label generator
export function ansLabelFor(lang, v) {
  const map = lang === "fr"
    ? { yes: "Oui", no: "Non", unknown: "Inconnu", na: "S.O." }
    : { yes: "Yes", no: "No", unknown: "Unknown", na: "N/A" };
  return map[v] || v;
}

export function normalizeAnswer(v) {
  const s = String(v || "").trim().toLowerCase();
  if (["oui","o","yes","y"].includes(s)) return "yes";
  if (["non","no","n"].includes(s)) return "no";
  if (["unknown","inconnu","dontknow","don't know"].includes(s)) return "unknown";
  if (["na","n/a","so","s.o.","not applicable"].includes(s)) return "na";
  return s;
}

/* -------------------------
   Language handling
------------------------- */
export function applyLangToSpans() {
  // Cooperates with existing [data-lang] spans elsewhere in the page
  qsa("[data-lang]").forEach(el => {
    const isTarget = el.getAttribute("data-lang") === currentLang;
    el.classList.toggle("hidden", !isTarget);
    el.setAttribute("aria-hidden", (!isTarget).toString());
  });
  // Update <html lang> for a11y/print
  document.documentElement.lang = currentLang;
}

/**
 * Keep aria-labels for questions aligned with the current language.
 * Variants can call this after re-rendering or on 'rrit:lang-changed'.
 */
export function updateQuestionAriaLabelsForLang() {
  qsa("fieldset.question-fieldset").forEach(fs => {
    const legend = fs.querySelector("legend");
    const labelEl = fs.querySelector(".rrit-responses");
    if (!legend || !labelEl) return;

    const langSpan = legend.querySelector(`[data-lang="${currentLang}"]`);
    const label = langSpan?.textContent?.trim() || "";
    if (label) labelEl.setAttribute("aria-label", label);
  });
}

/**
 * Set language and notify listeners so variants can re-render their views.
 */
export function setLanguage(lang) {
  const next = (lang === "fr") ? "fr" : "en";
  if (next === currentLang) return;
  currentLang = next;
  try { localStorage.setItem("rrit_lang", currentLang); } catch {}
  applyLangToSpans();
  // Notify any variant-specific renderers
  document.dispatchEvent(new CustomEvent("rrit:lang-changed", { detail: { lang: currentLang }}));
}

/* -------------------------
   Collect / Save / Restore
------------------------- */
export function collectResponses() {
  return QUESTIONS.map(q => {
    const sel = qs(`input[name="${q.id}"]:checked`);
    return { qid: q.id, answer: sel ? sel.value : null };
  }).filter(r => r.answer !== null);
}

export function saveScenario() {
  const payload = {
    version: "v2",
    lang: currentLang,
    data: collectResponses(),
    meta: {
      name: qs("#projectName")?.value || "",
      desc: qs("#projectDesc")?.value || "",
      date: qs("#assessmentDate")?.value || new Date().toISOString().slice(0,10),
      completedBy: qs("#completedBy")?.value || ""
    },
    savedAt: Date.now()
  };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch (e) {
    console.warn("[RRIT] localStorage save failed:", e);
  }
}

export function loadScenario() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Restore saved answers and meta. If the saved language differs,
 * setLanguage(saved.lang) will be called to trigger re-renders.
 */
export function restoreScenario(saved) {
  if (!saved?.data) return;

  if (saved.lang && saved.lang !== currentLang) setLanguage(saved.lang);

  saved.data.forEach(({ qid, answer }) => {
    const v = normalizeAnswer(answer);
    const el = qs(`input[name="${qid}"][value="${v}"]`);
    if (el && !el.checked) el.click();
  });

  const m = saved.meta || {};
  if (qs("#projectName")) qs("#projectName").value = m.name || "";
  if (qs("#projectDesc")) qs("#projectDesc").value = m.desc || "";
  if (qs("#assessmentDate")) qs("#assessmentDate").value = m.date || "";
  if (qs("#completedBy")) qs("#completedBy").value = m.completedBy || "";
}

/* -------------------------
   Public state setters (optional)
------------------------- */
/** Replace the QUESTIONS array with new content */
export function setQuestions(list) {
  QUESTIONS = Array.isArray(list) ? list : [];
}

/* -------------------------
   One-time startup helpers
------------------------- */
export function initCoreLanguage() {
  applyLangToSpans();
  document.documentElement.lang = currentLang;
}
