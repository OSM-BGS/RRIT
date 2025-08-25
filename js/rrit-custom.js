/* =========================================================
   RRIT – Rapid Risk Identification Tool
   Refactored Version – 2025-07-24
   ========================================================= */

// === Feature flag & URL switch (must run first) ===
window.FEATURES = window.FEATURES || { useAccordionSummary: false };
(function () {
  try {
    const v = (new URLSearchParams(location.search).get('summary') || '').toLowerCase();
    if (v === 'acc')   window.FEATURES.useAccordionSummary = true;
    if (v === 'table') window.FEATURES.useAccordionSummary = false;
  } catch {}
})();

// === Load per-question annex (bilingual) ===
async function loadAnnex() {
  if (window.RISK_ANNEX) return window.RISK_ANNEX;
  const base = document.querySelector('base')?.getAttribute('href') || '';
  // Adjust automatically if site serves from /docs
  const likelyDocs = location.pathname.includes('/docs/');
  const url = (likelyDocs ? 'js/risk-annex.json' : 'js/risk-annex.json') + '?v=1';
  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error('Annex HTTP ' + res.status);
    window.RISK_ANNEX = await res.json();
  } catch (e) {
    console.warn('Annex load failed; proceeding without annex.', e);
    window.RISK_ANNEX = window.RISK_ANNEX || {};
  }
  return window.RISK_ANNEX;
}

// --- i18n + answer helpers ---
function getLang() {
  const raw = (document.documentElement.getAttribute('lang') ||
               document.documentElement.getAttribute('data-lang') || 'en').toLowerCase();
  return raw.startsWith('fr') ? 'fr' : 'en';
}
function t(en, fr) { return getLang()==='fr' ? (fr || en || '') : (en || fr || ''); }
function normalizeAnswer(ans) {
  const s = (ans || '').toString().trim().toLowerCase();
  if (['yes','oui','y','o'].includes(s)) return 'yes';
  if (['no','non','n'].includes(s)) return 'no';
  if (['unknown',"don't know",'inconnu','ne sait pas','ns','n/s'].includes(s)) return 'unknown';
  if (['n/a','na','not applicable','s.o.','so','sans objet'].includes(s)) return 'na';
  return s;
}
function translateAnswer(ans) {
  const norm = normalizeAnswer(ans), lang = getLang();
  const map = { yes:{en:'Yes',fr:'Oui'}, no:{en:'No',fr:'Non'}, unknown:{en:'Unknown',fr:'Inconnu'}, na:{en:'N/A',fr:'S.O.'} };
  return (map[norm] && map[norm][lang]) ? map[norm][lang] : (ans || '');
}

// Extract a single-language question string, with fallback when only a bilingual string exists
function extractQuestionText(q) {
  const lang = getLang();
  const rawEn = q?.question?.en || q?.question_en || (typeof q?.question === 'string' && !q?.question?.fr ? q.question : '');
  const rawFr = q?.question?.fr || q?.question_fr || '';
  if (lang === 'fr' && rawFr) return rawFr;
  if (lang !== 'fr' && rawEn) return rawEn;

  // Heuristic split for bilingual combined strings, e.g., "1. EN ? 1. FR ?" or "EN ? FR ?"
  let s = (q?.question || '').toString().trim();
  if (!s) return '';
  s = s.replace(/^Q\d+\.\s*/i, '').trim();      // drop "Q1. "
  s = s.replace(/^\d+\.\s*/, '').trim();        // drop leading "1. "

  // Try: capture until first '?' then look for a new numbered segment "1. " for the second language
  let m = s.match(/^(.+?\?)(?:\s*\d+\.\s*)(.+)$/);
  if (m) {
    const partEN = m[1].trim();
   const partFR = m[2].trim();
    return lang === 'fr' ? partFR : partEN;
  }
  // Fallback: split on separators around a first question mark (handles "EN ? — FR ?" variants)
  m = s.match(/^(.+?\?)[\s/–-]+(.+)$/);
  if (m) {
    const partEN = m[1].trim();
    const partFR = m[2].trim();
    return lang === 'fr' ? partFR : partEN;
  }
  // Last resort: return string as-is (better to show something than nothing)
  return s;
}

