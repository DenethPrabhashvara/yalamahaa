// Matching Sri Lankan place names from the CAP feed's <areaDesc> against farmers.district.
// The feed writes names in caps with real-world drift in them — "PADAW IYA", "NUWARAELIYA",
// "DEHIATTAKANDIYD" — so names are normalised before comparison and never compared raw.
// Pure: no database, no network.

// The same canonical list the portal uses (farmerportal/src/data.js DISTRICTS); keep in step.
const DISTRICTS = [
  'Ampara', 'Anuradhapura', 'Badulla', 'Batticaloa', 'Colombo', 'Galle', 'Gampaha', 'Hambantota', 'Jaffna',
  'Kalutara', 'Kandy', 'Kegalle', 'Kilinochchi', 'Kurunegala', 'Mannar', 'Matale', 'Matara', 'Monaragala',
  'Mullaitivu', 'Nuwara Eliya', 'Polonnaruwa', 'Puttalam', 'Ratnapura', 'Trincomalee', 'Vavuniya',
]

// Dropping spaces and punctuation is what makes "PADAW IYA" and "Nuwara Eliya" comparable.
function norm(s) {
  return String(s == null ? '' : s).toUpperCase().replace(/[^A-Z]/g, '')
}

const BY_NORM = new Map(DISTRICTS.map((d) => [norm(d), d]))

// Spellings seen in the wild that aren't a one-or-two-character slip.
const ALIASES = new Map(Object.entries({
  MONERAGALA: 'Monaragala',
  MONARAGALLA: 'Monaragala',
  MULLAITHIVU: 'Mullaitivu',
  MULLATIVU: 'Mullaitivu',
  KILLINOCHCHI: 'Kilinochchi',
  KILINOCHCHIYA: 'Kilinochchi',
  BATTICOLOA: 'Batticaloa',
  BATTICALOE: 'Batticaloa',
  TRINCOMALE: 'Trincomalee',
  NUWARAELIYA: 'Nuwara Eliya',
  NUWARAELLIYA: 'Nuwara Eliya',
  ANURADAPURA: 'Anuradhapura',
  HAMBANTHOTA: 'Hambantota',
  PUTTALAMA: 'Puttalam',
  RATHNAPURA: 'Ratnapura',
  MONARAGALAE: 'Monaragala',
}))

function distance(a, b) {
  if (Math.abs(a.length - b.length) > 2) return 3 // cheap bail-out; we only care about <= 2
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    const row = [i]
    for (let j = 1; j <= b.length; j++) {
      row[j] = Math.min(
        prev[j] + 1,
        row[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      )
    }
    prev = row
  }
  return prev[b.length]
}

/**
 * A district name from anywhere -> its canonical spelling, or null.
 * Exact match, then the alias table, then an edit distance of at most 2 over the 25
 * names. District names sit far apart in edit distance, so a 2-character budget absorbs
 * typos like "DEHIATTAKANDIYD" without ever matching the wrong district.
 */
function canonDistrict(name) {
  const key = norm(name)
  if (!key || key.length < 4) return null
  const exact = BY_NORM.get(key) || ALIASES.get(key)
  if (exact) return exact

  let best = null
  let bestScore = 3
  for (const [k, canonical] of BY_NORM) {
    const d = distance(key, k)
    if (d < bestScore) {
      bestScore = d
      best = canonical
    } else if (d === bestScore) {
      best = null // ambiguous at this distance; refuse rather than guess
    }
  }
  return bestScore <= 2 ? best : null
}

// Title-case for display; division names have no canonical list to match against.
function titleCase(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/\b[a-z]/g, (c) => c.toUpperCase())
    .replace(/\s+/g, ' ')
    .trim()
}

const DISTRICT_LABEL = /Districts?\s*:/i
const DIVISION_LABEL = /Divisional\s+Secretariats?\s*:/i
const ISLAND_WIDE = /island.?wide|all\s+(?:the\s+)?districts|whole\s+island|every\s+district/i

function splitList(segment) {
  return String(segment || '')
    .split(/[,;/\n]/)
    .map((x) => x.trim())
    .filter(Boolean)
}

/**
 * <areaDesc> -> { districts, divisions, allIsland }.
 *
 * districts are canonical names, deduped. divisions are kept as title-cased text only:
 * farmers.division is free text (no list behind it) and the feed's division names carry
 * the worst of the typos, so they are never used to exclude a warning — only to
 * highlight "your area". Unrecognised district names are dropped from `districts`, and
 * the caller treats an empty result as island-wide so a warning is never hidden by a
 * parsing failure.
 */
function parseAreaDesc(text) {
  const raw = String(text || '')
  const out = { districts: [], divisions: [], allIsland: false }
  if (!raw.trim()) {
    out.allIsland = true
    return out
  }
  if (ISLAND_WIDE.test(raw)) out.allIsland = true

  const dm = DISTRICT_LABEL.exec(raw)
  const vm = DIVISION_LABEL.exec(raw)

  // Each label runs until the next label or the end of the text.
  const districtPart = dm
    ? raw.slice(dm.index + dm[0].length, vm && vm.index > dm.index ? vm.index : undefined)
    : ''
  const divisionPart = vm
    ? raw.slice(vm.index + vm[0].length, dm && dm.index > vm.index ? dm.index : undefined)
    : ''

  // With no "Districts:" label at all, try the whole text as a bare comma list; that is
  // how a shorter bulletin tends to be written.
  const districtNames = districtPart ? splitList(districtPart) : (dm || vm ? [] : splitList(raw))

  const seen = new Set()
  for (const name of districtNames) {
    const canonical = canonDistrict(name)
    if (canonical && !seen.has(canonical)) {
      seen.add(canonical)
      out.districts.push(canonical)
    }
  }

  const seenDiv = new Set()
  for (const name of splitList(divisionPart)) {
    const label = titleCase(name)
    const key = norm(label)
    if (label && key.length > 2 && !seenDiv.has(key)) {
      seenDiv.add(key)
      out.divisions.push(label)
    }
  }

  if (!out.districts.length && !out.divisions.length) out.allIsland = true
  return out
}

module.exports = { DISTRICTS, norm, canonDistrict, parseAreaDesc, titleCase }
