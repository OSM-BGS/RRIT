/* =========================================================
   RRIT – Rapid Risk Identification Tool
   Refactored Version – 2025-07-17
   Section 1: Configuration and Constants
   ========================================================= */

const questionWeights = {
  "No": 1, "Non": 1,
  "Unknown": 0.5, "Inconnu": 0.5
};

const criticalCategories = ["A", "B"];

const riskLabels = {
  high:        { en: "Requires Risk Mitigation",        fr: "Requiert une atténuation des risques" },
  medium:      { en: "Further research required",       fr: "Recherche supplémentaire requise"     },
  low:         { en: "Risks Mitigated / N/A",           fr: "Risques atténués / N/A"               },
  notReviewed: { en: "Not reviewed",                    fr: "Non examiné"                          }
};

const riskThresholds = { high: 0.4, medium: 0.2 };

const categories = {
  A: { en: "Regulatory Compliance (Mandatory)",           fr: "Conformité réglementaire (Obligatoire)" },
  B: { en: "Data Security and Privacy (Mandatory)",       fr: "Sécurité des données et confidentialité (Obligatoire)" },
  C: { en: "HR Technology / Integration",                 fr: "Technologie RH / Intégration" },
  D: { en: "User Adoption and Training",                  fr: "Adoption et formation des utilisateurs" },
  E: { en: "Cost-Benefit Analysis",                       fr: "Analyse coûts-avantages" },
  F: { en: "Vendor Reliability and Support",              fr: "Fiabilité et soutien du fournisseur" },
  G: { en: "Workforce Planning and Development",          fr: "Planification et développement de la main-d'œuvre" },
  H: { en: "Employee Engagement and Culture Change",      fr: "Mobilisation des employés et changement de culture" },
  I: { en: "Diversity and Inclusion Programs",            fr: "Programmes de diversité et d'inclusion" },
  J: { en: "Organizational Restructuring",                fr: "Restructuration organisationnelle" },
  K: { en: "Policy Development and Implementation",       fr: "Élaboration et mise en œuvre des politiques" }
};

const STORAGE_KEY = "rrit_savedScenario_v2";

let currentLang = navigator.language.startsWith("fr") ? "fr" : "en";

const qs  = s => document.querySelector(s);
const qsa = s => [...document.querySelectorAll(s)];
const setTxt = (el, txt) => el && (el.textContent = txt);
const setVis = (el, show = true) => el && el.classList.toggle("hidden", !show);

/* =========================================================
   Section 2: Local Storage + Data Handling Utilities
   ========================================================= */

// Save scenario with metadata and answers
function saveScenario(responses) {
  const metadata = {
    name: qs("#projectName")?.value || "",
    desc: qs("#projectDesc")?.value || "",
    date: qs("#assessmentDate")?.value || new Date().toISOString().split("T")[0],
    completedBy: qs("#completedBy")?.value || ""
  };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      savedAt: Date.now(),
      metadata,
      data: responses
    }));
  } catch (err) {
    console.error("[RRIT] Could not save scenario to localStorage.", err);
    alert("Warning: Unable to save scenario. Check your browser's storage settings.");
  }
}

// Clear scenario from localStorage
function clearScenario() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (err) {
    console.warn("[RRIT] Failed to clear scenario from storage.");
  }
}

// Reassign data-qid to each input inside a fieldset
function reassignQids() {
  qsa("fieldset[data-qid]").forEach(fs => {
    const qid = fs.dataset.qid;
    if (!qid) return;
    qsa('input[type="radio"], input[type="checkbox"]', fs).forEach(inp => {
      inp.dataset.qid = qid;
    });
  });
}

