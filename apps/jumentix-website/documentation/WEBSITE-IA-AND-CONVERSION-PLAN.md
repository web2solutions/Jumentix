# Jumentix Website IA and Conversion Plan

Issue tracking:

- Epic: [#124](https://github.com/web2solutions/Jumentix/issues/124)
- Task: [#125](https://github.com/web2solutions/Jumentix/issues/125)

## 1. Objective

Define the commercial website information architecture and conversion journey before implementation to reduce uncertainty and rework.

## 2. Primary Conversion Goals

1. Generate qualified enterprise leads (demo/contact).
2. Move technical evaluators to documentation and implementation guides.
3. Convert interest into pilot adoption (start with a first service/app).

## 3. CTA Model

Primary CTA:

- `Book an Enterprise Demo`

Secondary CTAs:

- `Start a Pilot with Jumentix`
- `Explore Technical Documentation`
- `Talk to Architecture Team`

Persistent CTA zones:

- Header nav CTA button
- Hero CTA group
- End-of-section CTA strips
- Footer conversion block

## 4. Sitemap (Static Website)

1. `/` Home (commercial narrative, trust, positioning, CTA)
2. `/product` Product overview (capabilities and outcomes)
3. `/use-cases` Use-case index
4. `/use-cases/rest-api`
5. `/use-cases/realtime-api`
6. `/use-cases/saas-monolith`
7. `/use-cases/saas-microservices`
8. `/use-cases/spa-pwa`
9. `/architecture` Enterprise architecture narrative
10. `/integrations` Adapters, databases, runtime options
11. `/security-compliance` Security and governance posture
12. `/docs` Technical docs gateway (links to docs index)
13. `/pricing-or-engagement` Commercial engagement model (initial static content)
14. `/contact` Lead capture and enterprise contact

## 5. Buyer Journey Flow

1. Awareness:
   - Home -> Product value proposition -> credibility/trust signals.
2. Consideration:
   - Product -> Use cases -> Architecture/Integrations.
3. Technical validation:
   - Docs gateway -> component hubs -> implementation guides.
4. Decision:
   - Contact/demo CTA with explicit pilot proposal.

## 6. Required Static Page Content Blocks

Home:

- Problem narrative
- Jumentix differentiation
- Outcome metrics/ROI
- CTA block

Product:

- Capability pillars (architecture, adapters, governance, deployment)
- Value by persona (CTO, Product Owner, Engineering Manager, Platform Team)

Use-case pages:

- Business context
- Why Jumentix fits
- Expected delivery pattern
- CTA to pilot/demo

Architecture/Integrations:

- DDD/EDA/Hexagonal narrative
- Framework matrix and database options
- Runtime/deployment flexibility

Security/compliance:

- PCI hardening posture summary
- CI quality gates and traceability standards

Contact:

- Enterprise request form placeholder
- Engagement options and expected response SLAs

## 7. Markdown Source-to-Website Mapping

| Website Section | Source Markdown |
| --- | --- |
| Product positioning | `/README.md` |
| Architecture narrative | `/documentation/md/ARCHITECTURE-AND-STRUCTURE.md` |
| Project vision/governance | `/documentation/md/PROJECT-OVERVIEW.md`, `/documentation/md/JUMENTIX-PROJECT-GOVERNANCE.md` |
| REST use case | `/apps/backend-template/documentation/guides/CREATING-REST-API-WITH-JUMENTIX.md` |
| Realtime use case | `/apps/backend-template/documentation/guides/CREATING-REALTIME-API-WITH-JUMENTIX.md` |
| SPA/PWA use case | `/apps/service-management/documentation/guides/CREATING-SPA-PWA-WITH-JUMENTIX.md` |
| SaaS monolith use case | `/documentation/md/guides/CREATING-SAAS-MONOLITH-WITH-JUMENTIX.md` |
| SaaS microservices use case | `/documentation/md/guides/CREATING-SAAS-MICROSERVICES-WITH-JUMENTIX.md` |
| Integrations matrix | `/documentation/md/adapters/http/README.md`, `/documentation/md/adapters/databases/README.md` |
| Security/compliance | `/documentation/md/PCI-REMEDIATION-PLAN-AND-EVIDENCE.md`, `/documentation/md/SECURITY-RUNBOOK-PCI.md` |
| Technical docs gateway | `/documentation/README.md` |

## 8. Governance and Execution Notes

- All pages are static and versioned with repository code.
- Content model must preserve traceability to source markdown files.
- PRs implementing this plan must map page deliverables to issues `#125` and `#124`.