/* =========================================================
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

// RISK_ANNEX: per-question risk/mitigation lookup
const RISK_ANNEX = {
  A: {
    'A-1': {
      severity: 'high', critical: true,
      risk: { en: 'Personal data processed without DPIA increases compliance risk.', fr: 'Le traitement de données personnelles sans EFVP augmente le risque de conformité.' },
      mit:  { en: ['Conduct a DPIA before go-live.', 'Limit data fields to essentials.', 'Appoint a privacy contact.'],
              fr: ['Mener une EFVP avant la mise en service.', 'Limiter les champs de données au strict nécessaire.', 'Désigner un responsable confidentialité.'] }
    }
  },
  B: {
    'B-1': {
      severity: 'medium', critical: false,
      risk: { en: 'Inadequate security controls may expose sensitive HR data.', fr: 'Des contrôles de sécurité inadéquats peuvent exposer des données RH sensibles.' },
      mit:  { en: ['Implement multi-factor authentication.', 'Regular security audits.', 'Staff security training.'],
              fr: ['Mettre en place une authentification multi-facteurs.', 'Audits de sécurité réguliers.', 'Formation du personnel en sécurité.'] }
    },
    'B-2': {
      severity: 'high', critical: true,
      risk: { en: 'Unencrypted data transmission creates data breach risk.', fr: 'La transmission de données non chiffrées crée un risque de violation de données.' },
      mit:  { en: ['Use TLS encryption for all data transfers.', 'Implement secure API endpoints.', 'Monitor data access logs.'],
              fr: ['Utiliser le chiffrement TLS pour tous les transferts de données.', 'Mettre en place des points de terminaison API sécurisés.', 'Surveiller les journaux d\'accès aux données.'] }
    }
  }
};

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

const RRITState = {
    isEditing: false,
    setEditMode(value) {
        this.isEditing = value;
        handleButtonVisibility(value);
        console.log("[RRIT] Edit mode:", value);
    }
};

let currentLang = navigator.language.startsWith("fr") ? "fr" : "en";

// Utility functions
const qs  = s => document.querySelector(s);
const qsa = s => [...document.querySelectorAll(s)];
const setTxt = (el, txt) => el && (el.textContent = txt);
const setVis = (el, show = true) => {
  if (!el) return;
  el.classList.toggle("hidden", !show);
  
  if (!el.matches('button, [tabindex], a, input, select, textarea')) {
    el.setAttribute("aria-hidden", !show);
  }
};

/* =========================================================
   Section 2: Local Storage and Data Handling
   ========================================================= */

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

function clearScenario() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (err) {
    console.warn("[RRIT] Failed to clear scenario from storage.");
  }
}

function reassignQids() {
  qsa("fieldset[data-qid]").forEach(fs => {
    const qid = fs.dataset.qid;
    if (!qid) return;
    qsa('input[type="radio"], input[type="checkbox"]', fs).forEach(inp => {
      inp.dataset.qid = qid;
    });
  });
}

function collectCategories() {
  const lang = currentLang;
  console.log(`[RRIT] Collecting categories for language: ${lang}`);
  
  // FIXED: Read from BOTH forms to preserve selections across languages
  const enChecked = qsa(`#categoryFormEN input[type="checkbox"]:checked`).map(cb => cb.value);
  const frChecked = qsa(`#categoryFormFR input[type="checkbox"]:checked`).map(cb => cb.value);
  
  // Combine selections from both forms (union of both sets)
  const allSelected = new Set([...enChecked, ...frChecked]);
  const selected = ["A", "B", ...Array.from(allSelected)];
  
  console.log(`[RRIT] EN form selections: ${enChecked.join(', ')}`);
  console.log(`[RRIT] FR form selections: ${frChecked.join(', ')}`);
  console.log(`[RRIT] Combined selected categories: ${selected.join(', ')}`);

  // Show/hide category sections based on combined selection
  Object.keys(categories).forEach(cat => {
    const sec = qs(`#step${cat}`);
    if (sec) {
      const shouldShow = selected.includes(cat);
      setVis(sec, shouldShow);
      console.log(`[RRIT] Category ${cat}: ${shouldShow ? 'visible' : 'hidden'}`);
    }
  });

  // CRITICAL: Sync checkbox states between both forms
  syncCategoryCheckboxes(selected);

  // Force language display update for newly shown sections
  setTimeout(() => {
    updateLanguageDisplay();
  }, 10);

  if (RRITState.isEditing) {
    setTimeout(() => placeSummaryBottom(), 0);
  }

  updateCategoryStatusMessage();
}

function restoreResponses(scenario) {
  if (!scenario || !scenario.data || !Array.isArray(scenario.data)) {
    console.warn("[RRIT] Invalid scenario data for restoreResponses.");
    return;
  }

  console.log("[RRIT] Restoring scenario:", scenario);

  // Restore metadata
  const metadata = scenario.metadata || {};
  Object.entries({
    "#projectName": metadata.name,
    "#projectDesc": metadata.desc,
    "#assessmentDate": metadata.date,
    "#completedBy": metadata.completedBy
  }).forEach(([selector, value]) => {
    const el = qs(selector);
    if (el) el.value = value || "";
  });

  // Extract categories from saved data
  const selectedCats = new Set(["A", "B"]);
  scenario.data.forEach(catData => {
    const catCode = Object.entries(categories).find(
      ([_, val]) => val.en === catData.category || val.fr === catData.category
    )?.[0];
    
    if (catCode) selectedCats.add(catCode);
  });

  // Restore category checkboxes
  qsa("#categoryFormEN input[type=checkbox], #categoryFormFR input[type=checkbox]").forEach(cb => {
    if (!cb.disabled) {
      cb.checked = selectedCats.has(cb.value);
    }
  });

  collectCategories();

  // Restore all answers
  scenario.data.forEach(catData => {
    catData.questions.forEach(q => {
      const inputs = qsa(`input[data-qid="${q.qid}"]`);
      inputs.forEach(inp => {
        if (inp.type === "radio" && inp.value === q.answer) {
          inp.checked = true;
        } else if (inp.type === "checkbox" && Array.isArray(q.answer)) {
          inp.checked = q.answer.includes(inp.value);
        }
      });
    });
  });

  console.log("[RRIT] Scenario restoration complete. Categories restored:", [...selectedCats]);
}

