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
/* =========================================================
   RRIT – Keyed/Robust Answer Storage (by data-qid)
   2025-07-15, ready for fieldset data-qid
   ========================================================= */

/* ----- [Configuration] ----- */
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

/* ---- [State & Utils] ---- */
let currentLang = "en";
const STORAGE_KEY = "rrit_savedScenario_v2"; // note the version bump for incompatibility with old

const qs      = s => document.querySelector(s);
const qsa     = s => [...document.querySelectorAll(s)];
const setTxt  = (el, txt) => el && (el.textContent = txt);
const setVis  = (el, show=true) => el && el.classList.toggle("hidden", !show);

/* ----- [LocalStorage] ----- */
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
function restoreScenarioResponses(saved) {
  if (!saved || !Array.isArray(saved.data)) {
    console.warn("[RRIT] No saved scenario data available for restoration.");
    return;
  }
  let restoreCount = 0, errorCount = 0;
  const missing = [];
  saved.data.forEach(cat =>
    cat.questions.forEach(q => {
   // Always uncheck all options for this qid!
      qsa(`input[data-qid="${q.qid}"]`).forEach(i => i.checked = false);
      const inp = qs(`input[data-qid="${q.qid}"][value="${q.answer}"]`);
      if (inp && !inp.checked) {
        inp.click();
        restoreCount++;
      } else if (!inp) {
        missing.push({ qid: q.qid, value: q.answer });
        errorCount++;
      }
    })
  );
  if (restoreCount === 0 && saved.data.length > 0) {
    console.warn("[RRIT] No saved answers restored — questions may have changed.");
  }
  if (errorCount > 0) {
    console.warn(`[RRIT] ${errorCount} answers could not be restored. Details:`, missing);
  }
  // Only after ALL restore attempts, sync cross-language answers
  syncResponses();
}
function loadScenario() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)); }
  catch (err) { return null; }
}

/* ----- [Answer Sync EN<->FR] ----- */
function syncResponses() {
  // Map for Yes/No/Unknown/NotApplicable <-> Oui/Non/Inconnu/Sans objet
  const map = { Yes:"Oui", No:"Non", Unknown:"Inconnu", "Not Applicable":"Sans objet",
                Oui:"Yes", Non:"No", Inconnu:"Unknown", "Sans objet":"Not Applicable" };
  qsa('input[type="radio"]:checked').forEach(src => {
    const twinName = src.name.endsWith("f") ? src.name.slice(0, -1) : src.name + "f";
    const twinVal  = map[src.value] || src.value;
    // Use data-qid (robust!)
    const twin = qs(`input[name="${twinName}"][value="${twinVal}"][data-qid="${src.dataset.qid}"]`);
    if (twin && !twin.checked) twin.click();
  });
}

