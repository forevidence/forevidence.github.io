# ForEvidence.ai

Static marketing site for ForEvidence.ai — a public benefit corporation building
independent evidence, evaluation, and assurance capacity for the AI era.
Pure HTML/CSS + a tiny vanilla-JS nav script. No build step, no dependencies.

## Structure
One brand, three surfaces:
- **Products** — Evidence Fabric, Evidentia assessment infrastructure
- **Services** — AI Evaluation, AI Assurance, Enterprise consultation, Evidentia credential programs
- **Public goods** (free) — Workforce Index, open assessment framework, open-source tools,
  Evidence Briefs, anti-deskilling research, public-interest advisory, and the partner coalition

## Pages
| File | Page |
|------|------|
| `index.html` | Home — mission-first hero + the three ways in |
| `products.html` | Products — Evidence Fabric · Evidentia infrastructure · public-goods tools |
| `services.html` | Services — Evaluation · Assurance · Enterprise consultation · Evidentia programs · public-interest advisory |
| `partner.html` | Public-goods layer + partnership call (nonprofits, academic centers, foundations, companies) |
| `approach.html` | Methodology |
| `insights.html` | Insights / blog index |
| `briefs.html` | Policy Signal Daily Brief (renders `briefs/data/*.json`; see below) |
| `briefs-archive.html` | Daily Brief archive — every edition by month |
| `about.html` | About / mission |
| `contact.html` | Contact + form |
| `subscribe.html` | Subscribe to the Daily Brief / Weekly Briefing / Insights (Web3Forms → redirects to `subscribe-confirmation.html`) |
| `subscribe-confirmation.html` | Post-subscription confirmation page (the GA4 conversion target) |
| `onepage.html` | Single-scroll landing page (alternative / interim) |
| `company-onepager.html` | Printable one-page company summary (print to Letter → Save as PDF) |
| `styles.css` | Shared stylesheet (design tokens at top) |
| `main.js` | Mobile nav + dropdown behavior |
| `analytics.js` | Site-wide Google Analytics (GA4) + subscription funnel events — set the Measurement ID once at the top of this file (setup steps in the file header). Reports `subscribe_cta_click` → `generate_lead` → `sign_up` (deduped per session); captures UTM/referrer attribution into subscribe-form emails. Loaded in every page's `<head>`. If EU/UK traffic matters, add a consent banner (Consent Mode v2) before production. |
| `favicon.svg` | Favicon |

## Preview locally
```bash
python3 -m http.server 8787
```
Then open http://localhost:8787

## Editing content
- Copy lives directly in each `.html` file. The header nav and footer are repeated in
  every page — if you change a nav/footer link, update it in all pages
  (a scripted find-and-replace across `*.html` is the easiest way).
- Colors, spacing, and fonts come from the CSS variables at the top of `styles.css`
  (`:root { ... }`). Change once, applies everywhere.
- The contact, partner, and insights-signup forms submit via Web3Forms
  (`.w3f-form` in `main.js`; access key in each form's hidden input).

## Deploy (edit → review → push → auto-redeploy)
1. Edit files on a branch.
2. Preview locally (above).
3. Commit and push / open a pull request.
4. The host auto-builds and redeploys on push to the main branch.

### Not published
The one-pagers (`*onepager*.html`, including the index and the internal buyer
targeting sheet) are **excluded from the repo via `.gitignore`** — they stay on
this machine only. Share them as PDFs (Cmd+P → Save as PDF), never as links.

### To do at deploy time
- [ ] Create the GitHub repo and push these files (free personal account is fine; repo must be public for free Pages).
- [ ] Connect a host, root directory, no build command.
- [ ] Add a `CNAME` file containing `forevidence.ai` (GitHub Pages) or set the custom domain in the host dashboard.
- [ ] Namecheap DNS: remove the existing `forevidence.ai → www` redirect and parking records, then add
      four A records for `@` (185.199.108–111.153) and a CNAME `www → <username>.github.io.`
- [x] Wire the contact + partner + insights-signup forms to a backend (Web3Forms).
- [ ] Set up email forwarding for `info@forevidence.ai` and `partnerships@forevidence.ai`
      (Namecheap Email Redirect is free). All site + one-pager copy now uses `info@` (not `hello@`).

## Policy Signal Daily Brief
`briefs.html` renders a daily brief from `briefs/data/` — one immutable JSON file per day
plus `index.json`, validated by `.github/workflows/validate-briefs.yml` (schema,
plain-text sanitization, https-only citations, immutability, index consistency). The data
is written by the Policy Signal publisher (a separate, private system); humans should not
hand-edit published day files except to append `corrections[]`. The Policy Signal design
docs (plan review, PRD, technical design) are private — `docs/policy-signal/` is
gitignored here and the documents live in the personal knowledge repo.

Deploy-time steps for the brief section:
- [ ] Mark the `Validate Daily Brief data` workflow as a **required status check** on `main`.
- [ ] Switch GitHub Pages to **deploy from GitHub Actions** so the validation gate fronts
      every deploy that touches brief data (TDD §6).
- [ ] Create the path-restricted GitHub App identity for the publisher (push ruleset
      limiting it to `briefs/data/**`).

## Weekly Briefing distribution
The Weekly Briefing publishes to three channels off the single publish-PR merge:
- **Atom feed** — `weekly-briefing/feed.xml`, generated by
  `.github/scripts/generate_weekly_feed.py`. Because `main` is PR-only, the feed is
  committed **as part of each publish PR** (run the generator after adding the edition);
  the `Validate Weekly Briefing data` workflow fails if it's stale. Works in any feed
  reader, and in Slack via `/feed subscribe https://forevidence.ai/weekly-briefing/feed.xml`.
- **Slack announcement** — `.github/workflows/notify-weekly-briefing.yml` posts the newest
  edition to a Slack channel when `index.json` changes on `main`. One-time setup: add an
  incoming-webhook URL as the `SLACK_WEBHOOK_URL` repo secret; until then runs no-op.
- **Email** — not yet wired; see the subscribe form notes above (an ESP like Buttondown
  can be driven from the same merge event, or consume the feed directly).

## Notes
- All content is **draft copy for review** — footers are marked accordingly.
- The site intentionally does not name any specific credentialing partner.
- ForEvidence.ai is a PBC; foundation grants for the public-goods layer route through a
  nonprofit partner or fiscal sponsor (reflected in `partner.html`).
