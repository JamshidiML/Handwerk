# Handwerk Quote Copilot — Project Brief v0.1

**Working codename:** Handwerk Quote Copilot  
**Date:** 10 August 2026  
**Status:** Discovery proposal — no build decision yet  
**Founder/Product Owner:** Mohsen Jamshidi

## 1. Executive decision

The customer problem is strong, frequent, and economically meaningful. The original solution, however, is no longer sufficiently differentiated: several German products now advertise nearly the same photo/voice-to-offer workflow.

**Recommendation:** continue, but do not build a generic quotation app for every trade. Start with one narrow trade and create a **trusted quote copilot** that maps site evidence only to the business's approved price book, asks for missing information, shows uncertainty, and requires human approval.

**Proposed first vertical:** small painting and interior-renovation businesses (*Maler- und Lackierer / Innenausbau*) with 1–15 employees in Bochum, Dortmund, and the wider NRW region.

**German product promise:**

> Vom Baustellenrundgang zum prüffertigen Angebotsentwurf in fünf Minuten – mit deinen Preisen, nachvollziehbar und unter deiner Kontrolle.

The product should create a **review-ready draft**, not claim to produce an infallible final price from photographs.

## 2. Assessment of the original idea

| Criterion | Weight | Original score | Reason |
|---|---:|---:|---|
| Problem severity and frequency | 20 | 18 | Quotations consume recurring owner/office time and delays can lose work. |
| Willingness to pay / measurable ROI | 15 | 11 | Clear time-saving value, but small firms are price-sensitive and switching is difficult. |
| Market size | 15 | 14 | Germany had 1,038,126 Handwerk businesses in 2025; the market is large and fragmented. |
| MVP feasibility | 15 | 11 | Voice extraction and document generation are feasible; reliable quantity and scope inference is harder. |
| Differentiation | 15 | 3 | Direct competitors now market the same core workflow. |
| Founder-market fit and distribution | 10 | 5 | Mohsen has strong R&D/product discipline but no established Handwerk customer network or trade-specific pricing knowledge. |
| Legal, privacy, and accuracy risk | 10 | 6 | Manageable with human review and privacy-by-design, but photos, voice, customer data, and wrong estimates create risk. |
| **Total** | **100** | **68/100** | Promising problem; insufficiently differentiated initial product. |

These scores are working hypotheses. Customer evidence, not AI opinion, must determine the final build decision.

### Market evidence

- ZDH reports 1,038,126 German Handwerk businesses, about 6.237 million employment relationships, and approximately €783.2 billion in 2025 revenue.
- 99.5% of the companies counted in the relevant Handwerk categories in 2024 were SMEs.
- The painting and decorating association reported 38,661 Maler- und Lackierer businesses as of 31 December 2024. This is large enough for a focused entry market without supporting every trade.
- The Handwerkskammer Dortmund serves about 20,000 businesses in the eastern Ruhr region and has dedicated digitalisation and AI contacts, making it a relevant discovery and partnership channel.

## 3. Competitive reality in August 2026

The earlier assumption that existing products still rely mainly on typing and forms is outdated.

| Product | Publicly advertised capability | Advertised positioning/pricing | Implication |
|---|---|---|---|
| MeisterFix | Photo and voice input, AI-generated work/material positions and PDF | Beta; Professional advertised at €19.99/month | Very close to the original concept. |
| Baustellenwerk | Photo-to-offer, voice documentation, invoice and site features | From €99/month | Competes with a broader operating suite. |
| Handwerk-Assistent | Spoken positions converted to PDF offers | €19.99/month | Voice-only entry point is already commoditising. |
| Angebotsmeister | Voice-to-structured offer, quantities, PDFs, mini-CRM | €39 and €89 plans advertised | Another direct product in the DACH market. |
| plancraft / HERO | Established Handwerk operating platforms adding AI assistants | Broader suites | Incumbents can bundle similar AI features into existing workflows. |

These are vendor claims, not independently verified product-quality assessments. During discovery, the team should trial each direct product and interview former/current users where possible.

## 4. Refined product thesis

### Target customer

An owner-led painting or interior-renovation company with 1–15 employees that:

- creates at least three quotations per week;
- currently uses Word, Excel, PDF templates, or a Handwerk package that is slow on mobile;
- has its own labour, material, travel, waste, and margin rules;
- performs repeatable renovation jobs where measurements can be explicitly captured;
- wants to keep final commercial control.

### Job to be done