/* ----- [SUMMARY GENERATION] ----- */
function generateSummary() {
  const lang        = currentLang;
  const body        = qs("#summaryTableBody");
  body.innerHTML    = "";
  const responses   = [];

  /* Determine which categories panels are visible */
  const selected = new Set(["A", "B"]);
  qsa("#categoryFormEN input:checked, #categoryFormFR input:checked")
    .forEach(i => selected.add(i.value));

  /* Score + capture all checked answers for those categories */
  selected.forEach(cat => {
    let total = 0, weight = 0, qList = [];
    ["", "f"].forEach(suffix => {
      qsa(`#step${cat} input[name^="cat${cat}q${suffix}"]:checked`).forEach(input => {
        // Use data-qid; question text supplied for print only
        const fs    = input.closest("fieldset");
        const qid   = input.dataset.qid || fs?.dataset.qid || "";
        const txt   = fs?.querySelector("legend")?.textContent || "";
        qList.push({ qid, question: txt, answer: input.value });
        if (input.value in questionWeights) weight += questionWeights[input.value];
        total += 1;
      });
    });

    /* Risk logic */
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
  setVis(qs("#rrit-intro"), false);
  setVis(qs("#step0"),      false);

  placeSummaryTop();
  setVis(qs("#riskSummaryHelp"), true);

  // Accessibility: focus heading
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

/* ----- [Post-Result Buttons Logic] ----- */
function showPostResultActions () {
  setVis(qs("#postResultActions"), true);
  ["editAnswersBtn", "newScenarioBtn", "printSummaryBtn"]
    .forEach(id => setVis(qs(`#${id}`), true));
  setVis(qs("#generateSummaryBtn"), false);
}

/* ----- [Edit/Revise Flow] ----- */
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
  setVis(qs("#rrit-intro"), true); setVis(qs("#step0"), true);

   // Assign data-qid to all radio inputs on page load from fieldset
  qsa("fieldset[data-qid]").forEach(fs => {
    const qid = fs.dataset.qid;
    qsa('input[type="radio"],input[type="checkbox"]', fs).forEach(inp => { inp.dataset.qid = qid; });
  });

  // Restore previous answers by qid
restoreScenarioResponses(saved);
  collectCategories();
  setVis(qs("#generateSummaryBtn"), true);

  if (qs("#rrit-summary") && qs("#stepK")?.nextElementSibling !== qs("#rrit-summary")) {
    placeSummaryBottom();
  }

  qs("#backToSummary")?.classList.remove("hidden");
  qs("#backToSummary").onclick = returnToSummary;
  qs("#rrit-intro").scrollIntoView({ behavior:"smooth" });
}

/* ----- [Back to Summary (from Edit)] ----- */
function returnToSummary() {
  const saved = loadScenario();
  if (!saved || !Array.isArray(saved.data) || !saved.data.length) {
    alert("No saved scenario to return to.");
    return;
  }

restoreScenarioResponses(saved);

  window.collectedResponses = saved.data;
  collectCategories();
  generateSummary();
  showPostResultActions();
   setVis(qs("#rrit-summary"), true);
setVis(qs("#summaryTableContainer"), true);
  qs("#rrit-summary")?.scrollIntoView({ behavior: "smooth" });

  // Hide "Back to Summary"
  const backBtn = qs("#backToSummary");
  if (backBtn) {
    const heading = qs("#rrit-summary");
    if (heading) {
      heading.setAttribute("tabindex", "-1");
      heading.focus();
      setTimeout(() => heading.removeAttribute("tabindex"), 100);
    } else { document.body.focus(); }
    backBtn.blur();
    backBtn.setAttribute("inert", "");
    backBtn.setAttribute("aria-hidden", "true");
    backBtn.classList.add("hidden");
  }
}

/* ---- [Panel Controls] ---- */
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
  const panels = qsa('section[id^="step"]:not(.hidden)');
  const last   = panels[panels.length - 1];
  if (summaryPanel && last &&
      summaryPanel.nextElementSibling !== null) {
    last.parentNode.insertBefore(summaryPanel, last.nextSibling);
  }
}

/* ---- [Language Toggle] ---- */
function toggleLanguage(lang) {
  currentLang = lang;
  document.documentElement.setAttribute("lang", lang);
  qsa("[data-lang]").forEach(el => {
    const show = el.getAttribute("data-lang") === lang;
    el.classList.toggle("hidden", !show);
    el.setAttribute("aria-hidden", !show);
  });
  qsa("#lang-switch a").forEach(a => a.toggleAttribute("aria-current", a.getAttribute("lang") === lang));
  const btns = {
    gen : { el: qs('button[onclick="generateSummary()"]'), en:"Generate Summary",    fr:"Générer le résumé" },
    prt : { el: qs("#printSummaryBtn"),                   en:"Print / Save as PDF", fr:"Imprimer / Enregistrer en PDF" },
    edt : { el: qs("#editAnswersBtn"),                    en:"Edit Answers",        fr:"Modifier les réponses" },
    new : { el: qs("#newScenarioBtn"),                    en:"Start New Scenario",  fr:"Nouveau scénario" }
  };
  Object.values(btns).forEach(({el, en, fr}) => {
    if (!el) return;
    el.textContent = (lang === "en") ? en : fr;
    el.setAttribute("aria-label", el.textContent.trim());
  });
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

function clearScenario() {
  try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
}
function startNewScenario() {
  clearScenario();
  setTimeout(() => { window.location.reload(); }, 100);
}

/* ---- [DOM Ready/Init] ---- */
document.addEventListener("DOMContentLoaded", () => {
  // Language auto-detect
  const browserLang = (navigator.languages?.[0] || navigator.language || "en").toLowerCase();
  toggleLanguage(browserLang.startsWith("fr") ? "fr" : "en");

  
  qsa("#categoryFormEN input, #categoryFormFR input").forEach(cb => cb.addEventListener("change", collectCategories));
  qs("#generateSummaryBtn")?.addEventListener("click", generateSummary);
  qs("#editAnswersBtn")?.addEventListener("click", editAnswersFlow);
  qs("#newScenarioBtn")?.addEventListener("click", startNewScenario);
  qs("#backToSummary")?.addEventListener("click", returnToSummary);

  // Restore scenario if any
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
