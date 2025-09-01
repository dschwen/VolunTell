
import type { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '../../../../lib/prisma'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()
  const { id } = req.query
  const { volunteerId, role } = req.body || {}
  if (typeof id !== 'string' || !volunteerId) return res.status(400).json({ error: 'shift id and volunteerId required' })
  try {
    // Prevent double-booking: check overlapping confirmed signup
    const shift = await prisma.shift.findUnique({ where: { id }, select: { start: true, end: true } })
    if (!shift) return res.status(404).json({ error: 'shift_not_found' })
    const conflict = await prisma.signup.findFirst({
      where: {
        volunteerId,
        status: 'confirmed',
        shift: {
          start: { lt: shift.end },
          end: { gt: shift.start }
        }
      },
      include: { shift: { include: { event: true } } }
    })
    if (conflict) {
      return res.status(409).json({ error: 'double_booked', conflict: { shiftId: conflict.shiftId, eventTitle: conflict.shift.event.title, start: conflict.shift.start, end: conflict.shift.end } })
    }

    const signup = await prisma.signup.upsert({
      where: { volunteerId_shiftId: { volunteerId, shiftId: id } },
      create: { volunteerId, shiftId: id, role: role || null, status: 'confirmed' },
      update: { role: role || null, status: 'confirmed' }
    })
    return res.status(200).json({ signup })
  } catch (e: any) {
    console.error(e)
    return res.status(500).json({ error: 'server_error' })
  }
}