> After a site visit, help me convert what I saw, measured, and said into a complete, priced, professional draft while the details are fresh—without inventing missing facts and without replacing my own pricing rules.

### Core workflow

1. The craft professional creates/selects a customer and project.
2. During the visit, they record a voice note, photos, and explicit measurements.
3. The system extracts scope, rooms/areas, work steps, quantities, exclusions, and open questions.
4. It maps extracted items only to approved company price-book entries.
5. It asks targeted follow-up questions when required facts are missing.
6. Every draft position shows its source, calculation, and confidence/risk flag.
7. The user edits and approves the draft.
8. The system exports a branded PDF and CSV; integrations come later.

### Defensible differentiators

1. **No invented pricing:** only business-approved price-book positions may be used.
2. **Missing-information engine:** the system asks trade-specific questions instead of hiding uncertainty.
3. **Evidence traceability:** each line links to the relevant voice transcript, photo, measurement, or user rule.
4. **Company learning:** corrections improve mappings and templates for that company without changing other customers' data.
5. **Multilingual capture:** a worker can speak naturally; the output becomes professional German trade language.
6. **Works beside existing software:** PDF/CSV export first; ERP replacement is not required.

### Safety principle

Photos may provide context, detect visible conditions, and document evidence. They must not be treated as a reliable measurement source unless a validated scale/depth method is present. Hidden wiring, pipes, substrate defects, access constraints, and code requirements cannot be inferred safely from an ordinary image.

### MVP scope

**Must have**

- mobile web capture for voice, photos, and measurements;
- customer/project records;
- Excel/CSV price-book import and manual price-book editor;
- transcript and structured scope extraction;
- mapping to approved positions;
- missing-information questions and uncertainty flags;
- editable offer draft with calculations;
- branded PDF and CSV export;
- human approval, audit log, deletion/export controls, and EU-oriented privacy design.

**Explicitly excluded from MVP**

- every Handwerk trade;
- universal or market-wide automatic pricing;
- exact measurements inferred from a normal photo;
- autonomous sending without human review;
- final invoices, payment collection, inventory, scheduling, payroll, and accounting;
- WhatsApp/Telegram as the primary product interface;
- VOB/HOAI compliance claims generated automatically.

## 5. Important corrections to the original assumptions

- **HOAI is not a general Handwerk quotation rule.** It applies to fees for covered architect and engineering services. It should not be used as a generic sales claim for electricians, painters, plumbers, or carpenters.
- **VOB is not universally applicable to every job.** VOB-related templates should be a later, reviewed option for contracts where the relevant terms are actually incorporated.
- **E-invoicing is adjacent, not part of the initial offer problem.** Germany's B2B e-invoice rules concern invoices, with transition rules; private consumers are excluded. This may become a later invoice/export module.
- **GDPR is product architecture, not a badge.** Photos, addresses, voice, names, and property details can be personal data. The product needs a lawful basis, transparency, data minimisation, retention/deletion controls, processor agreements, access control, and secure storage.
- **The EU AI Act is now operational.** The product is unlikely to be a high-risk use case by itself, but transparency, AI literacy, documentation, and human oversight should be designed in from the start. A qualified German/EU lawyer must confirm the final obligations before launch.

This brief is product guidance, not legal advice.

## 6. Business model hypothesis

Do not lock pricing before interviews. Test this initial structure:

- **Design partner pilot:** four weeks free, limited to five companies, in exchange for weekly feedback and anonymised evaluation cases.
- **Starter:** €49/month per company, up to two users.
- **Team:** €99/month per company, up to ten users, roles and approval workflow.
- **Later onboarding/import service:** €199 once, waived for early design partners.

The original €20–50 range may work for a solo plan, but a company-specific price-book setup, support, storage, and AI processing make €20 difficult as the main sustainable plan. Compete on trusted time savings, not on being the cheapest tool.

### Preliminary market logic

The first vertical reportedly includes 38,661 painting/decorating businesses. Capturing 1% at €79 average monthly revenue would be approximately €366,000 ARR; 5% would be approximately €1.83 million ARR. This is only a scenario, not a forecast, and ignores churn, discounts, taxes, support, and acquisition cost.

## 7. Team roles

