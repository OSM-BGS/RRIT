
// ===== RRIT CONFIGURATION BLOCK =====

const questionWeights = {
  "No": 1,
  "Unknown": 0.5,
  "Non": 1,           // French "No"
  "Inconnu": 0.5      // French "Unknown"
};
const criticalCategories = ['A', 'B'];   // ← NEW
const riskLabels = {
  high:    { en: "Requires Risk Mitigation",        fr: "Requiert une atténuation des risques" },
  medium:  { en: "Further research required",       fr: "Recherche supplémentaire requise" },
  low:     { en: "Risks Mitigated / N/A",           fr: "Risques atténués / N/A" },
  notReviewed: { en: "Not reviewed",                fr: "Non examiné" }
};

const riskThresholds = {
  high: 0.4,    // High if ≥ 40% "bad" weight
  medium: 0.2   // Medium if ≥ 20% but < 40%
  // Otherwise Low
};

const categories = {
  A: { en: "Regulatory Compliance (Mandatory)", fr: "Conformité réglementaire (Obligatoire)" },
  B: { en: "Data Security and Privacy (Mandatory)", fr: "Sécurité des données et confidentialité (Obligatoire)" },
  C: { en: "HR Technology / Integration", fr: "Technologie RH / Intégration" },
  D: { en: "User Adoption and Training", fr: "Adoption et formation des utilisateurs" },
  E: { en: "Cost-Benefit Analysis", fr: "Analyse coûts-avantages" },
  F: { en: "Vendor Reliability and Support", fr: "Fiabilité et soutien du fournisseur" },
  G: { en: "Workforce Planning and Development", fr: "Planification et développement de la main-d'œuvre" },
  H: { en: "Employee Engagement and Culture Change", fr: "Mobilisation des employés et changement de culture" },
  I: { en: "Diversity and Inclusion Programs", fr: "Programmes de diversité et d'inclusion" },
  J: { en: "Organizational Restructuring", fr: "Restructuration organisationnelle" },
  K: { en: "Policy Development and Implementation", fr: "Élaboration et mise en œuvre des politiques" }
};

// ===== END CONFIGURATION =====


// ===== STATE =====


// ===== FUNCTIONS =====

function syncResponses() {
  const valueMap = {
    // EN → FR
    "Yes": "Oui",
    "No": "Non",
    "Unknown": "Inconnu",
    "Not Applicable": "Sans objet",
    // FR → EN
    "Oui": "Yes",
    "Non": "No",
    "Inconnu": "Unknown",
    "Sans objet": "Not Applicable"
  };

  document.querySelectorAll('input[type="radio"]:checked').forEach(src => {
    const otherName = src.name.endsWith('f')
      ? src.name.slice(0, -1)
      : src.name + 'f';
    const desiredValue = valueMap[src.value] || src.value;
    const twin = document.querySelector(
      `input[name="${otherName}"][value="${desiredValue}"]`
    );
    if (twin) twin.checked = true;
  });
}