/* =========================================================
   Section 3: Response Collection
   ========================================================= */

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

function validateResponses(responses) {
    if (!Array.isArray(responses)) {
        console.error('[RRIT] Invalid response format');
        return false;
    }
    return responses.every(r => r.qid && (r.value !== undefined));
}

/* =========================================================
   Section 4: Summary Generation and Risk Logic
   ========================================================= */

function generateSummary() {
    const isEditMode = RRITState.isEditing;
    
    if (isEditMode && window.editModeCleanup) {
        window.editModeCleanup();
        delete window.editModeCleanup;
        delete window.editCategoryHandler;
    }
    
    // Use accordion or table based on feature flag
    if (window.FEATURES && window.FEATURES.useAccordionSummary) {
        loadAnnex().then(() => {
            renderSummaryAccordion();
        }).catch(() => {
            // Fail open: render without annex if fetch fails
            renderSummaryAccordion();
        });
    } else {
        generateSummaryTable();
    }
    
    updateSummaryMessage(isEditMode);
    
    if (isEditMode) {
        const genBtn = qs("#generateSummaryBtn");
        if (genBtn) {
            genBtn.textContent = "Generate Summary";
        }
    }
    
    saveScenario(window.collectedResponses);
    if (isEditMode) {
        RRITState.setEditMode(false);
    }
}

function updateSummaryMessage(isEditMode) {
    const msg = {
        en: isEditMode ? 
            "Summary updated with your changes." : 
            "", // Empty string, not missing
        fr: isEditMode ?
            "Sommaire mis à jour avec vos modifications." :
            "", // Empty string, not missing
    };
    
    setTxt(qs('#rrit-summary p[data-lang="en"]'), msg.en);
    setTxt(qs('#rrit-summary p[data-lang="fr"]'), msg.fr);
}

// Helper function to generate question card markup
function questionCardMarkup(catId, q, idx) {
  const qid = q.qid || `${catId}-${idx+1}`;

  // ⟵ replace previous language picking with this single line
  const questionText = extractQuestionText(q);

  const rawAnswer = (q.answer || '').toString();
  const norm = normalizeAnswer(rawAnswer);
  const answerLabel = translateAnswer(rawAnswer);

  // Merge annex (per-question bilingual content)
  const annex = (window.RISK_ANNEX?.[catId]?.[qid]) || null;
  const riskEn = q.riskStatement?.en || q.riskStatementEn || annex?.risk?.en || '';
  const riskFr = q.riskStatement?.fr || q.riskStatementFr || annex?.risk?.fr || '';
  const mitEn  = q.mitigations?.en || q.mitigationsEn || annex?.mit?.en || [];
  const mitFr  = q.mitigations?.fr || q.mitigationsFr || annex?.mit?.fr || [];
  const sev    = q.severity || annex?.severity || null;
  const crit   = !!(q.critical || annex?.critical);

  // Show risk details only for No / Unknown
  const showRisk = (norm === 'no' || norm === 'unknown');

  // Pick mitigation list for active lang; fallback to the other if empty
  const isFR = getLang() === 'fr';
  const mitList = isFR
    ? (Array.isArray(mitFr) && mitFr.length ? mitFr : (Array.isArray(mitEn) ? mitEn : []))
    : (Array.isArray(mitEn) && mitEn.length ? mitEn : (Array.isArray(mitFr) ? mitFr : []));

  const sevBadge  = sev ? `<span class="badge sev-${sev}">${sev}</span>` : '';
  const critBadge = crit ? `<span class="badge crit">${t('Critical','Critique')}</span>` : '';

  return `
    <li class="q-card">
      <div class="q-head">
        <div class="q-title">${questionText}</div>
        <div class="q-meta"><em>${t('Answer','Réponse')}:</em> ${answerLabel} ${sevBadge} ${critBadge}</div>
      </div>
      ${showRisk ? `
      <div class="q-body">
        <div class="q-risk">
          <h5 class="q-sec">${t('Risk statement','Énoncé du risque')}</h5>
          <p>${t(riskEn, riskFr) || '<span class="muted">—</span>'}</p>
        </div>
        <div class="q-mit">
          <h5 class="q-sec">${t('Mitigation strategies',"Stratégies d'atténuation")}</h5>
          ${mitList.length ? `<ul class="mit-list">${mitList.map(m=>`<li>${m}</li>`).join('')}</ul>` : `<p class="muted">—</p>`}
        </div>
      </div>` : ``}
    </li>`;
}

