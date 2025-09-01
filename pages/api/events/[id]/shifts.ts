import type { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '../../../../lib/prisma'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query
  if (typeof id !== 'string') return res.status(400).json({ error: 'invalid event id' })
  try {
    if (req.method === 'POST') {
      const { start, end, description } = req.body || {}
      if (!start || !end) return res.status(400).json({ error: 'start and end required' })
      const shift = await prisma.shift.create({ data: { eventId: id, start: new Date(start), end: new Date(end), description } })
      return res.status(201).json({ shift })
    }
    return res.status(405).end()
  } catch (e: any) {
    console.error(e)
    return res.status(500).json({ error: 'server_error' })
  }
}

