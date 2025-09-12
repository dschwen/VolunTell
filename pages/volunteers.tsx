import { useEffect, useMemo, useState } from 'react'
import TagMultiSelect from '../components/TagMultiSelect'

type Volunteer = {
  id: string
  name: string
  email?: string
  phone?: string
  skills: string[]
  isActive: boolean
  notes?: string
  contactLogs?: { id: string; at: string; method: string; comments?: string }[]
  tasks?: { id: string }[]
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
  const [form, setForm] = useState<{ name: string; email: string; phone: string; skills: string[]; notes: string }>({ name:'', email:'', phone:'', skills: [], notes: '' })
  const [allSkills, setAllSkills] = useState<{ id:string; name:string }[]>([])
  const [skillInput, setSkillInput] = useState('')
  const [avail, setAvail] = useState<any[]>([])
  const [blocks, setBlocks] = useState<any[]>([])
  const [newAvail, setNewAvail] = useState({ weekday: 1, startTime: '08:00', endTime: '17:00' })
  const [newBlock, setNewBlock] = useState({ weekday: 0 as any, date: '', startTime: '00:00', endTime: '23:59', notes: '' })
  const [contactModal, setContactModal] = useState<{ open: boolean; volunteer?: Volunteer; ids?: string[]; when: string; method: 'phone'|'email'|'other'; comments: string }>({ open:false, when:'', method:'phone', comments:'' })
  const [historyModal, setHistoryModal] = useState<{ open: boolean; volunteer?: Volunteer; items: any[] }>({ open:false, items: [] })
  const [assignModal, setAssignModal] = useState<{ open: boolean; events: any[]; eventId?: string; shiftId?: string; role?: string; loading: boolean; error?: string }>({ open:false, events: [], loading: false })
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [notesEdit, setNotesEdit] = useState<{ id: string; value: string } | null>(null)
  const [hideInactive, setHideInactive] = useState<boolean>(false)
  // Persist hideInactive in localStorage
  useEffect(() => {
    try { const v = localStorage.getItem('hideInactive'); if (v != null) setHideInactive(v === 'true') } catch {}
  }, [])
  useEffect(() => {
    try { localStorage.setItem('hideInactive', hideInactive ? 'true' : 'false') } catch {}
  }, [hideInactive])
  // Persist sort + contactDays
  useEffect(() => {
    try {
      const sb = localStorage.getItem('vols.sortBy'); if (sb) setSortBy(sb as any)
      const sd = localStorage.getItem('vols.sortDir'); if (sd === 'asc' || sd === 'desc') setSortDir(sd as any)
      const cd = localStorage.getItem('vols.contactDays'); if (cd != null) setContactDays(cd)
    } catch {}
  }, [])
  useEffect(() => { try { localStorage.setItem('vols.sortBy', sortBy) } catch {} }, [sortBy])
  useEffect(() => { try { localStorage.setItem('vols.sortDir', sortDir) } catch {} }, [sortDir])
  useEffect(() => { try { localStorage.setItem('vols.contactDays', contactDays) } catch {} }, [contactDays])
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
    setForm({ name: '', email: '', phone: '', skills: [], notes: '' })
    setModal({ open: true })
  }
  function openEdit(v: Volunteer) {
    setForm({ name: v.name, email: v.email || '', phone: v.phone || '', skills: v.skills || [], notes: v.notes || '' })
    setModal({ open: true, editing: v })
    // fetch availability and blackouts
    fetch(`/api/volunteers/${v.id}/availability`).then(r=>r.json()).then(d=>setAvail(d.items||[]))
    fetch(`/api/volunteers/${v.id}/blackouts`).then(r=>r.json()).then(d=>setBlocks(d.items||[]))
  }
  async function submit() {
    const payload = { ...form, skills: Array.from(new Set((form.skills||[]).map(s=>s.trim()).filter(Boolean))), notes: form.notes?.trim() || undefined }
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
      if (hideInactive && !v.isActive) return false
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
  }, [vols, q, skill, contactDays, sortBy, sortDir, hideInactive])
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
        <label style={{ display:'flex', alignItems:'center', gap:6 }}>
          <input type='checkbox' checked={hideInactive} onChange={e=>setHideInactive(e.target.checked)} /> Hide inactive
        </label>
        {selected.size > 0 && (
          <div style={{ display:'flex', gap:6, alignItems:'center' }}>
            <strong>{selected.size} selected</strong>
            <button onClick={()=>{ const now=new Date(); const pad=(n:number)=>String(n).padStart(2,'0'); const local = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`; setContactModal({ open:true, ids: Array.from(selected), when: local, method:'phone', comments:'' }) }}>📞 Log contact</button>
            <button onClick={async()=>{
              setAssignModal({ open:true, events: [], loading: true })
              try {
                const from = new Date().toISOString()
                const to = new Date(Date.now()+30*24*3600*1000).toISOString()
                const res = await fetch(`/api/events?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`)
                const data = await res.json()
                setAssignModal({ open:true, events: data.events||[], loading: false })
              } catch (e) {
                setAssignModal({ open:true, events: [], loading: false, error: 'Failed to load events' })
              }
            }}>📌 Assign to shift</button>
            <button onClick={async()=>{
              let ok=0
              for (const id of selected) {
                await fetch('/api/tasks', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ volunteerId: id, type: 'followup', status: 'open' }) })
                ok++
              }
              alert(`Flagged ${ok} for follow-up`)
              setSelected(new Set()); await refresh()
            }}>⭐ Flag follow-up</button>
            <button onClick={async()=>{
              let closed=0
              for (const id of selected) {
                const v = vols.find(x=>x.id===id)
                if (v?.tasks?.length) {
                  await fetch('/api/tasks/'+v.tasks[0].id, { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ status: 'done' }) })
                  closed++
                }
              }
              alert(`Cleared follow-up on ${closed} volunteers`)
              setSelected(new Set()); await refresh()
            }}>☆ Clear follow-up</button>
            <button onClick={async()=>{ if(!confirm(`Deactivate ${selected.size} volunteers?`)) return; for (const id of selected) { await fetch('/api/volunteers/'+id,{ method:'DELETE' }) } setSelected(new Set()); await refresh() }}>🚫 Deactivate</button>
            <button onClick={async()=>{ if(!confirm(`Permanently delete ${selected.size} volunteers? This removes related availability, blackouts, signups, attendance, and contacts.`)) return; for (const id of selected) { await fetch('/api/volunteers/'+id+'?hard=true',{ method:'DELETE' }) } setSelected(new Set()); await refresh() }}>🗑️ Delete</button>
          </div>
        )}
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
            <th><input type='checkbox' checked={selected.size>0 && filtered.every(v=>selected.has(v.id))} onChange={e=>{ if(e.target.checked){ setSelected(new Set(filtered.map(v=>v.id))) } else { setSelected(new Set()) } }} /></th>
            {['name','email','phone','skills','lastContact','status'].map((key)=>{
              const labelMap: any = { name:'Name', email:'Email', phone:'Phone', skills:'Skills', lastContact:'Last contact', status:'Status' }
              const k = key as 'name'|'email'|'phone'|'lastContact'|'status'| 'skills'
              const sortable = k !== 'skills'
              const isActive = sortable && sortBy === (k === 'lastContact' ? 'lastContact' : k as any)
              const arrow = isActive ? (sortDir==='asc'?'▲':'▼') : ''
              return (
                <th key={k} style={{ cursor: sortable ? 'pointer' : 'default', userSelect:'none' }} onClick={()=>{
                  if (!sortable) return
                  const target = (k === 'lastContact') ? 'lastContact' : (k as any)
                  if (sortBy === target) setSortDir(d=>d==='asc'?'desc':'asc')
                  else { setSortBy(target as any); setSortDir('asc') }
                }}>{labelMap[k]} {arrow}</th>
              )
            })}
            <th></th>
          </tr>
        </thead>
        <tbody>
          {filtered.map(v => (
            <tr key={v.id} style={{ borderBottom: '1px solid #f2f2f2' }}>
              <td><input type='checkbox' checked={selected.has(v.id)} onChange={e=>{ setSelected(prev=>{ const next=new Set(prev); if(e.target.checked) next.add(v.id); else next.delete(v.id); return next }) }} /></td>
              <td>
                <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                  <button title={v.tasks?.length ? 'Clear follow-up flag' : 'Flag for follow-up'} onClick={async()=>{
                    if (v.tasks?.length) {
                      const tid = v.tasks[0].id
                      await fetch('/api/tasks/'+tid, { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ status: 'done' }) })
                    } else {
                      await fetch('/api/tasks', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ volunteerId: v.id, type: 'followup', status: 'open' }) })
                    }
                    await refresh()
                  }} style={{ border:'1px solid #ddd', borderRadius:4, width:22, height:22, display:'grid', placeItems:'center', background:'#fff' }}>
                    <span style={{ color: v.tasks?.length ? '#f59e0b' : '#9ca3af' }}>{v.tasks?.length ? '★' : '☆'}</span>
                  </button>
                  <span>{v.name}</span>
                </div>
                {notesEdit?.id === v.id ? (
                  <div style={{ marginTop:4 }} onClick={e=>e.stopPropagation()}>
                    <textarea rows={2} style={{ width:'100%' }} value={notesEdit.value}
                      onKeyDown={async (e)=>{
                        if (e.key === 'Escape') { e.preventDefault(); setNotesEdit(null); return }
                        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                          e.preventDefault()
                          const body={ notes: (notesEdit.value||'').trim() || null }
                          await fetch('/api/volunteers/'+v.id, { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) })
                          setNotesEdit(null)
                          await refresh()
                        }
                      }}
                      onChange={e=>setNotesEdit(ne=>ne?{...ne, value:e.target.value}:ne)} />
                    <div style={{ display:'flex', gap:6, marginTop:4 }}>
                      <button onClick={async()=>{ const body={ notes: (notesEdit.value||'').trim() || null }; await fetch('/api/volunteers/'+v.id, { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) }); setNotesEdit(null); await refresh() }}>Save</button>
                      <button onClick={()=>setNotesEdit(null)}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <div
                    title='Click to edit comment'
                    onClick={()=>setNotesEdit({ id: v.id, value: v.notes || '' })}
                    style={{ fontSize:12, color:'#6b7280', marginTop:2, cursor:'text' }}>
                    {v.notes && v.notes.trim() ? v.notes : <span style={{ opacity:.6, fontStyle:'italic' }}>Add comment</span>}
                  </div>
                )}
              </td>
              <td>{v.email}</td>
              <td>{v.phone}</td>
              <td>{(v.skills||[]).join(', ')}</td>
              <td>
                {lastContactOf(v)}{' '}
                <button onClick={()=>openHistory(v)} title='View contact history'>🕘</button>
              </td>
              <td>{v.isActive ? 'Active' : 'Inactive'}</td>
              <td style={{ textAlign: 'right', display:'flex', gap:6, justifyContent:'flex-end' }}>
                <button onClick={() => openEdit(v)} title='Edit volunteer'>✏️</button>
                <button onClick={() => openContact(v)} title='Log contact'>📞</button>
                {v.isActive ? (
                  <>
                    <button onClick={() => remove(v)} title='Deactivate'>🚫</button>
                    <button onClick={() => hardDelete(v)} title='Delete permanently'>🗑️</button>
                  </>
                ) : (
                  <button onClick={() => reactivate(v)} title='Reactivate'>✅</button>
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
              <textarea placeholder="Comments" value={form.notes} onChange={e=>setForm({...form, notes:e.target.value})} rows={3} />
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
            <h3>Log contact — {contactModal.volunteer ? contactModal.volunteer.name : `${contactModal.ids?.length||0} selected`}</h3>
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
              <button onClick={async()=>{
                const body = { method: contactModal.method, at: new Date(contactModal.when).toISOString(), comments: contactModal.comments || undefined }
                if (contactModal.volunteer) {
                  await fetch(`/api/volunteers/${contactModal.volunteer.id}/contacts`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) })
                } else if (contactModal.ids?.length) {
                  for (const id of contactModal.ids) {
                    await fetch(`/api/volunteers/${id}/contacts`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) })
                  }
                }
                setContactModal({ open:false, when:'', method:'phone', comments:'' })
                setSelected(new Set())
                await refresh()
              }}>Save</button>
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
      {assignModal.open && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.35)', display:'grid', placeItems:'center', zIndex:3000 }}>
          <div style={{ background:'#fff', padding:16, borderRadius:8, width:560, maxWidth:'90vw' }}>
            <h3>Assign to shift</h3>
            <div style={{ display:'grid', gap:8, marginTop:8 }}>
              <label>Event
                <select value={assignModal.eventId || ''} onChange={e=>setAssignModal(m=>({ ...m, eventId: e.target.value || undefined, shiftId: undefined, role: undefined }))}>
                  <option value=''>Select…</option>
                  {(assignModal.events||[]).map((ev:any)=>(<option key={ev.id} value={ev.id}>{new Date(ev.start).toLocaleDateString()} — {ev.title}</option>))}
                </select>
              </label>
              <label>Shift
                <select value={assignModal.shiftId || ''} onChange={e=>setAssignModal(m=>({ ...m, shiftId: e.target.value || undefined, role: undefined }))} disabled={!assignModal.eventId}>
                  <option value=''>Select…</option>
                  {assignModal.eventId && (assignModal.events.find((ev:any)=>ev.id===assignModal.eventId)?.shifts||[]).map((sh:any)=>(
                    <option key={sh.id} value={sh.id}>{new Date(sh.start).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}–{new Date(sh.end).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</option>
                  ))}
                </select>
              </label>
              <label>Role (optional)
                <select value={assignModal.role || ''} onChange={e=>setAssignModal(m=>({ ...m, role: e.target.value || undefined }))} disabled={!assignModal.shiftId}>
                  <option value=''>—</option>
                  {assignModal.shiftId && (() => {
                    const ev = assignModal.events.find((e:any)=>e.id===assignModal.eventId)
                    const sh = ev?.shifts?.find((s:any)=>s.id===assignModal.shiftId)
                    const req = Array.from(new Set((sh?.requirements||[]).map((r:any)=>r.skill)))
                    return req.map((s:any)=>(<option key={s} value={s}>{s}</option>))
                  })()}
                </select>
              </label>
            </div>
            <div style={{ display:'flex', gap:8, justifyContent:'flex-end', marginTop:12 }}>
              <button onClick={()=>setAssignModal({ open:false, events: [], loading:false })}>Cancel</button>
              <button disabled={!assignModal.shiftId} onClick={async()=>{
                if (!assignModal.shiftId) return
                let ok = 0, failed = 0
                for (const id of selected) {
                  const res = await fetch('/api/shifts/'+assignModal.shiftId+'/assign', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ volunteerId: id, role: assignModal.role }) })
                  if (res.ok) ok++; else failed++
                }
                alert(`Assigned: ${ok}, Failed: ${failed}`)
                setAssignModal({ open:false, events: [], loading:false })
                setSelected(new Set())
              }}>Assign</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
