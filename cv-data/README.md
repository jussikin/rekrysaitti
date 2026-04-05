# CV Data Files

The CV content lives in one easy-to-edit file:

- `cv.md`

Generator usage:

- Run `node scripts/generate-site.js`
- Or run `npm run build:cv`
- This reads `cv-data/cv.md` and rewrites:
  - `saitti/index.html` (modern)
  - `saitti/cv.pdf` (generated directly from `cv-data/cv.md`)

Notes:

- Keep section headings exactly as they are in `cv.md`
- Keep list item keys (`company`, `role`, `period`, etc.) the same
