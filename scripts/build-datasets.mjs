// Builds the Business School option list used by the About you step.
//
//   node scripts/build-datasets.mjs
//
// See data/README.md for the sources.

import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const today = new Date().toISOString().slice(0, 10);

function readTsv(path) {
  const [header, ...rows] = readFileSync(path, "utf8").trim().split(/\r?\n/);
  const keys = header.split("\t");
  return rows.map((row) => Object.fromEntries(row.split("\t").map((v, i) => [keys[i], v])));
}

/* ---------- Business schools (NIRF 2025 + verified additions) ---------- */

// Common abbreviations and school names students search for. Keyed by cleaned name + city.
const SCHOOL_ALIASES = {
  "Indian Institute of Management Ahmedabad|Ahmedabad": ["IIMA", "IIM A"],
  "Indian Institute of Management Bangalore|Bengaluru": ["IIMB", "IIM B", "IIM Bengaluru"],
  "Indian Institute of Management Calcutta|Kolkata": ["IIMC", "IIM C", "IIM Kolkata"],
  "Indian Institute of Management Lucknow|Lucknow": ["IIML"],
  "Indian Institute of Management Kozhikode|Kozhikode": ["IIMK", "IIM Calicut"],
  "Indian Institute of Management Indore|Indore": ["IIMI"],
  "Indian Institute of Management, Mumbai|Mumbai": ["NITIE"],
  "Indian Institute of Technology Delhi|New Delhi": ["DMS IIT Delhi"],
  "Indian Institute of Technology Bombay|Mumbai": ["SJMSOM", "Shailesh J. Mehta School of Management"],
  "Indian Institute of Technology Kharagpur|Kharagpur": ["VGSOM", "Vinod Gupta School of Management"],
  "Indian Institute of Technology Madras|Chennai": ["DoMS IIT Madras"],
  "Indian Institute of Technology Roorkee|Roorkee": ["DoMS IIT Roorkee"],
  "Indian Institute of Technology (Indian School of Mines)|Dhanbad": ["IIT ISM", "ISM Dhanbad"],
  "Indian Institute of Foreign Trade|New Delhi": ["IIFT"],
  "Management Development Institute|Gurugram": ["MDI", "MDI Gurgaon"],
  "XLRI - Xavier School of Management|Jamshedpur": ["XLRI"],
  "Symbiosis Institute of Business Management|Pune": ["SIBM"],
  "S. P. Jain Institute of Management and Research|Mumbai": ["SPJIMR"],
  "SVKM's Narsee Monjee Institute of Management Studies|Mumbai": ["NMIMS"],
  "Amrita Vishwa Vidyapeetham|Coimbatore": ["Amrita School of Business"],
  "Institute of Management Technology|Ghaziabad": ["IMT", "IMT Ghaziabad"],
  "Institute of Management Technology|Hyderabad": ["IMT", "IMT Hyderabad"],
  "Institute of Management Technology, Nagpur|Nagpur": ["IMT", "IMT Nagpur"],
  "T. A. Pai Management Institute Manipal|Manipal": ["TAPMI"],
  "Goa Institute of Management|Sanquelim": ["GIM"],
  "Institute of Rural Management Anand|Anand": ["IRMA"],
  "Loyola Institute of Business Administration|Chennai": ["LIBA"],
  "Fore School of Management|New Delhi": ["FORE"],
  "Birla Institute of Management Technology|Greater Noida": ["BIMTECH"],
  "K.J.Somaiya Institute of Management|Mumbai": ["KJSIM", "Somaiya"],
  "Kalinga Institute of Industrial Technology|Bhubaneswar": ["KIIT", "KSOM"],
  "XIM University|Bhubaneswar": ["XIMB"],
  "Prin. L.N. Welingkar Institute of Management Development and Research|Mumbai": ["WeSchool", "Welingkar"],
  "Thiagarajar School of Management|Madurai": ["TSM"],
  "Banaras Hindu University|Varanasi": ["BHU", "FMS BHU"],
  "National Institute of Agricultural Extension Management|Hyderabad": ["MANAGE"],
  "Bharathidasan Institute of Management|Tiruchirappalli": ["BIM Trichy"],
  "National Institute of Bank Management|Pune": ["NIBM"],
  "Lal Bahadur Shastri Institute of Management|Delhi": ["LBSIM"],
  "Jagan Institute of Management Studies|Delhi": ["JIMS"],
  "Great Lakes Institute of Management|Chennai": ["Great Lakes"],
  "Great Lakes Institute of Management|Gurgaon": ["Great Lakes"],
  "Indian School of Business|Hyderabad": ["ISB"],
  "Indian School of Business|Mohali": ["ISB"],
  "Faculty of Management Studies, University of Delhi|New Delhi": ["FMS", "FMS Delhi"],
  "Jamnalal Bajaj Institute of Management Studies|Mumbai": ["JBIMS"],
  "Mesa School of Business|Bengaluru": ["Mesa"],
};

