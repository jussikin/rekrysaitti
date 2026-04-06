const fs = require("fs");
const path = require("path");

const rootDir = path.resolve(__dirname, "..");
const dataPath = path.join(rootDir, "cv-data", "cv.md");
const outputPath = path.join(rootDir, "saitti", "index.html");

const md = fs.readFileSync(dataPath, "utf8");

function escapeHtml(value) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatText(text) {
  const pattern = /([^\s]+)\s*\((https?:\/\/[^\s)]+)\)|(https?:\/\/[^\s)]+)/g;
  let result = "";
  let lastIndex = 0;
  let match;

  while ((match = pattern.exec(text)) !== null) {
    result += escapeHtml(text.slice(lastIndex, match.index));

    if (match[1] && match[2]) {
      const label = escapeHtml(match[1]);
      const url = escapeHtml(match[2]);
      result += `<a href="${url}">${label}</a>`;
    } else if (match[3]) {
      const rawUrl = match[3];
      const label = rawUrl.replace(/^https?:\/\//, "").replace(/\/$/, "");
      const url = escapeHtml(rawUrl);
      result += `<a href="${url}">${escapeHtml(label)}</a>`;
    }

    lastIndex = pattern.lastIndex;
  }

  result += escapeHtml(text.slice(lastIndex));
  return result;
}

function parseTopLevel(lines) {
  const sections = [];
  let current = null;

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line.trim()) {
      continue;
    }

    if (line.startsWith("# ")) {
      continue;
    }

    if (line.startsWith("## ")) {
      current = { title: line.slice(3).trim(), lines: [] };
      sections.push(current);
      continue;
    }

    if (!current) {
      continue;
    }

    current.lines.push(line);
  }

  return sections;
}

function parseKeyValueLine(line) {
  const match = line.match(/^([A-Za-z_]+):\s*(.*)$/);
  if (!match) {
    return null;
  }

  return {
    key: match[1].trim(),
    value: match[2].trim(),
  };
}

function parseSimpleList(lines) {
  const rows = [];

  for (const line of lines) {
    if (!line.startsWith("- ")) {
      continue;
    }

    const parsed = parseKeyValueLine(line.slice(2).trim());
    if (!parsed) {
      continue;
    }

    rows.push(parsed);
  }

  return rows;
}

function parseEntries(lines) {
  const entries = [];
  let current = null;

  for (const line of lines) {
    const subItem = line.match(/^\s{2,}-\s+(.*)$/);
    if (subItem && current) {
      if (!current.details_list) {
        current.details_list = [];
      }
      current.details_list.push(subItem[1].trim());
      continue;
    }

    if (line.startsWith("- ")) {
      const parsed = parseKeyValueLine(line.slice(2).trim());
      if (!parsed) {
        continue;
      }

      current = { [parsed.key]: parsed.value };
      entries.push(current);
      continue;
    }

    if (!current) {
      continue;
    }

    if (line.startsWith("  ")) {
      const parsed = parseKeyValueLine(line.trim());
      if (!parsed) {
        continue;
      }

      if (parsed.key === "details" && parsed.value === "") {
        if (!current.details_list) {
          current.details_list = [];
        }
      } else {
        current[parsed.key] = parsed.value;
      }
    }
  }

  return entries;
}

function getName(lines) {
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }
    const parsed = parseKeyValueLine(line);
    if (parsed && parsed.key === "name") {
      return parsed.value;
    }
  }
  return "";
}