| Team member | Formal role | Owns | Must not do |
|---|---|---|---|
| **Mohsen** | Founder, Product Owner, and Customer Discovery Lead | Vision, interviews, pilot relationships, priorities, commercial/legal decisions, final acceptance | Delegate customer truth or final decisions to AI tools |
| **ChatGPT** | Product Strategist and Program Manager | Research synthesis, interview scripts, PRD/backlog, decision log, KPI reviews, weekly status and correction loop | Invent customer evidence or silently change scope |
| **Codex** | Technical Lead and Implementation Agent | Repository, architecture proposals, code, tests, CI, security checks, releases, technical documentation | Choose product priorities or deploy material changes without acceptance criteria |
| **Claude** | Independent Red-Team Reviewer | Challenge assumptions, review PRDs/architecture/diffs, find failure cases, produce a written risk verdict | Become a second product owner or rewrite work without a traceable review request |
| **Human Handwerk design partner** | Domain and Safety Validator | Trade workflow, price-book meaning, completeness, dangerous omissions, real-world acceptance | Be replaced by AI consensus |

**Non-negotiable:** the four named collaborators are not enough without at least one real Handwerk professional. No model can supply authentic trade workflow, pricing behaviour, or customer trust evidence.

### Practical collaboration loop

1. Mohsen records interview/site evidence and makes the business decision.
2. ChatGPT converts evidence into one scoped issue with acceptance criteria and updates the decision log.
3. Codex implements the issue on a branch and provides test/evidence results.
4. Claude reviews the frozen spec and diff as an adversarial reviewer.
5. ChatGPT consolidates the evidence and scores the gate.
6. Mohsen accepts, rejects, or requests one correction cycle.

ChatGPT/Codex cannot directly coordinate an external Claude session in this setup. Use a standard handoff packet containing the current product brief, issue, acceptance criteria, diff/PR link, tests, open risks, and the exact review question.

### Decision rules

- GitHub becomes the source of truth after the discovery gate.
- Mohsen has final product and commercial decision authority.
- Evidence from users outranks model consensus.
- One issue has one owner and measurable acceptance criteria.
- No feature enters development without a linked customer problem or compliance need.
- No AI-generated price or scope is sent to a customer without human approval.

### Quality gate (100 points)

| Area | Weight |
|---|---:|
| Demonstrated customer value | 30 |
| Evidence and acceptance-test quality | 20 |
| Accuracy, uncertainty handling, and human control | 20 |
| Privacy, security, and legal readiness | 15 |
| Maintainability and operational readiness | 15 |

Passing requires **85/100**, no unresolved critical privacy/security issue, and no dangerous unflagged scope/pricing omission. A failed gate creates one corrective loop with a named owner and deadline.

## 8. Roadmap with evidence gates

### Phase 0 — Problem discovery (Weeks 1–4)

**Work**

- choose one initial trade and one local region;
- interview 15 business owners/estimators;
- observe at least three site-to-offer workflows;
- obtain at least 30 anonymised historical offers and, where possible, the original notes/photos;
- trial the direct competitors;
- document the current time, tools, errors, and willingness to pay.

**Go gate**

- at least 10/15 create three or more offers per week or spend at least two hours per week on the workflow;
- at least five share anonymised examples;
- at least three sign design-partner letters of intent;
- at least three state they would pay €49/month if specified outcomes are achieved.

If the gate fails, do not build. Revise the segment/problem or stop the project.

### Phase 1 — Concierge prototype (Weeks 5–8)

Use a simple secure upload/prototype and process cases with AI plus manual review. Do not build a full app yet.

**Success gate**

- at least 50 real historical/live cases processed;
- median draft preparation time under five minutes;
- at least 50% reduction in total quotation preparation time;
- at least 85% of proposed positions accepted or lightly edited;
- all missing critical facts are flagged in the test set;
- at least three partners request continued use.

### Phase 2 — Technical MVP (Months 3–5)

Build the mobile web app, organisation/project model, price-book import, capture flow, extraction/mapping pipeline, follow-up questions, review screen, PDF/CSV export, audit log, and core privacy/security controls.

Pilot with 5–10 companies. Instrument time-to-draft, edits, omissions, model cost, failure reasons, and weekly usage.

### Phase 3 — Paid beta (Months 6–8)

- convert at least five pilots to paying customers;
- expand to 20–30 companies within the same vertical;
- add onboarding, roles/approvals, support process, backups, monitoring, and billing;
- obtain legal/privacy review and basic penetration/security assessment;
- validate unit economics and support burden.

**Gate:** at least 60% 8-week logo retention, four approved drafts per active company per week, at least 50% median time saving, and gross margin capable of supporting the intended price.

### Phase 4 — Version 1 launch (Months 9–12)

