# Automated Audit Tools for GC Web Compliance

This document outlines automated tools and checks that can be used alongside the [gc-site-review-checklist.md](./gc-site-review-checklist.md) to assess Government of Canada web compliance.

## Quick Start

For a basic automated audit, run these tools against your site:

```bash
# Accessibility check with axe-core
npx @axe-core/cli https://your-site.example.com

# Link validation
npx broken-link-checker https://your-site.example.com --recursive

# Performance baseline with Lighthouse
npx lighthouse https://your-site.example.com --chrome-flags="--headless"
```

## Accessibility Testing

### axe-core (Recommended)
```bash
# Install and run axe-core CLI
npm install -g @axe-core/cli
axe https://your-site.example.com --tags wcag2a,wcag2aa --reporter html --dir ./audit-results/
```

### pa11y
```bash
# Alternative accessibility scanner
npm install -g pa11y
pa11y https://your-site.example.com --standard WCAG2AA --reporter html > audit-results/pa11y-report.html
```

### Manual Testing
- Test keyboard navigation (Tab, Enter, Esc, Arrow keys)
- Test with screen readers (NVDA, JAWS, VoiceOver)
- Verify focus management and ARIA labels

## Link Validation

### broken-link-checker
```bash
npm install -g broken-link-checker
blc https://your-site.example.com --recursive --ordered --exclude-external
```

### linkchecker (Python alternative)
```bash
pip install linkchecker
linkchecker https://your-site.example.com
```

## Performance Testing

### Lighthouse CLI
```bash
npm install -g lighthouse
lighthouse https://your-site.example.com --output html --output-path ./audit-results/lighthouse-report.html
```

Key metrics to monitor:
- **LCP (Largest Contentful Paint)**: ≤ 2.5s
- **CLS (Cumulative Layout Shift)**: ≤ 0.1
- **INP (Interaction to Next Paint)**: ≤ 200ms

### WebPageTest
Use [WebPageTest.org](https://www.webpagetest.org/) for more detailed performance analysis with different network conditions.

## Official Languages Validation

### Manual checks required:
- Verify all content has French equivalent
- Check language toggle functionality
- Validate `html lang` attributes
- Test form validation messages in both languages

### Automated helpers:
```bash
# Check for missing lang attributes
npx htmlhint --config .htmlhintrc *.html
```

## Security and Privacy

### Security Headers
```bash
# Check security headers
curl -I https://your-site.example.com | grep -E "(Content-Security-Policy|X-Content-Type-Options|X-Frame-Options)"
```

### SSL/TLS Validation
```bash
# Check SSL configuration
npx ssl-checker https://your-site.example.com
```

## Content Quality

### HTML Validation
```bash
# W3C HTML validator
npx html-validate *.html
```

### Spell Check
```bash
# Basic spell check for content
npx cspell "**/*.html" "**/*.md"
```

## CI/CD Integration

For continuous monitoring, integrate these tools into your build pipeline:

```yaml
# Example GitHub Actions workflow snippet
- name: Accessibility Check
  run: |
    npx @axe-core/cli ${{ github.event.deployment.payload.web_url }} --exit
    
- name: Link Check
  run: |
    npx broken-link-checker ${{ github.event.deployment.payload.web_url }} --recursive
    
- name: Lighthouse CI
  run: |
    npx lighthouse ${{ github.event.deployment.payload.web_url }} --chrome-flags="--headless" --quiet --output json > lighthouse-results.json
```

## Reporting and Documentation

### Audit Report Template
Create a standardized report including:
1. **Executive Summary**: High-level findings and recommendations
2. **Accessibility**: WCAG violations by severity
3. **Performance**: Core Web Vitals and recommendations
4. **Content**: Language parity and quality issues
5. **Technical**: Security headers, broken links, validation errors
6. **Action Plan**: Prioritized remediation steps with timelines

### Tools for Report Generation
- Use axe-core HTML reporter for accessibility
- Combine Lighthouse reports for performance trends
- Document manual testing results in the checklist

## Additional Resources

- [Canada.ca Design System](https://design.canada.ca/)
- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [Government of Canada Digital Standards](https://www.canada.ca/en/government/system/digital-government/government-canada-digital-standards.html)
- [Treasury Board Digital Policy](https://www.tbs-sct.gc.ca/pol/doc-eng.aspx?id=32601)

---

**Note**: This automated audit complements but does not replace the manual review process outlined in the [gc-site-review-checklist.md](./gc-site-review-checklist.md). Both automated and manual testing are essential for comprehensive GC web compliance assessment.