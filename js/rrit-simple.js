/* =========================================================
   RRIT – Simplified 24-Question Version
   ========================================================= */

// === Summary view selection (accordion is default) ===
window.FEATURES = window.FEATURES || {};
window.FEATURES.useAccordionSummary = true;

// Current language state
let currentLang = navigator.language.startsWith("fr") ? "fr" : "en";

// Helper functions
const qs  = s => document.querySelector(s);
const qsa = s => [...document.querySelectorAll(s)];

// === Load 24 bilingual questions ===
async function loadQuestions() {
  if (window.RRIT_QUESTIONS) return window.RRIT_QUESTIONS;
  try {
    const res = await fetch('data/rrit_questions_bilingual.json', { cache: 'no-store' });
    if (!res.ok) throw new Error('Questions HTTP ' + res.status);
    const data = await res.json();
    window.RRIT_QUESTIONS = Array.isArray(data) ? data : data.questions;
  } catch (error) {
    console.error('[RRIT] Failed to load questions:', error);
    window.RRIT_QUESTIONS = [];
  }
  return window.RRIT_QUESTIONS;
}

// === Load per-question annex (bilingual) ===
async function loadAnnex() {
  if (window.RISK_ANNEX) return window.RISK_ANNEX;
  try {
    const res = await fetch('js/risk-annex.json', { cache: 'no-store' });
    if (!res.ok) throw new Error('Annex HTTP ' + res.status);
    window.RISK_ANNEX = await res.json();
  } catch {
    window.RISK_ANNEX = window.RISK_ANNEX || {};
  }
  return window.RISK_ANNEX;
}

// Language and answer helpers
function getLang() {
  const raw = (document.documentElement.getAttribute('lang') ||
               document.documentElement.getAttribute('data-lang') || 'en').toLowerCase();
  return raw.startsWith('fr') ? 'fr' : 'en';
}

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

// Render a single question
function renderQuestion(question, index) {
  const lang = getLang();
  const qText = (question.text && question.text[lang]) || (question.question && question.question[lang]) || '';
  const whyText = (question.why && question.why[lang]) || (question.whyMatters && question.whyMatters[lang]) || '';
  
  return `
    <fieldset data-qid="${question.id}" class="question-fieldset">
      <legend>
        <strong>${index + 1}. ${qText}</strong>
      </legend>
      <div class="rrit-responses">
        <label class="radio-spacing">
          <input type="radio" name="q${question.id}" value="Yes" data-qid="${question.id}"> 
          <span data-lang="en">Yes</span><span data-lang="fr" class="hidden">Oui</span>
        </label>
        <label class="radio-spacing">
          <input type="radio" name="q${question.id}" value="No" data-qid="${question.id}"> 
          <span data-lang="en">No</span><span data-lang="fr" class="hidden">Non</span>
        </label>
        <label class="radio-spacing">
          <input type="radio" name="q${question.id}" value="Unknown" data-qid="${question.id}"> 
          <span data-lang="en">Unknown</span><span data-lang="fr" class="hidden">Inconnu</span>
        </label>
        <label class="radio-spacing">
          <input type="radio" name="q${question.id}" value="Not Applicable" data-qid="${question.id}"> 
          <span data-lang="en">N/A</span><span data-lang="fr" class="hidden">S.O.</span>
        </label>
      </div>
      <p class="why-matters"><em>${whyText}</em></p>
    </fieldset>
  `;
}

// Render all 24 questions
async function renderAllQuestions() {
  try {
    const questions = await loadQuestions();
    const container = document.getElementById('questionsList');
    
    if (!container) {
      console.error('[RRIT] Questions container not found');
      return;
    }
    
    if (!questions || questions.length === 0) {
      container.innerHTML = '<p class="alert alert-warning">Failed to load questions. Please refresh the page.</p>';
      return;
    }
    
    const questionsHtml = questions.map((q, index) => renderQuestion(q, index)).join('\n');
    container.innerHTML = questionsHtml;
    
    console.log(`[RRIT] Rendered ${questions.length} questions`);
    
  } catch (error) {
    console.error('[RRIT] Error rendering questions:', error);
    const container = document.getElementById('questionsList');
    if (container) {
      container.innerHTML = '<p class="alert alert-danger">Error loading questions. Please refresh the page.</p>';
    }
  }
}

