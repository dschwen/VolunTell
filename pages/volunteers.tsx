import { useEffect, useMemo, useState } from 'react'

type Volunteer = {
  id: string
  name: string
  email?: string
  phone?: string
  skills: string[]
  isActive: boolean
}

export default function VolunteersPage() {
  const [vols, setVols] = useState<Volunteer[]>([])
  const [loading, setLoading] = useState(false)
  const [q, setQ] = useState('')
  const [skill, setSkill] = useState('')
  const [modal, setModal] = useState<{ open: boolean; editing?: Volunteer }>(() => ({ open: false }))
  const [form, setForm] = useState({ name: '', email: '', phone: '', skills: '' })

  useEffect(() => { refresh() }, [])

  async function refresh() {
    setLoading(true)
    const params = new URLSearchParams()
    if (skill) params.set('skill', skill)
    const res = await fetch('/api/volunteers?' + params.toString())
    const data = await res.json()
    setVols(data.volunteers || [])
    setLoading(false)
  }

  function openAdd() {
    setForm({ name: '', email: '', phone: '', skills: '' })
    setModal({ open: true })
  }
  function openEdit(v: Volunteer) {
    setForm({ name: v.name, email: v.email || '', phone: v.phone || '', skills: (v.skills||[]).join(', ') })
    setModal({ open: true, editing: v })
  }
  async function submit() {
    const payload = { ...form, skills: form.skills.split(',').map(s => s.trim()).filter(Boolean) }
    if (!modal.editing) {
      await fetch('/api/volunteers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    } else {
      await fetch('/api/volunteers/' + modal.editing.id, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    }
    setModal({ open: false })
    await refresh()
  }
  async function remove(v: Volunteer) {
    if (!confirm(`Deactivate ${v.name}?`)) return
    await fetch('/api/volunteers/' + v.id, { method: 'DELETE' })
    await refresh()
  }

  const filtered = useMemo(() => vols.filter(v => v.name.toLowerCase().includes(q.toLowerCase())), [vols, q])

  return (
    <div>
      <h1>Volunteers</h1>
      <div style={{ display: 'flex', gap: 8, margin: '8px 0' }}>
        <input placeholder="Search" value={q} onChange={e=>setQ(e.target.value)} />
        <input placeholder="Filter by skill" value={skill} onChange={e=>setSkill(e.target.value)} />
        <button onClick={refresh} disabled={loading}>Refresh</button>
        <button onClick={openAdd}>Add Volunteer</button>
      </div>
      <table width="100%" cellPadding={6} style={{ borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '1px solid #eee' }}>
            <th>Name</th><th>Email</th><th>Phone</th><th>Skills</th><th>Status</th><th></th>
          </tr>
        </thead>
        <tbody>
          {filtered.map(v => (
            <tr key={v.id} style={{ borderBottom: '1px solid #f2f2f2' }}>
              <td>{v.name}</td>
              <td>{v.email}</td>
              <td>{v.phone}</td>
              <td>{(v.skills||[]).join(', ')}</td>
              <td>{v.isActive ? 'Active' : 'Inactive'}</td>
              <td style={{ textAlign: 'right' }}>
                <button onClick={() => openEdit(v)}>Edit</button>{' '}
                <button onClick={() => remove(v)}>Deactivate</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {modal.open && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.3)', display:'grid', placeItems:'center' }}>
          <div style={{ background:'#fff', padding:16, borderRadius:8, width:420 }}>
            <h3>{modal.editing ? 'Edit Volunteer' : 'Add Volunteer'}</h3>
            <div style={{ display:'grid', gap:8, marginTop:8 }}>
              <input placeholder="Name" value={form.name} onChange={e=>setForm({...form, name:e.target.value})} />
              <input placeholder="Email" value={form.email} onChange={e=>setForm({...form, email:e.target.value})} />
              <input placeholder="Phone" value={form.phone} onChange={e=>setForm({...form, phone:e.target.value})} />
              <input placeholder="Skills (comma-separated)" value={form.skills} onChange={e=>setForm({...form, skills:e.target.value})} />
            </div>
            <div style={{ display:'flex', gap:8, marginTop:12, justifyContent:'flex-end' }}>
              <button onClick={() => setModal({ open:false })}>Cancel</button>
              <button onClick={submit}>Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

