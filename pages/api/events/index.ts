import type { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '../../../lib/prisma'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method === 'GET') {
      const { projectId, category, from, to } = req.query
      const where: any = {}
      if (typeof projectId === 'string') where.projectId = projectId
      if (typeof category === 'string') where.category = category as any
      if (typeof from === 'string' || typeof to === 'string') {
        where.start = {}
        if (typeof from === 'string') where.start.gte = new Date(from)
        if (typeof to === 'string') where.start.lte = new Date(to)
      }
      const eventsRaw = await prisma.event.findMany({
        where,
        orderBy: { start: 'asc' },
        include: { project: true, shifts: { include: { requirements: true, signups: { include: { volunteer: true } } } } }
      })
      const toLocal = (d: Date) => {
        const ms = d.getTime() - d.getTimezoneOffset() * 60000
        return new Date(ms).toISOString().slice(0, 16)
      }
      const events = eventsRaw.map(ev => ({
        ...ev,
        start: ev.start.toISOString(),
        end: ev.end.toISOString(),
        startTs: ev.start.getTime(),
        endTs: ev.end.getTime(),
        startLocal: toLocal(ev.start),
        endLocal: toLocal(ev.end),
        shifts: ev.shifts.map(sh => ({
          ...sh,
          start: sh.start.toISOString(),
          end: sh.end.toISOString(),
          startTs: sh.start.getTime(),
          endTs: sh.end.getTime(),
          startLocal: toLocal(sh.start),
          endLocal: toLocal(sh.end)
        }))
      }))
      return res.status(200).json({ events })
    }
    if (req.method === 'POST') {
      const { title, start, end, location, notes, category, projectId } = req.body || {}
      if (!title || !start || !end) return res.status(400).json({ error: 'title,start,end required' })
      const event = await prisma.event.create({ data: { title, start: new Date(start), end: new Date(end), location, notes, category, projectId } })
      return res.status(201).json({ event })
    }
    return res.status(405).end()
  } catch (e: any) {
    console.error(e)
    return res.status(500).json({ error: 'server_error' })
  }
}
