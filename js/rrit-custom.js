/* =========================================================
   RRIT – Rapid Risk Identification Tool  (clean build 2025-07-02)
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

function saveScenario(data) {
  const metadata = {
    name: qs("#projectName")?.value || "",
    desc: qs("#projectDesc")?.value || "",
    date: qs("#assessmentDate")?.value || new Date().toISOString().split("T")[0],
    completedBy: qs("#completedBy")?.value || ""
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ savedAt: Date.now(), data, metadata }));
}

function loadScenario() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)); } catch { return null; }
}

/* ---------- SYNC ANSWERS ACROSS LANGUAGES ---------------- */
function syncResponses() {
  const map = { Yes:"Oui", No:"Non", Unknown:"Inconnu", "Not Applicable":"Sans objet",
                Oui:"Yes", Non:"No", Inconnu:"Unknown", "Sans objet":"Not Applicable" };

  qsa('input[type="radio"]:checked').forEach(src => {
    const twinName = src.name.endsWith("f") ? src.name.slice(0, -1) : src.name + "f";
    const twinVal  = map[src.value] || src.value;
    qs(`input[name="${twinName}"][value="${twinVal}"]`)?.click();
  });
}

/* ----------------------------------------------------------
   Helpers to move the summary panel up or down in the DOM
-----------------------------------------------------------*/
function placeSummaryTop () {
  const firstPanel   = qs("#stepA");          // always present
  const summaryPanel = qs("#rrit-summary");
  if (firstPanel && summaryPanel &&
      summaryPanel.previousElementSibling !== firstPanel) {
    firstPanel.parentNode.insertBefore(summaryPanel, firstPanel);
  }
}

function placeSummaryBottom () {
  const summaryPanel = qs("#rrit-summary");
  // find the last visible category panel (may be K or earlier)
  const panels = qsa('section[id^="step"]:not(.hidden)');
  const last   = panels[panels.length - 1];
  if (summaryPanel && last &&
      summaryPanel.nextElementSibling !== null) {
    last.parentNode.insertBefore(summaryPanel, last.nextSibling);
  }
}

/* ---------- SUMMARY GENERATION --------------------------- */
function generateSummary() {
  const lang        = currentLang;
  const body        = qs("#summaryTableBody");
  body.innerHTML    = "";
  const responses   = [];
  // Add project info at the top of the summary
  const name        = qs("#projectName")?.value || "(No project name)";
  const desc        = qs("#projectDesc")?.value || "(No description)";
  const date        = qs("#assessmentDate")?.value || new Date().toISOString().split("T")[0];
  const completedBy = qs("#completedBy")?.value || "(Not specified)";

// Clear any previous project metadata if user regenerates summary

   
  /* 1. Which categories are visible? */
  const selected = new Set(["A","B"]);
  qsa("#categoryFormEN input:checked, #categoryFormFR input:checked")
    .forEach(i => selected.add(i.value));

  /* 2. Compute scores                                                */
  selected.forEach(cat => {
    let total = 0, weight = 0, qList = [];

    ["", "f"].forEach(suffix => {
      qsa(`#step${cat} input[name^="cat${cat}q${suffix}"]:checked`)
        .forEach(input => {
          const txt = input.closest("fieldset").querySelector("legend").textContent;
          qList.push({ question: txt, answer: input.value });
          if (input.value in questionWeights) weight += questionWeights[input.value];
          total += 1;
        });
    });

    /* risk class ---------------------------------------------------- */
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

    // <td>${total ? `${weight.toFixed(1)} / ${total}` : "-"}</td>  ← saved for reactivation

body.insertAdjacentHTML("beforeend",
  `<tr><td>${categories[cat][lang]}</td>
       <td class="${css}">${status}</td></tr>`);

    if (qList.length) responses.push({ category: categories[cat][lang], questions: qList });
  });

  window.collectedResponses = responses;
  setVis(qs("#summaryTableContainer"), true);

/* ── hide intro & picker ───────────────────────────────────*/
setVis(qs("#rrit-intro"), false);
setVis(qs("#step0"),      false);

/* ── move summary to the top (once per summary) ───────────*/
placeSummaryTop();

/* ── show the help accordion ───────────────────────────────*/
setVis(qs("#riskSummaryHelp"), true);
   
/* ── show the help accordion ─────────────── */
setVis(qs("#riskSummaryHelp"), true);
   
/* ── NEW #1: hide intro & picker ───────────────────────── */
  setVis(qs("#rrit-intro"), false);
  setVis(qs("#step0"),      false);

  /* ── NEW #2: move summary panel just once ─────────────── */
  const firstPanel   = qs("#stepA");           // A is always present
  const summaryPanel = qs("#rrit-summary");
  if (summaryPanel && firstPanel &&
      summaryPanel.previousElementSibling !== null) {  // only if not already on top
    firstPanel.parentNode.insertBefore(summaryPanel, firstPanel);
  }

  /* scroll & update UI ------------------------------------ */
  const heading = qs("#rrit-summary");
  heading && requestAnimationFrame(() => {
    heading.scrollIntoView({ behavior: "smooth", block: "start" });
    heading.setAttribute("tabindex", "-1");
    heading.focus();
  });

  setTxt(qs('#rrit-summary p[data-lang="en"]'),
         "Risk profile summary generated. Review the results below, or click Edit Answers to make changes.");
  setTxt(qs('#rrit-summary p[data-lang="fr"]'),
         "Sommaire du profil de risque généré. Consultez les résultats ci-dessous ou cliquez sur Modifier les réponses pour apporter des changements.");

  /* buttons */
  setVis(qs("#generateSummaryBtn"), false);
  setVis(qs("#printSummaryBtn"), true);

/* ── NEW #3: unhide the wrapper row itself ─────────────── */
  setVis(qs("#postResultActions"), true);

  saveScenario(responses);
  showPostResultActions();
}
/* ---------- ACTION-BAR HANDLERS -------------------------- */
function showPostResultActions () {

  /* 1 – unhide the wrapper row itself */
  const bar = qs("#postResultActions");
  setVis(bar, true);                 // removes .hidden + aria-hidden

  /* 2 – reveal the individual buttons */
  ["editAnswersBtn", "newScenarioBtn", "printSummaryBtn"]
    .forEach(id => setVis(qs(`#${id}`), true));

  /* 3 – hide the Generate button so the row doesn’t duplicate */
  setVis(qs("#generateSummaryBtn"), false);
}
function editAnswersFlow() {
  const saved = loadScenario();
  if (!saved) return;

  setVis(qs("#summaryTableContainer"), false);
  setVis(qs("#printSummaryBtn"),      false);
  setVis(qs("#riskSummaryHelp"),      false);
  setVis(qs("#postResultActions"),    false);
  setVis(qs("#rrit-summary"), false); // hide summary panel

  setVis(qs("#rrit-intro"), true);
  setVis(qs("#step0"),      true);

  /* re-apply answers */
  saved.data.forEach(cat => cat.questions.forEach(q => {
    qs(`input[data-question="${q.question.replace(/"/g,'\\"')}"][value="${q.answer}"]`)?.click();
  }));
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
  if (!saved || !Array.isArray(saved.data) || !saved.data.length) return;

  // Restore answers to form inputs
  saved.data.forEach(cat => cat.questions.forEach(q => {
    qs(`input[data-question="${q.question.replace(/"/g, '\\"')}"][value="${q.answer}"]`)?.click();
  }));

  // Restore internal state
  window.collectedResponses = saved.data;

  collectCategories();
  generateSummary();
  showPostResultActions();
   
  qs("#rrit-summary")?.scrollIntoView({ behavior: "smooth" });
   
  // Hide "Back to Summary" link again
  qs("#backToSummary")?.classList.add("hidden");
}

