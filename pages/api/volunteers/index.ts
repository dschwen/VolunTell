import type { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '../../../lib/prisma'
import { availableOnWeekday } from '../../../lib/availability'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method === 'GET') {
      const { skill, active, availableAt } = req.query
      const where: any = {}
      if (typeof skill === 'string') where.skills = { has: skill }
      if (typeof active === 'string') where.isActive = active === 'true'
      const volunteers = await prisma.volunteer.findMany({ where, include: { availability: true, blackouts: true, family: true } })
      let filtered = volunteers
      if (typeof availableAt === 'string') {
        const dt = new Date(availableAt)
        const weekday = dt.getUTCDay()
        const start = dt.toISOString().slice(11,16)
        // assume 1-hour window for instant check
        const end   = new Date(dt.getTime() + 60*60*1000).toISOString().slice(11,16)
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

