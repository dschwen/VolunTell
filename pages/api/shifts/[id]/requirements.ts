import type { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '../../../../lib/prisma'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query
  if (typeof id !== 'string') return res.status(400).json({ error: 'invalid id' })
  try {
    if (req.method === 'POST') {
      const { skill } = req.body || {}
      let { minCount } = req.body || {}
      if (!skill) return res.status(400).json({ error: 'skill required' })
      if (typeof minCount !== 'number' || !Number.isFinite(minCount) || minCount <= 0) minCount = 1
      const existing = await prisma.requirement.findFirst({ where: { shiftId: id, skill } })
      let reqItem
      if (existing) {
        // Increment by 1 when duplicate skill is added
        reqItem = await prisma.requirement.update({ where: { id: existing.id }, data: { minCount: existing.minCount + 1 } })
      } else {
        reqItem = await prisma.requirement.create({ data: { shiftId: id, skill, minCount } })
      }
      return res.status(201).json({ requirement: reqItem })
    }
    return res.status(405).end()
  } catch (e: any) {
    console.error(e)
    return res.status(500).json({ error: 'server_error' })
  }
}