function generateSummary() {
  const lang = currentLang || "en";
  const summaryBody = document.getElementById("summaryTableBody");
  summaryBody.innerHTML = "";

  const printResponses = [];

  // Always include A and B, and add only checked boxes from C–K
  const checkedInputs = document.querySelectorAll(
    "#categoryFormEN input:checked, #categoryFormFR input:checked"
  );

  const selectedCats = new Set(["A", "B"]);
  checkedInputs.forEach(input => {
    selectedCats.add(input.value);
  });

  const visibleCats = [...selectedCats];

  visibleCats.forEach(cat => {
    let totalPossibleWeight = 0;
    let accumulatedWeight = 0;
    const questions = [];

    // English answers
    document.querySelectorAll(`section#step${cat} input[name^="cat${cat}q"]:checked`).forEach(input => {
      const qText = input.closest("fieldset").querySelector("legend").textContent;
      const answer = input.value;
      questions.push({ question: qText, answer });

      if (answer in questionWeights) accumulatedWeight += questionWeights[answer];
      totalPossibleWeight += 1;
    });

    // French answers
    document.querySelectorAll(`section#step${cat} input[name^="cat${cat}qf"]:checked`).forEach(input => {
      const qText = input.closest("fieldset").querySelector("legend").textContent;
      const answer = input.value;
      questions.push({ question: qText, answer });

      if (answer in questionWeights) accumulatedWeight += questionWeights[answer];
      totalPossibleWeight += 1;
    });

    let riskStatus, riskClass;

    if (
      criticalCategories.includes(cat) &&
      questions.some(q => /^(No|Non|Unknown|Inconnu)$/.test(q.answer))
    ) {
      riskStatus = riskLabels.high[lang];
      riskClass = "risk-high";
    } else if (totalPossibleWeight === 0) {
      riskStatus = riskLabels.notReviewed[lang];
      riskClass = "text-muted";
    } else {
      const ratio = accumulatedWeight / totalPossibleWeight;
      if (ratio >= riskThresholds.high) {
        riskStatus = riskLabels.high[lang];
        riskClass = "risk-high";
      } else if (ratio >= riskThresholds.medium) {
        riskStatus = riskLabels.medium[lang];
        riskClass = "risk-medium";
      } else {
        riskStatus = riskLabels.low[lang];
        riskClass = "risk-low";
      }
    }

    summaryBody.insertAdjacentHTML(
      "beforeend",
      `<tr>
         <td>${categories[cat][lang]}</td>
         <td>${totalPossibleWeight > 0 ? `${accumulatedWeight.toFixed(1)} / ${totalPossibleWeight}` : "-"}</td>
         <td class="${riskClass}">${riskStatus}</td>
       </tr>`
    );

    if (questions.length) {
      printResponses.push({ category: categories[cat][lang], questions });
    }
  });

  window.collectedResponses = printResponses;

  const summaryEl = document.getElementById("summaryTableContainer");
  summaryEl.classList.remove("hidden");

// ── Scroll to the “Risk Profile Summary” heading ──
const summaryHeading = document.getElementById("rrit-summary");
if (summaryHeading) {
  // wait one paint-cycle so the new layout is in place
  requestAnimationFrame(() => {
    summaryHeading.scrollIntoView({ behavior: "smooth", block: "start" });
    summaryHeading.setAttribute("tabindex", "-1");  // a11y focus-target
    summaryHeading.focus();
  });
}
  
// ── Update instructional text once the summary is shown ──
document.querySelector('#rrit-summary p[data-lang="en"]').textContent =
  "Risk profile summary generated. Review the results below, or click Edit Answers to make changes.";
document.querySelector('#rrit-summary p[data-lang="fr"]').textContent =
  "Sommaire du profil de risque généré. Consultez les résultats ci-dessous ou cliquez sur Modifier les réponses pour apporter des changements.";
  
  const intro = document.getElementById('rrit-intro');
  const step0 = document.getElementById('step0');
  if (intro) {
    intro.classList.add("hidden");
    intro.setAttribute("aria-hidden", "true");
  }
  if (step0) {
    step0.classList.add("hidden");
    step0.setAttribute("aria-hidden", "true");
  }



  const rritSummary = document.getElementById("rrit-summary");
  const firstQuestion = document.getElementById("stepA");
  if (rritSummary && firstQuestion) {
    firstQuestion.parentNode.insertBefore(rritSummary, firstQuestion);
  }
  // ✅ Toggle visibility of summary control buttons
const generateBtn = document.getElementById("generateSummaryBtn");
const printBtn = document.getElementById("printSummaryBtn");
if (generateBtn) {
  generateBtn.classList.add("hidden");
  generateBtn.setAttribute("aria-hidden", "true");
}
if (printBtn) {
  printBtn.classList.remove("hidden");
  printBtn.setAttribute("aria-hidden", "false");
}
  // ✅ Show and expand accordion help block
const helpBlock = document.getElementById("riskSummaryHelp");
if (helpBlock) {
  helpBlock.classList.remove("hidden");
}
  
  /* ─── NEW: persist answers + show action bar ─── */
saveScenario(window.collectedResponses);
showPostResultActions();
}
/* =====  NEW -- Scenario persistence & action-bar helpers  ===== */

let currentLang = "en";             // used by toggleLanguage()

const STORAGE_KEY = "rrit_savedScenario";
function saveScenario(state) {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ savedAt: new Date().toISOString(), data: state })
  );
}
function loadScenario() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "null"); }
  catch { return null; }
}
function clearScenario() {
  localStorage.removeItem(STORAGE_KEY);
}

function showPostResultActions() {
  const bar = document.getElementById("postResultActions");
  if (bar) {
    bar.classList.remove("hidden");
    bar.setAttribute("aria-hidden", "false");
  }
}