// === New: Accessible accordion summary renderer ===
function renderSummaryAccordion() {
  // Selected categories: A & B mandatory + any checked in EN/FR forms
  const sel = new Set(['A','B']);
  document.querySelectorAll('#categoryFormEN input[type=checkbox]:checked, #categoryFormFR input[type=checkbox]:checked')
    .forEach(cb => sel.add(cb.value || cb.getAttribute('data-cat') || ''));
  const selected = [...sel].filter(Boolean);

  // Collect responses for global storage
  const allResponses = [];
  selected.forEach(cat => {
    let qList = [];
    qsa(`#step${cat} input[name^="cat${cat}q"]:checked`).forEach(input => {
      const fs = input.closest("fieldset");
      const qid = input.dataset.qid || fs?.dataset.qid || "";
      const txt = fs?.querySelector("legend")?.textContent || "";
      qList.push({ qid, question: txt, answer: input.value });
    });
    if (qList.length) {
      allResponses.push({ category: cat, questions: qList });
    }
  });

  console.log("[RRIT] Collected accordion responses:", allResponses);
  window.collectedResponses = allResponses;

  // Use collectedResponses if present; otherwise stub by category
  const responses = Array.isArray(window.collectedResponses) ? window.collectedResponses
                   : selected.map(id => ({ category: id, questions: [] }));

  // Simple, safe RAG (replace with repo thresholds if available here)
  const val = s => (s||'').toString().toLowerCase();
  const ragFor = (id, qs=[]) => {
    if (['A','B'].includes(id) && qs.some(q => ['no','unknown'].includes(val(q.answer)))) return 'high';
    const answered = qs.filter(q => ['yes','no','unknown','n/a','na','not applicable'].includes(val(q.answer)));
    if (!answered.length) return 'notReviewed';
    const yes = answered.filter(q => val(q.answer)==='yes').length / answered.length;
    return yes >= 0.75 ? 'low' : yes >= 0.5 ? 'medium' : 'high';
  };

  // Build list + counts
  const counts = {high:0,medium:0,low:0,notReviewed:0};
  const cats = selected.map(id => {
    const rec = responses.find(r => (r.category === id || r.category?.startsWith(id))) || {questions:[]};
    const rag = ragFor(id, rec.questions);
    counts[rag] = (counts[rag]||0)+1;
    return { id, rag, rec };
  });

  // Overview cards
  const ov = document.getElementById('summaryOverview');
  if (ov) ov.innerHTML = `
    <div class="card"><strong>Categories assessed</strong><div>${cats.length}</div></div>
    <div class="card"><strong>High risk</strong><div>${counts.high||0}</div></div>
    <div class="card"><strong>Medium risk</strong><div>${counts.medium||0}</div></div>
    <div class="card"><strong>Low risk</strong><div>${counts.low||0}</div></div>`;

  // Category names
  const names = {
    A:{en:'Regulatory Compliance', fr:'Conformité réglementaire'},
    B:{en:'Data Security & Privacy', fr:'Sécurité des données et vie privée'},
    C:{en:'HR Technology / Integration', fr:'Technologie RH / Intégration'},
    D:{en:'User Adoption & Training', fr:'Adoption et formation des utilisateurs'},
    E:{en:'Cost-Benefit Analysis', fr:'Analyse coûts-avantages'},
    F:{en:'Vendor Reliability & Support', fr:'Fiabilité et soutien du fournisseur'},
    G:{en:'Workforce Planning & Development', fr:'Planification et développement de la main-d\'œuvre'},
    H:{en:'Employee Engagement & Culture Change', fr:'Mobilisation des employés & changement de culture'},
    I:{en:'Strategic Alignment', fr:'Alignement stratégique'},
    J:{en:'Accessibility & Inclusion', fr:'Accessibilité et inclusion'},
    K:{en:'Policy Development & Implementation', fr:'Élaboration & mise en œuvre des politiques'}
  };
  const ragTxt = {high:'High risk', medium:'Medium risk', low:'Low risk', notReviewed:'Not reviewed'};
  const lights = r => r==='high' ? '<span class="dot active"></span><span class="dot"></span><span class="dot"></span>'
                     : r==='medium'? '<span class="dot"></span><span class="dot active"></span><span class="dot"></span>'
                     : r==='low'   ? '<span class="dot"></span><span class="dot"></span><span class="dot active"></span>'
                     : '<span class="dot"></span><span class="dot"></span><span class="dot"></span>';

  // Accordion markup
  const root = document.getElementById('summaryAccordion');
  if (root) root.innerHTML = cats.map(c => {
    const nm = names[c.id] || {en:c.id, fr:c.id};
    const qaCards = (c.rec.questions || []).map((q,i) => questionCardMarkup(c.id, q, i)).join('');
    const panelHtml = `
      <div class="panel-grid single-col">
        <div class="box">
          <ol class="qa-cards">
            ${qaCards || `<li class="q-card empty"><span class="muted"><span lang="en">No answers recorded.</span><span lang="fr">Aucune réponse enregistrée.</span></span></li>`}
          </ol>
        </div>
      </div>`;
    return `
      <div class="acc-item">
        <button class="acc-trigger" id="acc-${c.id}" aria-expanded="false" aria-controls="panel-${c.id}">
          <span class="acc-left">
            <span class="cat-pill">${c.id}</span>
            <span class="cat-name"><span lang="en">${nm.en}</span><span lang="fr">${nm.fr}</span></span>
          </span>
          <span class="rag"><span class="rag-lights" aria-hidden="true">${lights(c.rag)}</span><span class="rag-text">${ragTxt[c.rag]}</span></span>
          <span class="chev">▼</span>
        </button>
        <div class="acc-panel" id="panel-${c.id}" aria-hidden="true" style="display:none;">
          ${panelHtml}
        </div>
      </div>
    `;
  }).join('');

  // Show accordion, hide table and intro
  setVis(qs("#summaryAccordionContainer"), true);
  setVis(qs("#summaryTableContainer"), false);
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

  // Add accordion interaction handlers
  addAccordionHandlers();
  
  handleButtonVisibility(RRITState.isEditing);
  saveScenario(allResponses);
}

