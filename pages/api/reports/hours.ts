import type { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '../../../lib/prisma'

function toCSV(rows: string[][]) {
  return rows.map(r => r.map(v => {
    const s = v == null ? '' : String(v)
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g,'""') + '"' : s
  }).join(',')).join('\n')
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { from, to } = req.query
  try {
    const where: any = {}
    if (typeof from === 'string' || typeof to === 'string') {
      where.createdAt = {}
      if (typeof from === 'string') where.createdAt.gte = new Date(from)
      if (typeof to === 'string') where.createdAt.lte = new Date(to)
    }
    const records = await prisma.attendance.findMany({
      where,
      include: {
        volunteer: true,
        shift: { include: { event: true } }
      },
      orderBy: { createdAt: 'asc' }
    })
    const rows: string[][] = [[
      'Volunteer','Email','Skills','Event','Date','Shift Start','Shift End','Status','Hours'
    ]]
    for (const a of records) {
      const skills = (a.volunteer.skills || []).join(' ')
      rows.push([
        a.volunteer.name,
        a.volunteer.email || '',
        skills,
        a.shift.event.title,
        new Date(a.shift.start).toISOString().slice(0,10),
        a.shift.start.toISOString(),
        a.shift.end.toISOString(),
        a.status,
        a.hours != null ? String(a.hours) : ''
      ])
    }
    const csv = toCSV(rows)
    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', 'attachment; filename="hours.csv"')
    return res.status(200).send(csv)
  } catch (e: any) {
    console.error(e)
    return res.status(500).json({ error: 'server_error' })
  }
}

