import type { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '../../../../lib/prisma'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query
  if (typeof id !== 'string') return res.status(400).json({ error: 'invalid id' })
  try {
    if (req.method === 'POST') {
      const { skill, minCount } = req.body || {}
      if (!skill || typeof minCount !== 'number') return res.status(400).json({ error: 'skill and minCount required' })
      const reqItem = await prisma.requirement.create({ data: { shiftId: id, skill, minCount } })
      return res.status(201).json({ requirement: reqItem })
    }
    return res.status(405).end()
  } catch (e: any) {
    console.error(e)
    return res.status(500).json({ error: 'server_error' })
  }
}

