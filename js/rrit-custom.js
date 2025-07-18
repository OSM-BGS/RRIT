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

let currentLang = "en";

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

// Load scenario from localStorage
function loadScenario() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY));
  } catch (err) {
    console.warn("[RRIT] Could not parse scenario from storage.");
    return null;
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

// Restore responses to the UI based on saved scenario
function restoreScenarioResponses(saved) {
  if (!saved || !Array.isArray(saved.data)) {
    console.warn("[RRIT] No saved scenario data available for restoration.");
    return;
  }

  let restoreCount = 0;
  let errorCount = 0;
  const missing = [];

  saved.data.forEach(cat => {
    cat.questions.forEach(q => {
      // Uncheck all options for this qid
      qsa(`input[data-qid="${q.qid}"]`).forEach(i => i.checked = false);

      const inp = qs(`input[data-qid="${q.qid}"][value="${q.answer}"]`);
      if (inp && !inp.checked) {
        inp.click();
        restoreCount++;
      } else if (!inp) {
        missing.push({ qid: q.qid, value: q.answer });
        errorCount++;
      }
    });
  });

  if (restoreCount === 0 && saved.data.length > 0) {
    console.warn("[RRIT] No saved answers restored — questions may have changed.");
  }

  if (errorCount > 0) {
    console.warn(`[RRIT] ${errorCount} answers could not be restored. Details:`, missing);
  }

  syncResponses(); // Sync between EN/FR
}

// Sync radio button answers across languages
function syncResponses() {
  const map = {
    Yes: "Oui", No: "Non", Unknown: "Inconnu", "Not Applicable": "Sans objet",
    Oui: "Yes", Non: "No", Inconnu: "Unknown", "Sans objet": "Not Applicable"
  };

  qsa('input[type="radio"]:checked').forEach(src => {
    const twinName = src.name.endsWith("f") ? src.name.slice(0, -1) : src.name + "f";
    const twinVal = map[src.value] || src.value;

    const twin = qs(`input[name="${twinName}"][value="${twinVal}"][data-qid="${src.dataset.qid}"]`);
    if (twin && !twin.checked) twin.click();
  });
}

/* =========================================================
   Section 4: Summary Generation and Risk Logic
   ========================================================= */

function generateSummary() {
  const lang = currentLang;
  const body = qs("#summaryTableBody");
  body.innerHTML = "";
  const responses = [];

  const selected = new Set(["A", "B"]);
  qsa("#categoryFormEN input:checked, #categoryFormFR input:checked")
    .forEach(i => selected.add(i.value));

  selected.forEach(cat => {
    let total = 0, weight = 0, qList = [];

    ["", "f"].forEach(suffix => {
      qsa(`#step${cat} input[name^="cat${cat}q${suffix}"]:checked`).forEach(input => {
        const fs = input.closest("fieldset");
        const qid = input.dataset.qid || fs?.dataset.qid || "";
        const txt = fs?.querySelector("legend")?.textContent || "";
        qList.push({ qid, question: txt, answer: input.value });

        if (input.value in questionWeights) weight += questionWeights[input.value];
        total += 1;
      });
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
  const saved = loadScenario();
  if (!saved || !saved.data) {
    console.warn("[RRIT] No saved scenario found.");
    return;
  }

  console.log("[RRIT] Entering editAnswersFlow()");
  console.log("[RRIT] Saved answers to restore:", saved.data);

  // Hide summary, show intro and input panels
  setVis(qs("#summaryTableContainer"), false);
  setVis(qs("#printSummaryBtn"),      false);
  setVis(qs("#riskSummaryHelp"),      false);
  setVis(qs("#postResultActions"),    false);
  setVis(qs("#rrit-summary"),         false);
  setVis(qs("#rrit-intro"),           true);
  setVis(qs("#step0"),                true);

  // Reveal the selected category panels
  collectCategories(); 
  console.log("[RRIT] collectCategories() called – visible panels should match previous selection.");

  // Assign data-qid attributes to inputs before restoring
  reassignQids(); // ✅ critical step before restoration

  // Log visible radio buttons to verify state
  const visibleRadios = [...document.querySelectorAll('input[type="radio"]')]
    .filter(el => el.offsetParent !== null && el.dataset.qid);
  console.log("[RRIT] Visible radio buttons with data-qid:", visibleRadios.map(r => ({
    name: r.name,
    value: r.value,
    qid: r.dataset.qid
  })));

  // Attempt to restore saved responses
  restoreScenarioResponses(saved);

  // Show Generate Summary button again
  setVis(qs("#generateSummaryBtn"), true);

  // Move the summary panel back to bottom if out of place
  if (qs("#rrit-summary") && qs("#stepK")?.nextElementSibling !== qs("#rrit-summary")) {
    placeSummaryBottom();
  }

  // Safely re-bind Back to Summary Button
  const backBtn = qs("#backToSummary");
  if (backBtn) {
    const cleanBackBtn = backBtn.cloneNode(true);
    backBtn.replaceWith(cleanBackBtn);
    cleanBackBtn.addEventListener("click", returnToSummary);
    cleanBackBtn.classList.remove("hidden");
    cleanBackBtn.removeAttribute("inert");
    cleanBackBtn.removeAttribute("aria-hidden");
    console.log("[RRIT] BackToSummary safely re-bound.");
  }

  // Scroll to top for accessibility
  qs("#rrit-intro")?.scrollIntoView({ behavior: "smooth" });

  console.log("[RRIT] editAnswersFlow() complete.");
}

function returnToSummary() {
  // Step 1: Re-collect updated answers
  const updatedResponses = collectResponses(); // Fresh from UI
  window.collectedResponses = updatedResponses;
  console.log("[RRIT] Updated responses collected on return:", updatedResponses);

  // Step 2: Save to localStorage
  saveScenario(updatedResponses);

  // Step 3: Rebuild the summary table
  generateSummary();
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

  // Sync radio answers in both languages
  syncResponses();

  // If summary is showing, regenerate it in selected language
  if (!qs("#summaryTableContainer")?.classList.contains("hidden")) {
    generateSummary();
  }
}
window.toggleLanguage = toggleLanguage;

function clearScenario() {
  try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
}

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
  toggleLanguage(browserLang.startsWith("fr") ? "fr" : "en");

  // Bind core event listeners
  qsa("#categoryFormEN input, #categoryFormFR input").forEach(cb =>
    cb.addEventListener("change", collectCategories)
  );
  qs("#generateSummaryBtn")?.addEventListener("click", generateSummary);
  qs("#editAnswersBtn")?.addEventListener("click", editAnswersFlow);
  qs("#newScenarioBtn")?.addEventListener("click", startNewScenario);
  qs("#backToSummary")?.addEventListener("click", returnToSummary);

  // Attempt to restore saved scenario
  const saved = loadScenario();
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
