// CAP 1.1 alerts from the Department of Meteorology (was.meteo.gov.lk/cap).
// Hand-rolled on purpose: the files are a few KB of flat XML and we read ~16 leaf fields,
// so a parser dependency isn't worth it in a 20-dependency package.json.
// Nothing here throws and nothing here touches the network or the database: every getter
// returns null when it finds nothing, so a feed that changes shape degrades instead of
// breaking the news section. Only identifier / sent / event are treated as required.

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }

// One pass, so "&amp;lt;" decodes to "&lt;" and not to "<".
function decode(s) {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&(amp|lt|gt|quot|apos|#\d+|#x[0-9a-f]+);/gi, (m, e) => {
      if (e[0] !== '#') return ENTITIES[e.toLowerCase()] || m
      const code = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : Number(e.slice(1))
      return Number.isFinite(code) ? String.fromCodePoint(code) : m
    })
}

// Matches <event>, <cap:event> and <event attr="x"> alike.
function pattern(name, flags) {
  return new RegExp(`<(?:[\\w.-]+:)?${name}\\b[^>]*>([\\s\\S]*?)</(?:[\\w.-]+:)?${name}\\s*>`, flags)
}

// A leaf value, decoded. null when absent or empty.
function tag(xml, name) {
  if (typeof xml !== 'string') return null
  const m = pattern(name, 'i').exec(xml)
  if (!m) return null
  return decode(m[1]).trim() || null
}

// Raw inner XML of every <name> block, NOT decoded — decoding here would turn an escaped
// "&lt;area&gt;" inside a description into markup that the nested parsing then believes.
function rawAll(xml, name) {
  if (typeof xml !== 'string') return []
  const re = pattern(name, 'gi')
  const out = []
  let m
  while ((m = re.exec(xml))) out.push(m[1])
  return out
}

// CAP permits one <info> per language. Take the one asked for, else the first.
// `lang` is matched as a prefix so both "si" and "en-US" style codes work.
function pickInfo(xml, lang) {
  const blocks = rawAll(xml, 'info')
  if (!blocks.length) return null
  if (!lang) return blocks[0]
  const want = blocks.find((b) => (tag(b, 'language') || '').toLowerCase().startsWith(lang.toLowerCase()))
  return want || blocks[0]
}

/** One CAP file -> a flat object, or null if it isn't a usable alert. */
function parseCap(xml, lang) {
  if (typeof xml !== 'string' || !xml.includes('<alert')) return null
  const identifier = tag(xml, 'identifier')
  const sent = tag(xml, 'sent')
  const info = pickInfo(xml, lang)
  const event = tag(info, 'event')
  if (!identifier || !sent || !event) return null

  // Every <area> of the block, joined; the <polygon> siblings are ignored.
  const areaDesc = rawAll(info || '', 'area')
    .map((a) => tag(a, 'areaDesc'))
    .filter(Boolean)
    .join('\n')

  return {
    identifier,
    sent,
    sender: tag(xml, 'sender'),
    status: tag(xml, 'status'),
    msgType: tag(xml, 'msgType'),
    scope: tag(xml, 'scope'),
    references: tag(xml, 'references'),
    language: tag(info, 'language'),
    category: tag(info, 'category'),
    event,
    responseType: tag(info, 'responseType'),
    urgency: tag(info, 'urgency'),
    severity: tag(info, 'severity'),
    certainty: tag(info, 'certainty'),
    expires: tag(info, 'expires'),
    senderName: tag(info, 'senderName'),
    headline: tag(info, 'headline'),
    description: tag(info, 'description'),
    instruction: tag(info, 'instruction'),
    web: tag(info, 'web'),
    areaDesc: areaDesc || null,
  }
}

/**
 * The RSS index -> [{ id, guid, link, category, pubDate }].
 * Used only to discover ids: the index is English whatever language you ask it for,
 * so nothing from it is ever displayed.
 */