function addAccordionHandlers() {
  // Remove existing listeners to avoid duplicates
  qsa('.acc-trigger').forEach(btn => {
    btn.replaceWith(btn.cloneNode(true));
  });
  
  // Add click handlers to all accordion triggers
  qsa('.acc-trigger').forEach(btn => {
    btn.addEventListener('click', function(e) {
      e.preventDefault();
      const panel = document.getElementById(this.getAttribute('aria-controls'));
      const chev = this.querySelector('.chev');
      const isExpanded = this.getAttribute('aria-expanded') === 'true';
      
      if (isExpanded) {
        // Collapse
        this.setAttribute('aria-expanded', 'false');
        panel.setAttribute('aria-hidden', 'true');
        panel.style.display = 'none';
        if (chev) chev.textContent = '▼';
      } else {
        // Expand
        this.setAttribute('aria-expanded', 'true');
        panel.setAttribute('aria-hidden', 'false');
        panel.style.display = 'block';
        if (chev) chev.textContent = '▲';
      }
    });
    
    // Add keyboard support
    btn.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        this.click();
      }
    });
  });
}

function generateSummaryTable() {
  const lang = currentLang;
  const body = qs("#summaryTableBody");
  body.innerHTML = "";
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

  setVis(qs("#summaryTableContainer"), true);
  setVis(qs("#summaryAccordionContainer"), false);
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

  handleButtonVisibility(RRITState.isEditing);
  saveScenario(responses);
}

/* =========================================================
   Section 5: UI Management and Button Visibility
   ========================================================= */

function handleButtonVisibility(isEditing) {
    const buttons = {
        generateSummaryBtn: isEditing,
        editAnswersBtn: !isEditing,
        newScenarioBtn: !isEditing,
        printSummaryBtn: true
    };

    const summaryActionRow = qs("#summaryActionRow");
    if (summaryActionRow) {
        summaryActionRow.style.display = "flex";
        summaryActionRow.classList.remove("hidden");
    }

    const postResultActions = qs("#postResultActions");
    if (postResultActions) {
        if (isEditing) {
            postResultActions.classList.add("hidden");
            postResultActions.setAttribute("aria-hidden", "true");
        } else {
            postResultActions.classList.remove("hidden");
            postResultActions.removeAttribute("aria-hidden");
        }
    }

    Object.entries(buttons).forEach(([id, show]) => {
        const btn = qs(`#${id}`);
        if (btn) {
            btn.classList.remove("hidden");
            btn.style.display = show ? "inline-block" : "none";
            btn.removeAttribute("aria-hidden");
            btn.disabled = false;
        }
    });

    console.log("[RRIT] Edit mode:", isEditing, "Button states:", buttons);
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
  
  if (summaryPanel && last && summaryPanel.parentNode) {
    if (summaryPanel.nextElementSibling !== null || 
        summaryPanel.previousElementSibling !== last) {
      last.parentNode.insertBefore(summaryPanel, last.nextSibling);
      console.log("[RRIT] Summary panel repositioned after:", last.id);
    }
  }
}

/* =========================================================
   Section 6: Edit Flow Management
   ========================================================= */

