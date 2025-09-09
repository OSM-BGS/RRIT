/* =========================================================
   RRIT – Rapid Risk Identification Tool (Unified Build)
   - 24+ mandatory questions (length of QUESTIONS)
   - Bilingual UI via [data-lang] spans
   - Risks-only summary (No/Unknown)
   - Save/restore, Edit, New Scenario, Print
   - Single bootstrap: load questions, then init once
   ========================================================= */

/* -------------------------
   Globals & shared state
------------------------- */
const STORAGE_KEY = "rrit_savedScenario_v2";

// QUESTIONS must be an array of:
// { id, text:{en,fr}, why:{en,fr}, risk_statement:{en,fr}, mitigations:{en:[],fr:[]} }
let QUESTIONS = Array.isArray(window.RRIT_QUESTIONS) ? window.RRIT_QUESTIONS : [];

// Load questions from JSON (relative path so it works under /RRIT/)
async function loadQuestions() {
  if (QUESTIONS.length) return QUESTIONS;
  try {
    const res = await fetch("data/rrit_questions_bilingual.json", { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    QUESTIONS = Array.isArray(data) ? data : (data.questions || []);
  } catch (e) {
    console.error("[RRIT] Failed to load questions:", e);
    QUESTIONS = [];
  }
  return QUESTIONS;
}

let currentLang = (() => {
  try {
    const saved = localStorage.getItem("rrit_lang");
    if (saved === "fr" || saved === "en") return saved;
  } catch {}
  const sys = (navigator.languages?.[0] || navigator.language || "en").toLowerCase();
  return sys.startsWith("fr") ? "fr" : "en";
})();

/* -------------------------
   DOM helpers
------------------------- */
const qs  = (sel, root) => { try { return (root || document).querySelector(sel); } catch { return null; } };
const qsa = (sel, root) => { try { return Array.from((root || document).querySelectorAll(sel)); } catch { return []; } };
const setText = (el, txt) => { if (el) el.textContent = txt; };

/* -------------------------
   i18n helpers
------------------------- */
function t(obj) { return (typeof obj === "string") ? obj : (obj?.[currentLang] ?? obj?.en ?? ""); }
function ansLabel(v) {
  const map = currentLang === "fr"
    ? { yes: "Oui", no: "Non", unknown: "Inconnu", na: "S.O." }
    : { yes: "Yes", no: "No", unknown: "Unknown", na: "N/A" };
  return map[v] || v;
}
// Language-agnostic label generator
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
  qsa("[data-lang]").forEach(el => {
    const isTarget = el.getAttribute("data-lang") === currentLang;
    el.classList.toggle("hidden", !isTarget);
    el.setAttribute("aria-hidden", (!isTarget).toString());
  });
  document.documentElement.lang = currentLang;
}
function updateQuestionAriaLabelsForLang() {
  qsa("fieldset.question-fieldset").forEach(fs => {
    const legend = fs?.querySelector?.("legend");
    const labelEl = fs?.querySelector?.(".rrit-responses");
    if (!legend || !labelEl) return;
    const langSpan = legend.querySelector(`[data-lang="${currentLang}"]`);
    const label = langSpan?.textContent?.trim() || "";
    if (label) labelEl.setAttribute("aria-label", label);
  });
}
function toggleLanguage(lang) {
  currentLang = (lang === "fr") ? "fr" : "en";
  try { localStorage.setItem("rrit_lang", currentLang); } catch {}
  applyLangToSpans();
  renderQuestions();            // re-render Q&A in selected language
  renderSummaryIfVisible();     // if summary is visible, refresh content
  const g1 = qs("#btnGenerateSummary");
  if (g1) setText(g1, currentLang === "fr" ? "Générer le résumé" : "Generate Summary");
}
window.toggleLanguage = toggleLanguage; // preserve inline onclick usage

/* -------------------------
   Robust element lookup
------------------------- */
function getIds() {
  // Prefer the first #questionsSection that contains #questionsList
  const allSections = qsa("#questionsSection");
  let questionsSectionPrimary =
    allSections.find(sec => qs("#questionsList", sec)) ||
    allSections[0] ||
    qs("#questionsSection");

  const questionsList = qs("#questionsList", questionsSectionPrimary) || qs("#questionsList");
  const progressText = qs("#progressText") || qs('[data-role="progressText"]');

  // Summary area: support current markup (#rrit-summary) and legacy fallbacks
  const summaryPanel =
    qs("#rrit-summary") ||
    qs("#summaryPanel") ||
    qs("#summarySection") ||
    qs('[data-role="summaryPanel"]');

  // Optional dedicated header element (we avoid overwriting bilingual <h2> titles)
  const summaryHeader =
    (summaryPanel && (qs("#summaryHeader", summaryPanel) || qs('[data-role="summaryHeader"]', summaryPanel))) || null;

  // Prefer scoped lookups; fall back to global by id if needed
  const riskCountEl =
    (summaryPanel && (qs("#riskCount", summaryPanel) || qs('[data-role="riskCount"]', summaryPanel))) ||
    qs("#riskCount") ||
    qs('[data-role="riskCount"]');

  const riskList =
    (summaryPanel && (qs("#riskList", summaryPanel) || qs('[data-role="riskList"]', summaryPanel))) ||
    qs("#riskList") ||
    qs('[data-role="riskList"]');

  // Actions
  const btnGenerateSummary = qs("#btnGenerateSummary") || qs('[data-role="btnGenerateSummary"]');
  const editAnswersBtn = qs("#editAnswersBtn") || qs('[data-role="editAnswersBtn"]');
  const newScenarioBtn = qs("#newScenarioBtn") || qs('[data-role="newScenarioBtn"]');
  const printSummaryBtn = qs("#printSummaryBtn") || qs('[data-role="printSummaryBtn"]');
  const postResultActions = qs("#postResultActions") || qs('[data-role="postResultActions"]');

  return {
    questionsSectionPrimary,
    questionsList,
    progressText,
    summaryPanel,
    summaryHeader,
    riskCountEl,
    riskList,
    postResultActions,
    btnGenerateSummary,
    editAnswersBtn,
    newScenarioBtn,
    printSummaryBtn
  };
}

/* -------------------------
   Render: Questions
------------------------- */
function renderQuestions() {
  const { questionsList, questionsSectionPrimary, btnGenerateSummary, progressText } = getIds();
  if (!questionsList || !questionsSectionPrimary) return;

  questionsSectionPrimary.classList.remove("hidden");
  const summaryPanel = getIds().summaryPanel;
  if (summaryPanel) summaryPanel.classList.add("hidden");

  const items = QUESTIONS || [];
  questionsList.innerHTML = items.map(q => {
    const qTextEn = q.text?.en || "";
    const qTextFr = q.text?.fr || qTextEn;
    const whyEn = q.why?.en || "";
    const whyFr = q.why?.fr || whyEn;
    const name = q.id;

    const inputs = ["yes","no","unknown","na"].map(v => {
      const id = `${name}_${v}`;
      return `
        <label class="rrit-choice">
          <input type="radio" name="${name}" id="${id}" value="${v}" />
          <span>
            <span data-lang="en">${ansLabelFor("en", v)}</span>
            <span data-lang="fr">${ansLabelFor("fr", v)}</span>
          </span>
        </label>`;
    }).join("");

    return `
      <fieldset class="question-fieldset">
        <legend>
          <span data-lang="en">${qTextEn}</span>
          <span data-lang="fr">${qTextFr}</span>
        </legend>
        <div class="rrit-why">
          <span data-lang="en">${whyEn}</span>
          <span data-lang="fr">${whyFr}</span>
        </div>
        <div class="rrit-responses" role="group" aria-label="">
          ${inputs}
        </div>
      </fieldset>
    `;
  }).join("");

  // Language visibility + a11y
  applyLangToSpans();
  updateQuestionAriaLabelsForLang();

  // Progress + guard
  const total = items.length;
  const updateProgress = () => {
    const answered = items.filter(q => !!qs(`input[name="${q.id}"]:checked`)).length;
    if (progressText) {
      setText(progressText, (currentLang === "fr" ? "Répondu " : "Answered ") + `${answered}/${total}`);
    }
    if (btnGenerateSummary) {
      btnGenerateSummary.disabled = answered !== total;
    }
  };

  questionsList.removeEventListener("change", questionsList._rritChange || (()=>{}));
  questionsList._rritChange = updateProgress;
  questionsList.addEventListener("change", updateProgress);
  updateProgress();
}

/* -------------------------
   Collect / Save / Restore
------------------------- */
function collectResponses() {
  return (QUESTIONS || []).map(q => {
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
  } catch {
    return null;
  }
}

function restoreScenario(saved) {
  if (!saved?.data) return;
  if (saved.lang && saved.lang !== currentLang) toggleLanguage(saved.lang);

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
   Summary – Risks only
------------------------- */
function renderSummaryIfVisible() {
  const { summaryPanel } = getIds();
  const riskList = summaryPanel ? qs("#riskList", summaryPanel) : null;
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
  if (!skipGuard && responses.length !== (QUESTIONS || []).length) {
    alert(currentLang === "fr" ? "Veuillez répondre à toutes les questions." : "Please answer all questions.");
    return;
  }

  // Compute risks (No/Unknown) and map to question records safely
  const risks = responses
    .filter(r => r.answer === "no" || r.answer === "unknown")
    .map(r => {
      const q = (QUESTIONS || []).find(x => x.id === r.qid);
      return q ? { q, answer: r.answer } : null;
    })
    .filter(x => !!x);

  if (!summaryPanel || !riskList) return;

  // Optional dedicated header node: set if present (bilingual H2s are handled by data-lang)
  if (summaryHeader) {
    setText(summaryHeader, currentLang === "fr" ? "Résumé des risques" : "Risk Summary");
  }

  // Count
  if (riskCountEl) {
    setText(riskCountEl, String(risks.length));
  }

  // List content
  riskList.innerHTML = risks.map(({ q, answer }) => {
    const qTextEn = q.text?.en || "";
    const qTextFr = q.text?.fr || qTextEn;
    const riskEn = q.risk_statement?.en || "";
    const riskFr = q.risk_statement?.fr || riskEn;
    const mitigationsEn = Array.isArray(q.mitigations?.en) ? q.mitigations.en : [];
    const mitigationsFr = Array.isArray(q.mitigations?.fr) ? q.mitigations.fr : mitigationsEn;

    const mitEN = mitigationsEn.map(m => `<li>${m}</li>`).join("");
    const mitFR = mitigationsFr.map(m => `<li>${m}</li>`).join("");

    return `
      <li class="risk-item">
        <h3 class="risk-q">
          <span class="badge">${ansLabel(answer)}</span>
          <span data-lang="en">${qTextEn}</span>
          <span data-lang="fr">${qTextFr}</span>
        </h3>
        <p class="risk-statement">
          <strong data-lang="en">Risk:</strong>
          <strong data-lang="fr">Risque&nbsp;:</strong>
          <span data-lang="en">${riskEn}</span>
          <span data-lang="fr">${riskFr}</span>
        </p>
        <div class="risk-mitigations">
          <div data-lang="en">
            <strong>Mitigations</strong>
            <ul>${mitEN}</ul>
          </div>
          <div data-lang="fr">
            <strong>Mesures d’atténuation</strong>
            <ul>${mitFR}</ul>
          </div>
        </div>
      </li>
    `;
  }).join("");

  // Toggle visibility
  if (questionsSectionPrimary) questionsSectionPrimary.classList.add("hidden");
  summaryPanel.classList.remove("hidden");
  // Important for CSS that relies on a state class to reveal summary
  document.body.classList.add("summary-ready");

  // Ensure language visibility is correct
  applyLangToSpans();

  // Wire actions (idempotent) and reveal them
  if (editAnswersBtn) {
    editAnswersBtn.classList.remove("hidden");
    editAnswersBtn.removeAttribute("aria-hidden");
    editAnswersBtn.onclick = () => {
      summaryPanel.classList.add("hidden");
      if (questionsSectionPrimary) questionsSectionPrimary.classList.remove("hidden");
      document.body.classList.remove("summary-ready");
      applyLangToSpans();
      updateQuestionAriaLabelsForLang();
    };
  }
  if (newScenarioBtn) {
    newScenarioBtn.classList.remove("hidden");
    newScenarioBtn.removeAttribute("aria-hidden");
    newScenarioBtn.onclick = () => {
      // Clear answers
      (QUESTIONS || []).forEach(q => {
        qsa(`input[name="${q.id}"]`).forEach(el => { el.checked = false; });
      });
      // Clear meta
      if (qs("#projectName")) qs("#projectName").value = "";
      if (qs("#projectDesc")) qs("#projectDesc").value = "";
      if (qs("#assessmentDate")) qs("#assessmentDate").value = "";
      if (qs("#completedBy")) qs("#completedBy").value = "";
      // Clear storage
      try { localStorage.removeItem(STORAGE_KEY); } catch {}
      // Back to questions
      summaryPanel.classList.add("hidden");
      document.body.classList.remove("summary-ready");
      const { questionsSectionPrimary: qsp } = getIds();
      if (qsp) qsp.classList.remove("hidden");
      renderQuestions();
    };
  }
  if (printSummaryBtn) {
    printSummaryBtn.classList.remove("hidden");
    printSummaryBtn.removeAttribute("aria-hidden");
    printSummaryBtn.onclick = () => window.print();
  }
  if (postResultActions) {
    postResultActions.classList.remove("hidden");
    postResultActions.setAttribute("data-state", "active");
  }

  // Persist scenario after generating
  saveScenario();
}

/* -------------------------
   Public API (optional)
------------------------- */
window.RRIT = {
  setQuestions(list) {
    QUESTIONS = Array.isArray(list) ? list : [];
    renderQuestions();
  },
  getQuestions() { return QUESTIONS.slice(); },
  saveScenario,
  loadScenario,
  restoreScenario,
  generateSummary,
  renderQuestions,
  toggleLanguage
};

/* -------------------------
   Initialization
------------------------- */
function initRRIT() {
  applyLangToSpans();

  // If QUESTIONS were pre-injected, render; otherwise wait for loader/bootstrap
  if (QUESTIONS.length) {
    renderQuestions();
    // Attempt restore
    const saved = loadScenario();
    if (saved) {
      restoreScenario(saved);
      // Enable Generate Summary based on restored answers
      const { btnGenerateSummary } = getIds();
      if (btnGenerateSummary) {
        const answered = collectResponses().length;
        btnGenerateSummary.disabled = answered !== (QUESTIONS || []).length;
      }
    }
  }

  // Wire the Generate Summary button if present
  const { btnGenerateSummary } = getIds();
  if (btnGenerateSummary) {
    btnGenerateSummary.addEventListener("click", (e) => {
      e.preventDefault();
      saveScenario();   // persist before generating
      generateSummary();
    });
  }

  // Optional: autosave on changes
  const { questionsList } = getIds();
  if (questionsList) {
    questionsList.addEventListener("change", () => {
      saveScenario();
    });
  }
}

/* -------------------------
   Bootstrap
------------------------- */
(function () {
  const start = async () => {
    try {
      await loadQuestions();  // ensure QUESTIONS is populated
      initRRIT();             // render and wire once
    } catch (e) {
      console.error("[RRIT] Initialization failed:", e);
    }
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