// Check if all 24 questions are answered
function summaryIsReady() {
  try {
    const answeredInputs = document.querySelectorAll('input[type="radio"]:checked[data-qid]');
    const answeredCount = answeredInputs.length;
    console.log(`[RRIT] Answered questions: ${answeredCount}/24`);
    return answeredCount === 24;
  } catch (e) {
    console.error('[RRIT] Error checking summary readiness:', e);
    return false;
  }
}

// Collect responses from 24 questions
function collectAndUpdateResponses() {
    const responses = [];
    const checkedInputs = document.querySelectorAll('input[type="radio"]:checked[data-qid]');
    
    checkedInputs.forEach(input => {
        const fieldset = input.closest("fieldset");
        const qid = input.dataset.qid;
        const questionText = fieldset?.querySelector("legend")?.textContent?.trim() || "";
        
        if (qid && questionText && input.value) {
            responses.push({ 
                qid, 
                question: questionText, 
                answer: input.value 
            });
        }
    });
    
    window.collectedResponses = responses;
    console.log(`[RRIT] Updated collectedResponses: ${responses.length} answers collected`);
}

// Generate risks-only summary
async function renderRisksOnlySummary() {
    try {
        const questions = await loadQuestions();
        const responses = window.collectedResponses || [];
        
        // Filter for No/Unknown answers only
        const risks = responses.filter(r => {
            const normalized = normalizeAnswer(r.answer);
            return normalized === 'no' || normalized === 'unknown';
        });
        
        const riskCount = risks.length;
        const lang = getLang();
        
        // Create or find the required section structure
        let summarySection = document.getElementById('summarySection');
        if (!summarySection) {
            summarySection = document.createElement('section');
            summarySection.id = 'summarySection';
            summarySection.className = 'hidden';
            document.body.appendChild(summarySection);
        }
        
        // Create title element
        let summaryTitle = document.getElementById('summaryTitle');
        if (!summaryTitle) {
            summaryTitle = document.createElement('h2');
            summaryTitle.id = 'summaryTitle';
            summarySection.appendChild(summaryTitle);
        }
        
        // Create risk count line
        let riskCountLine = document.getElementById('riskCountLine');
        if (!riskCountLine) {
            riskCountLine = document.createElement('p');
            riskCountLine.id = 'riskCountLine';
            summarySection.appendChild(riskCountLine);
        }
        
        // Create risk list with panel-group class
        let riskList = document.getElementById('riskList');
        if (!riskList) {
            riskList = document.createElement('div');
            riskList.id = 'riskList';
            riskList.className = 'panel-group';
            summarySection.appendChild(riskList);
        }
        
        // Set title
        summaryTitle.textContent = lang === 'fr' ? 'Résumé des risques' : 'Risk Summary';
        
        // Set count line
        riskCountLine.textContent = lang === 'fr' 
            ? `Nombre total de risques identifiés : ${riskCount}`
            : `Total risks identified: ${riskCount}`;
        
        // Generate risk cards HTML
        if (riskCount === 0) {
            riskList.innerHTML = `<p><strong>${lang === 'fr' ? 'Aucun risque identifié' : 'No risks identified'}</strong></p>`;
        } else {
            const riskCardsHtml = await Promise.all(risks.map(async (risk) => {
                const question = questions.find(q => q.qid === risk.qid);
                const questionText = question ? (question.question[lang] || question.question.en) : risk.question;
                const riskStatement = question ? (question.risk_statement ? (question.risk_statement[lang] || question.risk_statement.en) : '') : '';
                const mitigations = question ? (question.mitigations ? (question.mitigations[lang] || question.mitigations.en || []) : []) : [];
                
                const answerLabel = translateAnswer(risk.answer);
                
                return `
                    <div class="panel panel-default">
                        <div class="panel-heading">
                            <h4 class="panel-title">
                                ${questionText}
                                <small>(${answerLabel})</small>
                            </h4>
                        </div>
                        <div class="panel-body">
                            ${riskStatement ? `<h4>${lang === 'fr' ? 'Énoncé de risque' : 'Risk statement'}</h4><p>${riskStatement}</p>` : ''}
                            ${Array.isArray(mitigations) && mitigations.length ? `
                                <h4>${lang === 'fr' ? 'Mesures d\'atténuation' : 'Mitigation actions'}</h4>
                                <ul>${mitigations.map(m => `<li>${m}</li>`).join('')}</ul>
                            ` : ''}
                        </div>
                    </div>
                `;
            }));
            
            riskList.innerHTML = riskCardsHtml.join('\n');
        }
        
        // Show summary section
        summarySection.classList.remove('hidden');
        summarySection.style.display = 'block';
        
        // Hide other sections to focus on risks
        const intro = document.getElementById('rrit-intro');
        const questionsSection = document.getElementById('questionsSection');
        const existingSummary = document.getElementById('rrit-summary');
        
        if (intro) intro.style.display = 'none';
        if (questionsSection) questionsSection.style.display = 'none';
        if (existingSummary) existingSummary.style.display = 'none';
        
        console.log(`[RRIT] Generated risks-only summary with ${riskCount} risks`);
        
        // Show print button when summary is ready
        const printBtn = document.getElementById('printSummaryBtn');
        if (printBtn) {
            printBtn.classList.remove('hidden');
            printBtn.removeAttribute('aria-hidden');
            printBtn.style.display = '';
        }
        
    } catch (error) {
        console.error('[RRIT] Error generating risks summary:', error);
    }
}

