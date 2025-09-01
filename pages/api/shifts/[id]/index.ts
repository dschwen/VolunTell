import type { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '../../../../lib/prisma'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query
  if (typeof id !== 'string') return res.status(400).json({ error: 'invalid shift id' })
  try {
    if (req.method === 'GET') {
      const shift = await prisma.shift.findUnique({ where: { id }, include: { requirements: true, signups: { include: { volunteer: true } }, event: true } })
      if (!shift) return res.status(404).json({ error: 'not_found' })
      return res.status(200).json({ shift })
    }
    if (req.method === 'PATCH') {
      const { start, end, description } = req.body || {}
      const shift = await prisma.shift.update({ where: { id }, data: {
        start: start ? new Date(start) : undefined,
        end: end ? new Date(end) : undefined,
        description
      } })
      return res.status(200).json({ shift })
    }
    if (req.method === 'DELETE') {
      await prisma.shift.delete({ where: { id } })
      return res.status(204).end()
    }
    return res.status(405).end()
  } catch (e: any) {
    console.error(e)
    return res.status(500).json({ error: 'server_error' })
  }
}
