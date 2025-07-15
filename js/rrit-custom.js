/* =========================================================
   RRIT – Rapid Risk Identification Tool
   Clean/Refactored build – 2025-07-15
   =========================================================
   Improvements:
   - Fixed all function closure issues
   - Strong comments and error reporting
   - Robust focus and ARIA handling
   - Modular and easy to maintain
   - Ready for production and enhancements
   ========================================================= */

/* ---------- CONFIGURATION -------------------------------- */
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

/* ---------- STATE / STORAGE ------------------------------ */
let currentLang = "en";
const STORAGE_KEY = "rrit_savedScenario_v1";

/* ---------- UTILS ---------------------------------------- */
const qs      = s => document.querySelector(s);
const qsa     = s => [...document.querySelectorAll(s)];
const setTxt  = (el, txt) => el && (el.textContent = txt);
const setVis  = (el, show=true) => el && el.classList.toggle("hidden", !show);

/* -------------- STORAGE HELPERS -------------------------- */
function saveScenario(data) {
  const metadata = {
    name: qs("#projectName")?.value || "",
    desc: qs("#projectDesc")?.value || "",
    date: qs("#assessmentDate")?.value || new Date().toISOString().split("T")[0],
    completedBy: qs("#completedBy")?.value || ""
  };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ savedAt: Date.now(), data, metadata }));
  } catch (err) {
    console.error("[RRIT] Could not save scenario to localStorage.", err);
    alert("Warning: Unable to save scenario. Check your browser's storage settings.");
  }
}

function loadScenario() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY));
  } catch (err) {
    console.warn("[RRIT] Failed to load scenario from storage.", err);
    return null;
  }
}

/* ---------- SYNC ANSWERS ACROSS LANGUAGES ---------------- */
function syncResponses() {
  // Ensures answers checkboxes/radios are synced across language switch (must be in perfect sync in HTML)
  const map = { Yes:"Oui", No:"Non", Unknown:"Inconnu", "Not Applicable":"Sans objet",
                Oui:"Yes", Non:"No", Inconnu:"Unknown", "Sans objet":"Not Applicable" };
  qsa('input[type="radio"]:checked').forEach(src => {
    const twinName = src.name.endsWith("f") ? src.name.slice(0, -1) : src.name + "f";
    const twinVal  = map[src.value] || src.value;
    // Will 'click' the corresponding radio in the other language
    const twin = qs(`input[name="${twinName}"][value="${twinVal}"]`);
    if(twin && !twin.checked) twin.click();
  });
}

/* ---------- SUMMARY PANEL MOVERS ------------------------- */
function placeSummaryTop() {
  const firstPanel   = qs("#stepA");
  const summaryPanel = qs("#rrit-summary");
  if (firstPanel && summaryPanel &&
      summaryPanel.previousElementSibling !== firstPanel) {
    firstPanel.parentNode.insertBefore(summaryPanel, firstPanel);
  }
}

function placeSummaryBottom() {
  const summaryPanel = qs("#rrit-summary");
  // find the last visible category panel (may be K or earlier)
  const panels = qsa('section[id^="step"]:not(.hidden)');
  const last   = panels[panels.length - 1];
  if (summaryPanel && last &&
      summaryPanel.nextElementSibling !== null) {
    last.parentNode.insertBefore(summaryPanel, last.nextSibling);
  }
}

