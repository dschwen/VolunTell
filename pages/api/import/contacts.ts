import type { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '../../../lib/prisma'

type Mapping = {
  email?: string
  phone?: string
  method?: string
  at?: string
  comments?: string
}

type Defaults = {
  method?: string
}

type Options = {
  timezone?: string
  delimiter?: string
}

type DedupeOptions = {
  strategy?: 'exact' | 'none'
  windowMinutes?: number
}

type PreviewRow = {
  idx: number
  matchedVolunteer?: { id: string; name: string }
  normalized: { method?: string; atISO?: string; comments?: string }
  issues: string[]
}

type PreviewPayload = {
  total: number
  matched: number
  unmatched: number
  duplicates: number
  rows: PreviewRow[]
}

type ImportSummary = {
  imported: number
  duplicates: number
  unmatched: number
  errors: string[]
}

type RowContext = {
  idx: number
  volunteer?: { id: string; name: string }
  method?: string
  at?: Date
  comments?: string
  issues: string[]
  duplicate?: boolean
}

function normalizeHeader(s: string): string {
  return s.replace(/\s+/g, ' ').trim().toLowerCase()
}

function parseCsv(text: string, delimiter = ','): { headers: string[]; rows: string[][] } {
  const rows: string[][] = []
  const cur: string[] = []
  let cell = ''
  let i = 0
  let inQuotes = false
  const N = text.length
  const delim = delimiter.length ? delimiter[0] : ','
  function pushCell() {
    cur.push(cell)
    cell = ''
  }
  function pushRow() {
    rows.push(cur.slice())
    cur.length = 0
  }
  while (i < N) {
    const ch = text[i]
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < N && text[i + 1] === '"') {
          cell += '"'
          i += 2
          continue
        }
        inQuotes = false
        i++
        continue
      }
      cell += ch
      i++
      continue
    }
    if (ch === '"') {
      inQuotes = true
      i++
      continue
    }
    if (ch === delim) {
      pushCell()
      i++
      continue
    }
    if (ch === '\n') {
      pushCell()
      pushRow()
      i++
      continue
    }
    if (ch === '\r') {
      i++
      continue
    }
    cell += ch
    i++
  }
  pushCell()
  if (cur.length) pushRow()
  if (!rows.length) return { headers: [], rows: [] }
  const headers = rows.shift()!.map((h) => h.trim())
  return { headers, rows }
}

function findHeader(headers: string[], guesses: string[]): string | undefined {
  const normalized = headers.map((h) => normalizeHeader(h))
  for (const guess of guesses) {
    const idx = normalized.indexOf(normalizeHeader(guess))
    if (idx >= 0) return headers[idx]
  }
  return undefined
}

function normalizeMethod(raw?: string): { value?: string; issue?: string } {
  if (!raw) return { value: undefined }
  const text = raw.trim().toLowerCase()
  if (!text) return { value: undefined }
  if (['phone', 'call', 'phone call', 'voice', 'sms', 'text', 'in person', 'in-person'].includes(text)) return { value: 'phone' }
  if (['email', 'e-mail', 'mail'].includes(text)) return { value: 'email' }
  if (['other', 'note'].includes(text)) return { value: 'other' }
  return { value: undefined, issue: 'invalid_method' }
}

