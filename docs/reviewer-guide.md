# Government of Canada Web Compliance - Reviewer Guide

This guide provides step-by-step instructions for conducting thorough Government of Canada web compliance reviews using the [GC Site Review Checklist](./gc-site-review-checklist.md) and supporting tools.

## Before You Start

### Required Knowledge
- Basic understanding of WCAG 2.1 AA accessibility standards
- Familiarity with GC web policies and standards
- Knowledge of browser developer tools
- Understanding of bilingual requirements for GC services

### Required Tools
- Modern web browser (Chrome, Firefox, Edge, Safari)
- Screen reader software (NVDA recommended for Windows, VoiceOver for Mac)
- Internet connection for validation tools
- Access to automated audit tools (see [README-AUDIT.md](./README-AUDIT.md))

## Review Process Overview

### Phase 1: Preparation (15-30 minutes)
1. **Understand the scope**
   - Review the site/application purpose
   - Identify target audience (internal/external)
   - Determine if this is an official GC service
   - Note any special requirements or constraints

2. **Gather information**
   - Primary URL and all relevant pages
   - Previous review reports (if available)
   - Known issues or concerns
   - Timeline and urgency

3. **Set up tools**
   - Install browser extensions (axe DevTools, WAVE)
   - Test screen reader functionality
   - Prepare the [GC Site Review Checklist](./gc-site-review-checklist.md)

### Phase 2: Automated Testing (30-45 minutes)

Follow the [automated audit guide](./README-AUDIT.md) to run:

1. **Accessibility scanning**
   ```bash
   npx @axe-core/cli https://your-site.example.com --tags wcag2a,wcag2aa
   ```

2. **Performance audit**
   ```bash
   npx lighthouse https://your-site.example.com
   ```

3. **Link validation**
   ```bash
   npx broken-link-checker https://your-site.example.com --recursive
   ```

4. **HTML validation**
   - Use W3C Markup Validator or html-validate

**⚠️ Important**: Automated tools catch only ~30-40% of accessibility issues. Manual testing is essential.

### Phase 3: Manual Testing (1-2 hours)

#### Accessibility Testing

**Keyboard Navigation (15-20 minutes)**
- [ ] Tab through all interactive elements
- [ ] Verify logical tab order
- [ ] Test with Enter, Space, Arrow keys, Esc
- [ ] Ensure no keyboard traps
- [ ] Verify visible focus indicators

**Screen Reader Testing (30-45 minutes)**
- [ ] Test with NVDA (Windows) or VoiceOver (Mac)
- [ ] Navigate by headings (H key in NVDA)
- [ ] Navigate by landmarks (D key in NVDA)
- [ ] Test form controls and labels
- [ ] Verify alt text for images
- [ ] Check table headers and structure

**Visual and Responsive Testing (15-20 minutes)**
- [ ] Test at 200% zoom level
- [ ] Test at 320px viewport width
- [ ] Verify color contrast (use browser tools)
- [ ] Test with high contrast mode
- [ ] Check for text that relies only on color

#### Bilingual Testing (30-45 minutes)

**Content Parity**
- [ ] Compare English and French versions side-by-side
- [ ] Verify equivalent information and functionality
- [ ] Check translation quality and accuracy
- [ ] Test form validation messages in both languages

**Technical Implementation**
- [ ] Verify `html lang` attributes are correct
- [ ] Test language toggle functionality
- [ ] Check URL structure for language indication
- [ ] Validate bilingual metadata and alt text

#### Content and Usability (20-30 minutes)

**Content Quality**
- [ ] Plain language assessment
- [ ] Meaningful page titles and headings
- [ ] Clear navigation and information architecture
- [ ] Accurate and helpful error messages

**GC Branding and Standards**
- [ ] Proper use of GCWeb theme (if applicable)
- [ ] Correct footer information
- [ ] "Date modified" present and accurate
- [ ] Appropriate use of GC symbols and branding

### Phase 4: Privacy and Security Review (20-30 minutes)

**Privacy Assessment**
- [ ] Review privacy notice/policy
- [ ] Identify personal information collection
- [ ] Check for appropriate consent mechanisms
- [ ] Verify third-party service disclosures

**Security Review**
- [ ] Confirm HTTPS enforcement
- [ ] Check security headers (use browser dev tools)
- [ ] Review cookie usage and notices
- [ ] Test for mixed content issues

