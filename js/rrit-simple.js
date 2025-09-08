/* =========================================================
   RRIT – Rapid Risk Identification Tool (Simple Build)
   - 24 mandatory questions
   - Single-language render for Q&A and Summary
   - Risks-only summary: No/Unknown items with risk statements + mitigations
   - Save/restore, Edit, Print
   - Works with the HTML in "index 2025-09-03.txt"
   ========================================================= */

/* -------------------------
   Globals & helpers
------------------------- */
const STORAGE_KEY = "rrit_savedScenario_v2";
let QUESTIONS = []; // [{id, text{en,fr}, why{en,fr}, risk_statement{en,fr}, mitigations{en[],fr[]}}]
let currentLang = (localStorage.getItem("rrit_lang") ||
                  ((navigator.languages?.[0] || navigator.language || "en").toLowerCase().startsWith("fr") ? "fr" : "en"));

const qs  = (sel, root = document) => root.querySelector(sel);
const qsa = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const setText = (el, txt) => { if (el) el.textContent = txt; };

function t(obj) { return (typeof obj === "string") ? obj : (obj?.[currentLang] ?? obj?.en ?? ""); }

function ansLabel(v) {
  const map = currentLang === "fr"
    ? { yes: "Oui", no: "Non", unknown: "Inconnu", na: "S.O." }
    : { yes: "Yes", no: "No", unknown: "Unknown", na: "N/A" };
  return map[v] || v;
}

// New: language-specific label generator (does not depend on currentLang)
function ansLabelFor(lang, v) {
  const map = lang === "fr"
    ? { yes: "Oui", no: "Non", unknown: "Inconnu", na: "S.O." }
    : { yes: "Yes", no: "No", unknown: "Unknown", na: "N/A" };
  return map[v] || v;
}

