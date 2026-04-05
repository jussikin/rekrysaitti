# Agent Notes For This Repo

## Project purpose

- This repository is a personal static CV site project.
- Source CV content is maintained in Markdown, not directly in HTML.

## Single source of truth

- Edit CV content in `cv-data/cv.md`.
- Keep section headings and keys stable so the generator can parse correctly.

## Build/generation flow

- Generate site output with `npm run build:cv` (or `node scripts/generate-site.js`).
- The generator reads `cv-data/cv.md` and writes:
  - `saitti/index.html` (classic page)
  - `saitti/index-modern.html` (modern page)

## Frontend/output notes

- Modern styles are in `saitti/style-modern.css`.
- URL rendering is intentionally compact (labels like `github.com/jussikin`) to avoid overflow in cards.
- Do not hand-edit generated HTML as the build step will overwrite it.

## Git/workspace notes

- Terraform files were intentionally removed from this project and are no longer needed.
- `AGENTS.md` has been intentionally left available for ongoing repo-specific instructions.