function editAnswersFlow() {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!saved) {
        console.warn("[RRIT] No saved data found for editing");
        return;
    }

    RRITState.setEditMode(true);

    setVis(qs("#step0"), true);
    restoreResponses(saved);

    const hideElements = ["#summaryTableContainer", "#summaryAccordionContainer", "#postResultActions", 
                         "#riskSummaryHelp", "#rrit-intro"];
    hideElements.forEach(el => setVis(qs(el), false));

    const summaryPanel = qs("#rrit-summary");
    if (summaryPanel) {
        summaryPanel.classList.remove("hidden");
        summaryPanel.removeAttribute("aria-hidden");
        
        setTxt(qs('#rrit-summary p[data-lang="en"]'),
            "Review your answers above, then click below to generate an updated summary.");
        setTxt(qs('#rrit-summary p[data-lang="fr"]'),
            "Examinez vos réponses ci-dessus, puis cliquez ci-dessous pour générer un résumé mis à jour.");
    }

    const summaryActionRow = qs("#summaryActionRow");
    const genBtn = qs("#generateSummaryBtn");
    if (genBtn && summaryActionRow) {
        summaryActionRow.style.display = "flex";
        summaryActionRow.classList.remove("hidden");
        genBtn.style.display = "inline-block";
        genBtn.classList.remove("hidden");
        genBtn.removeAttribute("aria-hidden");
        
        const buttonText = currentLang === "en" ? 
            "Generate Updated Summary" : 
            "Générer le sommaire mis à jour";
        genBtn.textContent = buttonText;
    }

    collectCategories();
    
    window.editModeCleanup = () => {
        qsa("#categoryFormEN input, #categoryFormFR input").forEach(checkbox => {
            checkbox.removeEventListener('change', window.editCategoryHandler);
        });
    };

    window.editCategoryHandler = () => {
        setTimeout(() => placeSummaryBottom(), 100);
    };
    
    qsa("#categoryFormEN input, #categoryFormFR input").forEach(checkbox => {
        checkbox.addEventListener('change', window.editCategoryHandler);
    });
    
    placeSummaryBottom();
    document.getElementById("step0")?.scrollIntoView({ behavior: "smooth" });
    
    console.log("[RRIT] Edit mode activated with visible summary panel");
}

/* =========================================================
   Section 7: Event Listeners and Initialization
   ========================================================= */

function initializeEventListeners() {
    const buttonHandlers = {
        generateSummaryBtn: generateSummary,
        editAnswersBtn: editAnswersFlow,
        newScenarioBtn: () => { 
            clearScenario();
            window.location.reload();
        },
        printSummaryBtn: () => {
            document.documentElement.setAttribute('data-print-lang', currentLang);
            
            console.log('Setting data-content for project info fields...');
            
            // Set project info field content as data attributes for CSS display
            qsa('#projectInfo input[type="text"], #projectInfo input[type="date"], #projectInfo textarea').forEach(input => {
                const fieldset = input.closest('fieldset');
                console.log('Field:', input.name || input.id, 'Value:', `"${input.value}"`, 'Has fieldset:', !!fieldset);
                
                if (fieldset) {
                    if (input.value && input.value.trim()) {
                        fieldset.setAttribute('data-content', input.value);
                        console.log('✓ Set data-content:', input.value);
                    } else {
                        console.log('✗ Empty value for field:', input.name || input.id);
                    }
                }
            });
            
            // Debug output
            qsa('#projectInfo fieldset[data-content]').forEach(fieldset => {
                console.log('Fieldset with data-content:', fieldset.getAttribute('data-content'));
            });
            
            setTimeout(() => {
                window.print();
                setTimeout(() => {
                    document.documentElement.removeAttribute('data-print-lang');
                    qsa('#projectInfo fieldset[data-content]').forEach(fieldset => {
                        fieldset.removeAttribute('data-content');
                    });
                }, 500);
            }, 100);
        },
        langEN: () => toggleLanguage('en'),
        langFR: () => toggleLanguage('fr')
    };

    Object.entries(buttonHandlers).forEach(([id, handler]) => {
        const btn = qs(`#${id}`);
        if (btn) {
            const newBtn = btn.cloneNode(true);
            btn.replaceWith(newBtn);
            newBtn.addEventListener('click', handler);
            console.log(`[RRIT] Initialized ${id} button`);
        }
    });
}

function initializeCategoryListeners() {
    console.log('[RRIT] Initializing category listeners...');
    
    // Remove existing listeners first
    qsa("#categoryFormEN input, #categoryFormFR input").forEach(inp => {
        inp.removeEventListener("change", collectCategories);
    });
    
    // Add listeners to both English and French forms
    qsa("#categoryFormEN input[type='checkbox'], #categoryFormFR input[type='checkbox']").forEach(inp => {
        if (!inp.disabled) { // Skip mandatory categories A and B
            inp.addEventListener("change", (event) => {
                console.log(`[RRIT] Category ${event.target.value} changed to: ${event.target.checked}, Language: ${currentLang}`);
                
                // Immediately sync the same checkbox in the other form
                const otherFormId = currentLang === "en" ? "categoryFormFR" : "categoryFormEN";
                const otherCheckbox = qs(`#${otherFormId} input[value="${event.target.value}"]`);
                
                if (otherCheckbox && !otherCheckbox.disabled) {
                    otherCheckbox.checked = event.target.checked;
                    console.log(`[RRIT] Synced ${event.target.value} in ${otherFormId}: ${event.target.checked}`);
                }
                
                // Then collect categories
                collectCategories();
                
                // Force language display update after category changes
                setTimeout(() => {
                    updateLanguageDisplay();
                }, 50);
            });
        }
    });
    
    console.log('[RRIT] Category listeners initialized for both forms');
}