function parseRssIds(xml) {
  if (typeof xml !== 'string') return []
  const out = []
  for (const item of rawAll(xml, 'item')) {
    const guid = tag(item, 'guid')
    const link = tag(item, 'link')
    // Both carry the id ("cap:en:<id>" and ".../<id>.xml"); take whichever parses.
    const byGuid = guid && /(?:^|:)([0-9a-f]{8,})$/i.exec(guid)
    const byLink = link && /\/([0-9a-f]{8,})\.xml(?:$|[?#])/i.exec(link)
    const id = (byGuid && byGuid[1]) || (byLink && byLink[1]) || null
    if (id) out.push({ id, guid, link, category: tag(item, 'category'), pubDate: tag(item, 'pubDate') })
  }
  return out
}

/**
 * A Cancel message names what it withdraws in <references>, as
 * "sender,identifier,sent" entries separated by whitespace.
 */
function referencedIds(references) {
  if (!references) return []
  return references
    .split(/\s+/)
    .map((ref) => ref.split(',')[1])
    .filter((id) => id && id.length > 3)
}

// "Amber Warning (Be Prepared)" -> amber. Orange is the same tier as amber for us.
const COLOUR_RE = /\b(red|amber|orange|yellow)\s+(?:level\s+)?warning\b/i

// Strong Winds and Heavy Rain are ordinary monsoon vocabulary, so they are deliberately
// NOT cyclone. Untested against a real cyclone bulletin — see the test SQL in
// models/add-weather-advisories.sql and re-check this against the first real one.
const CYCLONE_RE = /cyclon|tropical\s+(?:storm|depression)|\bdepression\b|storm\s+surge|\bgale\b|tsunami/i

function colourOf(headline) {
  const m = COLOUR_RE.exec(headline || '')
  if (!m) return 'none'
  const c = m[1].toLowerCase()
  return c === 'orange' ? 'amber' : c
}

function isCyclone(cap) {
  return CYCLONE_RE.test(`${cap.event || ''} ${cap.headline || ''}`)
}

/**
 * Whether this earns the red banner on the farmer's home screen.
 * Severity alone must never fire it: Amber + Severe lightning is routine in this feed
 * and a banner that cries wolf is one farmers learn to ignore. Only the Department's own
 * top colour tier, a genuine cyclone at Severe+, or Extreme severity as a safety net for
 * a bulletin that omits the colour word.
 */
function bannerFor(cap, colour, cyclone) {
  if (cap.status !== 'Actual' || cap.scope !== 'Public') return false
  if (cap.msgType !== 'Alert' && cap.msgType !== 'Update') return false
  if (!cap.expires) return false // an indefinite red banner is a bug, not a warning
  const until = Date.parse(cap.expires)
  if (!Number.isFinite(until) || until <= Date.now()) return false
  if (colour === 'red' || cap.severity === 'Extreme') return true
  return cyclone && (cap.severity === 'Severe' || cap.severity === 'Extreme')
}

// The CSS class the portal uses for the item's icon tile. Computed here so the severity
// rules live in one place on the server rather than being re-derived in the UI.
function toneOf(colour, severity) {
  if (colour === 'red' || severity === 'Extreme') return 'red'
  if (colour === 'amber' || severity === 'Severe') return 'amber'
  if (colour === 'yellow' || severity === 'Moderate') return 'blue'
  return 'soft'
}

/** Everything the language-invariant columns need, from the English CAP file. */
function classify(cap) {
  const colour = colourOf(cap.headline)
  const cyclone = isCyclone(cap)
  return { colour, cyclone, banner: bannerFor(cap, colour, cyclone), tone: toneOf(colour, cap.severity) }
}

module.exports = {
  parseCap,
  parseRssIds,
  referencedIds,
  classify,
  colourOf,
  isCyclone,
  bannerFor,
  toneOf,
  decode,
  tag,
  COLOUR_RE,
  CYCLONE_RE,
}
