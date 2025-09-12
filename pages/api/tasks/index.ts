import type { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '../../../lib/prisma'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method === 'GET') {
      const { status, volunteerId, type, dueBefore } = req.query
      const where: any = {}
      if (typeof status === 'string') where.status = status
      if (typeof type === 'string') where.type = type
      if (typeof volunteerId === 'string') where.volunteerId = volunteerId
      if (typeof dueBefore === 'string') where.dueDate = { lte: new Date(dueBefore) }
      const tasks = await prisma.task.findMany({ where, orderBy: { createdAt: 'desc' }, include: { volunteer: { select: { id: true, name: true, email: true, phone: true } }, event: true } })
      return res.status(200).json({ tasks })
    }
    if (req.method === 'POST') {
      const { volunteerId, eventId, type, notes, status, dueDate } = req.body || {}
      if (!type) return res.status(400).json({ error: 'type required' })
      const task = await prisma.task.create({ data: { volunteerId: volunteerId || null, eventId: eventId || null, type, notes, status: status || 'open', dueDate: dueDate ? new Date(dueDate) : null } })
      return res.status(201).json({ task })
    }
    return res.status(405).end()
  } catch (e: any) {
    console.error(e)
    return res.status(500).json({ error: 'server_error' })
  }
}