document.addEventListener("DOMContentLoaded", () => {
    console.log('[RRIT] Initializing RRIT application...');
    
    // Set default language and apply display rules immediately
    currentLang = 'en';
    document.documentElement.lang = currentLang;
    
    // Apply language display immediately
    setTimeout(() => {
        updateLanguageDisplay();
        console.log('[RRIT] Initial language display applied');
    }, 10);
    
    // Initialize event listeners
    initializeEventListeners();
    initializeCategoryListeners();
    
    console.log('[RRIT] Application initialized successfully');
});

/* =========================================================
   Section 8: Language Management
   ========================================================= */

function toggleLanguage(lang) {
    console.log(`[RRIT] Switching to language: ${lang}`);
    
    // Update current language FIRST
    currentLang = lang;
    
    // Get all content elements (EXCLUDE language switcher buttons)
    const enElements = document.querySelectorAll('[data-lang="en"]:not(.lang-link):not(#wb-lng [data-lang="en"])');
    const frElements = document.querySelectorAll('[data-lang="fr"]:not(.lang-link):not(#wb-lng [data-lang="fr"])');
    
    if (lang === 'en') {
        // Show English content
        enElements.forEach(el => {
            el.classList.remove('hidden');
            el.setAttribute('aria-hidden', 'false');
        });
        
        // Hide French content
        frElements.forEach(el => {
            el.classList.add('hidden');
            el.setAttribute('aria-hidden', 'true');
        });
        
    } else if (lang === 'fr') {
        // Show French content
        frElements.forEach(el => {
            el.classList.remove('hidden');
            el.setAttribute('aria-hidden', 'false');
        });
        
        // Hide English content
        enElements.forEach(el => {
            el.classList.add('hidden');
            el.setAttribute('aria-hidden', 'true');
        });
    }
    
    // ALWAYS keep both language switcher buttons visible and update their styling
    const langEn = document.querySelector('a[onclick*="toggleLanguage(\'en\')"]');
    const langFr = document.querySelector('a[onclick*="toggleLanguage(\'fr\')"]');
    
    if (langEn && langFr) {
        // Ensure both buttons are always visible
        langEn.classList.remove('hidden');
        langFr.classList.remove('hidden');
        langEn.removeAttribute('aria-hidden');
        langFr.removeAttribute('aria-hidden');
        
        // Update active styling
        if (lang === 'en') {
            langEn.classList.add('active');
            langFr.classList.remove('active');
        } else {
            langFr.classList.add('active');
            langEn.classList.remove('active');
        }
    }
    
    // Update page language attribute
    document.documentElement.lang = lang;
    
    // CRITICAL: Re-collect categories after language change
    setTimeout(() => {
        collectCategories();
        updateLanguageDisplay();
        updateButtonText();
        updateCategoryStatusMessage();
    }, 50);
    
    // Announce language change
    const announcement = document.getElementById('lang-announcement');
    if (announcement) {
        announcement.textContent = lang === 'en' ? 
            'Language changed to English' : 
            'Langue changée en français';
    }
    
    console.log(`[RRIT] Language switched to: ${lang}`);
}

function updateLanguageDisplay() {
    console.log(`[RRIT] Updating language display to: ${currentLang}`);
    
    // Get content elements but EXCLUDE language switcher buttons
    const contentSelector = [
        '[data-lang="en"]:not(.lang-link):not(#wb-lng [data-lang="en"])',
        '[data-lang="fr"]:not(.lang-link):not(#wb-lng [data-lang="fr"])',
        '[lang="en"]:not(.lang-link):not(#wb-lng [lang="en"])', 
        '[lang="fr"]:not(.lang-link):not(#wb-lng [lang="fr"])'
    ].join(', ');
    
    const langElements = qsa(contentSelector);
    
    langElements.forEach(el => {
        const elLang = el.getAttribute('data-lang') || el.getAttribute('lang');
        const shouldShow = elLang === currentLang;
        el.classList.toggle('hidden', !shouldShow);
        
        if (shouldShow) {
            el.removeAttribute('aria-hidden');
        } else {
            el.setAttribute('aria-hidden', 'true');
        }
    });
    
    // ENSURE language switcher buttons stay visible
    const langSwitcher = qs('#wb-lng');
    if (langSwitcher) {
        langSwitcher.classList.remove('hidden');
        langSwitcher.removeAttribute('aria-hidden');
        
        // Ensure both language links stay visible
        qsa('#wb-lng .lang-link').forEach(link => {
            link.classList.remove('hidden');
            link.removeAttribute('aria-hidden');
        });
    }
    
    // Special handling for risk summary help sections
    const riskHelpEN = qs("#riskHelpEN");
    const riskHelpFR = qs("#riskHelpFR");
    
    if (riskHelpEN && riskHelpFR) {
        if (currentLang === "en") {
            riskHelpEN.classList.remove('hidden');
            riskHelpEN.removeAttribute('aria-hidden');
            riskHelpFR.classList.add('hidden');
            riskHelpFR.setAttribute('aria-hidden', 'true');
        } else {
            riskHelpFR.classList.remove('hidden');
            riskHelpFR.removeAttribute('aria-hidden');
            riskHelpEN.classList.add('hidden');
            riskHelpEN.setAttribute('aria-hidden', 'true');
        }
    }
    
    // Update the summary help label text
    const riskSummaryHelpLabel = qs("#riskSummaryHelpLabel");
    if (riskSummaryHelpLabel) {
        const labelText = currentLang === "en" ? 
            "📘 How to interpret the Risk Summary" : 
            "📘 Comment interpréter le sommaire du profil de risque";
        riskSummaryHelpLabel.textContent = labelText;
    }
    
    // Ensure essential containers stay visible
    const essentialElements = ['#step0', '#projectInfo', '#rrit-intro'];
    essentialElements.forEach(selector => {
        const el = qs(selector);
        if (el) {
            el.classList.remove('hidden');
            el.removeAttribute('aria-hidden');
        }
    });
    
    updateCategoryStatusMessage();
    updateButtonText();
    
    if (qs("#summaryTableContainer:not(.hidden)") || qs("#summaryAccordionContainer:not(.hidden)")) {
        regenerateSummaryTable();
    }
    
    console.log(`[RRIT] Language display updated to: ${currentLang}`);
}