function sectionTitleFromKey(key) {
  return key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function hasText(value) {
  return String(value || "").trim().length > 0;
}

function isFilledSimpleRow(row) {
  return row && hasText(row.key) && hasText(row.value);
}

function isFilledEntry(entry, keys) {
  if (!entry) {
    return false;
  }

  if (keys.some((key) => hasText(entry[key]))) {
    return true;
  }

  return Array.isArray(entry.details_list) && entry.details_list.some((line) => hasText(line));
}

function detailItems(entry, detailKey) {
  function normalize(item) {
    const text = String(item || "").trim();
    if (!text) {
      return "";
    }
    return text.charAt(0).toUpperCase() + text.slice(1);
  }

  if (Array.isArray(entry.details_list) && entry.details_list.length > 0) {
    return entry.details_list.map(normalize).filter(Boolean);
  }

  const raw = String(entry[detailKey] || "");
  return raw
    .split(",")
    .map(normalize)
    .filter(Boolean);
}

function renderModernItems(items, titleKey, detailKey) {
  return items
    .map((item) => {
      const title = formatText(item[titleKey] || "");
      const detailsArray = detailItems(item, detailKey);
      const details = detailsArray.length > 0
        ? detailsArray.map((line) => `<li>${formatText(line)}</li>`).join("")
        : "";

      return `<article class="entry"><h4>${title}</h4><ul>${details}</ul></article>`;
    })
    .join("\n");
}

function buildModernHtml(data) {
  const basicRows = data.basic.filter(isFilledSimpleRow);
  const workRows = data.work.filter((entry) => isFilledEntry(entry, ["role", "company", "period"]));
  const techRows = data.tech.filter((entry) => isFilledEntry(entry, ["area", "details"]));
  const courseRows = data.courses.filter((entry) => isFilledEntry(entry, ["course", "details"]));
  const hobbyRows = data.hobbies.filter((entry) => isFilledEntry(entry, ["hobby", "details"]));
  const contactRows = data.contact.filter(isFilledSimpleRow);
  const subtitle = hasText(workRows[0] && workRows[0].role) ? workRows[0].role : "Curriculum Vitae";

  const basic = basicRows
    .map((row) => `<li><strong>${sectionTitleFromKey(row.key)}:</strong> ${formatText(row.value)}</li>`)
    .join("\n");

  const work = workRows
    .map((entry) => {
      const role = formatText(entry.role || "");
      const company = formatText(entry.company || "");
      const period = formatText(entry.period || "");
      return `<article class="entry work"><h4>${role}</h4><p class="meta">${company}</p><p class="period">${period}</p></article>`;
    })
    .join("\n");

  const tech = renderModernItems(techRows, "area", "details");
  const courses = renderModernItems(courseRows, "course", "details");
  const hobbies = renderModernItems(hobbyRows, "hobby", "details");

  const contact = contactRows
    .map((row) => `<li><strong>${sectionTitleFromKey(row.key)}:</strong> ${formatText(row.value)}</li>`)
    .join("\n");

  const contentSections = [];

  if (basicRows.length > 0) {
    contentSections.push(
      "    <section>",
      "      <h2>Basic Data</h2>",
      "      <ul>",
      basic,
      "      </ul>",
      "    </section>",
      ""
    );
  }

  if (workRows.length > 0) {
    contentSections.push(
      "    <section>",
      "      <h2>Work Experience</h2>",
      "      <div class=\"grid\">",
      work,
      "      </div>",
      "    </section>",
      ""
    );
  }

  if (techRows.length > 0) {
    contentSections.push(
      "    <section>",
      "      <h2>Technology Expertise</h2>",
      "      <div class=\"grid\">",
      tech,
      "      </div>",
      "    </section>",
      ""
    );
  }

  if (courseRows.length > 0) {
    contentSections.push(
      "    <section>",
      "      <h2>Courses</h2>",
      "      <div class=\"grid\">",
      courses,
      "      </div>",
      "    </section>",
      ""
    );
  }

  if (hobbyRows.length > 0) {
    contentSections.push(
      "    <section>",
      "      <h2>Hobbies</h2>",
      "      <div class=\"grid\">",
      hobbies,
      "      </div>",
      "    </section>",
      ""
    );
  }

  if (contactRows.length > 0) {
    contentSections.push(
      "    <section>",
      "      <h2>Contact</h2>",
      "      <ul>",
      contact,
      "      </ul>",
      "    </section>",
      ""
    );
  }

  return [
    "<!doctype html>",
    '<html lang="en">',
    "<head>",
    '  <meta charset="utf-8">',
    '  <meta name="viewport" content="width=device-width, initial-scale=1">',
    `  <title>${escapeHtml(data.name)} - CV</title>`,
    '  <link rel="stylesheet" href="style-modern.css">',
    "</head>",
    "<body>",
    "  <main class=\"page\">",
    "    <header class=\"hero\">",
    "      <div class=\"hero-content\">",
    "        <div>",
    `          <h1>${escapeHtml(data.name)}</h1>`,
    `          <p>${formatText(subtitle)}</p>`,
    "        </div>",
    '        <img class="profile-photo" src="larvi.jpg" alt="Portrait of Jussi Kinnunen">',
    "      </div>",
    "    </header>",
    "",
    ...contentSections,
    "",
    "    <aside class=\"info-box\" aria-label=\"CV source and formats\">",
    "      <h3>CV Formats</h3>",
    "      <p>For automated edits or agent workflows, use the Markdown source as the single source of truth.</p>",
    "      <ul>",
    '        <li><a href="../cv-data/cv.md">Markdown source (cv.md)</a></li>',
    '        <li><a href="cv.pdf">PDF version (cv.pdf)</a></li>',
    "      </ul>",
    "    </aside>",
    "",
    "    <p class=\"source-link\">Source code: <a href=\"https://github.com/jussikin/rekrysaitti\">github.com/jussikin/rekrysaitti</a></p>",
    "  </main>",
    "</body>",
    "</html>",
    "",
  ].join("\n");
}

const lines = md.split(/\r?\n/);
const sections = parseTopLevel(lines);
const byTitle = Object.fromEntries(sections.map((s) => [s.title, s]));

const data = {
  name: getName(lines) || "Unnamed",
  basic: parseSimpleList((byTitle["Basic Data"] || { lines: [] }).lines),
  work: parseEntries((byTitle["Work Experience"] || { lines: [] }).lines),
  tech: parseEntries((byTitle["Technology Expertise"] || { lines: [] }).lines),
  courses: parseEntries((byTitle["Courses Taken"] || { lines: [] }).lines),
  hobbies: parseEntries((byTitle["Hobbies and Other Interests"] || { lines: [] }).lines),
  contact: parseSimpleList((byTitle["Contact Details"] || { lines: [] }).lines),
};

const modernHtml = buildModernHtml(data);

fs.writeFileSync(outputPath, modernHtml, "utf8");

process.stdout.write(`Generated ${path.relative(rootDir, outputPath)} from ${path.relative(rootDir, dataPath)}\n`);
