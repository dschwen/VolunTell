import type { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '../../../lib/prisma'
import { availableOnWeekday, availableForRange } from '../../../lib/availability'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method === 'GET') {
      const { skill, active, availableAt, availableForShift } = req.query
      const where: any = {}
      if (typeof skill === 'string') where.skills = { has: skill }
      if (typeof active === 'string') where.isActive = active === 'true'
      // For availableForShift, we need availability + blackouts and conflict check
      const volunteers = await prisma.volunteer.findMany({ where, include: { availability: true, blackouts: true, family: true } })
      if (typeof availableForShift === 'string') {
        const shift = await prisma.shift.findUnique({ where: { id: availableForShift }, include: { signups: { where: { status: 'confirmed' } } } })
        if (!shift) return res.status(404).json({ error: 'shift_not_found' })
        // Build set of volunteers with overlapping confirmed signups
        const conflicts = await prisma.signup.findMany({ where: { status: 'confirmed', shift: { start: { lt: shift.end }, end: { gt: shift.start } } }, select: { volunteerId: true } })
        const conflictSet = new Set(conflicts.map(c => c.volunteerId))
        const filtered = volunteers.filter(v => !conflictSet.has(v.id) && availableForRange(shift.start, shift.end, v.availability, v.blackouts))
        return res.status(200).json({ volunteers: filtered })
      }
      let filtered = volunteers
      if (typeof availableAt === 'string') {
        const dt = new Date(availableAt)
        const weekday = dt.getDay()
        const hhmm = (d: Date) => `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
        const start = hhmm(dt)
        // assume 1-hour window for instant check
        const end   = hhmm(new Date(dt.getTime() + 60*60*1000))
        filtered = volunteers.filter(v => availableOnWeekday(weekday, start, end, v.availability, v.blackouts))
      }
      return res.status(200).json({ volunteers: filtered })
    }
    if (req.method === 'POST') {
      const { name, email, phone, skills, familyId, notes, isActive } = req.body || {}
      if (!name) return res.status(400).json({ error: 'name required' })
      const volunteer = await prisma.volunteer.create({ data: { name, email, phone, skills: skills || [], familyId, notes, isActive: isActive ?? true } })
      return res.status(201).json({ volunteer })
    }
    return res.status(405).end()
  } catch (e: any) {
    console.error(e)
    return res.status(500).json({ error: 'server_error' })
  }
}
