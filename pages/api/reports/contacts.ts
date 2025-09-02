import type { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '../../../lib/prisma'

function toCSV(rows: string[][]) {
  return rows.map(r => r.map(v => {
    const s = v == null ? '' : String(v)
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g,'""') + '"' : s
  }).join(',')).join('\n')
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { from, to, volunteerId } = req.query
  try {
    const where: any = {}
    if (typeof volunteerId === 'string') where.volunteerId = volunteerId
    if (typeof from === 'string' || typeof to === 'string') {
      where.at = {}
      if (typeof from === 'string') where.at.gte = new Date(from)
      if (typeof to === 'string') where.at.lte = new Date(to)
    }
    const records = await prisma.contactLog.findMany({
      where,
      include: { volunteer: true },
      orderBy: { at: 'asc' }
    })
    const rows: string[][] = [[ 'Volunteer','Email','Phone','Method','At','Comments' ]]
    for (const r of records) {
      rows.push([
        r.volunteer.name,
        r.volunteer.email || '',
        r.volunteer.phone || '',
        r.method,
        r.at.toISOString(),
        r.comments || ''
      ])
    }
    const csv = toCSV(rows)
    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', 'attachment; filename="contacts.csv"')
    return res.status(200).send(csv)
  } catch (e: any) {
    console.error(e)
    return res.status(500).json({ error: 'server_error' })
  }
}

