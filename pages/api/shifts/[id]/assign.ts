
export default async function handler(req:any, res:any) {
  if (req.method !== 'POST') return res.status(405).end()
  const { id } = req.query
  const { volunteerId, role } = req.body || {}
  console.log('Assign volunteer', { shiftId: id, volunteerId, role })
  res.status(200).json({ ok: true })
}
