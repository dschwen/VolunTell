import type { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '../../../lib/prisma'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method === 'POST') {
      const { shiftId, volunteerId, status, hours, checkinTs, checkoutTs } = req.body || {}
      if (!shiftId || !volunteerId || !status) return res.status(400).json({ error: 'shiftId, volunteerId, status required' })
      const attendance = await prisma.attendance.create({
        data: {
          shiftId,
          volunteerId,
          status,
          hours: hours != null ? String(hours) as any : null,
          checkinTs: checkinTs ? new Date(checkinTs) : null,
          checkoutTs: checkoutTs ? new Date(checkoutTs) : null,
        }
      })
      return res.status(201).json({ attendance })
    }
    return res.status(405).end()
  } catch (e: any) {
    console.error(e)
    return res.status(500).json({ error: 'server_error' })
  }
}

