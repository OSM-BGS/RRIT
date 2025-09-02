/* =========================================================
   RRIT – Rapid Risk Identification Tool
   Clean refactor for 24Q, single-language render, risks-only summary
   ========================================================= */

/* =========================
   Global state & utilities
   ========================= */

window.QUESTIONS = [];              // [{ id, text{en,fr}, why{en,fr}, risk_statement{en,fr}, mitigations{en[],fr[]} }]
const STORAGE_KEY = "rrit_savedScenario_v2";
let currentLang = (localStorage.getItem("rrit_lang") ||
                  (navigator.language||"en").toLowerCase().startsWith("fr") ? "fr" : "en");

/* Shortcuts */
const qs  = (s, r=document) => r.querySelector(s);
const qsa = (s, r=document) => Array.from(r.querySelectorAll(s));
const setTxt = (el, txt) => { if (el) el.textContent = txt; };

/* Localize helpers */
function t(obj) {
  if (obj == null) return "";
  if (typeof obj === "string") return obj;
  return obj[currentLang] ?? obj.en ?? "";
}
function ansLabel(v) {
  const L = currentLang === "fr"
    ? { yes:"Oui", no:"Non", unknown:"Inconnu", na:"S.O." }
    : { yes:"Yes", no:"No", unknown:"Unknown", na:"N/A" };
  return L[v] || v;
}
function normalizeAnswer(v) {
  const s = (v||"").toString().trim().toLowerCase();
  if (["yes","oui","y","o"].includes(s)) return "yes";
  if (["no","non","n"].includes(s)) return "no";
  if (["unknown","inconnu","ns","n/s","dontknow","don't know"].includes(s)) return "unknown";
  if (["na","n/a","not applicable","s.o.","so","sans objet"].includes(s)) return "na";
  return s;
}

/* =========================
   Data loading
   ========================= */

async function loadQuestions() {
  if (window.QUESTIONS.length) return window.QUESTIONS;
  try {
    // Accept either an array or {questions:[…]}
    const res = await fetch("data/rrit_questions_bilingual.json", { cache: "no-store" });
    if (!res.ok) throw new Error("HTTP "+res.status);
    const data = await res.json();
    window.QUESTIONS = Array.isArray(data) ? data : (data.questions || []);
  } catch (e) {
    console.error("[RRIT] Failed to load questions:", e);
    window.QUESTIONS = [];
  }
  return window.QUESTIONS;
}

/* =========================
   Render – questions (single language)
   ========================= */

function ensureQuestionsScaffold() {
  // Minimal scaffold if host HTML doesn’t have containers
  let wrap = qs("#questionsSection");
  if (!wrap) {
    wrap = document.createElement("section");
    wrap.id = "questionsSection";
    document.body.prepend(wrap);
  }
  if (!qs("#progressText", wrap)) {
    const p = document.createElement("p");
    p.id = "progressText";
    p.className = "mrgn-bttm-sm";
    wrap.appendChild(p);
  }
  if (!qs("#questionsList", wrap)) {
    const d = document.createElement("div");
    d.id = "questionsList";
    wrap.appendChild(d);
  }
  if (!qs("#btnGenerateSummary")) {
    const b = document.createElement("button");
    b.id = "btnGenerateSummary";
    b.className = "btn btn-primary mrgn-tp-lg";
    b.disabled = true;
    b.textContent = currentLang === "fr" ? "Générer le résumé" : "Generate summary";
    wrap.appendChild(b);
  }
}

function renderQuestions() {
  ensureQuestionsScaffold();
  const list = qs("#questionsList");
  const L = currentLang;
  const items = window.QUESTIONS;

  list.innerHTML = items.map((q, idx) => {
    const qid = q.id || `Q${idx+1}`;
    const qText = t(q.text);
    const why   = t(q.why);
    return `
      <fieldset class="question-fieldset" data-qid="${qid}">
        <legend><strong>${idx+1}. ${qText}</strong></legend>
        <div class="rrit-responses" role="radiogroup" aria-label="${qText}">
          ${["yes","no","unknown","na"].map(v => `
            <label class="radio-inline mrgn-rght-sm">
              <input type="radio" name="${qid}" value="${v}" required>
              <span>${ansLabel(v)}</span>
            </label>`).join("")}
        </div>
        ${why ? `<p class="why-matters"><em>${why}</em></p>` : ""}
      </fieldset>
    `;
  }).join("");

  // progress + enablement
  const onChange = () => {
    const total = items.length;
    const answered = items.filter(q => !!qs(`input[name="${q.id}"]:checked`)).length;
    setTxt(qs("#progressText"), (L==="fr" ? "Répondu " : "Answered ") + `${answered}/${total}`);
    const btn = qs("#btnGenerateSummary");
    if (btn) btn.disabled = answered !== total;
  };
  list.removeEventListener("change", list._rritOnChange || (()=>{}));
  list._rritOnChange = onChange;
  list.addEventListener("change", onChange);
  onChange();
}