// Collect selected categories and show panels
function collectCategories() {
  const lang = currentLang;
  const formId = lang === "en" ? "categoryFormEN" : "categoryFormFR";
  const selected = ["A", "B", ...qsa(`#${formId} input:checked`).map(cb => cb.value)];

  Object.keys(categories).forEach(cat => {
    const sec = qs(`#step${cat}`);
    if (sec) setVis(sec, selected.includes(cat));
  });

  setTxt(qs("#statusMsg"),
    (lang === "en" ? "Categories shown: " : "Catégories affichées : ") + selected.join(", "));
}

function restoreResponses(saved) {
  if (!saved || !saved.responses) return;

  const responses = saved.responses;
  Object.keys(responses).forEach(qid => {
    const qname = qsa(`[data-qid="${qid}"] input`)?.[0]?.name;
    if (!qname || !responses[qid]) return;

    const inputs = qsa(`[name="${qname}"]`);
    const input = inputs.find(i => i.value === responses[qid][0]);
    if (input) input.checked = true;
  });

  // Also restore metadata fields if available
  if (saved.meta) {
    const { projectName, projectDesc, assessmentDate, completedBy } = saved.meta;
    if (qs("#projectName")) qs("#projectName").value = projectName || "";
    if (qs("#projectDesc")) qs("#projectDesc").value = projectDesc || "";
    if (qs("#assessmentDate")) qs("#assessmentDate").value = assessmentDate || "";
    if (qs("#completedBy")) qs("#completedBy").value = completedBy || "";
  }
}



/* =========================================================
   Section 3: Response Collection and Restoration
   ========================================================= */

// Collect responses from all visible fieldsets
function collectResponses() {
  const responses = [];

  qsa("fieldset[data-qid]").forEach(fs => {
    const qid = fs.dataset.qid;
    const inputs = qsa('input[type="radio"], input[type="checkbox"]', fs);

    let value = null;

    if (inputs.length && inputs[0].type === "radio") {
      const selected = [...inputs].find(inp => inp.checked);
      value = selected?.value || null;
    } else if (inputs.length && inputs[0].type === "checkbox") {
      const selected = [...inputs].filter(inp => inp.checked);
      value = selected.map(inp => inp.value);
    }

    if (qid && value !== null) {
      responses.push({ qid, value });
    }
  });

  return responses;
}


/* =========================================================
   Section 4: Summary Generation and Risk Logic
   ========================================================= */

function generateSummary() {
  const lang = currentLang;
  const body = qs("#summaryTableBody");
  body.innerHTML = ""; // Clears old summary on repeat clicks
  const responses = [];

  const selected = new Set(["A", "B"]);
  qsa("#categoryFormEN input:checked, #categoryFormFR input:checked")
    .forEach(i => selected.add(i.value));

  selected.forEach(cat => {
    let total = 0, weight = 0, qList = [];

   qsa(`#step${cat} input[name^="cat${cat}q"]:checked`).forEach(input => {
  const fs = input.closest("fieldset");
  const qid = input.dataset.qid || fs?.dataset.qid || "";
  const txt = fs?.querySelector("legend")?.textContent || "";
  qList.push({ qid, question: txt, answer: input.value });

  if (input.value in questionWeights) weight += questionWeights[input.value];
  total += 1;
});

    let status, css;
    if (criticalCategories.includes(cat) && qList.some(q => /^(No|Non|Unknown|Inconnu)$/.test(q.answer))) {
      status = riskLabels.high[lang]; css = "risk-high";
    } else if (!total) {
      status = riskLabels.notReviewed[lang]; css = "text-muted";
    } else {
      const ratio = weight / total;
      if (ratio >= riskThresholds.high) {
        status = riskLabels.high[lang]; css = "risk-high";
      } else if (ratio >= riskThresholds.medium) {
        status = riskLabels.medium[lang]; css = "risk-medium";
      } else {
        status = riskLabels.low[lang]; css = "risk-low";
      }
    }

    body.insertAdjacentHTML("beforeend",
      `<tr><td>${categories[cat][lang]}</td><td class="${css}">${status}</td></tr>`
    );

    if (qList.length) {
      responses.push({ category: categories[cat][lang], questions: qList });
    }
  });

  console.log("[RRIT] Collected responses:", responses);
  window.collectedResponses = responses;
  console.log("[RRIT] generateSummary() called.");

  setVis(qs("#summaryTableContainer"), true);
  setVis(qs("#rrit-intro"), false);
  setVis(qs("#step0"), false);

  placeSummaryTop();
  setVis(qs("#riskSummaryHelp"), true);

  const heading = qs("#rrit-summary");
  if (heading) {
    heading.setAttribute("tabindex", "-1");
    heading.focus();
    setTimeout(() => heading.removeAttribute("tabindex"), 100);
  }

  setTxt(qs('#rrit-summary p[data-lang="en"]'),
    "Risk profile summary generated. Review the results below, or click Edit Answers to make changes.");
  setTxt(qs('#rrit-summary p[data-lang="fr"]'),
    "Sommaire du profil de risque généré. Consultez les résultats ci-dessous ou cliquez sur Modifier les réponses pour apporter des changements.");

  setVis(qs("#generateSummaryBtn"), false);
  setVis(qs("#printSummaryBtn"), true);
  setVis(qs("#postResultActions"), true);

  saveScenario(responses);
  showPostResultActions();
}

