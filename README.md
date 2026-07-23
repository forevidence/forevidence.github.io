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
| `about.html` | About / mission |
| `contact.html` | Contact + form |
| `onepage.html` | Single-scroll landing page (alternative / interim) |
| `company-onepager.html` | Printable one-page company summary (print to Letter → Save as PDF) |
| `styles.css` | Shared stylesheet (design tokens at top) |
| `main.js` | Mobile nav + dropdown behavior |
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
- Contact and partner forms are not yet wired to a backend — see below.

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
- [ ] Wire the contact + partner forms to a backend (Formspree / Web3Forms / Netlify Forms).
- [ ] Set up email forwarding for `info@forevidence.ai` and `partnerships@forevidence.ai`
      (Namecheap Email Redirect is free). All site + one-pager copy now uses `info@` (not `hello@`).

## Notes
- All content is **draft copy for review** — footers are marked accordingly.
- The site intentionally does not name any specific credentialing partner.
- ForEvidence.ai is a PBC; foundation grants for the public-goods layer route through a
  nonprofit partner or fiscal sponsor (reflected in `partner.html`).
