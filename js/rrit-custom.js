/* =========================================================
   RRIT – Rapid Risk Identification Tool
   Refactored Version – 2025-07-24
   ========================================================= */

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
    
    generateSummaryTable();
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
        printSummaryBtn: true,
        generateAnnexBtn: !isEditing
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
        generateAnnexBtn: () => {
            console.log('[RRIT] Generating detailed annex...');
            const flagged = getFlaggedQuestions();
            console.log('[RRIT] Flagged questions:', flagged);
            
            if (flagged.length === 0) {
                alert(currentLang === 'en' ? 
                    'No flagged questions found. The annex will only show items answered with "No" or "Unknown".' :
                    'Aucune question signalée trouvée. L\'annexe ne montrera que les éléments répondus par « Non » ou « Inconnu ».');
                return;
            }
            
            const annexData = buildAnnexData(flagged);
            console.log('[RRIT] Annex data:', annexData);
            
            if (annexData.length === 0) {
                alert(currentLang === 'en' ? 
                    'No mitigation information available for flagged questions.' :
                    'Aucune information d\'atténuation disponible pour les questions signalées.');
                return;
            }
            
            renderAnnex(annexData);
            
            // Scroll to annex
            const annexElement = qs('#detailedAnnex');
            if (annexElement) {
                annexElement.scrollIntoView({ behavior: 'smooth' });
            }
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
            printSummaryBtn: "Print / Save as PDF",
            generateAnnexBtn: "Generate Detailed Annex"
        },
        fr: {
            generateSummaryBtn: RRITState.isEditing ? "Générer le sommaire mis à jour" : "Générer le sommaire",
            editAnswersBtn: "Modifier les réponses",
            newScenarioBtn: "Nouveau scénario",
            printSummaryBtn: "Imprimer / Sauvegarder en PDF",
            generateAnnexBtn: "Générer l'annexe détaillée"
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

/* =========================================================
   Section 9: Annex Helper Functions
   ========================================================= */

// Sample MITIGATION_LIBRARY for testing - should be populated with actual data
window.MITIGATION_LIBRARY = {
  "A.1": {
    riskStatement: {
      en: "Non-compliance with privacy protection policies creates legal and regulatory risks.",
      fr: "Le non-respect des politiques de protection de la vie privée crée des risques juridiques et réglementaires."
    },
    whyMatters: {
      en: "Privacy violations can result in penalties, lawsuits, and damage to organizational reputation.",
      fr: "Les violations de la vie privée peuvent entraîner des sanctions, des poursuites et des dommages à la réputation organisationnelle."
    },
    mitigations: {
      en: [
        "Conduct a comprehensive privacy impact assessment",
        "Implement privacy-by-design principles",
        "Establish clear data governance protocols",
        "Provide regular privacy training for all staff"
      ],
      fr: [
        "Effectuer une évaluation complète de l'impact sur la vie privée",
        "Mettre en œuvre les principes de protection de la vie privée dès la conception",
        "Établir des protocoles clairs de gouvernance des données",
        "Fournir une formation régulière sur la vie privée à tout le personnel"
      ]
    }
  },
  "A.2": {
    riskStatement: {
      en: "Lack of alignment with Canadian labour laws may result in legal challenges and compliance issues.",
      fr: "Le manque d'alignement avec les lois du travail canadiennes peut entraîner des défis juridiques et des problèmes de conformité."
    },
    whyMatters: {
      en: "Labour law violations can lead to legal action, financial penalties, and operational disruptions.",
      fr: "Les violations du droit du travail peuvent entraîner des actions en justice, des sanctions financières et des perturbations opérationnelles."
    },
    mitigations: {
      en: [
        "Consult with legal experts specializing in Canadian labour law",
        "Review and update all HR policies to ensure compliance",
        "Implement regular compliance monitoring processes",
        "Establish clear grievance and dispute resolution procedures"
      ],
      fr: [
        "Consulter des experts juridiques spécialisés en droit du travail canadien",
        "Réviser et mettre à jour toutes les politiques RH pour assurer la conformité",
        "Mettre en place des processus de surveillance de la conformité réguliers",
        "Établir des procédures claires de griefs et de résolution de conflits"
      ]
    }
  },
  "B.1": {
    riskStatement: {
      en: "Inadequate data security measures expose sensitive employee information to potential breaches.",
      fr: "Des mesures de sécurité des données inadéquates exposent les informations sensibles des employés à des violations potentielles."
    },
    whyMatters: {
      en: "Data breaches can result in identity theft, financial losses, and severe reputational damage.",
      fr: "Les violations de données peuvent entraîner un vol d'identité, des pertes financières et des dommages de réputation graves."
    },
    mitigations: {
      en: [
        "Implement multi-factor authentication for all systems",
        "Use end-to-end encryption for data transmission and storage",
        "Conduct regular security audits and penetration testing",
        "Establish incident response procedures for security breaches"
      ],
      fr: [
        "Mettre en place l'authentification multifactorielle pour tous les systèmes",
        "Utiliser le chiffrement de bout en bout pour la transmission et le stockage des données",
        "Effectuer des audits de sécurité réguliers et des tests de pénétration",
        "Établir des procédures de réponse aux incidents pour les violations de sécurité"
      ]
    }
  }
};

// Bilingual labels for annex sections
const annexLabels = {
  question: { en: "Question", fr: "Question" },
  answer:   { en: "Answer", fr: "Réponse" },
  risk:     { en: "Identified Risk", fr: "Risque identifié" },
  why:      { en: "Why It Matters", fr: "Pourquoi c'est important" },
  mitig:    { en: "Sample Mitigation Strategies", fr: "Mesures d'atténuation proposées" }
};

// 4.a Filter only No/Unknown items
function getFlaggedQuestions({ includeUnknown = true } = {}) {
  const NEG = new Set(["no", "non"]);
  const UNK = new Set(["unknown", "inconnu", "inconnue"]);

  const flagged = [];
  (window.collectedResponses || []).forEach(catBlock => {
    const cat = catBlock.category; // localized name; we'll map back to code if needed
    (catBlock.questions || []).forEach(q => {
      const ans = String(q.answer || "").trim().toLowerCase();
      const isNo = NEG.has(ans);
      const isUnk = includeUnknown && UNK.has(ans);
      if (isNo || isUnk) {
        // Expect q.qid and q.question present from generateSummaryTable()
        flagged.push({ categoryLabel: cat, qid: q.qid, questionText: q.question, answer: q.answer });
      }
    });
  });
  return flagged;
}

// 4.b Build Annex data; join to mitigation library and map to category codes
function buildAnnexData(flagged) {
  const lang = (currentLang || "en").toLowerCase();
  // categories constant exists: { A:{en,fr}, ... }
  const labelToCode = Object.fromEntries(
    Object.entries(categories).flatMap(([code, names]) => [
      [names.en, code],
      [names.fr, code]
    ])
  );

  const byCat = {};
  flagged.forEach(item => {
    const code = labelToCode[item.categoryLabel] || item.categoryLabel; // fallback if already a code
    const lib = (window.MITIGATION_LIBRARY || {})[item.qid];
    if (!lib) return;

    (byCat[code] ||= { category: code, items: [] });

    const riskStatement = lib.riskStatement?.[lang] || lib.riskStatement?.en || "";
    const whyMatters    = lib.whyMatters?.[lang]    || lib.whyMatters?.en    || "";
    const mitigations   = lib.mitigations?.[lang]   || lib.mitigations?.en   || [];

    byCat[code].items.push({
      qid: item.qid,
      questionText: item.questionText,
      answer: item.answer,
      riskStatement,
      whyMatters,
      mitigations
    });
  });

  const order = ["A","B","C","D","E","F","G","H","I","J","K"];
  return order.filter(c => byCat[c]).map(c => byCat[c]);
}

// 4.c Render Annex with bilingual headings and bullet list
function renderAnnex(sections) {
  const lang = currentLang || "en";
  const root = document.getElementById("detailedAnnex");
  if (!root) return;
  root.innerHTML = "";
  root.classList.remove("hidden");
  root.removeAttribute("aria-hidden");

  sections.forEach(sec => {
    const cat = document.createElement("section");
    cat.className = "annex-category";
    cat.id = `annex-cat-${sec.category}`;

    const h3 = document.createElement("h3");
    h3.textContent = categories[sec.category][lang];
    cat.appendChild(h3);

    sec.items.forEach(it => {
      const art = document.createElement("article");
      art.className = "annex-item";

      art.innerHTML = `
        <div><strong>${annexLabels.question[lang]} (${it.qid}):</strong> ${it.questionText}</div>
        <div><strong>${annexLabels.answer[lang]}:</strong> ${it.answer}</div>
        <h4>${annexLabels.risk[lang]}</h4>
        <p>${it.riskStatement}</p>
        <h4>${annexLabels.why[lang]}</h4>
        <p>${it.whyMatters}</p>
        <h4>${annexLabels.mitig[lang]}</h4>
      `;

      const ul = document.createElement("ul");
      it.mitigations.forEach(m => {
        const li = document.createElement("li");
        li.textContent = m;
        ul.appendChild(li);
      });
      art.appendChild(ul);

      cat.appendChild(art);
    });

    root.appendChild(cat);
  });
}
