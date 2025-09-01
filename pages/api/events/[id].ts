import type { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '../../../lib/prisma'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query
  if (typeof id !== 'string') return res.status(400).json({ error: 'invalid id' })
  try {
    if (req.method === 'PATCH') {
      const { title, start, end, location, notes, category, projectId } = req.body || {}
      const event = await prisma.event.update({
        where: { id },
        data: { title, start: start ? new Date(start) : undefined, end: end ? new Date(end) : undefined, location, notes, category, projectId }
      })
      return res.status(200).json({ event })
    }
    if (req.method === 'DELETE') {
      await prisma.event.delete({ where: { id } })
      return res.status(204).end()
    }
    return res.status(405).end()
  } catch (e: any) {
    console.error(e)
    return res.status(500).json({ error: 'server_error' })
  }
}

