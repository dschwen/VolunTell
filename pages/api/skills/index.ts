import type { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '../../../lib/prisma'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method === 'GET') {
      const skills = await prisma.skill.findMany({ orderBy: { name: 'asc' } })
      return res.status(200).json({ skills })
    }
    if (req.method === 'POST') {
      const { name } = req.body || {}
      if (!name) return res.status(400).json({ error: 'name required' })
      const skill = await prisma.skill.create({ data: { name } })
      return res.status(201).json({ skill })
    }
    return res.status(405).end()
  } catch (e: any) {
    if (e.code === 'P2002') return res.status(409).json({ error: 'duplicate' })
    console.error(e)
    return res.status(500).json({ error: 'server_error' })
  }
}

