import type { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '../../../../lib/prisma'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query
  if (typeof id !== 'string') return res.status(400).json({ error: 'invalid id' })
  try {
    if (req.method === 'GET') {
      const items = await prisma.blackout.findMany({ where: { volunteerId: id }, orderBy: [{ weekday: 'asc' }, { date: 'asc' }] })
      return res.status(200).json({ items })
    }
    if (req.method === 'POST') {
      const { date, weekday, startTime, endTime, notes } = req.body || {}
      if ((!date && weekday == null) || !startTime || !endTime) return res.status(400).json({ error: 'date or weekday, and start/end required' })
      const item = await prisma.blackout.create({ data: { volunteerId: id, date: date ? new Date(date) : null, weekday, startTime, endTime, notes } })
      return res.status(201).json({ item })
    }
    return res.status(405).end()
  } catch (e: any) {
    console.error(e)
    return res.status(500).json({ error: 'server_error' })
  }
}

