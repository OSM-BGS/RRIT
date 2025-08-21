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

const categories = {
  A: { en: "Regulatory Compliance (Mandatory)",           fr: "Conformité réglementaire (Obligatoire)" },
  B: { en: "Data Security and Privacy (Mandatory)",       fr: "Sécurité des données et confidentialité (Obligatoire)" },
  C: { en: "HR Technology / Integration",                 fr: "Technologie RH / Intégration" },
  D: { en: "User Adoption and Training",                  fr: "Adoption et formation des utilisateurs" },
  E: { en: "Cost-Benefit Analysis",                       fr: "Analyse coûts-avantages" },
  F: { en: "Vendor Reliability and Support",              fr: "Fiabilité et soutien du fournisseur" },
  G: { en: "Workforce Planning and Development",          fr: "Planification et développement de la main-d'oeuvre" },
  H: { en: "Employee Engagement and Culture Change",      fr: "Mobilisation des employés et changement de culture" },
  I: { en: "Diversity and Inclusion Programs",            fr: "Programmes de diversité et d'inclusion" },
  J: { en: "Organizational Restructuring",                fr: "Restructuration organisationnelle" },
  K: { en: "Policy Development and Implementation",       fr: "Élaboration et mise en oeuvre des politiques" }
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

function renderSummaryAccordion() {
  // 1) Build selected categories: A & B mandatory + any checked
  const sel = new Set(['A','B']);
  document.querySelectorAll('#categoryFormEN input[type=checkbox]:checked,[id="categoryFormFR"] input[type=checkbox]:checked')
    .forEach(cb => sel.add(cb.value || cb.getAttribute('data-cat') || ''));
  const selected = [...sel].filter(Boolean);

  // 2) Build a tiny model from existing collectedResponses if present, otherwise from DOM
  const responses = Array.isArray(window.collectedResponses) ? window.collectedResponses : selected.map(id => ({
    category: id, questions: []
  }));

  // 3) Placeholder RAG (replace with your thresholds if available in scope)
  const ragFor = (id, qs=[]) => {
    const val = s => (s||'').toString().toLowerCase();
    if (['A','B'].includes(id) && qs.some(q => ['no','unknown'].includes(val(q.answer)))) return 'high';
    const answered = qs.filter(q => ['yes','no','unknown','n/a','na','not applicable'].includes(val(q.answer)));
    if (!answered.length) return 'notReviewed';
    const yes = answered.filter(q => val(q.answer)==='yes').length / answered.length;
    return yes >= 0.75 ? 'low' : yes >= 0.5 ? 'medium' : 'high';
  };

  // 4) Overview
  const counts = {high:0,medium:0,low:0,notReviewed:0};
  const cats = selected.map(id => {
    const rec = responses.find(r => (r.category === id || r.category?.startsWith(id))) || {questions:[]};
    const rag = ragFor(id, rec.questions);
    counts[rag] = (counts[rag]||0)+1;
    return { id, rag, rec };
  });
  const ov = document.getElementById('summaryOverview');
  if (ov) ov.innerHTML = `
    <div class="card"><strong>Categories assessed</strong><div>${cats.length}</div></div>
    <div class="card"><strong>High risk</strong><div>${counts.high||0}</div></div>
    <div class="card"><strong>Medium risk</strong><div>${counts.medium||0}</div></div>
    <div class="card"><strong>Low risk</strong><div>${counts.low||0}</div></div>`;

  // 5) Accordion
  const names = {
    A:{en:'Regulatory Compliance', fr:'Conformité réglementaire'},
    B:{en:'Data Security & Privacy', fr:'Sécurité des données et vie privée'},
    C:{en:'HR Technology / Integration', fr:'Technologie RH / Intégration'},
    D:{en:'User Adoption & Training', fr:'Adoption et formation des utilisateurs'},
    E:{en:'Cost-Benefit Analysis', fr:'Analyse coûts-avantages'},
    F:{en:'Vendor Reliability & Support', fr:'Fiabilité et soutien du fournisseur'},
    G:{en:'Workforce Planning & Development', fr:'Planification et développement de la main-d\'oeuvre'},
    H:{en:'Employee Engagement & Culture Change', fr:'Mobilisation des employés & changement de culture'},
    I:{en:'Strategic Alignment', fr:'Alignement stratégique'},
    J:{en:'Accessibility & Inclusion', fr:'Accessibilité et inclusion'},
    K:{en:'Policy Development & Implementation', fr:'Élaboration & mise en oeuvre des politiques'}
  };
  const ragTxt = {high:'High risk', medium:'Medium risk', low:'Low risk', notReviewed:'Not reviewed'};
  const lights = r => r==='high' ? '<span class="dot active"></span><span class="dot"></span><span class="dot"></span>'
                     : r==='medium'? '<span class="dot"></span><span class="dot active"></span><span class="dot"></span>'
                     : r==='low'   ? '<span class="dot"></span><span class="dot"></span><span class="dot active"></span>'
                     : '<span class="dot"></span><span class="dot"></span><span class="dot"></span>';
  const root = document.getElementById('summaryAccordion');
  if (root) root.innerHTML = cats.map(c => {
    const nm = names[c.id] || {en:c.id, fr:c.id};
    const qa = (c.rec.questions||[]).map((q,i)=>`
      <li><strong>Q${i+1}.</strong> ${q.question?.en || q.question || ''}<div><em>Answer:</em> ${q.answer||''}</div></li>
    `).join('') || '<li>No answers recorded.</li>';
    return `
      <div class="acc-item">
        <button class="acc-trigger" id="acc-${c.id}" aria-expanded="false" aria-controls="panel-${c.id}">
          <span class="acc-left">
            <span class="cat-pill">${c.id}</span>
            <span class="cat-name"><span lang="en">${nm.en}</span><span lang="fr">${nm.fr}</span></span>
          </span>
          <span class="rag"><span class="rag-lights" aria-hidden="true">${lights(c.rag)}</span><span class="rag-text">${ragTxt[c.rag]}</span><span class="chev">▸</span></span>
        </button>
        <div id="panel-${c.id}" class="acc-panel" role="region" aria-labelledby="acc-${c.id}" hidden>
          <div class="panel-grid">
            <div class="box">
              <h4><span lang="en">Questions & answers</span><span lang="fr">Questions et réponses</span></h4>
              <ul>${qa}</ul>
            </div>
            <div class="box">
              <h4><span lang="en">Risk statement</span><span lang="fr">Énoncé du risque</span></h4>
              <p class="muted">—</p>
              <h4><span lang="en">Mitigation strategies</span><span lang="fr">Stratégies d'atténuation</span></h4>
              <ul><li>—</li></ul>
            </div>
          </div>
        </div>
      </div>`;
  }).join('');
  root?.querySelectorAll('.acc-trigger').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const open = btn.getAttribute('aria-expanded')==='true';
      btn.setAttribute('aria-expanded', String(!open));
      const panel = document.getElementById(btn.getAttribute('aria-controls'));
      if (panel) panel.hidden = open;
      const chev = btn.querySelector('.chev'); if (chev) chev.textContent = open ? '▸' : '▾';
    });
  });

  // 6) Show accordion, hide legacy table, keep help visible
  const show = el => el && (el.classList.remove('hidden'), el.style.removeProperty('display'));
  const hide = el => el && (el.classList.add('hidden'), el.style.setProperty('display','none'));
  show(document.getElementById('summaryAccordionContainer'));
  hide(document.getElementById('summaryTableContainer'));
  show(document.getElementById('riskSummaryHelp'));
  if (typeof placeSummaryTop === 'function') placeSummaryTop();
  if (typeof handleButtonVisibility === 'function') handleButtonVisibility(window.RRITState?.isEditing);
}

function generateSummary() {
    const isEditMode = RRITState.isEditing;
    
    if (isEditMode && window.editModeCleanup) {
        window.editModeCleanup();
        delete window.editModeCleanup;
        delete window.editCategoryHandler;
    }
    
    if (window.FEATURES?.useAccordionSummary) {
      renderSummaryAccordion();
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

    const hideElements = ["#summaryTableContainer", "#postResultActions", 
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
    
    if (qs("#summaryTableContainer:not(.hidden)")) {
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
        generateSummaryTable();
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