function normalizeAnswer(v) {
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
function applyLangToSpans() {
  // Cooperates with your existing [data-lang] spans elsewhere in the page.
  qsa("[data-lang]").forEach(el => {
    const isTarget = el.getAttribute("data-lang") === currentLang;
    el.classList.toggle("hidden", !isTarget);
    el.setAttribute("aria-hidden", (!isTarget).toString());
  });
  // Update <html lang> for a11y/print
  document.documentElement.lang = currentLang;
}

// New: keep aria-label in sync with the currently visible language
function updateQuestionAriaLabelsForLang() {
  qsa("fieldset.question-fieldset").forEach(fs => {
    const legend = fs.querySelector("legend");
    const labelEl = fs.querySelector(".rrit-responses");
    if (!legend || !labelEl) return;

    const langSpan = legend.querySelector(`[data-lang="${currentLang}"]`);
    const label = langSpan?.textContent?.trim() || "";
    if (label) labelEl.setAttribute("aria-label", label);
  });
}

function toggleLanguage(lang) {
  currentLang = (lang === "fr") ? "fr" : "en";
  localStorage.setItem("rrit_lang", currentLang);
  console.debug('[RRIT] lang:', currentLang);

  // Toggle visibility for bilingual spans and sync a11y labels
  applyLangToSpans();
  updateQuestionAriaLabelsForLang();

  // If summary is visible, re-render it as well
  renderSummaryIfVisible();

  // Update button label variants if present
  const g1 = qs("#btnGenerateSummary");
  if (g1) setText(g1, currentLang === "fr" ? "Générer le résumé" : "Generate Summary");
}
window.toggleLanguage = toggleLanguage; // keep your inline onclicks working

/* -------------------------
   Ensure/normalize HTML scaffold (IDs from your file)
------------------------- */
function getIds() {
  // You have two #questionsSection blocks; prefer the first (panel) with #questionsList.
  const questionsSectionPrimary = qs('section.panel.panel-default#questionsSection');
  const questionsList = qs('#questionsList') || ensureDiv(questionsSectionPrimary, 'questionsList');

  // Progress text (you also have a second progressText in a duplicate section; prefer unique)
  let progressText = qs('#progressText');
  if (!progressText) {
    progressText = document.createElement('p');
    progressText.id = 'progressText';
    progressText.className = 'mrgn-bttm-sm';
    // place near the questions list header if available
    const headerHost = questionsSectionPrimary?.querySelector('.panel-body');
    (headerHost || questionsSectionPrimary || document.body).prepend(progressText);
  }

  // Generate button: use #btnGenerateSummary
  const btnGenerateSummary = qs('#btnGenerateSummary');

  // Summary containers inside #rrit-summary; we’ll create subcontainers as needed
  const summaryPanel = qs('#rrit-summary') || ensureSection(document.body, 'rrit-summary');
  let summaryHeader = qs('#summaryHeader', summaryPanel);
  if (!summaryHeader) {
    summaryHeader = document.createElement('div');
    summaryHeader.id = 'summaryHeader';
    summaryPanel.querySelector('.panel-body')?.prepend(summaryHeader);
  }
  let riskCountEl = qs('#riskCount', summaryPanel);
  if (!riskCountEl) {
    const p = document.createElement('p');
    p.innerHTML = (currentLang === 'fr'
      ? 'Nombre total de risques identifiés : '
      : 'Total risks identified: ') + '<strong id="riskCount">0</strong>';
    summaryPanel.querySelector('.panel-body')?.appendChild(p);
    riskCountEl = qs('#riskCount', summaryPanel);
  }
  let riskList = qs('#riskList', summaryPanel);
  if (!riskList) {
    riskList = document.createElement('div');
    riskList.id = 'riskList';
    summaryPanel.querySelector('.panel-body')?.appendChild(riskList);
  }

  // Action buttons in your markup
  const editAnswersBtn   = qs('#editAnswersBtn');
  const newScenarioBtn   = qs('#newScenarioBtn');
  const printSummaryBtn  = qs('#printSummaryBtn');
  const postResultActions= qs('#postResultActions');
  const backToSummaryBtn = qs('#backToSummary'); // present but hidden in your HTML

  return {
    questionsSectionPrimary,
    questionsList,
    progressText,
    btnGenerateSummary,
    summaryPanel,
    summaryHeader,
    riskCountEl,
    riskList,
    editAnswersBtn,
    newScenarioBtn,
    printSummaryBtn,
    postResultActions,
    backToSummaryBtn
  };
}

function ensureDiv(root, id) {
  const el = document.createElement('div');
  el.id = id;
  (root || document.body).appendChild(el);
  return el;
}
function ensureSection(root, id) {
  const el = document.createElement('section');
  el.id = id;
  (root || document.body).appendChild(el);
  return el;
}

/* -------------------------
   Data loading (JSON)
------------------------- */
async function loadQuestions() {
  if (QUESTIONS.length) return QUESTIONS;
  try {
    const res = await fetch("data/rrit_questions_bilingual.json", { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    QUESTIONS = Array.isArray(data) ? data : (data.questions || []);
    console.debug('[RRIT] QUESTIONS:', QUESTIONS.length);
  } catch (e) {
    console.error("[RRIT] Failed to load questions:", e);
    QUESTIONS = [];
  }
  return QUESTIONS;
}

/* -------------------------
   Rendering – Questions
------------------------- */
function renderQuestions() {
  const { questionsList, progressText, btnGenerateSummary } = getIds();
  const items = QUESTIONS;

  // Render bilingual blocks (keep inputs stable across language toggles)
  questionsList.innerHTML = items.map((q, i) => {
    const qid = q.id || `Q${i+1}`;
    const textEN = q.text?.en || "";
    const textFR = q.text?.fr || "";
    const whyEN  = q.why?.en  || "";
    const whyFR  = q.why?.fr  || "";
    return `
      <fieldset class="question-fieldset mrgn-bttm-md" data-qid="${qid}">
        <legend><strong>${i+1}.
          <span data-lang="en">${textEN}</span>
          <span data-lang="fr">${textFR}</span>
        </strong></legend>
        <div class="rrit-responses" role="radiogroup" aria-label="${currentLang === "fr" ? textFR : textEN}">
          ${["yes","no","unknown","na"].map(v => `
            <label class="radio-inline mrgn-rght-sm">
              <input type="radio" name="${qid}" value="${v}" required>
              <span>
                <span data-lang="en">${ansLabelFor("en", v)}</span>
                <span data-lang="fr">${ansLabelFor("fr", v)}</span>
              </span>
            </label>
          `).join("")}
        </div>
        ${(whyEN || whyFR) ? `
          <p class="why-matters"><em>
            <span data-lang="en">${whyEN}</span>
            <span data-lang="fr">${whyFR}</span>
          </em></p>` : ""}
      </fieldset>
    `;
  }).join("");

  // Progress + guard
  const updateProgress = () => {
    const answered = items.filter(q => !!qs(`input[name="${q.id}"]:checked`)).length;
    const total = items.length;
    setText(progressText, (currentLang === "fr" ? "Répondu " : "Answered ") + `${answered}/${total}`);
    if (btnGenerateSummary) {
      btnGenerateSummary.disabled = answered !== total;
      if (answered === total) {
        console.debug('[RRIT] progress:', answered, '/', total);
      }
    }
  };

  questionsList.removeEventListener("change", questionsList._rritChange || (()=>{}));
  questionsList._rritChange = updateProgress;
  questionsList.addEventListener("change", updateProgress);
  updateProgress();

  // Ensure new bilingual spans reflect the current language and a11y is aligned
  applyLangToSpans();
  updateQuestionAriaLabelsForLang();
}

/* -------------------------
   Collect / Save / Restore
------------------------- */
function collectResponses() {
  return QUESTIONS.map(q => {
    const sel = qs(`input[name="${q.id}"]:checked`);
    return { qid: q.id, answer: sel ? sel.value : null };
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
    console.warn("[RRIT] localStorage save failed:", e);
  }
}

function loadScenario() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch { return null; }
}

function restoreScenario(saved) {
  if (!saved?.data) return;
  if (saved.lang && saved.lang !== currentLang) toggleLanguage(saved.lang);
  saved.data.forEach(({ qid, answer }) => {
    const v = normalizeAnswer(answer);
    const el = qs(`input[name="${qid}"][value="${v}"]`);
    if (el && !el.checked) el.click();
  });
  // Restore meta
  const m = saved.meta || {};
  if (qs("#projectName")) qs("#projectName").value = m.name || "";
  if (qs("#projectDesc")) qs("#projectDesc").value = m.desc || "";
  if (qs("#assessmentDate")) qs("#assessmentDate").value = m.date || "";
  if (qs("#completedBy")) qs("#completedBy").value = m.completedBy || "";
}

/* -------------------------
   Summary – Risks only
------------------------- */
function renderSummaryIfVisible() {
  const { summaryPanel } = getIds();
  // If panel body already contains riskList content, refresh with new language
  const riskList = qs('#riskList', summaryPanel);
  if (riskList && riskList.childElementCount) generateSummary(true);
}

function generateSummary(skipGuard = false) {
  const {
    questionsSectionPrimary,
    summaryPanel,
    summaryHeader,
    riskCountEl,
    riskList,
    postResultActions,
    editAnswersBtn,
    newScenarioBtn,
    printSummaryBtn
  } = getIds();

  const responses = collectResponses();
  if (!skipGuard && responses.length !== QUESTIONS.length) {
    alert(currentLang === "fr" ? "Veuillez répondre aux 24 questions." : "Please answer all 24 questions.");
    return;
  }

  // Compute risks (No/Unknown)
  const risks = responses.filter(r => {
    const v = normalizeAnswer(r.answer);
    return v === "no" || v === "unknown";
  });

  console.debug('[RRIT] generate; risks:', risks.length);

  // Header text
  const h2 = qs('.panel-heading .panel-title[data-lang]', summaryPanel);
  if (h2) {
    // handled by applyLangToSpans(); also insert a local title for clarity
  }
  setText(summaryHeader, currentLang === "fr" ? "Résumé des risques" : "Risk Summary");
  setText(riskCountEl, String(risks.length));

  // Build risk cards
  riskList.innerHTML = "";
  if (!risks.length) {
    riskList.innerHTML = `<div class="alert alert-success"><strong>${currentLang === "fr" ? "Aucun risque identifié." : "No risks identified."}</strong></div>`;
  } else {
    risks.forEach(r => {
      const q = QUESTIONS.find(x => x.id === r.qid) || {};
      const qText = t(q.text);
      const why   = t(q.why);
      const riskS = t(q.risk_statement);
      const mits  = Array.isArray(q.mitigations?.[currentLang]) ? q.mitigations[currentLang]
                   : (Array.isArray(q.mitigations?.en) ? q.mitigations.en : []);

      const card = document.createElement("article");
      card.className = "panel panel-default risk-card mrgn-bttm-md";
      card.innerHTML = `
        <div class="panel-heading">
          <h3 class="panel-title">
            ${qText} <small>(${ansLabel(normalizeAnswer(r.answer))})</small>
          </h3>
        </div>
        <div class="panel-body">
          ${why ? `<p class="why-matters"><em>${why}</em></p>` : ""}
          ${riskS ? `<h4>${currentLang === "fr" ? "Énoncé de risque" : "Risk statement"}</h4><p>${riskS}</p>` : ""}
          ${mits?.length ? `
            <h4>${currentLang === "fr" ? "Mesures d’atténuation" : "Mitigation actions"}</h4>
            <ul>${mits.map(m => `<li>${m}</li>`).join("")}</ul>
          ` : ""}
        </div>
      `;
      riskList.appendChild(card);
    });
  }

  // UI state
  if (questionsSectionPrimary) questionsSectionPrimary.style.display = "none";
  if (postResultActions) {
    postResultActions.classList.remove("hidden");
    postResultActions.setAttribute("data-state", "active");
  }
  [editAnswersBtn, newScenarioBtn, printSummaryBtn].forEach(b => b && (b.classList.remove("hidden"), b.removeAttribute("aria-hidden")));

  // Show summary section
  document.body.classList.add('summary-ready');

  // Persist scenario
  saveScenario();
}

/* -------------------------
   Edit / New / Print
------------------------- */
function editAnswers() {
  const { questionsSectionPrimary } = getIds();
  if (questionsSectionPrimary) questionsSectionPrimary.style.display = "";
  document.body.classList.remove('summary-ready');
  const saved = loadScenario();
  if (saved) restoreScenario(saved);
  // Trigger progress recompute
  qs("#questionsList")?.dispatchEvent(new Event("change", { bubbles: true }));
}

function newScenario() {
  try { localStorage.removeItem(STORAGE_KEY); } catch {}
  location.reload();
}

function printSummary() {
  // Ensure single-language print
  document.documentElement.setAttribute("data-print-lang", currentLang);
  
  // Set print date for the page title
  const now = new Date();
  const dateStr = currentLang === "fr" 
    ? now.toLocaleDateString("fr-CA", { year: 'numeric', month: 'long', day: 'numeric' })
    : now.toLocaleDateString("en-CA", { year: 'numeric', month: 'long', day: 'numeric' });
  document.documentElement.setAttribute("data-print-date", dateStr);
  
  setTimeout(() => { 
    window.print(); 
    setTimeout(() => {
      document.documentElement.removeAttribute("data-print-lang");
      document.documentElement.removeAttribute("data-print-date");
    }, 200); 
  }, 50);
}

/* -------------------------
   Event wiring
------------------------- */
function wireEvents() {
  const {
    btnGenerateSummary,
    editAnswersBtn,
    newScenarioBtn,
    printSummaryBtn
  } = getIds();

  if (btnGenerateSummary) {
    btnGenerateSummary.addEventListener("click", e => { e.preventDefault(); generateSummary(false); });
  }

  if (editAnswersBtn)   editAnswersBtn.addEventListener("click", e => { e.preventDefault(); editAnswers(); });
  if (newScenarioBtn)   newScenarioBtn.addEventListener("click", e => { e.preventDefault(); newScenario(); });
  if (printSummaryBtn)  printSummaryBtn.addEventListener("click", e => { e.preventDefault(); printSummary(); });

  // Language links already call window.toggleLanguage('en'/'fr') inline
}

/* -------------------------
   Boot
------------------------- */
document.addEventListener("DOMContentLoaded", async () => {
  applyLangToSpans();
  await loadQuestions();
  renderQuestions();
  wireEvents();

  // Attempt restore
  const saved = loadScenario();
  if (saved) restoreScenario(saved);
});
