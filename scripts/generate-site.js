const fs = require("fs");
const path = require("path");

const rootDir = path.resolve(__dirname, "..");
const dataPath = path.join(rootDir, "cv-data", "cv.md");
const classicOutputPath = path.join(rootDir, "saitti", "index.html");
const modernOutputPath = path.join(rootDir, "saitti", "index-modern.html");

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

function renderClassicDlRow(term, description) {
  return `  <dt>${formatText(term)}</dt>\n  <dd>${formatText(description)}</dd>`;
}

function buildClassicHtml(data) {
  const basicLabels = {
    domicile: "Domicile",
    year_of_birth: "Year of Birth",
    marital_status: "Marital status",
    working_languages: "Working languages",
  };

  const basicRows = data.basic
    .map((row) => renderClassicDlRow(basicLabels[row.key] || sectionTitleFromKey(row.key), row.value))
    .join("\n");

  const workRows = data.work
    .map((entry) => renderClassicDlRow(entry.company || "", `${entry.role || ""}, ${entry.period || ""}`.replace(/^,\s*/, "").replace(/,\s*$/, "")))
    .join("\n");

  const techRows = data.tech
    .map((entry) => renderClassicDlRow(entry.area || "", entry.details || ""))
    .join("\n");

  const courseRows = data.courses
    .map((entry) => renderClassicDlRow(entry.course || "", entry.details || ""))
    .join("\n");

  const hobbyRows = data.hobbies
    .map((entry) => {
      const details = entry.details_list && entry.details_list.length
        ? entry.details_list.join(", ")
        : entry.details || "";
      return renderClassicDlRow(entry.hobby || "", details);
    })
    .join("\n");

  const contactRows = data.contact
    .map((row) => renderClassicDlRow(sectionTitleFromKey(row.key), row.value))
    .join("\n");

  return [
    "<html>",
    "<head>",
    '  <link REL="stylesheet" TYPE="text/css" href="style.css" />',
    "  <title>CV jk</title>",
    "</head>",
    '<body background="background.gif">',
    `  <h1>Curriculum Vitae - ${formatText(data.name)}</h1>`,
    "",
    "<h3>Basic data</h3>",
    '<img src="larvi.jpg" align="right" alt="Portrait">',
    "<dl>",
    basicRows,
    "</dl>",
    "",
    "<h3>Work experience</h3>",
    "<dl>",
    workRows,
    "</dl>",
    "",
    "<h3>Technology expertise</h3>",
    "<dl>",
    techRows,
    "</dl>",
    "",
    "<h3>Courses taken</h3>",
    "<dl>",
    courseRows,
    "</dl>",
    "",
    "<h3>Hobbies &amp; etc.</h3>",
    "<dl>",
    hobbyRows,
    "</dl>",
    "",
    "<h3>Contact details</h3>",
    "<dl>",
    contactRows,
    "</dl>",
    "</body>",
    "</html>",
    "",
  ].join("\n");
}

function renderModernItems(items, titleKey, detailKey) {
  return items
    .map((item) => {
      const title = formatText(item[titleKey] || "");
      const details = item.details_list && item.details_list.length
        ? item.details_list.map((line) => `<li>${formatText(line)}</li>`).join("")
        : `<li>${formatText(item[detailKey] || "")}</li>`;

      return `<article class="entry"><h4>${title}</h4><ul>${details}</ul></article>`;
    })
    .join("\n");
}

function buildModernHtml(data) {
  const basic = data.basic
    .map((row) => `<li><strong>${sectionTitleFromKey(row.key)}:</strong> ${formatText(row.value)}</li>`)
    .join("\n");

  const work = data.work
    .map((entry) => {
      const role = formatText(entry.role || "");
      const company = formatText(entry.company || "");
      const period = formatText(entry.period || "");
      return `<article class="entry work"><h4>${role}</h4><p class="meta">${company}</p><p class="period">${period}</p></article>`;
    })
    .join("\n");

  const tech = renderModernItems(data.tech, "area", "details");
  const courses = renderModernItems(data.courses, "course", "details");
  const hobbies = renderModernItems(data.hobbies, "hobby", "details");

  const contact = data.contact
    .map((row) => `<li><strong>${sectionTitleFromKey(row.key)}:</strong> ${formatText(row.value)}</li>`)
    .join("\n");

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
    "          <p>Senior software consultant</p>",
    "        </div>",
    '        <img class="profile-photo" src="larvi.jpg" alt="Portrait of Jussi Kinnunen">',
    "      </div>",
    "    </header>",
    "",
    "    <section>",
    "      <h2>Basic Data</h2>",
    "      <ul>",
    basic,
    "      </ul>",
    "    </section>",
    "",
    "    <section>",
    "      <h2>Work Experience</h2>",
    "      <div class=\"grid\">",
    work,
    "      </div>",
    "    </section>",
    "",
    "    <section>",
    "      <h2>Technology Expertise</h2>",
    "      <div class=\"grid\">",
    tech,
    "      </div>",
    "    </section>",
    "",
    "    <section>",
    "      <h2>Courses</h2>",
    "      <div class=\"grid\">",
    courses,
    "      </div>",
    "    </section>",
    "",
    "    <section>",
    "      <h2>Hobbies</h2>",
    "      <div class=\"grid\">",
    hobbies,
    "      </div>",
    "    </section>",
    "",
    "    <section>",
    "      <h2>Contact</h2>",
    "      <ul>",
    contact,
    "      </ul>",
    "    </section>",
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

const classicHtml = buildClassicHtml(data);
const modernHtml = buildModernHtml(data);

fs.writeFileSync(classicOutputPath, classicHtml, "utf8");
fs.writeFileSync(modernOutputPath, modernHtml, "utf8");

process.stdout.write(`Generated ${path.relative(rootDir, classicOutputPath)} from ${path.relative(rootDir, dataPath)}\n`);
process.stdout.write(`Generated ${path.relative(rootDir, modernOutputPath)} from ${path.relative(rootDir, dataPath)}\n`);