function parseDateParts(value: string): { year: number; month: number; day: number; hour: number; minute: number; second: number } | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  let m = trimmed.match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?\s*(am|pm)?)?$/i)
  if (!m) {
    m = trimmed.match(/^(\d{1,2})[-\/(](\d{1,2})[-\/(](\d{2,4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(am|pm)?)?$/i)
    if (!m) return null
    const year = Number(m[3].length === 2 ? (Number(m[3]) > 50 ? '19' + m[3] : '20' + m[3]) : m[3])
    let hour = Number(m[4] ?? 0)
    const minute = Number(m[5] ?? 0)
    const second = Number(m[6] ?? 0)
    const marker = m[7]?.toLowerCase()
    if (marker) {
      if (marker === 'pm' && hour < 12) hour += 12
      if (marker === 'am' && hour === 12) hour = 0
    }
    return {
      year,
      month: Number(m[1]),
      day: Number(m[2]),
      hour,
      minute,
      second,
    }
  }
  const year = Number(m[1])
  const month = Number(m[2])
  const day = Number(m[3])
  let hour = Number(m[4] ?? 0)
  const minute = Number(m[5] ?? 0)
  const second = Number(m[6] ?? 0)
  const marker = m[7]?.toLowerCase()
  if (marker) {
    if (marker === 'pm' && hour < 12) hour += 12
    if (marker === 'am' && hour === 12) hour = 0
  }
  return { year, month, day, hour, minute, second }
}

function fromTimeZone(parts: { year: number; month: number; day: number; hour: number; minute: number; second: number }, timezone?: string): Date | null {
  const { year, month, day, hour, minute, second } = parts
  if (!timezone) return new Date(year, month - 1, day, hour, minute, second)
  const utcGuess = Date.UTC(year, month - 1, day, hour, minute, second)
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
  const partsArr = formatter.formatToParts(new Date(utcGuess))
  const lookup = (type: string) => Number(partsArr.find((p) => p.type === type)?.value ?? NaN)
  const tzYear = lookup('year')
  const tzMonth = lookup('month')
  const tzDay = lookup('day')
  const tzHour = lookup('hour')
  const tzMinute = lookup('minute')
  const tzSecond = lookup('second')
  if ([tzYear, tzMonth, tzDay, tzHour, tzMinute, tzSecond].some((n) => Number.isNaN(n))) return null
  const tzUTC = Date.UTC(tzYear, tzMonth - 1, tzDay, tzHour, tzMinute, tzSecond)
  const offset = tzUTC - utcGuess
  return new Date(utcGuess - offset)
}

function parseDate(value: string | undefined, timezone?: string): { date?: Date; issue?: string } {
  if (!value) return { date: undefined }
  const direct = new Date(value)
  if (!Number.isNaN(direct.getTime())) return { date: direct }
  const parts = parseDateParts(value)
  if (!parts) return { issue: 'invalid_date' }
  const dt = fromTimeZone(parts, timezone)
  if (!dt || Number.isNaN(dt.getTime())) return { issue: 'invalid_date' }
  return { date: dt }
}

function normalizePhone(value?: string): string {
  if (!value) return ''
  return value.replace(/[^0-9+]/g, '')
}

function autoMapping(headers: string[], provided?: Mapping): Mapping {
  const mapping: Mapping = { ...(provided || {}) }
  const ensure = (key: keyof Mapping, guesses: string[]) => {
    if (mapping[key]) return
    const found = findHeader(headers, guesses)
    if (found) mapping[key] = found
  }
  ensure('email', ['email', 'email address'])
  ensure('phone', ['phone', 'phone number', 'mobile', 'contact phone'])
  ensure('method', ['method', 'contact method', 'type'])
  ensure('at', ['date', 'datetime', 'contact date', 'timestamp', 'when'])
  ensure('comments', ['comments', 'notes'])
  return mapping
}

function getValue(row: string[], headers: string[], mapping: Mapping, key: keyof Mapping): string {
  const header = mapping[key]
  if (!header) return ''
  const idx = headers.findIndex((h) => normalizeHeader(h) === normalizeHeader(header))
  if (idx < 0) return ''
  return (row[idx] || '').trim()
}

async function buildHandler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()
  try {
    const dryRun = req.query.dryRun !== 'false'
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body
    const csvText = typeof body?.csv === 'string' ? body.csv.replace(/^\uFEFF/, '') : ''
    if (!csvText.trim()) return res.status(400).json({ error: 'missing_csv' })
    const options: Options = (body?.options as Options) || {}
    const defaults: Defaults = (body?.defaults as Defaults) || {}
    const dedupe: DedupeOptions = (body?.dedupe as DedupeOptions) || {}
    const providedMapping: Mapping | undefined = body?.mapping as Mapping | undefined

    const { headers, rows } = parseCsv(csvText, options.delimiter || ',')
    if (!headers.length) return res.status(400).json({ error: 'empty_csv' })
    const appliedMapping = autoMapping(headers, providedMapping)

    const volunteers = await prisma.volunteer.findMany({ select: { id: true, name: true, email: true, phone: true } })
    const volunteersByEmail = new Map<string, { id: string; name: string }>()
    const volunteersByPhone = new Map<string, { id: string; name: string }>()
    for (const v of volunteers) {
      if (v.email) volunteersByEmail.set(v.email.toLowerCase(), { id: v.id, name: v.name })
      if (v.phone) volunteersByPhone.set(normalizePhone(v.phone), { id: v.id, name: v.name })
    }

    const contexts: RowContext[] = []
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      const idx = i + 2
      const issues: string[] = []
      const emailValue = getValue(row, headers, appliedMapping, 'email')
      const phoneValue = getValue(row, headers, appliedMapping, 'phone')
      const methodValueRaw = getValue(row, headers, appliedMapping, 'method') || defaults.method
      const commentsValue = getValue(row, headers, appliedMapping, 'comments')
      const { value: methodValue, issue: methodIssue } = normalizeMethod(methodValueRaw)
      if (!methodValue) issues.push(methodIssue || 'missing_method')
      const { date: parsedDate, issue: dateIssue } = parseDate(getValue(row, headers, appliedMapping, 'at'), options.timezone)
      if (!parsedDate) issues.push(dateIssue || 'missing_date')
      let volunteer: { id: string; name: string } | undefined
      if (emailValue) volunteer = volunteersByEmail.get(emailValue.trim().toLowerCase())
      if (!volunteer && phoneValue) volunteer = volunteersByPhone.get(normalizePhone(phoneValue))
      if (!volunteer) issues.push('missing_volunteer')
      contexts.push({ idx, volunteer, method: methodValue, at: parsedDate, comments: commentsValue || undefined, issues })
    }

    const matchedVolunteerIds = Array.from(new Set(contexts.filter((c) => c.volunteer).map((c) => c.volunteer!.id)))
    const existingLogs = matchedVolunteerIds.length
      ? await prisma.contactLog.findMany({ where: { volunteerId: { in: matchedVolunteerIds } } })
      : []
    const existingMap = new Map<string, number[]>()
    for (const log of existingLogs) {
      const key = `${log.volunteerId}|${normalizeHeader(log.method)}`
      const list = existingMap.get(key) || []
      list.push(log.at.getTime())
      existingMap.set(key, list)
    }

    const dedupeStrategy = dedupe.strategy === 'none' ? 'none' : 'exact'
    const windowMs = dedupe.windowMinutes && dedupe.windowMinutes > 0 ? dedupe.windowMinutes * 60 * 1000 : 0
    const seenMap = new Map<string, number[]>()

    let duplicates = 0
    let unmatched = 0
    let matched = 0

    for (const ctx of contexts) {
      if (!ctx.volunteer) {
        unmatched++
        continue
      }
      matched++
      if (!ctx.method || !ctx.at) continue
      if (dedupeStrategy === 'none') continue
      const key = `${ctx.volunteer.id}|${ctx.method}`
      const time = ctx.at.getTime()
      const existing = existingMap.get(key) || []
      let isDup = false
      if (windowMs > 0) {
        if (existing.some((t) => Math.abs(t - time) <= windowMs)) isDup = true
      } else {
        if (existing.includes(time)) isDup = true
      }
      if (!isDup) {
        const seen = seenMap.get(key) || []
        if (windowMs > 0) {
          if (seen.some((t) => Math.abs(t - time) <= windowMs)) isDup = true
        } else if (seen.includes(time)) {
          isDup = true
        }
        seen.push(time)
        seenMap.set(key, seen)
      }
      if (isDup) {
        ctx.issues.push('duplicate')
        ctx.duplicate = true
        duplicates++
      }
    }

    if (dryRun) {
      const preview: PreviewPayload = {
        total: contexts.length,
        matched,
        unmatched,
        duplicates,
        rows: contexts.map((ctx) => ({
          idx: ctx.idx,
          matchedVolunteer: ctx.volunteer,
          normalized: {
            method: ctx.method,
            atISO: ctx.at ? ctx.at.toISOString() : undefined,
            comments: ctx.comments,
          },
          issues: ctx.issues,
        })),
      }
      return res.status(200).json({ preview })
    }

    const toInsert = contexts.filter(
      (ctx) => !ctx.duplicate && ctx.volunteer && ctx.method && ctx.at && !ctx.issues.length,
    )
    if (toInsert.length) {
      await prisma.contactLog.createMany({
        data: toInsert.map((ctx) => ({
          volunteerId: ctx.volunteer!.id,
          method: ctx.method!,
          at: ctx.at!,
          comments: ctx.comments || null,
        })),
      })
    }
    const summary: ImportSummary = {
      imported: toInsert.length,
      duplicates,
      unmatched,
      errors: [],
    }
    return res.status(200).json(summary)
  } catch (e: any) {
    console.error(e)
    return res.status(500).json({ error: 'server_error' })
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  await buildHandler(req, res)
}
