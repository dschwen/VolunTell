import type { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '../../../lib/prisma'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method === 'GET') {
      const { keys } = req.query
      let where: any = {}
      if (typeof keys === 'string') where.key = { in: keys.split(',') }
      const rows = await prisma.appSetting.findMany({ where })
      const settings: Record<string,string> = {}
      for (const r of rows) settings[r.key] = r.value
      return res.status(200).json({ settings })
    }
    if (req.method === 'POST') {
      const body = req.body || {}
      const entries = Object.entries(body) as [string,string][]
      for (const [key, value] of entries) {
        await prisma.appSetting.upsert({ where: { key }, update: { value: String(value) }, create: { key, value: String(value) } })
      }
      return res.status(200).json({ ok: true })
    }
    return res.status(405).end()
  } catch (e: any) {
    console.error(e)
    return res.status(500).json({ error: 'server_error' })
  }
}

