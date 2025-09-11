import type { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '../../../lib/prisma'

type ImportResult = {
  created: number
  updated: number
  skipped: number
  errors: string[]
}

function normalizeHeader(s: string): string {
  return s.replace(/\s+/g, ' ').trim().toLowerCase()
}

function parseCsv(text: string): { headers: string[]; rows: string[][] } {
  const rows: string[][] = []
  let i = 0
  const N = text.length
  const cur: string[] = []
  let cell = ''
  let inQuotes = false
  function pushCell() { cur.push(cell); cell = '' }
  function pushRow() { rows.push(cur.slice()); cur.length = 0 }
  while (i < N) {
    const ch = text[i]
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < N && text[i + 1] === '"') { cell += '"'; i += 2; continue }
        inQuotes = false; i++; continue
      }
      cell += ch; i++; continue
    }
    if (ch === '"') { inQuotes = true; i++; continue }
    if (ch === ',') { pushCell(); i++; continue }
    if (ch === '\n') { pushCell(); pushRow(); i++; continue }
    if (ch === '\r') { i++; continue }
    cell += ch; i++
  }
  // flush last cell/row
  pushCell(); if (cur.length) pushRow()
  if (!rows.length) return { headers: [], rows: [] }
  const headers = rows.shift()!.map(h => normalizeHeader(h))
  return { headers, rows }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()
  try {
    // Accept JSON with { csv: string } or raw text/csv body
    const isText = typeof req.body === 'string'
    const raw = isText ? String(req.body) : String((req.body && (req.body as any).csv) || '')
    const csvText = raw.replace(/^\uFEFF/, '')
    if (!csvText.trim()) return res.status(400).json({ error: 'missing_csv' })

    const { headers, rows } = parseCsv(csvText)
    const hmap = new Map(headers.map((h, idx) => [h, idx]))
    const hFirst = hmap.get('first name')
    const hLast = hmap.get('last name')
    const hEmail = hmap.get('email')
    const hPhone = hmap.get('phone number') ?? hmap.get('phone')
    if (hFirst == null && hLast == null && hEmail == null && hPhone == null) {
      return res.status(400).json({ error: 'missing_required_headers', expected: ['First Name','Last Name','Email','Phone Number'] })
    }

    const result: ImportResult = { created: 0, updated: 0, skipped: 0, errors: [] }
    for (let r = 0; r < rows.length; r++) {
      const row = rows[r]
      const first = hFirst != null ? (row[hFirst] || '').trim() : ''
      const last = hLast != null ? (row[hLast] || '').trim() : ''
      const email = hEmail != null ? (row[hEmail] || '').trim() : ''
      const phone = hPhone != null ? (row[hPhone] || '').trim() : ''
      const name = [first, last].filter(Boolean).join(' ').trim()
      if (!name && !email && !phone) { result.skipped++; continue }
      try {
        if (email) {
          // upsert by email (unique)
          const existing = await prisma.volunteer.findUnique({ where: { email } })
          if (!existing) {
            await prisma.volunteer.create({ data: { name: name || email, email, phone: phone || null, isActive: true, skills: [] } })
            result.created++
          } else {
            await prisma.volunteer.update({ where: { id: existing.id }, data: { name: name || existing.name, phone: phone || existing.phone || null } })
            result.updated++
          }
          continue
        }
        // No email: try phone match
        if (phone) {
          const existing = await prisma.volunteer.findFirst({ where: { phone } })
          if (!existing) {
            await prisma.volunteer.create({ data: { name: name || phone, phone, isActive: true, skills: [] } })
            result.created++
          } else {
            await prisma.volunteer.update({ where: { id: existing.id }, data: { name: name || existing.name } })
            result.updated++
          }
          continue
        }
        // Neither email nor phone → create if name present
        if (name) {
          await prisma.volunteer.create({ data: { name, isActive: true, skills: [] } })
          result.created++
        } else {
          result.skipped++
        }
      } catch (e: any) {
        result.errors.push(`row ${r + 2}: ${e?.message || 'error'}`)
      }
    }
    return res.status(200).json(result)
  } catch (e: any) {
    console.error(e)
    return res.status(500).json({ error: 'server_error' })
  }
}
