import type { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '../../../../lib/prisma'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query
  if (typeof id !== 'string') return res.status(400).json({ error: 'invalid id' })
  if (req.method !== 'POST') return res.status(405).end()
  try {
    const base = await prisma.shift.findUnique({ where: { id }, include: { requirements: true, event: true } })
    if (!base) return res.status(404).json({ error: 'not_found' })
    const { start, end } = req.body || {}
    const newStart = start ? new Date(start) : base.start
    const newEnd = end ? new Date(end) : base.end
    const created = await prisma.shift.create({ data: { eventId: base.eventId, start: newStart, end: newEnd, description: base.description || null } })
    if (base.requirements?.length) {
      await prisma.requirement.createMany({ data: base.requirements.map(r => ({ shiftId: created.id, skill: r.skill, minCount: r.minCount })) })
    }
    return res.status(201).json({ shift: created })
  } catch (e: any) {
    console.error(e)
    return res.status(500).json({ error: 'server_error' })
  }
}

