const MIN_PHONE_DIGITS = 6

function digitsOnly(value: string): string {
  return (value ?? '').replace(/\D/g, '')
}

function stripInternationalPrefix(value: string): string {
  const raw = digitsOnly(value)
  if (raw.startsWith('00')) return raw.slice(2)
  return raw
}

function localVariantsFromCountryCode(value: string): string[] {
  const digits = stripInternationalPrefix(value)
  if (!digits.startsWith('383')) return []

  const rest = digits.slice(3)
  const variants = new Set<string>()
  if (rest.length >= MIN_PHONE_DIGITS) variants.add(rest)
  if (rest.length >= MIN_PHONE_DIGITS && !rest.startsWith('0')) variants.add(`0${rest}`)
  return Array.from(variants)
}

export function phoneCandidates(value: string): string[] {
  const raw = value ?? ''

  const parts = raw
    .split(/[;,|]+/g)
    .map((p) => p.trim())
    .filter(Boolean)

  const candidates = new Set<string>()

  const add = (v: string) => {
    const cleaned = stripInternationalPrefix(v)
    if (cleaned.length >= MIN_PHONE_DIGITS) candidates.add(cleaned)
    localVariantsFromCountryCode(v).forEach((variant) => candidates.add(stripInternationalPrefix(variant)))
  }

  if (parts.length) parts.forEach(add)
  else add(raw)

  // Fallback: in-case the number is split by odd separators like "044 / 372/  632"
  const compact = digitsOnly(raw)
  if (compact.length >= MIN_PHONE_DIGITS) candidates.add(stripInternationalPrefix(compact))

  return Array.from(candidates)
}

export function normalizePhoneQuery(query: string): string {
  return stripInternationalPrefix(query)
}

export function phoneMatches(phoneValue: string, query: string): boolean {
  const q = normalizePhoneQuery(query)
  if (!q) return true
  const candidates = phoneCandidates(phoneValue)
  return candidates.some((c) => c.includes(q) || c.endsWith(q))
}

