import type { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '../../../lib/prisma'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query
  if (typeof id !== 'string') return res.status(400).json({ error: 'invalid id' })
  try {
    if (req.method === 'PATCH') {
      const { status, notes, dueDate, type } = req.body || {}
      const task = await prisma.task.update({ where: { id }, data: { status, notes, dueDate: dueDate ? new Date(dueDate) : undefined, type } })
      return res.status(200).json({ task })
    }
    if (req.method === 'DELETE') {
      await prisma.task.delete({ where: { id } })
      return res.status(204).end()
    }
    return res.status(405).end()
  } catch (e: any) {
    console.error(e)
    return res.status(500).json({ error: 'server_error' })
  }
}