// Minimal typography clean-up of the published names; the wording is unchanged.
function cleanName(name, city) {
  let n = name
    .replace(/`/g, "'")
    .replace(/\s+/g, " ")
    .replace(/\s+,/g, ",")
    .replace(/,(?=\S)/g, ", ")
    .replace(/\s*\(PGDM\)$/, "")
    .trim();
  // NIRF lists IIM Nagpur as just "Indian Institute of Management".
  if (n === "Indian Institute of Management") n = `${n} ${city}`;
  return n;
}

function cleanCity(city) {
  const c = city.split(",")[0].trim(); // "Gurugram, Haryana" -> "Gurugram"
  return c === c.toUpperCase() ? c[0] + c.slice(1).toLowerCase() : c;
}

const STOPWORDS = new Set(["of", "and", "the", "for", "&", "-", "in"]);
function acronym(name) {
  return name
    .replace(/[(),.']/g, " ")
    .split(/\s+/)
    .filter((w) => w && !STOPWORDS.has(w.toLowerCase()) && /^[A-Za-z]/.test(w))
    .map((w) => w[0].toUpperCase())
    .join("");
}

function buildSchools() {
  const nirf = readTsv(join(root, "data/sources/nirf-2025-management.tsv")).map((r) => ({
    name: cleanName(r.name, cleanCity(r.city)),
    city: cleanCity(r.city),
    state: r.state,
    source: `NIRF 2025 Management (rank ${r.rank})`,
  }));
  const additions = readTsv(join(root, "data/sources/business-schools-additions.tsv")).map((r) => ({
    name: r.name,
    city: r.city,
    state: r.state,
    source: `Official website (${r.source_url}), checked ${r.verified}`,
  }));

  // NIRF ranks PIBM's PGDM separately; it is the same institution and campus.
  const merged = [];
  const seen = new Set();
  for (const s of [...nirf, ...additions]) {
    const base = s.name.replace(/ for PGDM \(PIBM PGDM\)$/, "");
    const key = `${base.toLowerCase()}|${s.city.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push({ ...s, name: base });
  }

  const nameCounts = new Map();
  for (const s of merged) nameCounts.set(s.name, (nameCounts.get(s.name) ?? 0) + 1);

  // Generated acronyms are kept only when unique: IIM Ahmedabad and IIM Amritsar would
  // both be "IIMA", and that must not match the wrong school.
  const acronymCounts = new Map();
  const manualAliases = new Set(Object.values(SCHOOL_ALIASES).flat().map((a) => a.toUpperCase()));
  for (const s of merged) acronymCounts.set(acronym(s.name), (acronymCounts.get(acronym(s.name)) ?? 0) + 1);

  const unusedAliases = new Set(Object.keys(SCHOOL_ALIASES));
  const schools = merged
    .map((s) => {
      const key = `${s.name}|${s.city}`;
      unusedAliases.delete(key);
      const generated = acronym(s.name);
      const manual = SCHOOL_ALIASES[key] ?? [];
      const keepGenerated =
        generated.length >= 3 &&
        acronymCounts.get(generated) === 1 &&
        (!manualAliases.has(generated) || manual.some((a) => a.toUpperCase() === generated));
      // Standard short forms for national institute families, e.g. "IIM Amritsar".
      const family = [
        ["Indian Institute of Management", "IIM"],
        ["Indian Institute of Technology", "IIT"],
        ["National Institute of Technology", "NIT"],
      ].find(([prefix]) => s.name.startsWith(prefix));
      const short = family ? [`${family[1]} ${s.city}`] : [];
      const aliases = [...new Set([...(keepGenerated ? [generated] : []), ...short, ...manual])].filter(
        (a) => a.length >= 2 && a !== s.name,
      );
      return {
        // Names shared by several campuses carry their city so the stored value is unambiguous.
        value: nameCounts.get(s.name) > 1 ? `${s.name}, ${s.city}` : s.name,
        name: s.name,
        city: s.city,
        state: s.state,
        aliases,
        source: s.source,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, "en") || a.city.localeCompare(b.city, "en"));
  if (unusedAliases.size) console.warn("Unmatched school aliases:", [...unusedAliases]);

  const out = {
    sources: [
      {
        name: "NIRF India Rankings 2025: Management (ranks 1–100 and band 101–125)",
        url: "https://www.nirfindia.org/Rankings/2025/ManagementRanking.html",
        publisher: "National Institutional Ranking Framework, Ministry of Education, Government of India",
        licence: "No licence stated. Only factual data (institution names and locations) is used, with attribution.",
      },
      {
        name: "Manual additions verified on each institution's official website",
        file: "data/sources/business-schools-additions.tsv",
      },
    ],
    note: "Initial list, not a complete register of Indian business schools. Students can enter any institution that is missing.",
    generated: today,
    count: schools.length,
    schools,
  };
  writeFileSync(join(root, "src/data/business-schools.json"), JSON.stringify(out, null, 1));
  console.log(`Business schools: ${nirf.length} NIRF rows + ${additions.length} additions -> ${schools.length} entries`);
}

buildSchools();