/* =========================================================
   Section 5: Post-Result Actions and Summary Placement
   ========================================================= */

function showPostResultActions() {
  setVis(qs("#postResultActions"), true);
  ["editAnswersBtn", "newScenarioBtn", "printSummaryBtn"]
    .forEach(id => setVis(qs(`#${id}`), true));
  setVis(qs("#generateSummaryBtn"), false);
}

function placeSummaryTop() {
  const firstPanel = qs('section[id^="step"]:not(.hidden)');
  const summaryPanel = qs("#rrit-summary");
  if (firstPanel && summaryPanel &&
      summaryPanel.previousElementSibling !== firstPanel) {
    firstPanel.parentNode.insertBefore(summaryPanel, firstPanel);
  }
}

function placeSummaryBottom() {
  const summaryPanel = qs("#rrit-summary");
  const panels = qsa('section[id^="step"]:not(.hidden)');
  const last = panels[panels.length - 1];
  if (summaryPanel && last &&
      summaryPanel.nextElementSibling !== null) {
    last.parentNode.insertBefore(summaryPanel, last.nextSibling);
  }
}

/* =========================================================
   Section 6: Edit/Return Flow (Edit Answers, Return to Summary)
   ========================================================= */

function editAnswersFlow() {
  const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
  if (!saved) return;

  // Reset all answers first
  qsa("input[type=radio], input[type=checkbox]").forEach(el => el.checked = false);

  // Restore answers and metadata
  restoreResponses(saved);

  // Show relevant UI panels
  setVis(qs("#rrit-summary"), false);
  setVis(qs("#generateSummaryBtn"), true);
  setVis(qs("#printSummaryBtn"), false);
  setVis(qs("#postResultActions"), false);
  setVis(qs("#riskSummaryHelp"), false);

  setVis(qs("#rrit-intro"), false);
  setVis(qs("#step0"), true);

  qsa('section[id^="step"]').forEach(sec => {
    if (!sec.id.startsWith("step")) return;
    setVis(sec, false); // Hide all
  });

  collectCategories(); // Show selected again
  placeSummaryBottom();

  // Scroll to first section
  document.getElementById("stepA")?.scrollIntoView({ behavior: "smooth" });
}

/* =========================================================
   Section 7: Language Switching & Scenario Reset
   ========================================================= */

