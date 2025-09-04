# Government of Canada Web Compliance – Reviewer Checklist

Use this checklist to review a site for alignment with Government of Canada (GC) requirements and good practices. It is written to be practical for program/project sites that may be hosted outside Canada.ca (e.g., GitHub Pages), while still emphasizing the core GC obligations: accessibility, official languages, usability/design, privacy/security, and transparency.

Reviewer:
Date:
Project/Tool:
Primary URL: https://osm-bgs.github.io/RRIT/
Scope of review (pages, flows, versions):

Notes:
- “Must” = high priority; typically policy-, law-, or essential standard-aligned
- “Should” = recommended best practice; improves quality, consistency, and user outcomes
- If this is an officially published GC service or content for Canadians, consult the Canada.ca design system and departmental web governance for additional mandatory items (e.g., GCWeb templates, branding, analytics program integration, domain placement).

-------------------------------------------------------------------------------

1) Governance and scope
- [ ] Must: Confirm purpose and audience (internal/external; public/private; prototype/production)
- [ ] Must: Identify accountable GC organization and contact for the site (program, branch)
- [ ] Must: If public-facing GC content/service, confirm alignment with Canada.ca publishing rules (e.g., GCWeb theme, templates, domain strategy)
- [ ] Should: Document scope boundaries (what is in/out), version, and change log

2) Official languages (English/French equivalence)
- [ ] Must: All public-facing content available in both official languages, with equal quality and completeness
- [ ] Must: A persistent language switch is available and identifiable as English/Français
- [ ] Must: The html lang attribute reflects page language; language of parts is correctly set when mixed content occurs
- [ ] Should: URLs reflect language or provide hreflang alternates; metadata, alt text, form labels, error messages, and PDFs are bilingual
- [ ] Should: Map labels, legends, and key controls are bilingual or have bilingual equivalents nearby

3) Design system and branding (Canada.ca/GCWeb where applicable)
- [ ] Must: If this is an official GC site on Canada.ca, use GCWeb (WET-BOEW GCWeb theme) headers, footers, colours, and components
- [ ] Must: Include “Date modified,” breadcrumb, and standard footer items (e.g., terms, privacy) where GCWeb applies
- [ ] Should: Use Canada.ca content patterns and templates appropriate to page types (e.g., landing, transactional, topic)
- [ ] Should: Maintain consistent navigation, typography scale, and spacing; avoid custom UI that conflicts with GCWeb norms

4) Accessibility (target WCAG 2.1 AA)
Keyboard and structure
- [ ] Must: Full keyboard operability (no traps; logical tab order; visible focus)
- [ ] Must: Provide a “Skip to main content” link; use ARIA landmarks and semantic headings in order
- [ ] Must: Images have meaningful alt text or are marked decorative; icon-only controls have accessible names
- [ ] Must: Forms have associated labels; errors are announced to screen readers; instructions don’t rely on colour alone
- [ ] Must: Sufficient colour contrast (text 4.5:1; large text 3:1; UI components/graphics 3:1)
- [ ] Must: Reflow and zoom: content readable/operable at 320px width and 200% zoom without loss of functionality
- [ ] Must: No content flashing/flickering that could induce seizures; pause/stop controls for moving content
- [ ] Should: Provide status messages via appropriate ARIA roles; use headings for page outline; avoid redundant link text

Rich media/maps/data viz
- [ ] Must: Provide captions for prerecorded video and transcripts for audio; describe time-based media where needed
- [ ] Should: For maps/charts, provide non-visual alternatives or accessible data tables for key info; ensure keyboard access to controls
- [ ] Should: Use patterns and markers beyond colour; provide high-contrast palette and adequate hit targets

Testing
- [ ] Must: Automated accessibility checks (e.g., axe, pa11y) show no critical/blocking violations
- [ ] Should: Manual checks with keyboard and screen reader (NVDA/JAWS/VoiceOver) confirm core flows

5) Privacy, cookies, and security
- [ ] Must: Privacy notice available and accurate; identifies any personal information collected and purpose
- [ ] Must: If collecting personal information, ensure a PIA (Privacy Impact Assessment) is completed per departmental process
- [ ] Must: HTTPS enforced; no mixed content; HSTS enabled (where you control headers)
- [ ] Should: Security headers configured (CSP, X-Content-Type-Options, Referrer-Policy, Permissions-Policy)
- [ ] Should: Cookie banner/notice used if non-essential cookies or third-party analytics/storage are used; link to details
- [ ] Should: Disclose and minimize third-party embeds; provide consent/alternatives when they impact privacy

6) Content quality and information architecture
- [ ] Must: Plain language; short sentences; avoid jargon; meaningful headings and link text
- [ ] Must: Accurate page titles that reflect task/content; one H1 per page
- [ ] Should: Meta descriptions present; canonical links; social sharing metadata where helpful
- [ ] Should: Consistent navigation and breadcrumbs; no orphan pages
- [ ] Must: No broken links; avoid deep external redirects; descriptive file names for downloads
- [ ] Should: Include “Last updated/Date modified” and change notes for data/tools

7) Performance and reliability
- [ ] Should: Core Web Vitals: LCP ≤ 2.5s, CLS ≤ 0.1, INP ≤ 200ms (on representative networks/devices)
- [ ] Should: Optimize images (responsive sizes, compression, lazy loading); defer non-critical scripts
- [ ] Should: Caching headers set for static assets; minimize render-blocking resources
- [ ] Should: Service availability and error handling are user-friendly; offline/timeout messaging where appropriate

8) Analytics, measurement, and feedback
- [ ] Must: Provide a clear way to contact for support/feedback and accessibility accommodation requests
- [ ] Should: Use department-approved analytics and respect privacy/consent configurations
- [ ] Should: Define KPIs; capture key task completion events; provide anonymized metrics as needed

9) Open data/code and transparency
- [ ] Should: Provide repository link, license (e.g., Open Government Licence – Canada for content; compatible OSS license for code)
- [ ] Should: Document data sources, update cadence, and methodology; version datasets and releases
- [ ] Should: Accessibility statement and known limitations listed with timelines for fixes

10) QA, change control, and operations
- [ ] Must: CI runs automated checks (accessibility, links, performance thresholds) on PRs before release
- [ ] Should: Peer review of content changes (including bilingual content) and UX for key tasks
- [ ] Should: Dependency management and vulnerability scanning in place; reproducible builds
- [ ] Should: Backups/restore plan appropriate to risk; incident response contacts

-------------------------------------------------------------------------------

How to use this checklist
1) Run the automated audit (see docs/README-AUDIT.md).
2) Manually review with keyboard and screen reader for core tasks.
3) Validate official languages, privacy, and content quality.
4) Record issues with severity, language parity, routes, and remediation plan.