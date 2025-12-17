export type DelimitedParseResult = {
  delimiter: string
  rows: string[][]
}

const DELIMITER_CANDIDATES = [',', ';', '\t', '|'] as const

const splitLines = (text: string) => text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')

export function detectDelimiter(text: string): string {
  const firstNonEmptyLine = splitLines(text).find((line) => line.trim().length > 0) ?? ''
  const best = DELIMITER_CANDIDATES.map((delimiter) => ({
    delimiter,
    count: (firstNonEmptyLine.match(new RegExp(escapeRegExp(delimiter), 'g')) ?? []).length,
  })).sort((a, b) => b.count - a.count)[0]

  if (!best) return ','
  return best.count > 0 ? best.delimiter : ','
}

export function parseDelimitedText(text: string, delimiter: string): DelimitedParseResult {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false

  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  for (let i = 0; i < normalized.length; i++) {
    const char = normalized[i]

    if (inQuotes) {
      if (char === '"') {
        const next = normalized[i + 1]
        if (next === '"') {
          field += '"'
          i++
          continue
        }
        inQuotes = false
        continue
      }
      field += char
      continue
    }

    if (char === '"') {
      inQuotes = true
      continue
    }

    if (char === delimiter) {
      row.push(field)
      field = ''
      continue
    }

    if (char === '\n') {
      row.push(field)
      field = ''
      rows.push(row)
      row = []
      continue
    }

    field += char
  }

  row.push(field)
  rows.push(row)

  const nonEmptyRows = rows
    .map((r) => r.map((cell) => cell ?? ''))
    .filter((r) => r.some((cell) => cell.trim().length > 0))

  return { delimiter, rows: nonEmptyRows }
}

export function toDelimitedText(options: {
  delimiter: string
  rows: string[][]
}): string {
  const { delimiter, rows } = options
  const escapeCell = (value: string) => {
    const raw = value ?? ''
    const mustQuote = raw.includes('"') || raw.includes('\n') || raw.includes('\r') || raw.includes(delimiter)
    const escaped = raw.replace(/"/g, '""')
    return mustQuote ? `"${escaped}"` : escaped
  }

  return rows.map((row) => row.map((cell) => escapeCell(cell ?? '')).join(delimiter)).join('\n')
}

export function extractDateFromFilename(filename: string): string | null {
  const name = filename ?? ''

  const iso = name.match(/(\d{4})[-_.](\d{2})[-_.](\d{2})/)
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`

  const dmy = name.match(/(\d{1,2})[-_.](\d{1,2})[-_.](\d{4})/)
  if (dmy) {
    const dd = dmy[1].padStart(2, '0')
    const mm = dmy[2].padStart(2, '0')
    const yyyy = dmy[3]
    return `${yyyy}-${mm}-${dd}`
  }

  const compact = name.match(/(\d{4})(\d{2})(\d{2})/)
  if (compact) return `${compact[1]}-${compact[2]}-${compact[3]}`

  return null
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