// Generate summary
function generateSummary() {
    collectAndUpdateResponses();
    
    if (!summaryIsReady()) {
        const emptyState = document.getElementById('summaryEmptyState');
        if (emptyState) {
            emptyState.style.display = '';
            emptyState.innerHTML = `
                <span data-lang="en">Answer all 24 questions to generate your risk summary. (${document.querySelectorAll('input[type="radio"]:checked[data-qid]').length}/24 answered)</span>
                <span data-lang="fr" class="hidden">Répondez aux 24 questions pour générer votre résumé des risques. (${document.querySelectorAll('input[type="radio"]:checked[data-qid]').length}/24 répondues)</span>
            `;
        }
        return;
    }
    
    renderRisksOnlySummary();
    
    // Show summary section
    const summarySection = document.getElementById('rrit-summary');
    if (summarySection) {
        summarySection.style.display = '';
        summarySection.classList.remove('hidden');
    }
    
    const emptyState = document.getElementById('summaryEmptyState');
    if (emptyState) emptyState.style.display = 'none';
}

// Language toggle
function toggleLanguage(lang) {
    console.log(`[RRIT] Switching to language: ${lang}`);
    currentLang = lang;
    document.documentElement.lang = lang;
    
    // Update language display
    updateLanguageDisplay();
}

// Print function for summary
function printSummary() {
    // Ensure language attribute is set correctly for the print
    document.documentElement.setAttribute("data-print-lang", currentLang);
    setTimeout(() => {
        window.print();
        setTimeout(() => document.documentElement.removeAttribute("data-print-lang"), 250);
    }, 50);
}

function updateLanguageDisplay() {
    console.log(`[RRIT] Updating language display to: ${currentLang}`);
    
    // Show/hide elements based on language
    const langElements = document.querySelectorAll('[data-lang], [lang]');
    langElements.forEach(el => {
        // Skip language switcher elements
        if (el.closest('#wb-lng')) return;
        
        const elLang = el.getAttribute('data-lang') || el.getAttribute('lang');
        const shouldShow = elLang === currentLang;
        
        el.classList.toggle('hidden', !shouldShow);
        if (shouldShow) {
            el.removeAttribute('aria-hidden');
        } else {
            el.setAttribute('aria-hidden', 'true');
        }
    });
    
    // Re-render questions in new language if container exists
    const questionsContainer = document.getElementById('questionsList');
    if (questionsContainer && questionsContainer.children.length > 0) {
        renderAllQuestions().catch(error => {
            console.error('[RRIT] Error re-rendering questions for language change:', error);
        });
    }
}

// Initialize when DOM is ready
document.addEventListener("DOMContentLoaded", () => {
    console.log('[RRIT] Initializing RRIT application...');
    
    // Set default language
    currentLang = 'en';
    document.documentElement.lang = currentLang;
    
    // Apply language display
    setTimeout(() => {
        updateLanguageDisplay();
        console.log('[RRIT] Initial language display applied');
    }, 10);
    
    // Initialize Generate Summary button
    const generateBtn = document.getElementById('btnGenerateSummary');
    if (generateBtn) {
        generateBtn.addEventListener('click', generateSummary);
        console.log('[RRIT] Generate Summary button initialized');
    }
    
    // Initialize Print Summary button
    const printBtn = document.getElementById('printSummaryBtn');
    if (printBtn) {
        printBtn.addEventListener('click', printSummary);
        console.log('[RRIT] Print Summary button initialized');
    }
    
    // Load and render questions
    renderAllQuestions().then(() => {
        console.log('[RRIT] Questions loaded and rendered');
    }).catch(error => {
        console.error('[RRIT] Failed to load questions:', error);
    });
    
    console.log('[RRIT] Application initialized successfully');
});