/* =========================
   Collect / Save / Restore
   ========================= */

function collectResponses() {
  return window.QUESTIONS.map(q => {
    const el = qs(`input[name="${q.id}"]:checked`);
    return { qid: q.id, answer: el ? el.value : null };
  }).filter(r => r.answer !== null);
}

function saveScenario() {
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
    console.warn("[RRIT] localStorage save failed", e);
  }
}

function loadScenario() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function restoreScenario(saved) {
  if (!saved?.data) return;
  // language preference
  if (saved.lang) toggleLanguage(saved.lang, /*noRecurse*/true);
  // restore inputs
  saved.data.forEach(({ qid, answer }) => {
    const inp = qs(`input[name="${qid}"][value="${normalizeAnswer(answer)}"]`);
    if (inp && !inp.checked) inp.click();
  });

  // restore meta
  const m = saved.meta || {};
  if (qs("#projectName")) qs("#projectName").value = m.name || "";
  if (qs("#projectDesc")) qs("#projectDesc").value = m.desc || "";
  if (qs("#assessmentDate")) qs("#assessmentDate").value = m.date || "";
  if (qs("#completedBy")) qs("#completedBy").value = m.completedBy || "";
}

/* =========================
   Summary – risks only
   ========================= */

function ensureSummaryScaffold() {
  let sec = qs("#summarySection");
  if (!sec) {
    sec = document.createElement("section");
    sec.id = "summarySection";
    sec.className = "hidden";
    document.body.appendChild(sec);
  }
  if (!qs("#summaryTitle", sec)) {
    const h = document.createElement("h2");
    h.id = "summaryTitle";
    sec.appendChild(h);
  }
  if (!qs("#riskCountLine", sec)) {
    const p = document.createElement("p");
    p.id = "riskCountLine";
    sec.appendChild(p);
  }
  if (!qs("#riskList", sec)) {
    const d = document.createElement("div");
    d.id = "riskList";
    d.className = "panel-group";
    sec.appendChild(d);
  }
}

function summaryIsReady() {
  return collectResponses().length === window.QUESTIONS.length;
}

function generateSummary() {
  if (!summaryIsReady()) {
    alert(currentLang==="fr" ? "Veuillez répondre aux 24 questions." : "Please answer all 24 questions.");
    return;
  }
  ensureSummaryScaffold();
  
  // Clean up any old elements that might conflict
  const oldRiskCount = qs("#riskCount");
  if (oldRiskCount && oldRiskCount.parentElement) {
    oldRiskCount.parentElement.remove();
  }

  const responses = collectResponses();
  const risks = responses.filter(r => {
    const n = normalizeAnswer(r.answer);
    return n === "no" || n === "unknown";
  });

  // Header - using t() for bilingual support
  setTxt(qs("#summaryTitle"), t(currentLang==="fr" ? "Résumé des risques" : "Risk Summary"));
  
  // Count line - bilingual format as specified
  const riskCountLine = qs("#riskCountLine");
  if (riskCountLine) {
    riskCountLine.textContent = currentLang==="fr" 
      ? `Nombre total de risques identifiés : ${risks.length}`
      : `Total risks identified: ${risks.length}`;
  }

  // List
  const list = qs("#riskList");
  const items = risks.map(r => {
    const q = window.QUESTIONS.find(x => x.id === r.qid) || {};
    const qText = t(q.text);
    const riskS = t(q.risk_statement);
    const mits  = t(q.mitigations);
    const mitsList = Array.isArray(mits) ? mits : (mits && typeof mits === 'object' ? (mits[currentLang] || mits.en || []) : []);

    return `
      <div class="panel panel-default">
        <div class="panel-heading">
          <h4 class="panel-title">
            ${qText}
            <small>(${ansLabel(normalizeAnswer(r.answer))})</small>
          </h4>
        </div>
        <div class="panel-body">
          ${riskS ? `<h4>${currentLang==="fr" ? "Énoncé de risque" : "Risk statement"}</h4><p>${riskS}</p>` : ""}
          ${Array.isArray(mitsList) && mitsList.length ? `
            <h4>${currentLang==="fr" ? "Mesures d’atténuation" : "Mitigation actions"}</h4>
            <ul>${mitsList.map(m => `<li>${m}</li>`).join("")}</ul>
          ` : ""}
        </div>
      </div>
    `;
  }).join("");

  list.innerHTML = risks.length === 0
    ? `<p><strong>${currentLang==="fr" ? "Aucun risque identifié" : "No risks identified"}</strong></p>`
    : items;

  // Show summary section
  const sum = qs("#summarySection");
  if (sum) {
    sum.classList.remove("hidden");
    sum.style.display = "block";
  }

  // Hide questions section to focus attention (optional)
  const qsec = qs("#questionsSection");
  if (qsec) qsec.style.display = "none";

  // Persist
  saveScenario();
}

