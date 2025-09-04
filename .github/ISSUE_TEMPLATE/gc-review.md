---
name: Government of Canada Web Compliance Review
about: Use this template to request or track a GC web compliance review
title: 'GC Review: [Site/Feature Name]'
labels: ['gc-compliance', 'review']
assignees: ''
---

## Site/Feature Information

**Primary URL:** https://
**Review Type:** 
- [ ] Initial compliance review
- [ ] Pre-launch review  
- [ ] Post-incident review
- [ ] Periodic audit
- [ ] Accessibility focused
- [ ] Bilingual content review

**Scope:**
- [ ] Full site review
- [ ] Specific pages: [list pages]
- [ ] New features: [describe features]
- [ ] Content updates: [describe changes]

## Review Context

**Target Audience:** 
- [ ] Internal (GC employees)
- [ ] External (Canadian public)
- [ ] Mixed

**Publication Status:**
- [ ] Prototype/development
- [ ] Staging/pre-production
- [ ] Production/live
- [ ] Official GC service on Canada.ca
- [ ] External hosting (GitHub Pages, etc.)

**Timeline:**
- **Requested completion date:** 
- **Launch/deployment date:** 
- **Any specific deadlines:** 

## GC Compliance Areas (check all that apply)

### High Priority (Must Fix)
- [ ] **Accessibility** - WCAG 2.1 AA compliance
- [ ] **Official Languages** - English/French equivalence  
- [ ] **Privacy & Security** - Personal information protection
- [ ] **GCWeb Branding** - Design system compliance (if applicable)
- [ ] **Content Quality** - Plain language, accuracy

### Standard Review
- [ ] **Performance** - Core Web Vitals, loading speed
- [ ] **Analytics & Feedback** - Contact methods, measurement
- [ ] **Transparency** - Open data, licensing
- [ ] **Operations** - CI/CD, change control

## Automated Checks Status

- [ ] Accessibility scan completed (axe-core/pa11y)
- [ ] Link validation completed
- [ ] Performance audit completed (Lighthouse)
- [ ] HTML validation completed
- [ ] Security headers checked

**Automated results:** [Link to audit artifacts or paste summary]

## Manual Testing Required

- [ ] Keyboard navigation testing
- [ ] Screen reader testing (NVDA/JAWS/VoiceOver)
- [ ] Mobile device testing
- [ ] Bilingual content verification
- [ ] Form submission testing
- [ ] Error handling testing

## Known Issues or Concerns

[Describe any known issues, limitations, or specific areas of concern]

## Previous Reviews

**Last review date:** 
**Previous issues:** [Link to related issues or reports]

## Review Assignment

**Reviewer(s):** @
**Review lead:** @
**Stakeholder contacts:** 

## Checklist and Documentation

- [ ] [GC Site Review Checklist](./docs/gc-site-review-checklist.md) completed
- [ ] Automated audit results reviewed (see [README-AUDIT.md](./docs/README-AUDIT.md))
- [ ] Manual testing completed
- [ ] Issues documented with severity levels
- [ ] Remediation plan created with timelines
- [ ] Accessibility statement updated (if needed)

## Review Results

_To be completed by reviewer:_

**Overall Status:**
- [ ] ✅ Compliant - Ready for production
- [ ] ⚠️ Minor issues - Can launch with remediation plan
- [ ] ❌ Major issues - Requires fixes before launch
- [ ] 🔄 Needs follow-up review

**Priority Issues Found:** [Number]
**Total Issues Found:** [Number]

**Report:** [Link to detailed review report or attach results]

---

## Additional Resources

- [GC Site Review Checklist](./docs/gc-site-review-checklist.md)
- [Automated Audit Guide](./docs/README-AUDIT.md) 
- [Canada.ca Design System](https://design.canada.ca/)
- [Digital Government Standards](https://www.canada.ca/en/government/system/digital-government/government-canada-digital-standards.html)