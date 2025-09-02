import type { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '../../../../lib/prisma'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query
  if (typeof id !== 'string') return res.status(400).json({ error: 'invalid id' })
  try {
    if (req.method === 'GET') {
      const items = await prisma.contactLog.findMany({ where: { volunteerId: id }, orderBy: { at: 'desc' } })
      return res.status(200).json({ items })
    }
    if (req.method === 'POST') {
      const { method, at, comments } = req.body || {}
      if (!method) return res.status(400).json({ error: 'method required' })
      const when = at ? new Date(at) : new Date()
      const item = await prisma.contactLog.create({ data: { volunteerId: id, method, at: when, comments } })
      return res.status(201).json({ item })
    }
    return res.status(405).end()
  } catch (e: any) {
    console.error(e)
    return res.status(500).json({ error: 'server_error' })
  }
}

