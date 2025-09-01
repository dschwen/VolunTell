import type { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '../../../../lib/prisma'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query
  if (typeof id !== 'string') return res.status(400).json({ error: 'invalid id' })
  try {
    if (req.method === 'GET') {
      const items = await prisma.availability.findMany({ where: { volunteerId: id }, orderBy: [{ weekday: 'asc' }, { startTime: 'asc' }] })
      return res.status(200).json({ items })
    }
    if (req.method === 'POST') {
      const { weekday, startTime, endTime } = req.body || {}
      if (weekday == null || !startTime || !endTime) return res.status(400).json({ error: 'weekday,startTime,endTime required' })
      const item = await prisma.availability.create({ data: { volunteerId: id, weekday, startTime, endTime } })
      return res.status(201).json({ item })
    }
    return res.status(405).end()
  } catch (e: any) {
    console.error(e)
    return res.status(500).json({ error: 'server_error' })
  }
}