/* ---------- GENERATE SUMMARY ----------------------------- */
function generateSummary() {
  const lang        = currentLang;
  const body        = qs("#summaryTableBody");
  body.innerHTML    = "";
  const responses   = [];
  // Project info capture (not yet shown in summary)
  // const name        = qs("#projectName")?.value || "(No project name)";
  // const desc        = qs("#projectDesc")?.value || "(No description)";
  // const date        = qs("#assessmentDate")?.value || new Date().toISOString().split("T")[0];
  // const completedBy = qs("#completedBy")?.value || "(Not specified)";

  /* 1. Which categories are visible? */
  const selected = new Set(["A", "B"]);
  qsa("#categoryFormEN input:checked, #categoryFormFR input:checked")
    .forEach(i => selected.add(i.value));

  /* 2. Compile and score responses for each selected category */
  selected.forEach(cat => {
    let total = 0, weight = 0, qList = [];

    ["", "f"].forEach(suffix => {
      qsa(`#step${cat} input[name^="cat${cat}q${suffix}"]:checked`).forEach(input => {
        const txt = input.closest("fieldset").querySelector("legend").textContent;
        qList.push({ question: txt, answer: input.value });
        if (input.value in questionWeights) weight += questionWeights[input.value];
        total += 1;
      });
    });

    /* risk assessment ---------------------------------------------------- */
    let status, css;
    if (criticalCategories.includes(cat) && qList.some(q => /^(No|Non|Unknown|Inconnu)$/.test(q.answer))) {
      status = riskLabels.high[lang]; css = "risk-high";
    } else if (!total) {
      status = riskLabels.notReviewed[lang]; css = "text-muted";
    } else {
      const ratio = weight / total;
      if (ratio >= riskThresholds.high) { status = riskLabels.high[lang];   css = "risk-high"; }
      else if (ratio >= riskThresholds.medium) { status = riskLabels.medium[lang]; css = "risk-medium"; }
      else { status = riskLabels.low[lang];    css = "risk-low"; }
    }

    body.insertAdjacentHTML("beforeend",
      `<tr><td>${categories[cat][lang]}</td>
         <td class="${css}">${status}</td></tr>`);

    if (qList.length) responses.push({ category: categories[cat][lang], questions: qList });
  });

  window.collectedResponses = responses;
  setVis(qs("#summaryTableContainer"), true);

  /* Hide intro & picker */
  setVis(qs("#rrit-intro"), false);
  setVis(qs("#step0"),      false);

  /* Move summary to the top */
  placeSummaryTop();
  setVis(qs("#riskSummaryHelp"), true);

  /* Focus summary heading for accessibility */
  const heading = qs("#rrit-summary");
  if (heading) {
    heading.setAttribute("tabindex", "-1");
    heading.focus();
    setTimeout(() => heading.removeAttribute("tabindex"), 100);
  }

  /* Update status and button visibility */
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

/* ---------- ACTION BUTTON FLOWS -------------------------- */
function showPostResultActions () {
  setVis(qs("#postResultActions"), true);
  ["editAnswersBtn", "newScenarioBtn", "printSummaryBtn"]
    .forEach(id => setVis(qs(`#${id}`), true));
  setVis(qs("#generateSummaryBtn"), false);
}

function editAnswersFlow() {
  const saved = loadScenario();
  if (!saved) {
    alert("No saved scenario found.");
    return;
  }

  setVis(qs("#summaryTableContainer"), false);
  setVis(qs("#printSummaryBtn"),      false);
  setVis(qs("#riskSummaryHelp"),      false);
  setVis(qs("#postResultActions"),    false);
  setVis(qs("#rrit-summary"),         false);

  setVis(qs("#rrit-intro"), true);
  setVis(qs("#step0"),      true);

  // Re-apply saved answers by question text (fragile if question text changed)
  let restoreCount = 0;
  saved.data.forEach(cat =>
    cat.questions.forEach(q => {
      const inp = qs(`input[data-question="${q.question.replace(/"/g,'\\"')}"][value="${q.answer}"]`);
      if (inp && !inp.checked) {
        inp.click();
        restoreCount++;
      }
    })
  );
  if (restoreCount === 0 && saved.data.length > 0) {
    console.warn("[RRIT] No saved answers restored — questions may have changed.");
  }
  collectCategories();

  setVis(qs("#generateSummaryBtn"), true);

  if (qs("#rrit-summary") && qs("#stepK")?.nextElementSibling !== qs("#rrit-summary")) {
    placeSummaryBottom();
  }

  qs("#backToSummary")?.classList.remove("hidden");
  qs("#backToSummary").onclick = returnToSummary;
  qs("#rrit-intro").scrollIntoView({ behavior:"smooth" });
}

function returnToSummary() {
  const saved = loadScenario();
  if (!saved || !Array.isArray(saved.data) || !saved.data.length) {
    alert("No saved scenario to return to.");
    return;
  }

  // Re-apply saved answers
  let restoreCount = 0;
  saved.data.forEach(cat =>
    cat.questions.forEach(q => {
      const inp = qs(`input[data-question="${q.question.replace(/"/g, '\\"')}"][value="${q.answer}"]`);
      if (inp && !inp.checked) {
        inp.click();
        restoreCount++;
      }
    })
  );
  if (restoreCount === 0 && saved.data.length > 0) {
    console.warn("[RRIT] No saved answers restored — questions may have changed.");
  }

  window.collectedResponses = saved.data;

  collectCategories();
  generateSummary();
  showPostResultActions();

  qs("#rrit-summary")?.scrollIntoView({ behavior: "smooth" });

  // Accessibility: move focus to the summary panel before hiding button!
  const backBtn = qs("#backToSummary");
  if (backBtn) {
    const heading = qs("#rrit-summary");
    if (heading) {
      heading.setAttribute("tabindex", "-1");
      heading.focus();
      setTimeout(() => heading.removeAttribute("tabindex"), 100);
    } else {
      document.body.focus();
    }
    backBtn.blur();
    backBtn.setAttribute("inert", "");
    backBtn.setAttribute("aria-hidden", "true");
    backBtn.classList.add("hidden");
  }
}

/* ---------- CATEGORY PANEL VISIBILITY --------------------- */
function collectCategories() {
  const lang     = currentLang;
  const formId   = lang === "en" ? "categoryFormEN" : "categoryFormFR";
  const selected = ["A", "B", ...qsa(`#${formId} input:checked`).map(cb => cb.value)];

  Object.keys(categories).forEach(cat => {
    const sec = qs(`#step${cat}`);
    if (sec) setVis(sec, selected.includes(cat));
  });

  setTxt(qs("#statusMsg"), (lang === "en" ? "Categories shown: " : "Catégories affichées : ") + selected.join(", "));
}

/* ---------- LANGUAGE TOGGLE ------------------------------- */
function toggleLanguage(lang) {
  currentLang = lang;
  document.documentElement.setAttribute("lang", lang);

  qsa("[data-lang]").forEach(el => {
    const show = el.getAttribute("data-lang") === lang;
    el.classList.toggle("hidden", !show);
    el.setAttribute("aria-hidden", !show);
  });

  qsa("#lang-switch a").forEach(a => a.toggleAttribute("aria-current", a.getAttribute("lang") === lang));

  // Button labels
  const btns = {
    gen : { el: qs('button[onclick="generateSummary()"]'), en:"Generate Summary",    fr:"Générer le résumé" },
    prt : { el: qs("#printSummaryBtn"),                   en:"Print / Save as PDF", fr:"Imprimer / Enregistrer en PDF" },
    edt : { el: qs("#editAnswersBtn"),                    en:"Edit Answers",        fr:"Modifier les réponses" },
    new : { el: qs("#newScenarioBtn"),                    en:"Start New Scenario",  fr:"Nouveau scénario" }
  };
  Object.values(btns).forEach(({el,en,fr}) => {
    if (!el) return;
    el.textContent = (lang === "en") ? en : fr;
    el.setAttribute("aria-label", el.textContent.trim());
  });

  // Back to Summary button
  setVis(qs('#backToSummary span[data-lang="en"]'), lang === "en");
  setVis(qs('#backToSummary span[data-lang="fr"]'), lang === "fr");

  setVis(qs("#riskHelpEN"), lang === "en");
  setVis(qs("#riskHelpFR"), lang === "fr");
  setTxt(qs("#riskSummaryHelpLabel"),
         lang === "en" ? "📘 How to interpret the Risk Summary"
                       : "📘 Comment interpréter le sommaire du profil de risque");

  syncResponses();
  if (!qs("#summaryTableContainer")?.classList.contains("hidden")) generateSummary();
}
window.toggleLanguage = toggleLanguage;

/* ---------- CLEAR STORAGE & START NEW --------------------- */
function clearScenario() {
  try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
}

function startNewScenario() {
  clearScenario();
  setTimeout(() => {
    window.location.reload();
  }, 100);
}

/* ---------- DOM READY: MAIN INIT BINDINGS ----------------- */
document.addEventListener("DOMContentLoaded", () => {
  // Language auto-detect
  const browserLang = (navigator.languages?.[0] || navigator.language || "en").toLowerCase();
  toggleLanguage(browserLang.startsWith("fr") ? "fr" : "en");

  // Map questions to data-question for restore
  qsa("fieldset").forEach(fs => {
    const q = fs.querySelector("legend")?.textContent.trim() || "";
    qsa('input[type="radio"],input[type="checkbox"]', fs).forEach(inp => inp.dataset.question = q);
  });

  // Category checkboxes: collect on change
  qsa("#categoryFormEN input, #categoryFormFR input").forEach(cb => cb.addEventListener("change", collectCategories));

  // Action buttons
  qs("#generateSummaryBtn")?.addEventListener("click", generateSummary);
  qs("#editAnswersBtn")?.addEventListener("click", editAnswersFlow);
  qs("#newScenarioBtn")?.addEventListener("click", startNewScenario);
  qs("#backToSummary") ?.addEventListener("click", returnToSummary);

  // Restore saved scenario, if any, on page load
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

  // Block initial WET auto-scroll
  window.preventInitialScroll = true;
  setTimeout(()=>{ window.preventInitialScroll=false; }, 4000);
});
