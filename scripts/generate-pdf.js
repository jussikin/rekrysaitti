const fs = require("fs");
const path = require("path");
const PDFDocument = require("pdfkit");

const rootDir = path.resolve(__dirname, "..");
const dataPath = path.join(rootDir, "cv-data", "cv.md");
const pdfPath = path.join(rootDir, "saitti", "cv.pdf");

const md = fs.readFileSync(dataPath, "utf8");

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

    if (current) {
      current.lines.push(line);
    }
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
  return lines
    .filter((line) => line.startsWith("- "))
    .map((line) => parseKeyValueLine(line.slice(2).trim()))
    .filter(Boolean);
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

    if (line.startsWith("  ") && current) {
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
  return "Unnamed";
}

function humanizeKey(key) {
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

function createData() {
  const lines = md.split(/\r?\n/);
  const sections = parseTopLevel(lines);
  const byTitle = Object.fromEntries(sections.map((s) => [s.title, s]));

  return {
    name: getName(lines),
    basic: parseSimpleList((byTitle["Basic Data"] || { lines: [] }).lines),
    work: parseEntries((byTitle["Work Experience"] || { lines: [] }).lines),
    tech: parseEntries((byTitle["Technology Expertise"] || { lines: [] }).lines),
    courses: parseEntries((byTitle["Courses Taken"] || { lines: [] }).lines),
    hobbies: parseEntries((byTitle["Hobbies and Other Interests"] || { lines: [] }).lines),
    contact: parseSimpleList((byTitle["Contact Details"] || { lines: [] }).lines),
  };
}

function renderPdf(data) {
  const doc = new PDFDocument({
    size: "A4",
    margin: 40,
    info: {
      Title: `${data.name} CV`,
      Author: data.name,
    },
  });

  const stream = fs.createWriteStream(pdfPath);
  doc.pipe(stream);

  function ensureSpace(height = 40) {
    if (doc.y + height > doc.page.height - doc.page.margins.bottom) {
      doc.addPage();
    }
  }

  function sectionTitle(text) {
    ensureSpace(30);
    doc.moveDown(0.2);
    doc.font("Helvetica-Bold").fontSize(13).fillColor("#0f4b45").text(text);
    doc.moveDown(0.25);
  }

  function keyValue(label, value) {
    ensureSpace(18);
    doc.font("Helvetica-Bold").fontSize(10.5).fillColor("#1f1b16").text(`${label}: `, { continued: true });
    doc.font("Helvetica").fontSize(10.5).fillColor("#1f1b16").text(String(value || ""));
  }

  function bullet(text, indent = 16) {
    ensureSpace(16);
    doc.font("Helvetica").fontSize(10.5).fillColor("#1f1b16").text(`- ${text}`, { indent });
  }

  function detail(text, indent = 28) {
    ensureSpace(14);
    doc.font("Helvetica").fontSize(10.2).fillColor("#2d2823").text(text, { indent });
  }

  function lineBreak() {
    doc.moveDown(0.35);
  }

  const basicRows = data.basic.filter(isFilledSimpleRow);
  const workRows = data.work.filter((entry) => isFilledEntry(entry, ["role", "company", "period"]));
  const techRows = data.tech.filter((entry) => isFilledEntry(entry, ["area", "details"]));
  const courseRows = data.courses.filter((entry) => isFilledEntry(entry, ["course", "details"]));
  const hobbyRows = data.hobbies.filter((entry) => isFilledEntry(entry, ["hobby", "details"]));
  const contactRows = data.contact.filter(isFilledSimpleRow);
  const subtitle = hasText(workRows[0] && workRows[0].role) ? workRows[0].role : "Curriculum Vitae";

  doc.font("Helvetica-Bold").fontSize(21).fillColor("#1f1b16").text(data.name);
  doc.font("Helvetica").fontSize(11).fillColor("#57504a").text(subtitle);
  doc.moveDown(0.6);

  if (basicRows.length > 0) {
    sectionTitle("Basic Data");
  }
  for (const row of basicRows) {
    keyValue(humanizeKey(row.key), row.value);
  }

  if (workRows.length > 0) {
    sectionTitle("Work Experience");
  }
  for (const item of workRows) {
    ensureSpace(26);
    doc.font("Helvetica-Bold").fontSize(11).fillColor("#1f1b16").text(item.role || "");
    doc.font("Helvetica").fontSize(10.5).fillColor("#1f1b16").text(item.company || "");
    doc.font("Helvetica").fontSize(10).fillColor("#57504a").text(item.period || "");
    lineBreak();
  }

  if (techRows.length > 0) {
    sectionTitle("Technology Expertise");
  }
  for (const item of techRows) {
    bullet(item.area || "");
    for (const line of detailItems(item, "details")) {
      bullet(line, 28);
    }
    lineBreak();
  }

  if (courseRows.length > 0) {
    sectionTitle("Courses Taken");
  }
  for (const item of courseRows) {
    bullet(`${item.course || ""}: ${item.details || ""}`);
  }

  if (hobbyRows.length > 0) {
    sectionTitle("Hobbies and Other Interests");
  }
  for (const item of hobbyRows) {
    bullet(item.hobby || "");
    if (item.details_list && item.details_list.length) {
      for (const detail of item.details_list) {
        bullet(detail, 28);
      }
    } else if (item.details) {
      bullet(item.details, 28);
    }
    lineBreak();
  }

  if (contactRows.length > 0) {
    sectionTitle("Contact Details");
  }
  for (const row of contactRows) {
    keyValue(humanizeKey(row.key), row.value);
  }

  doc.end();

  return new Promise((resolve, reject) => {
    stream.on("finish", resolve);
    stream.on("error", reject);
  });
}

async function run() {
  const data = createData();
  await renderPdf(data);
  process.stdout.write(`Generated ${path.relative(rootDir, pdfPath)} from ${path.relative(rootDir, dataPath)}\n`);
}

run().catch((error) => {
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exit(1);
});
