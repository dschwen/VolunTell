import { useEffect, useMemo, useState } from 'react'
import TagMultiSelect from '../components/TagMultiSelect'

type Volunteer = {
  id: string
  name: string
  email?: string
  phone?: string
  skills: string[]
  isActive: boolean
  contactLogs?: { id: string; at: string; method: string; comments?: string }[]
}

export default function VolunteersPage() {
  const [vols, setVols] = useState<Volunteer[]>([])
  const [loading, setLoading] = useState(false)
  const [q, setQ] = useState('')
  const [skill, setSkill] = useState('')
  const [contactDays, setContactDays] = useState<string>('')
  const [exportFrom, setExportFrom] = useState('')
  const [exportTo, setExportTo] = useState('')
  const fileInputId = 'volunteers-import-file'
  const [sortBy, setSortBy] = useState<'name'|'email'|'phone'|'lastContact'|'status'>('name')
  const [sortDir, setSortDir] = useState<'asc'|'desc'>('asc')
  const [modal, setModal] = useState<{ open: boolean; editing?: Volunteer }>(() => ({ open: false }))
  const [form, setForm] = useState<{ name: string; email: string; phone: string; skills: string[] }>({ name:'', email:'', phone:'', skills: [] })
  const [allSkills, setAllSkills] = useState<{ id:string; name:string }[]>([])
  const [skillInput, setSkillInput] = useState('')
  const [avail, setAvail] = useState<any[]>([])
  const [blocks, setBlocks] = useState<any[]>([])
  const [newAvail, setNewAvail] = useState({ weekday: 1, startTime: '08:00', endTime: '17:00' })
  const [newBlock, setNewBlock] = useState({ weekday: 0 as any, date: '', startTime: '00:00', endTime: '23:59', notes: '' })
  const [contactModal, setContactModal] = useState<{ open: boolean; volunteer?: Volunteer; when: string; method: 'phone'|'email'|'other'; comments: string }>({ open:false, when:'', method:'phone', comments:'' })
  const [historyModal, setHistoryModal] = useState<{ open: boolean; volunteer?: Volunteer; items: any[] }>({ open:false, items: [] })
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
  async function reactivate(v: Volunteer) {
    await fetch('/api/volunteers/' + v.id, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ isActive: true }) })
    await refresh()
  }
  async function hardDelete(v: Volunteer) {
    if (!confirm(`Permanently delete ${v.name}? This removes all availability, blackouts, signups, and attendance.`)) return
    await fetch('/api/volunteers/' + v.id + '?hard=true', { method: 'DELETE' })
    await refresh()
  }

  const filtered = useMemo(() => {
    const term = q.toLowerCase()
    const days = Number(contactDays)
    const cutoff = Number.isFinite(days) && days > 0 ? Date.now() - days*24*3600*1000 : null
    const list = vols.filter(v => {
      if (!v.name.toLowerCase().includes(term)) return false
      if (skill && !(v.skills||[]).some(s => s.toLowerCase().includes(skill.toLowerCase()))) return false
      if (cutoff != null) {
        const last = v.contactLogs?.[0]?.at ? new Date(v.contactLogs![0]!.at).getTime() : null
        if (last == null || last < cutoff) return false
      }
      return true
    })
    const dir = sortDir === 'asc' ? 1 : -1
    const getLast = (v: Volunteer) => v.contactLogs?.[0]?.at ? new Date(v.contactLogs![0]!.at).getTime() : null
    return list.sort((a, b) => {
      switch (sortBy) {
        case 'name': {
          return dir * a.name.localeCompare(b.name)
        }
        case 'email': {
          const av = (a.email || '').toLowerCase(); const bv = (b.email || '').toLowerCase()
          return dir * av.localeCompare(bv)
        }
        case 'phone': {
          const av = (a.phone || ''); const bv = (b.phone || '')
          return dir * av.localeCompare(bv)
        }
        case 'status': {
          const av = a.isActive ? 0 : 1; const bv = b.isActive ? 0 : 1
          return dir * (av - bv)
        }
        case 'lastContact': {
          const at = getLast(a); const bt = getLast(b)
          if (at == null && bt == null) return 0
          if (at == null) return 1 * (sortDir === 'asc' ? 1 : -1) // nulls last
          if (bt == null) return -1 * (sortDir === 'asc' ? 1 : -1)
          return dir * (at - bt)
        }
      }
    })
  }, [vols, q, skill, contactDays, sortBy, sortDir])
  function lastContactOf(v: Volunteer): string {
    const at = v.contactLogs?.[0]?.at
    if (!at) return '—'
    try { return new Date(at).toLocaleString() } catch { return '—' }
  }
  function openContact(v: Volunteer) {
    const now = new Date()
    const pad = (n:number)=>String(n).padStart(2,'0')
    const local = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`
    setContactModal({ open:true, volunteer: v, when: local, method: 'phone', comments: '' })
  }
  async function submitContact() {
    const v = contactModal.volunteer!
    const body = { method: contactModal.method, at: new Date(contactModal.when).toISOString(), comments: contactModal.comments || undefined }
    await fetch(`/api/volunteers/${v.id}/contacts`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) })
    setContactModal({ open:false, when:'', method:'phone', comments:'' })
    await refresh()
  }
  async function openHistory(v: Volunteer) {
    const res = await fetch(`/api/volunteers/${v.id}/contacts`)
    const data = await res.json()
    setHistoryModal({ open:true, volunteer: v, items: data.items || [] })
  }

  return (
    <div>
      <h1>Volunteers</h1>
      <div style={{ display: 'flex', gap: 8, margin: '8px 0', flexWrap:'wrap' }}>
        <input placeholder="Search" value={q} onChange={e=>setQ(e.target.value)} />
        <input placeholder="Filter by skill" value={skill} onChange={e=>setSkill(e.target.value)} />
        <label>Contacted within (days)
          <input type='number' min={1} value={contactDays} onChange={e=>setContactDays(e.target.value)} style={{ width:100, marginLeft:6 }} />
        </label>
        <button onClick={refresh} disabled={loading}>Refresh</button>
        <button onClick={openAdd}>Add Volunteer</button>
        <span style={{ marginLeft:'auto' }} />
        <label>Sort by
          <select value={sortBy} onChange={e=>setSortBy(e.target.value as any)} style={{ marginLeft:6 }}>
            <option value='name'>Name</option>
            <option value='email'>Email</option>
            <option value='phone'>Phone</option>
            <option value='lastContact'>Last contact</option>
            <option value='status'>Status</option>
          </select>
        </label>
        <button onClick={()=>setSortDir(d=>d==='asc'?'desc':'asc')} title={`Direction: ${sortDir}`}>{sortDir==='asc'?'Asc':'Desc'}</button>
        <input id={fileInputId} type='file' accept='.csv,text/csv' style={{ display:'none' }} onChange={async (e)=>{
          const f = e.target.files?.[0]
          if (!f) return
          const text = await f.text()
          const res = await fetch('/api/import/volunteers', { method:'POST', headers:{ 'Content-Type': 'application/json' }, body: JSON.stringify({ csv: text }) })
          if (!res.ok) { alert('Import failed'); return }
          const data = await res.json()
          alert(`Import complete. Created: ${data.created}, Updated: ${data.updated}, Skipped: ${data.skipped}${(data.errors?.length? `, Errors: ${data.errors.length}` : '')}`)
          ;(e.target as HTMLInputElement).value = ''
          await refresh()
        }} />
        <button onClick={()=>document.getElementById(fileInputId)?.click()}>Import CSV</button>
        <label>From <input type='date' value={exportFrom} onChange={e=>setExportFrom(e.target.value)} /></label>
        <label>To <input type='date' value={exportTo} onChange={e=>setExportTo(e.target.value)} /></label>
        <button onClick={()=>{
          const params = new URLSearchParams()
          if (exportFrom) params.set('from', new Date(exportFrom).toISOString())
          if (exportTo) { const dt = new Date(exportTo); dt.setHours(23,59,59,999); params.set('to', dt.toISOString()) }
          window.open('/api/reports/contacts?' + params.toString(), '_blank')
        }}>Export contacts CSV</button>
      </div>
      <table width="100%" cellPadding={6} style={{ borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '1px solid #eee' }}>
            <th>Name</th><th>Email</th><th>Phone</th><th>Skills</th><th>Last contact</th><th>Status</th><th></th>
          </tr>
        </thead>
        <tbody>
          {filtered.map(v => (
            <tr key={v.id} style={{ borderBottom: '1px solid #f2f2f2' }}>
              <td>{v.name}</td>
              <td>{v.email}</td>
              <td>{v.phone}</td>
              <td>{(v.skills||[]).join(', ')}</td>
              <td>
                {lastContactOf(v)}{' '}
                <button onClick={()=>openHistory(v)} title='View contact history'>History</button>
              </td>
              <td>{v.isActive ? 'Active' : 'Inactive'}</td>
              <td style={{ textAlign: 'right', display:'flex', gap:6, justifyContent:'flex-end' }}>
                <button onClick={() => openEdit(v)}>Edit</button>
                <button onClick={() => openContact(v)}>Log contact</button>
                {v.isActive ? (
                  <>
                    <button onClick={() => remove(v)}>Deactivate</button>
                    <button onClick={() => hardDelete(v)}>Delete</button>
                  </>
                ) : (
                  <button onClick={() => reactivate(v)}>Reactivate</button>
                )}
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

      {contactModal.open && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.35)', display:'grid', placeItems:'center', zIndex:3000 }}>
          <div style={{ background:'#fff', padding:16, borderRadius:8, width:520, maxWidth:'90vw' }}>
            <h3>Log contact — {contactModal.volunteer?.name}</h3>
            <div style={{ display:'grid', gap:8, marginTop:8 }}>
              <label>Method
                <select value={contactModal.method} onChange={e=>setContactModal(c=>({ ...c, method: e.target.value as any }))}>
                  <option value='phone'>by phone</option>
                  <option value='email'>by email</option>
                  <option value='other'>other</option>
                </select>
              </label>
              <label>Date/Time
                <input type='datetime-local' value={contactModal.when} onChange={e=>setContactModal(c=>({ ...c, when: e.target.value }))} />
              </label>
              <textarea placeholder='Comments' value={contactModal.comments} onChange={e=>setContactModal(c=>({ ...c, comments: e.target.value }))} rows={3} />
            </div>
            <div style={{ display:'flex', gap:8, justifyContent:'flex-end', marginTop:12 }}>
              <button onClick={()=>setContactModal({ open:false, when:'', method:'phone', comments:'' })}>Cancel</button>
              <button onClick={submitContact}>Save</button>
            </div>
          </div>
        </div>
      )}

      {historyModal.open && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.35)', display:'grid', placeItems:'center', zIndex:3000 }}>
          <div style={{ background:'#fff', padding:16, borderRadius:8, width:640, maxWidth:'90vw', maxHeight:'80vh', overflow:'auto' }}>
            <h3>Contact history — {historyModal.volunteer?.name}</h3>
            <table width='100%' cellPadding={6} style={{ borderCollapse:'collapse', marginTop:8 }}>
              <thead><tr style={{ textAlign:'left', borderBottom:'1px solid #eee' }}><th>Date</th><th>Method</th><th>Comments</th></tr></thead>
              <tbody>
                {historyModal.items.map((i:any)=>(
                  <tr key={i.id} style={{ borderBottom:'1px solid #f5f5f5' }}>
                    <td>{new Date(i.at).toLocaleString()}</td>
                    <td>{i.method}</td>
                    <td>{i.comments || '—'}</td>
                  </tr>
                ))}
                {!historyModal.items.length && (<tr><td colSpan={3} style={{ opacity:.7 }}>No contacts logged yet.</td></tr>)}
              </tbody>
            </table>
            <div style={{ display:'flex', justifyContent:'flex-end', marginTop:12 }}>
              <button onClick={()=>setHistoryModal({ open:false, items: [] })}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