function editAnswersFlow() {
  const data = loadScenario();
  if (!data) return;

  /* 1. Hide result details (table, Print button, help accordion),
       but keep #rrit-summary visible so the Generate button remains */
  document.getElementById("summaryTableContainer")?.classList.add("hidden");
  document.getElementById("printSummaryBtn")?.classList.add("hidden");
  document.getElementById("riskSummaryHelp")?.classList.add("hidden");
  document.getElementById("postResultActions")?.classList.add("hidden");

  /* 2. Show intro text */
  const intro = document.getElementById("rrit-intro");
  if (intro) {
    intro.classList.remove("hidden");
    intro.setAttribute("aria-hidden", "false");
  }

  /* 3. Collapse all open <details> panels */
  document
    .querySelectorAll('section[id^="step"] details[open]')
    .forEach(det => det.removeAttribute("open"));

  /* 4. Re-check saved answers */
  data.data.forEach(cat =>
    cat.questions.forEach(q => {
      const radio = document.querySelector(
        `input[data-question="${q.question.replace(/"/g, '\\"')}"][value="${q.answer}"]`
      );
      if (radio) radio.checked = true;
    })
  );

  /* 5. Refresh visible category panels */
  collectCategories();

  /* 5-bis. Ensure the category picker block (#step0) is shown */
  const step0 = document.getElementById("step0");
  if (step0) {
    step0.classList.remove("hidden");
    step0.setAttribute("aria-hidden", "false");
  }

  /* 5-ter. Toggle buttons: show Generate, hide Print */
  const gen = document.getElementById("generateSummaryBtn");
  if (gen) {
    gen.classList.remove("hidden");
    gen.setAttribute("aria-hidden", "false");
  }
  const print = document.getElementById("printSummaryBtn");
  if (print) {
    print.classList.add("hidden");
    print.setAttribute("aria-hidden", "true");
  }

  /* 6. Show & bind Back-to-Summary link */
  const back = document.getElementById("backToSummary");
  if (back) {
    back.classList.remove("hidden");
    back.setAttribute("aria-hidden", "false");
    back.onclick = returnToSummary;
  }

  /* 7. Scroll user to the intro section */
  intro?.scrollIntoView({ behavior: "smooth" });
}


function returnToSummary() {
  collectCategories();      // refresh visible panels
  generateSummary();        // rebuild scores & table
  document.getElementById("backToSummary")?.classList.add("hidden");
}

function startNewScenario() {
  const msg = currentLang === "fr"
    ? "Cette action supprimera vos réponses et démarrera un nouveau scénario. Continuer?"
    : "This will clear your answers and start a new scenario. Proceed?";
  if (!confirm(msg)) return;

  clearScenario();
  window.collectedResponses = [];

  /* uncheck everything */
  document.querySelectorAll('input[type="radio"],input[type="checkbox"]')
    .forEach(i => (i.checked = false));

  /* reset UI */
  document.getElementById("rrit-summary")?.classList.add("hidden");
  document.getElementById("postResultActions")?.classList.add("hidden");
  document.getElementById("rrit-intro")?.classList.remove("hidden");
  document.getElementById("step0")?.classList.remove("hidden");
  document.getElementById("rrit-intro")?.scrollIntoView({behavior:"smooth"});
}
// ===== UI and Bilingual Logic =====


function expandAllQuestions() {
  document.querySelectorAll(
    'section[id^="step"]:not(.hidden) details'
  ).forEach(det => det.setAttribute('open', ''));
}

function collectCategories() {
  const lang = currentLang;
  const formId = (lang === "en") ? "categoryFormEN" : "categoryFormFR";
  const selected = [...document.querySelectorAll("#" + formId + " input:checked")].map(cb => cb.value);
  const visibleCats = ["A", "B", ...selected];

  // Loop through all defined categories (A–K)
  Object.keys(categories).forEach(cat => {
    const sec = document.getElementById("step" + cat);
    if (!sec) return;

    if (visibleCats.includes(cat)) {
      sec.classList.remove("hidden");
      sec.setAttribute("aria-hidden", "false");
    } else {
      sec.classList.add("hidden");
      sec.setAttribute("aria-hidden", "true");
    }
  });

  // Update live feedback
  document.getElementById("statusMsg").textContent =
    (lang === "en" ? "Categories shown: " : "Catégories affichées : ") +
    visibleCats.join(", ");
}
// ===== On Page Load =====


