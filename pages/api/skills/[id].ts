import type { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '../../../lib/prisma'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query
  if (typeof id !== 'string') return res.status(400).json({ error: 'invalid id' })
  try {
    if (req.method === 'DELETE') {
      await prisma.skill.delete({ where: { id } })
      return res.status(204).end()
    }
    if (req.method === 'PATCH') {
      const { name } = req.body || {}
      const skill = await prisma.skill.update({ where: { id }, data: { name } })
      return res.status(200).json({ skill })
    }
    return res.status(405).end()
  } catch (e: any) {
    if (e.code === 'P2002') return res.status(409).json({ error: 'duplicate' })
    console.error(e)
    return res.status(500).json({ error: 'server_error' })
  }
}