function updateCategoryStatusMessage() {
    const formId = currentLang === "en" ? "categoryFormEN" : "categoryFormFR";
    const selected = ["A", "B", ...qsa(`#${formId} input:checked`).map(cb => cb.value)];
    
    const translatedNames = selected.map(cat => categories[cat][currentLang]);
    
    const prefix = currentLang === "en" ? "Categories shown: " : "Catégories affichées : ";
    setTxt(qs("#statusMsg"), prefix + translatedNames.join(", "));
}

function updateButtonText() {
    const buttonTexts = {
        en: {
            generateSummaryBtn: RRITState.isEditing ? "Generate Updated Summary" : "Generate Summary",
            editAnswersBtn: "Edit Answers",
            newScenarioBtn: "Start New Scenario",
            printSummaryBtn: "Print / Save as PDF"
        },
        fr: {
            generateSummaryBtn: RRITState.isEditing ? "Générer le sommaire mis à jour" : "Générer le sommaire",
            editAnswersBtn: "Modifier les réponses",
            newScenarioBtn: "Nouveau scénario",
            printSummaryBtn: "Imprimer / Sauvegarder en PDF"
        }
    };
    
    Object.entries(buttonTexts[currentLang]).forEach(([id, text]) => {
        const btn = qs(`#${id}`);
        if (btn) {
            btn.textContent = text;
        }
    });
}

function regenerateSummaryTable() {
    if (window.collectedResponses && window.collectedResponses.length > 0) {
        if (window.FEATURES && window.FEATURES.useAccordionSummary) {
            loadAnnex().then(() => {
                renderSummaryAccordion();
            }).catch(() => {
                // Fail open: render without annex if fetch fails
                renderSummaryAccordion();
            });
        } else {
            generateSummaryTable();
        }
    }
}

/* =========================================================
   Debug Functions
   ========================================================= */

function debugPrintLanguage() {
    console.log('Current language:', currentLang);
    console.log('HTML data-print-lang:', document.documentElement.getAttribute('data-print-lang'));
    console.log('English elements:', qsa('[data-lang="en"], [lang="en"]').length);
    console.log('French elements:', qsa('[data-lang="fr"], [lang="fr"]').length);
}

function syncCategoryCheckboxes(selectedCategories) {
  console.log(`[RRIT] Syncing checkboxes for categories: ${selectedCategories.join(', ')}`);
  
  // Get all category checkboxes from both forms
  const allCheckboxes = qsa("#categoryFormEN input[type='checkbox'], #categoryFormFR input[type='checkbox']");
  
  allCheckboxes.forEach(checkbox => {
    if (!checkbox.disabled) { // Don't touch A and B (mandatory)
      const shouldBeChecked = selectedCategories.includes(checkbox.value);
      
      if (checkbox.checked !== shouldBeChecked) {
        checkbox.checked = shouldBeChecked;
        console.log(`[RRIT] Synced ${checkbox.value} checkbox: ${shouldBeChecked}`);
      }
    }
  });
}

// === Language change observer for accordion re-rendering ===
(function observeLangChange(){
  try {
    const obs = new MutationObserver(ms=>{
      if (ms.some(m=>m.attributeName==='lang' || m.attributeName==='data-lang')) {
        if (window.FEATURES?.useAccordionSummary && typeof renderSummaryAccordion==='function') {
          renderSummaryAccordion();
        }
      }
    });
    obs.observe(document.documentElement, { attributes:true, attributeFilter:['lang','data-lang'] });
  } catch {}
})();
