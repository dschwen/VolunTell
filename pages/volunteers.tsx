import { useEffect, useMemo, useState } from 'react'
import TagMultiSelect from '../components/TagMultiSelect'

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
  const [form, setForm] = useState<{ name: string; email: string; phone: string; skills: string[] }>({ name:'', email:'', phone:'', skills: [] })
  const [allSkills, setAllSkills] = useState<{ id:string; name:string }[]>([])
  const [skillInput, setSkillInput] = useState('')
  const [avail, setAvail] = useState<any[]>([])
  const [blocks, setBlocks] = useState<any[]>([])
  const [newAvail, setNewAvail] = useState({ weekday: 1, startTime: '08:00', endTime: '17:00' })
  const [newBlock, setNewBlock] = useState({ weekday: 0 as any, date: '', startTime: '00:00', endTime: '23:59', notes: '' })
  const dayNames = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']

  useEffect(() => { refresh() }, [])

  async function refresh() {
    setLoading(true)
    const params = new URLSearchParams()
    if (skill) params.set('skill', skill)
    const [vres, sres] = await Promise.all([
      fetch('/api/volunteers?' + params.toString()),
      fetch('/api/skills')
    ])
    const vdata = await vres.json(); const sdata = await sres.json()
    setVols(vdata.volunteers || [])
    setAllSkills(sdata.skills || [])
    setLoading(false)
  }

  function openAdd() {
    setForm({ name: '', email: '', phone: '', skills: [] })
    setModal({ open: true })
  }
  function openEdit(v: Volunteer) {
    setForm({ name: v.name, email: v.email || '', phone: v.phone || '', skills: v.skills || [] })
    setModal({ open: true, editing: v })
    // fetch availability and blackouts
    fetch(`/api/volunteers/${v.id}/availability`).then(r=>r.json()).then(d=>setAvail(d.items||[]))
    fetch(`/api/volunteers/${v.id}/blackouts`).then(r=>r.json()).then(d=>setBlocks(d.items||[]))
  }
  async function submit() {
    const payload = { ...form, skills: Array.from(new Set((form.skills||[]).map(s=>s.trim()).filter(Boolean))) }
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
          <div style={{ background:'#fff', padding:16, borderRadius:8, width:680, maxWidth:'90vw' }}>
            <h3>{modal.editing ? 'Edit Volunteer' : 'Add Volunteer'}</h3>
            <div style={{ display:'grid', gap:8, marginTop:8 }}>
              <input placeholder="Name" value={form.name} onChange={e=>setForm({...form, name:e.target.value})} />
              <input placeholder="Email" value={form.email} onChange={e=>setForm({...form, email:e.target.value})} />
              <input placeholder="Phone" value={form.phone} onChange={e=>setForm({...form, phone:e.target.value})} />
              <TagMultiSelect
                value={form.skills}
                options={allSkills.map(s=>s.name)}
                onChange={skills=>setForm(f=>({...f, skills}))}
                onRequestCreate={async (label) => {
                  const res = await fetch('/api/skills', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ name: label }) })
                  if (res.ok) {
                    const data = await res.json()
                    setAllSkills(prev => [...prev, { id: data.skill.id, name: data.skill.name }])
                    return data.skill.name
                  }
                }}
                placeholder="Add skill"
              />
            </div>
            {modal.editing && (
              <div style={{ marginTop:16 }}>
                <h4>Availability</h4>
                <ul style={{ paddingLeft:16 }}>
                  {avail.map((a:any)=>(
                    <li key={a.id}>
                      {dayNames[a.weekday]} {a.startTime}-{a.endTime} <button onClick={async()=>{ if(!confirm('Remove availability?')) return; await fetch('/api/availability/'+a.id,{method:'DELETE'}); const r=await fetch(`/api/volunteers/${modal.editing!.id}/availability`); setAvail((await r.json()).items||[]) }}>Remove</button>
                    </li>
                  ))}
                </ul>
                <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                  <label>Weekday <select value={newAvail.weekday} onChange={e=>setNewAvail({...newAvail, weekday: Number(e.target.value)})}>
                    {dayNames.map((d,i)=>(<option key={i} value={i}>{d}</option>))}
                  </select></label>
                  <label>Start <input type="time" value={newAvail.startTime} onChange={e=>setNewAvail({...newAvail, startTime:e.target.value})} /></label>
                  <label>End <input type="time" value={newAvail.endTime} onChange={e=>setNewAvail({...newAvail, endTime:e.target.value})} /></label>
                  <button onClick={async()=>{ await fetch(`/api/volunteers/${modal.editing!.id}/availability`,{method:'POST',headers:{'Content-Type':'application/json'}, body: JSON.stringify(newAvail)}); const r=await fetch(`/api/volunteers/${modal.editing!.id}/availability`); setAvail((await r.json()).items||[]) }}>Add</button>
                </div>

                <h4 style={{ marginTop:12 }}>Blackouts</h4>
                <ul style={{ paddingLeft:16 }}>
                  {blocks.map((b:any)=>(
                    <li key={b.id}>
                      {(b.date? new Date(b.date).toLocaleDateString() : dayNames[b.weekday])} {b.startTime}-{b.endTime} {b.notes? `(${b.notes})`:''}
                      {' '}<button onClick={async()=>{ if(!confirm('Remove blackout?')) return; await fetch('/api/blackouts/'+b.id,{method:'DELETE'}); const r=await fetch(`/api/volunteers/${modal.editing!.id}/blackouts`); setBlocks((await r.json()).items||[]) }}>Remove</button>
                    </li>
                  ))}
                </ul>
                <div style={{ display:'grid', gap:6 }}>
                  <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                    <label>Weekday <select value={newBlock.weekday ?? ''} onChange={e=>setNewBlock({...newBlock, weekday: e.target.value===''? null : Number(e.target.value)})}>
                      <option value=''>—</option>
                      {dayNames.map((d,i)=>(<option key={i} value={i}>{d}</option>))}
                    </select></label>
                    <span>or</span>
                    <label>Date <input type="date" value={newBlock.date} onChange={e=>setNewBlock({...newBlock, date:e.target.value})} /></label>
                    <label>Start <input type="time" value={newBlock.startTime} onChange={e=>setNewBlock({...newBlock, startTime:e.target.value})} /></label>
                    <label>End <input type="time" value={newBlock.endTime} onChange={e=>setNewBlock({...newBlock, endTime:e.target.value})} /></label>
                  </div>
                  <input placeholder="Notes" value={newBlock.notes} onChange={e=>setNewBlock({...newBlock, notes:e.target.value})} />
                  <button onClick={async()=>{ const payload:any={...newBlock}; if(!payload.date) delete payload.date; await fetch(`/api/volunteers/${modal.editing!.id}/blackouts`,{method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload)}); const r=await fetch(`/api/volunteers/${modal.editing!.id}/blackouts`); setBlocks((await r.json()).items||[]) }}>Add Blackout</button>
                </div>
              </div>
            )}
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