### Phase 5: Documentation and Reporting (30-45 minutes)

#### Issue Categorization
**Critical (Must Fix Before Launch)**
- Blocking accessibility barriers
- Missing bilingual content
- Privacy violations
- Security vulnerabilities

**High Priority (Fix Soon)**
- Non-blocking accessibility issues
- Performance problems
- Content quality issues
- Minor compliance gaps

**Medium Priority (Plan for Future)**
- Enhancement opportunities
- Non-essential features
- Documentation improvements

#### Report Structure
1. **Executive Summary**
   - Overall compliance status
   - Critical issues count
   - Recommendation (ready/not ready for launch)

2. **Detailed Findings**
   - Issues organized by category
   - Severity levels and impact
   - Specific remediation steps
   - Screenshots or examples where helpful

3. **Action Plan**
   - Prioritized list of fixes
   - Estimated effort/timeline
   - Responsible parties
   - Follow-up review schedule

## Common Issues and Solutions

### Accessibility Quick Fixes
- **Missing alt text**: Add descriptive alt attributes to images
- **Poor color contrast**: Use online contrast checkers and adjust colors
- **Missing form labels**: Associate labels with form controls using `for` attribute
- **Invalid heading structure**: Use logical heading hierarchy (H1 → H2 → H3)

### Bilingual Common Issues
- **Inconsistent translation**: Work with translation services for accuracy
- **Missing language toggle**: Implement persistent language switching
- **Wrong lang attributes**: Set `<html lang="en">` or `<html lang="fr">` appropriately
- **Untranslated error messages**: Ensure all user-facing text is bilingual

### Performance Quick Wins
- **Image optimization**: Compress and resize images appropriately
- **Minify CSS/JS**: Use build tools to reduce file sizes
- **Enable caching**: Set appropriate cache headers for static assets
- **Remove unused code**: Clean up CSS and JavaScript

## Reviewer Certification and Training

### Recommended Training
- **WCAG 2.1**: Complete IAAP or similar accessibility certification
- **Screen Reader Usage**: Practice with NVDA, JAWS, and VoiceOver
- **GC Standards**: Review Canada.ca design system documentation
- **Security Basics**: Understanding of common web security principles

### Continuing Education
- Stay updated on WCAG guidelines and techniques
- Follow accessibility and usability best practices
- Monitor GC policy updates and new requirements
- Participate in accessibility community discussions

## Quality Assurance

### Peer Review Process
- Have another reviewer spot-check critical findings
- Cross-reference automated and manual results
- Validate recommendations against GC standards
- Ensure consistent application of criteria

### Follow-up Reviews
- Schedule re-review after remediation
- Track improvement over time
- Update review process based on lessons learned
- Maintain reviewer notes for future reference

## Resources and References

### Official Documentation
- [Canada.ca Design System](https://design.canada.ca/)
- [WCAG 2.1 Quick Reference](https://www.w3.org/WAI/WCAG21/quickref/)
- [GC Digital Standards](https://www.canada.ca/en/government/system/digital-government/government-canada-digital-standards.html)
- [Treasury Board Digital Policy](https://www.tbs-sct.gc.ca/pol/doc-eng.aspx?id=32601)

### Testing Tools and Extensions
- [axe DevTools](https://www.deque.com/axe/devtools/) - Browser extension
- [WAVE](https://wave.webaim.org/) - Web accessibility evaluator
- [Colour Contrast Analyser](https://www.tpgi.com/color-contrast-checker/) - Desktop app
- [Lighthouse](https://developers.google.com/web/tools/lighthouse) - Built into Chrome DevTools

### Screen Reader Resources
- [NVDA Download](https://www.nvaccess.org/download/) - Free Windows screen reader
- [VoiceOver Guide](https://www.apple.com/accessibility/voiceover/) - Built into macOS
- [JAWS](https://www.freedomscientific.com/products/software/jaws/) - Commercial option

### Additional Training
- [WebAIM](https://webaim.org/) - Web accessibility training and resources
- [Deque University](https://dequeuniversity.com/) - Comprehensive accessibility courses
- [A11y Project](https://www.a11yproject.com/) - Community-driven accessibility resources

---

**Questions or need support?** Contact the digital accessibility team or create an issue using the [GC Review template](../.github/ISSUE_TEMPLATE/gc-review.md).