function toggleLanguage(lang) {
  currentLang = lang;
  document.documentElement.setAttribute("lang", lang);
  
  // Toggle visibility for bilingual elements
  qsa("[data-lang]").forEach(el => {
    const show = el.getAttribute("data-lang") === lang;
    el.classList.toggle("hidden", !show);
    el.setAttribute("aria-hidden", !show);
  });

   // Also toggle plain <span lang="en"> / <span lang="fr"> blocks
   qsa("span[lang='en'], span[lang='fr']").forEach(span => {
     const show = span.getAttribute("lang") === lang;
     span.classList.toggle("hidden", !show);
     span.setAttribute("aria-hidden", !show);
 });
   
  // Update language toggle navigation
  qsa("#lang-switch a").forEach(a =>
    a.toggleAttribute("aria-current", a.getAttribute("lang") === lang)
  );

  // Update key button labels and accessibility labels
  const btns = {
    gen : { el: qs('button[onclick="generateSummary()"]'), en: "Generate Summary",    fr: "Générer le résumé" },
    prt : { el: qs("#printSummaryBtn"),                   en: "Print / Save as PDF", fr: "Imprimer / Enregistrer en PDF" },
    edt : { el: qs("#editAnswersBtn"),                    en: "Edit Answers",        fr: "Modifier les réponses" },
    new : { el: qs("#newScenarioBtn"),                    en: "Start New Scenario",  fr: "Nouveau scénario" }
  };
  Object.values(btns).forEach(({ el, en, fr }) => {
    if (!el) return;
    el.textContent = lang === "en" ? en : fr;
    el.setAttribute("aria-label", el.textContent.trim());
  });

  // Toggle language-specific content
  setVis(qs('#backToSummary span[data-lang="en"]'), lang === "en");
  setVis(qs('#backToSummary span[data-lang="fr"]'), lang === "fr");
  setVis(qs("#riskHelpEN"), lang === "en");
  setVis(qs("#riskHelpFR"), lang === "fr");
  setTxt(qs("#riskSummaryHelpLabel"),
    lang === "en" ? "📘 How to interpret the Risk Summary"
                  : "📘 Comment interpréter le sommaire du profil de risque"
  );



  // If summary is showing, regenerate it in selected language
  if (!qs("#summaryTableContainer")?.classList.contains("hidden")) {
    generateSummary();
  }
}
window.toggleLanguage = toggleLanguage;


function startNewScenario() {
  clearScenario();
  setTimeout(() => { window.location.reload(); }, 100);
}

/* =========================================================
   Section 8: DOM Ready & Initialization
   ========================================================= */

document.addEventListener("DOMContentLoaded", () => {
  // Auto-detect and apply language
  const browserLang = (navigator.languages?.[0] || navigator.language || "en").toLowerCase();
  currentLang = browserLang.startsWith("fr") ? "fr" : "en";
  toggleLanguage(currentLang);

  // Bind core event listeners
  qsa("#categoryFormEN input, #categoryFormFR input").forEach(cb =>
    cb.addEventListener("change", collectCategories)
  );
  qs("#generateSummaryBtn")?.addEventListener("click", generateSummary);
  qs("#editAnswersBtn")?.addEventListener("click", editAnswersFlow);
  qs("#newScenarioBtn")?.addEventListener("click", startNewScenario);
  qs("#backToSummary")?.addEventListener("click", returnToSummary);

  // Attempt to restore saved scenario
 const savedRaw = localStorage.getItem(STORAGE_KEY);
let saved = null;
try {
  saved = JSON.parse(savedRaw);
} catch (err) {
  console.warn("[RRIT] Could not parse scenario from storage.");
}
  const hasResults = saved && Array.isArray(saved.data) && saved.data.length;
  const summaryVisible = !qs("#summaryTableContainer")?.classList.contains("hidden");
  if (hasResults && summaryVisible) {
    window.collectedResponses = saved.data;
    showPostResultActions();
  } else {
    setVis(qs("#postResultActions"), false);
    setVis(qs("#generateSummaryBtn"), true);
  }

  // Prevent WET auto-scroll on load
  window.preventInitialScroll = true;
  setTimeout(() => { window.preventInitialScroll = false; }, 4000);
});