/* =========================
   Summary visibility helper
   ========================= */

function renderSummaryIfVisible() {
  const sum = qs("#summarySection");
  if (sum && sum.offsetParent !== null) {
    generateSummary(); // re-renders with the current language
  }
}

/* =========================
   Language toggle (re-render)
   ========================= */

function toggleLanguage(lang, noRecurse=false) {
  currentLang = (lang === "fr") ? "fr" : "en";
  document.documentElement.lang = currentLang;
  localStorage.setItem("rrit_lang", currentLang);

  // Save current responses before re-rendering questions
  const savedResponses = collectResponses();
  
  renderQuestions();
  
  // Restore responses after re-rendering
  savedResponses.forEach(({ qid, answer }) => {
    const inp = qs(`input[name="${qid}"][value="${normalizeAnswer(answer)}"]`);
    if (inp && !inp.checked) inp.checked = true;
  });
  
  // Trigger progress update after restoring responses
  const onChange = qs("#questionsList")?._rritOnChange;
  if (onChange) onChange();
  
  renderSummaryIfVisible();

  // Update button labels if present
  const gen = qs("#btnGenerateSummary");
  if (gen) gen.textContent = currentLang==="fr" ? "Générer le résumé" : "Generate summary";

  if (!noRecurse) console.log("[RRIT] Language switched to:", currentLang);
}

/* =========================
   Print (single-language)
   ========================= */

function printSummary() {
  // Ensure language attribute is set correctly for the print
  document.documentElement.setAttribute("data-print-lang", currentLang);
  setTimeout(() => {
    window.print();
    setTimeout(() => document.documentElement.removeAttribute("data-print-lang"), 250);
  }, 50);
}

/* =========================
   Edit flow
   ========================= */

function editAnswers() {
  // Show questions again and restore saved selections
  const qsec = qs("#questionsSection");
  if (qsec) qsec.style.display = "";
  const saved = loadScenario();
  if (saved) restoreScenario(saved);
  // Recompute progress
  const evt = new Event("change", { bubbles: true });
  qs("#questionsList")?.dispatchEvent(evt);
}

/* =========================
   Event wiring & boot
   ========================= */

function wireEvents() {
  const map = {
    "#btnGenerateSummary": generateSummary,
    "#printSummaryBtn": printSummary,
    "#editAnswersBtn": editAnswers,
    "#newScenarioBtn": () => { localStorage.removeItem(STORAGE_KEY); location.reload(); }
  };
  Object.entries(map).forEach(([sel, fn]) => {
    const el = qs(sel);
    if (el) {
      const clone = el.cloneNode(true);
      el.replaceWith(clone);
      clone.addEventListener("click", (e) => { e.preventDefault(); fn(); });
    }
  });

  // Optional language switchers (if present)
  const langEN = qs('[data-action="lang-en"]') || qs('a[onclick*="toggleLanguage(\'en\')"]');
  const langFR = qs('[data-action="lang-fr"]') || qs('a[onclick*="toggleLanguage(\'fr\')"]');
  if (langEN) { langEN.addEventListener("click", e => { e.preventDefault(); toggleLanguage("en"); }); }
  if (langFR) { langFR.addEventListener("click", e => { e.preventDefault(); toggleLanguage("fr"); }); }
}

document.addEventListener("DOMContentLoaded", async () => {
  await loadQuestions();
  document.documentElement.lang = currentLang;
  renderQuestions();
  wireEvents();

  // Try to restore a saved scenario (optional)
  const saved = loadScenario();
  if (saved) restoreScenario(saved);
});