document.addEventListener("DOMContentLoaded", () => {
  /* ─── 1. Detect browser language and set UI  ─── */
  const browserLang =
    (navigator.languages && navigator.languages.length)
      ? navigator.languages[0]
      : navigator.language || navigator.userLanguage || "en";
  toggleLanguage(browserLang.toLowerCase().startsWith("fr") ? "fr" : "en");

  /* ─── 2. ONE-TIME retrofit: add data-question to every input  ─── */
  document.querySelectorAll("fieldset").forEach(fs => {
    const qText = fs.querySelector("legend")?.textContent.trim() || "";
    fs.querySelectorAll('input[type="radio"], input[type="checkbox"]').forEach(inp => {
      inp.setAttribute("data-question", qText);
    });
  });

  /* ─── 3. Enable real-time toggling of category sections  ─── */
  document
    .querySelectorAll("#categoryFormEN input, #categoryFormFR input")
    .forEach(cb => cb.addEventListener("change", collectCategories));

  /* ─── 4. Wire the new action-flow buttons (if present in HTML)  ─── */
  document.getElementById("editAnswersBtn") ?.addEventListener("click", editAnswersFlow);
  document.getElementById("newScenarioBtn")  ?.addEventListener("click", startNewScenario);
  document.getElementById("backToSummary")  ?.addEventListener("click", returnToSummary);

  /* ─── 5. Restore saved scenario, if any  ─── */
  const saved = loadScenario();
  if (saved) {
    window.collectedResponses = saved.data || [];
    showPostResultActions();   // reveals the Edit/New buttons
  }

  /* ─── 6. Block initial WET auto-scroll (existing behaviour)  ─── */
  window.preventInitialScroll = true;
  setTimeout(() => { window.preventInitialScroll = false; }, 4000);
});

// ===== UI and Bilingual Logic =====

function toggleLanguage(lang) {
   currentLang = lang; /* remember the choice */

  // Set <html lang="..."> for accessibility and compliance
  document.documentElement.setAttribute("lang", lang);

// 2- Show or hide every bilingual element in the page
  document.querySelectorAll('[data-lang]').forEach(el => {
    const hide = el.getAttribute('data-lang') !== lang;
    el.classList.toggle('hidden', hide);
    el.setAttribute('aria-hidden', hide);
  });

  
 /* ---- NEW: update active link, no hiding ---- */
  document.querySelectorAll('#lang-switch a').forEach(a => {
    if (a.getAttribute('lang') === lang) {
      a.setAttribute('aria-current', 'page');
      a.focus();                         // optional: move focus
    } else {
      a.removeAttribute('aria-current');
    }
  });

  // Update the Generate Summary button bilingualy
  const genButton = document.querySelector('button[onclick="generateSummary()"]');
  if (genButton) {
    genButton.textContent = (lang === "en") ? "Generate Summary" : "Générer le résumé";
  }
 // Update the Print button label bilingualy (if visible)
const printButton = document.getElementById("printSummaryBtn");
if (printButton && !printButton.classList.contains("hidden")) {
  printButton.textContent = (lang === "en")
    ? "Print / Save as PDF"
    : "Imprimer / Enregistrer en PDF";
}
  // ✅ Update accordion help content based on language
const riskHelpEN = document.getElementById("riskHelpEN");
const riskHelpFR = document.getElementById("riskHelpFR");
if (riskHelpEN && riskHelpFR) {
  riskHelpEN.classList.toggle("hidden", lang !== "en");
  riskHelpFR.classList.toggle("hidden", lang !== "fr");
}

const helpLabel = document.getElementById("riskSummaryHelpLabel");
if (helpLabel) {
  helpLabel.textContent = (lang === "en")
    ? "📘 How to interpret the Risk Summary"
    : "📘 Comment interpréter le sommaire du profil de risque";
}
  // Keep answers in sync across languages
  syncResponses();

  // If the summary table is showing, regenerate it to update the language
  const summaryContainer = document.getElementById('summaryTableContainer');
const alreadyInteracted = document.querySelector('input[type="radio"]:checked');

if (summaryContainer && !summaryContainer.classList.contains('hidden') && alreadyInteracted) {
  generateSummary();
}

  // === [ARIA PATCH START] ===
  // Mark active language for screen readers
  document.querySelectorAll('#wb-lng a').forEach(link => {
    if (link.getAttribute('lang') === lang) {
      link.setAttribute('aria-current', 'page');
    } else {
      link.removeAttribute('aria-current');
    }
  });
  // === [ARIA PATCH END] ===
    /* ✱✱ NEW — shift focus to the link that is now visible ✱✱ */
  const activeLink = document.querySelector(`#wb-lng a[lang="${lang}"]`);
  if (activeLink) activeLink.focus();     // prevents “blocked aria-hidden” warning
}

window.toggleLanguage = toggleLanguage;

