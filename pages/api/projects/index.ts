import type { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '../../../lib/prisma'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method === 'GET') {
      const projects = await prisma.project.findMany({ orderBy: { createdAt: 'desc' } })
      return res.status(200).json({ projects })
    }
    if (req.method === 'POST') {
      const { name, colorTag, notes } = req.body || {}
      if (!name) return res.status(400).json({ error: 'name required' })
      const project = await prisma.project.create({ data: { name, colorTag, notes } })
      return res.status(201).json({ project })
    }
    return res.status(405).end()
  } catch (e: any) {
    console.error(e)
    return res.status(500).json({ error: 'server_error' })
  }
}

