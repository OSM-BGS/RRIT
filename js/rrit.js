/* =========================================================
   RRIT – Rapid Risk Identification Tool (Unified Build)
   - Replaces rrit-simple.js and rrit-custom.js
   - Single-language render; bilingual via [data-lang]
   - Save/restore, progress guard, risks-only summary
   - No modules/exports; attaches API to window.RRIT
   ========================================================= */

/* -------------------------
   Globals & shared state
------------------------- */
const STORAGE_KEY = "rrit_savedScenario_v2";

// QUESTIONS must be an array of:
// { id, text:{en,fr}, why:{en,fr}, risk_statement:{en,fr}, mitigations:{en:[],fr:[]} }
let QUESTIONS = Array.isArray(window.RRIT_QUESTIONS) ? window.RRIT_QUESTIONS : [];

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
const qs  = (sel, root = document) => root.querySelector(sel);
const qsa = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const setText = (el, txt) => { if (el) el.textContent = txt; };

/* -------------------------
   i18n helpers
------------------------- */
function t(obj) {
  return (typeof obj === "string") ? obj : (obj?.[currentLang] ?? obj?.en ?? "");
}
function ansLabel(v) {
  const map = currentLang === "fr"
    ? { yes: "Oui", no: "Non", unknown: "Inconnu", na: "S.O." }
    : { yes: "Yes", no: "No", unknown: "Unknown", na: "N/A" };
  return map[v] || v;
}
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
  try { localStorage.setItem("rrit_lang", currentLang); } catch {}
  applyLangToSpans();
  renderQuestions();
  renderSummaryIfVisible();
  const g1 = qs("#btnGenerateSummary");
  if (g1) setText(g1, currentLang === "fr" ? "Générer le résumé" : "Generate Summary");
}
window.toggleLanguage = toggleLanguage;

/* -------------------------
   Robust element lookup
------------------------- */
function getIds() {
  const allSections = qsa("#questionsSection");
  let questionsSectionPrimary = allSections.find(sec => qs("#questionsList", sec)) || allSections[0] || qs("#questionsSection");

  const questionsList = qs("#questionsList", questionsSectionPrimary) || qs("#questionsList");
  const progressText = qs("#progressText") || qs('[data-role="progressText"]');

  const summaryPanel = qs("#summaryPanel") || qs('[data-role="summaryPanel"]');
  const summaryHeader = qs("#summaryHeader", summaryPanel) || qs('[data-role="summaryHeader"]', summaryPanel) || summaryPanel;
  const riskCountEl = qs("#riskCount", summaryPanel) || qs('[data-role="riskCount"]', summaryPanel);
  const riskList = qs("#riskList", summaryPanel) || qs('[data-role="riskList"]', summaryPanel);

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
          <span>${ansLabel(v)}</span>
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

  applyLangToSpans();
  updateQuestionAriaLabelsForLang();

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

  const risks = responses.filter(r => r.answer === "no" || r.answer === "unknown")
    .map(r => {
      const q = (QUESTIONS || []).find(x => x.id === r.qid);
      return { q, answer: r.answer };
    }).filter(x => !!x.q);

  if (!summaryPanel || !riskList) return;

  if (summaryHeader) setText(summaryHeader, currentLang === "fr" ? "Résumé des risques" : "Risk Summary");
  if (riskCountEl) setText(riskCountEl, String(risks.length));

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

  if (questionsSectionPrimary) questionsSectionPrimary.classList.add("hidden");
  summaryPanel.classList.remove("hidden");

  applyLangToSpans();

  if (editAnswersBtn) {
    editAnswersBtn.onclick = () => {
      summaryPanel.classList.add("hidden");
      if (questionsSectionPrimary) questionsSectionPrimary.classList.remove("hidden");
      applyLangToSpans();
      updateQuestionAriaLabelsForLang();
    };
  }
  if (newScenarioBtn) {
    newScenarioBtn.onclick = () => {
      (QUESTIONS || []).forEach(q => {
        qsa(`input[name="${q.id}"]`).forEach(el => { el.checked = false; });
      });
      if (qs("#projectName")) qs("#projectName").value = "";
      if (qs("#projectDesc")) qs("#projectDesc").value = "";
      if (qs("#assessmentDate")) qs("#assessmentDate").value = "";
      if (qs("#completedBy")) qs("#completedBy").value = "";
      try { localStorage.removeItem(STORAGE_KEY); } catch {}
      summaryPanel.classList.add("hidden");
      const { questionsSectionPrimary: qsp } = getIds();
      if (qsp) qsp.classList.remove("hidden");
      renderQuestions();
    };
  }
  if (printSummaryBtn) {
    printSummaryBtn.onclick = () => window.print();
  }
  if (postResultActions) postResultActions.classList.remove("hidden");
}

/* -------------------------
   Public API
------------------------- */
window.RRIT = {
  setQuestions(list) {
    QUESTIONS = Array.isArray(list) ? list : [];
    renderQuestions();
  },
  getQuestions() {
    return QUESTIONS.slice();
  },
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

  if (QUESTIONS.length) {
    renderQuestions();
    const saved = loadScenario();
    if (saved) {
      restoreScenario(saved);
      const { btnGenerateSummary } = getIds();
      if (btnGenerateSummary) {
        const answered = collectResponses().length;
        btnGenerateSummary.disabled = answered !== (QUESTIONS || []).length;
      }
    }
  }

  const { btnGenerateSummary } = getIds();
  if (btnGenerateSummary) {
    btnGenerateSummary.addEventListener("click", (e) => {
      e.preventDefault();
      saveScenario();
      generateSummary();
    });
  }

  const { questionsList } = getIds();
  if (questionsList) {
    questionsList.addEventListener("change", () => {
      saveScenario();
    });
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initRRIT);
} else {
  initRRIT();
}
