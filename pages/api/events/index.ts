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
      const events = await prisma.event.findMany({
        where,
        orderBy: { start: 'asc' },
        include: { project: true, shifts: { include: { requirements: true, signups: { include: { volunteer: true } } } } }
      })
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
