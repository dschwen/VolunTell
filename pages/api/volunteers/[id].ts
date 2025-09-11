import type { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '../../../lib/prisma'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query
  if (typeof id !== 'string') return res.status(400).json({ error: 'invalid id' })
  try {
    if (req.method === 'PATCH') {
      const { name, email, phone, skills, familyId, notes, isActive } = req.body || {}
      const volunteer = await prisma.volunteer.update({ where: { id }, data: { name, email, phone, skills, familyId, notes, isActive } })
      return res.status(200).json({ volunteer })
    }
    if (req.method === 'DELETE') {
      if (req.query.hard === 'true') {
        await prisma.$transaction([
          prisma.attendance.deleteMany({ where: { volunteerId: id } }),
          prisma.signup.deleteMany({ where: { volunteerId: id } }),
          prisma.availability.deleteMany({ where: { volunteerId: id } }),
          prisma.blackout.deleteMany({ where: { volunteerId: id } }),
          prisma.task.deleteMany({ where: { volunteerId: id } }),
          prisma.contactLog.deleteMany({ where: { volunteerId: id } }),
        ])
        await prisma.volunteer.delete({ where: { id } })
        return res.status(200).json({ ok: true })
      } else {
        const volunteer = await prisma.volunteer.update({ where: { id }, data: { isActive: false } })
        return res.status(200).json({ volunteer })
      }
    }
    return res.status(405).end()
  } catch (e: any) {
    console.error(e)
    return res.status(500).json({ error: 'server_error' })
  }
}