/* ---------- CATEGORY VISIBILITY -------------------------- */
function collectCategories() {
  const lang     = currentLang;
  const formId   = lang === "en" ? "categoryFormEN" : "categoryFormFR";
  const selected = ["A","B", ...qsa(`#${formId} input:checked`).map(cb => cb.value)];

  Object.keys(categories).forEach(cat => {
    const sec = qs(`#step${cat}`);
    if (sec) setVis(sec, selected.includes(cat));
  });

  setTxt(qs("#statusMsg"), (lang === "en" ? "Categories shown: " : "Catégories affichées : ") + selected.join(", "));
}

/* ---------- LANGUAGE TOGGLE ------------------------------ */
function toggleLanguage(lang) {
  currentLang = lang;
  document.documentElement.setAttribute("lang", lang);

  qsa("[data-lang]").forEach(el => {
    const show = el.getAttribute("data-lang") === lang;
    el.classList.toggle("hidden", !show);
    el.setAttribute("aria-hidden", !show);
  });

  /* switcher state */
  qsa("#lang-switch a").forEach(a => a.toggleAttribute("aria-current", a.getAttribute("lang") === lang));

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

  /* Back to Summary */
   setVis(qs('#backToSummary span[data-lang="en"]'), lang === "en");
  setVis(qs('#backToSummary span[data-lang="fr"]'), lang === "fr");

   
  /* help accordion */
  setVis(qs("#riskHelpEN"), lang === "en");
  setVis(qs("#riskHelpFR"), lang === "fr");
  setTxt(qs("#riskSummaryHelpLabel"),
         lang === "en" ? "📘 How to interpret the Risk Summary"
                       : "📘 Comment interpréter le sommaire du profil de risque");

  syncResponses();
  if (!qs("#summaryTableContainer")?.classList.contains("hidden")) generateSummary();
}
window.toggleLanguage = toggleLanguage;

/* ---------- DOM READY ------------------------------------ */
document.addEventListener("DOMContentLoaded", () => {
  const browserLang = (navigator.languages?.[0] || navigator.language || "en").toLowerCase();
  toggleLanguage(browserLang.startsWith("fr") ? "fr" : "en");

  /* map questions → data-question attr (one-time retrofit) */
  qsa("fieldset").forEach(fs => {
    const q = fs.querySelector("legend")?.textContent.trim() || "";
    qsa('input[type="radio"],input[type="checkbox"]', fs).forEach(inp => inp.dataset.question = q);
  });

  /* category picker */
  qsa("#categoryFormEN input, #categoryFormFR input").forEach(cb => cb.addEventListener("change", collectCategories));

  /* action buttons */
  qs("#generateSummaryBtn")?.addEventListener("click", generateSummary);
   qs("#editAnswersBtn")?.addEventListener("click", editAnswersFlow);
  qs("#newScenarioBtn")?.addEventListener("click", startNewScenario);
  qs("#backToSummary") ?.addEventListener("click", returnToSummary);

/* ─── 5. Restore saved scenario, if any ─── */
const saved = loadScenario();
const hasResults = saved && Array.isArray(saved.data) && saved.data.length;
const summaryVisible = !qs("#summaryTableContainer")?.classList.contains("hidden");

if (hasResults && summaryVisible) {
  window.collectedResponses = saved.data;
  showPostResultActions();  // only show if results are still visible
} else {
  setVis(qs("#postResultActions"), false);   // hide Edit/New/Print row
  setVis(qs("#generateSummaryBtn"), true);   // show Generate button
}

  /* block initial WET auto-scroll */
  window.preventInitialScroll = true; setTimeout(()=>{ window.preventInitialScroll=false; }, 4000);
});
