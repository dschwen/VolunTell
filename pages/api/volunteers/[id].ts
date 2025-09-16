import type { NextApiRequest, NextApiResponse } from 'next'
import { Prisma } from '@prisma/client'
import { prisma } from '../../../lib/prisma'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query
  if (typeof id !== 'string') return res.status(400).json({ error: 'invalid id' })
  try {
    if (req.method === 'PATCH') {
      const { name, email, phone, skills, familyId, notes, isActive } = req.body || {}
      const data: any = {}
      if (typeof name === 'string') {
        const trimmed = name.trim()
        if (!trimmed) return res.status(400).json({ error: 'name required' })
        data.name = trimmed
      }
      if (email !== undefined) data.email = typeof email === 'string' && email.trim() ? email.trim() : null
      if (phone !== undefined) data.phone = typeof phone === 'string' && phone.trim() ? phone.trim() : null
      if (skills !== undefined) {
        data.skills = Array.isArray(skills)
          ? Array.from(new Set(skills.map((s: any) => (typeof s === 'string' ? s.trim() : '')).filter(Boolean)))
          : []
      }
      if (familyId !== undefined) data.familyId = typeof familyId === 'string' && familyId.trim() ? familyId : null
      if (notes !== undefined) data.notes = typeof notes === 'string' && notes.trim() ? notes.trim() : null
      if (isActive !== undefined) data.isActive = isActive
      try {
        const volunteer = await prisma.volunteer.update({ where: { id }, data })
        return res.status(200).json({ volunteer })
      } catch (err: any) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002' && Array.isArray((err.meta as any)?.target) && (err.meta as any).target.includes('email')) {
          return res.status(409).json({ error: 'email_exists' })
        }
        throw err
      }
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