- production reliability and incident runbook;
- contractual documents and data-processing terms;
- customer onboarding and help centre;
- referral case studies with verified time-saving evidence;
- partnership outreach to local Innung/HWK after real pilot evidence;
- limited integration/export based on measured demand.

Only after strong retention should the team add a second trade, invoices/e-invoices, payments, scheduling, or inventory.

## 9. North-star and guardrail metrics

**North-star metric:** number of human-approved offer drafts produced per active company per week.

**Outcome metrics**

- median minutes from end of site visit to approved draft;
- percentage time saved versus prior process;
- weekly active companies and 8-/12-week retention;
- percentage of drafts sent after review;
- paid conversion and monthly recurring revenue.

**Accuracy and safety guardrails**

- critical omission rate;
- invented/unapproved price-book position rate (target: zero);
- percentage of low-confidence facts correctly flagged;
- edit distance/value change between AI draft and approved offer;
- customer-reported pricing/scope incidents;
- deletion/export request completion and security incidents.

## 10. First 14-day sprint

### Mohsen

1. Confirm the working segment: painting/interior renovation in NRW.
2. Recruit ten interview candidates: direct outreach first, then Innung/HWK introductions.
3. Conduct six interviews and one workflow observation in week one; complete the remainder in week two.
4. Ask for anonymised examples and a future paid-pilot commitment; do not sell features prematurely.
5. Record each interview as structured notes or a voice memo after obtaining any necessary permission.

### ChatGPT

- produce the German interview script, evidence form, competitor trial checklist, and weekly synthesis;
- maintain assumptions, decisions, risks, and scores;
- propose the Phase 0 go/no-go decision based only on collected evidence.

### Codex

- no production build in the first two weeks;
- after the segment is confirmed, create a lightweight repository structure for research evidence, decisions, product specs, and later code;
- build only a throwaway clickable/secure intake prototype if interviews require it.

### Claude

- review this product thesis and interview design for confirmation bias;
- identify ten failure modes and five reasons the target customer may refuse to switch/pay;
- review the discovery evidence at Day 14 without seeing the team's desired conclusion first.

### Day-14 deliverables

- interview evidence table;
- current workflow map;
- competitor trial matrix;
- top-five pains ranked by frequency and economic cost;
- design-partner list and willingness-to-pay evidence;
- explicit go / revise / stop decision.

## 11. Sources reviewed

- [ZDH — Handwerk businesses, employment, and revenue](https://www.zdh.de/daten-und-fakten/betriebe/beschaeftigte/umsaetze/)
- [Destatis — Handwerk structural data 2024](https://www.destatis.de/DE/Themen/Branchen-Unternehmen/Handwerk/aktuell-struktur-handwerk.html)
- [Bundesverband Farbe — painting and decorating sector facts](https://www.farbe.de/fileadmin/Bundesverband_Farbe/Bundesverband/Mitarbeiter/Naser/2025-07-31_Flyer_Zahlen_Daten_Fakten.pdf)
- [Handwerkskammer Dortmund — digitalisation and AI support](https://www.hwk-do.de/digitalisierung-innovation-2/)
- [BMF — mandatory B2B e-invoice FAQ](https://www.bundesfinanzministerium.de/Content/DE/FAQ/e-rechnung.html)
- [German federal law — HOAI scope](https://www.gesetze-im-internet.de/hoai_2013/__1.html)
- [EUR-Lex — General Data Protection Regulation](https://eur-lex.europa.eu/eli/reg/2016/679/oj/eng)
- [European Commission — AI Act framework and timeline](https://digital-strategy.ec.europa.eu/en/policies/regulatory-framework-ai)
- [MeisterFix product page](https://meisterfix-app.de/)
- [Baustellenwerk product page](https://baustellenwerk.de/)
- [Handwerk-Assistent product page](https://handwerk.vetron.de/)
- [Angebotsmeister product page](https://angebots-meister.de/produkt)
- [plancraft product updates](https://plancraft.com/de-de/produktupdates)
- [HERO AI announcement](https://presse.hero-software.de/hero-ai-launch)

## 12. Current recommendation

**Proceed only to Phase 0 discovery. Do not begin a full product build yet.**

The idea can become a marketable product if the team proves a narrow workflow, earns trust through company-specific pricing and visible uncertainty, and gains real design partners. Building the generic version now would enter a crowded category with weak differentiation and a high risk of producing a technically impressive product that customers do not switch to.
