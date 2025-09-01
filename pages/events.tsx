import { useEffect, useMemo, useState } from 'react'
import TagMultiSelect from '../components/TagMultiSelect'

type Project = { id: string; name: string }
type Signup = { id: string; volunteerId: string; role?: string; status: string; volunteer?: { name: string } }
type Requirement = { skill: string; minCount: number }
type Shift = { id: string; start: string; end: string; requirements: Requirement[]; signups: Signup[] }
type Event = { id: string; title: string; start: string; end: string; category: string; projectId?: string; project?: Project; shifts: Shift[] }

export default function EventsPage() {
  const [events, setEvents] = useState<Event[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [filters, setFilters] = useState<{projectId?: string; category?: string}>({})
  const [loading, setLoading] = useState(false)
  const [modal, setModal] = useState<{ open: boolean; editing?: Event }>({ open: false })
  const [form, setForm] = useState<{ title: string; start: string; end: string; category: string; projectId?: string; location?: string; notes?: string }>(
    { title:'', start:'', end:'', category:'BUILD' }
  )
  const [volunteers, setVolunteers] = useState<{ id:string; name:string; skills:string[] }[]>([])
  const [allSkills, setAllSkills] = useState<string[]>([])
  const [trimByRequiredSkills, setTrimByRequiredSkills] = useState<boolean>(false)

  useEffect(() => { refresh(); fetchProjects(); fetchVolunteers(); fetchSkills(); fetchSettings() }, [])
  useEffect(() => { refresh() }, [filters.projectId, filters.category])

  async function fetchProjects() {
    const res = await fetch('/api/projects')
    const data = await res.json()
    setProjects(data.projects || [])
  }
  async function refresh() {
    setLoading(true)
    const params = new URLSearchParams()
    if (filters.projectId) params.set('projectId', filters.projectId)
    if (filters.category) params.set('category', filters.category)
    const res = await fetch('/api/events?'+params.toString())
    const data = await res.json()
    setEvents(data.events || [])
    setLoading(false)
  }
  async function fetchVolunteers() {
    const res = await fetch('/api/volunteers?active=true')
    const data = await res.json()
    setVolunteers((data.volunteers||[]).map((v:any)=>({ id:v.id, name:v.name, skills:v.skills||[] })))
  }
  async function fetchSkills() {
    const res = await fetch('/api/skills')
    const data = await res.json()
    setAllSkills((data.skills||[]).map((s:any)=>s.name))
  }
  async function fetchSettings() {
    try {
      const res = await fetch('/api/settings?keys=requireSkillsForAvailability')
      const data = await res.json()
      setTrimByRequiredSkills((data.settings?.requireSkillsForAvailability || 'false') === 'true')
    } catch {}
  }
  function openAdd() { setForm({ title:'', start:'', end:'', category:'BUILD', projectId: filters.projectId }); setModal({ open:true }) }
  function openEdit(ev: Event) {
    setForm({ title: ev.title, start: ev.start.slice(0,16), end: ev.end.slice(0,16), category: ev.category, projectId: ev.projectId })
    setModal({ open: true, editing: ev })
  }
  async function submit() {
    const payload = { ...form, start: form.start, end: form.end }
    if (!modal.editing) {
      const payloadIso = { ...payload, start: new Date(payload.start).toISOString(), end: new Date(payload.end).toISOString() }
      await fetch('/api/events', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payloadIso) })
    } else {
      const payloadIso = { ...payload, start: payload.start ? new Date(payload.start).toISOString() : undefined, end: payload.end ? new Date(payload.end).toISOString() : undefined }
      await fetch('/api/events/'+modal.editing.id, { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payloadIso) })
    }
    setModal({ open:false })
    await refresh()
  }
  async function remove(ev: Event) {
    if (!confirm(`Delete event "${ev.title}"? This cannot be undone.`)) return
    await fetch('/api/events/'+ev.id, { method:'DELETE' })
    await refresh()
  }

  const categories = ['BUILD','RESTORE','RENOVATION']
  const evs = useMemo(() => events, [events])

  return (
    <div>
      <h1>Events</h1>
      <div style={{ display:'flex', gap:8, margin:'8px 0' }}>
        <select value={filters.projectId || ''} onChange={e=>setFilters(f=>({...f, projectId: e.target.value || undefined}))}>
          <option value=''>All Projects</option>
          {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <select value={filters.category || ''} onChange={e=>setFilters(f=>({...f, category: e.target.value || undefined}))}>
          <option value=''>All Categories</option>
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <button onClick={refresh} disabled={loading}>Refresh</button>
        <button onClick={openAdd}>Add Event</button>
      </div>
      <table width="100%" cellPadding={6} style={{ borderCollapse:'collapse' }}>
        <thead>
          <tr style={{ textAlign:'left', borderBottom:'1px solid #eee' }}>
            <th>Title</th><th>Start</th><th>End</th><th>Category</th><th>Project</th><th></th>
          </tr>
        </thead>
        <tbody>
          {evs.map(ev => (
            <tr key={ev.id} style={{ borderBottom:'1px solid #f2f2f2' }}>
              <td>{ev.title}</td>
              <td>{new Date(ev.start).toLocaleString()}</td>
              <td>{new Date(ev.end).toLocaleString()}</td>
              <td>{ev.category}</td>
              <td>{ev.project?.name || '—'}</td>
              <td style={{ textAlign:'right' }}>
                <button onClick={() => openEdit(ev)}>Edit</button>{' '}
                <button onClick={() => remove(ev)}>Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ marginTop: 12 }}>
        {evs.map(ev => (
          <div key={ev.id} style={{ padding:'8px 0', borderTop:'1px dashed #e5e7eb' }}>
            <strong>{ev.title}</strong>
            <div style={{ display:'grid', gap:8, marginTop:6 }}>
              <AddShiftForm eventId={ev.id} onAdded={refresh} />
              {ev.shifts?.map(sh => (
                <div key={sh.id} style={{ padding:8, border:'1px solid #eee', borderRadius:6 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                    <div>
                      <span style={{ fontWeight:600 }}>Shift</span>: {new Date(sh.start).toLocaleString()} → {new Date(sh.end).toLocaleString()}
                    </div>
                    <div>
                      <button onClick={async()=>{ const start = prompt('New start (YYYY-MM-DDTHH:mm)', sh.start.slice(0,16)); if(!start) return; const end = prompt('New end (YYYY-MM-DDTHH:mm)', sh.end.slice(0,16)); if(!end) return; await fetch('/api/shifts/'+sh.id,{ method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ start: new Date(start).toISOString(), end: new Date(end).toISOString() }) }); await refresh() }}>Edit</button>{' '}
                      <button onClick={async()=>{ if(!confirm('Delete this shift?')) return; await fetch('/api/shifts/'+sh.id,{ method:'DELETE' }); await refresh() }}>Delete</button>
                    </div>
                  </div>
                  <RequirementsEditor options={allSkills} shiftId={sh.id} requirements={sh.requirements} countsBySkill={Object.fromEntries((sh.requirements||[]).map(r=>[r.skill, sh.signups.filter(s=>s.role===r.skill).length]))} onChanged={async()=>{ await refresh(); await fetchSkills() }} />
                  <div style={{ marginTop:6 }}>
                    <div style={{ fontSize:13, opacity:.8, marginBottom:4 }}>Assigned volunteers</div>
                    <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                      {sh.signups.map(s => (
                        <span key={s.id} style={{ padding:'2px 6px', border:'1px solid #ddd', borderRadius:12, fontSize:12 }}>
                          {s.volunteer?.name || s.volunteerId}{s.role?` (${s.role})`:''}
                          {' '}<button onClick={async()=>{ if(!confirm('Remove assignment?')) return; await fetch('/api/signups/'+s.id,{method:'DELETE'}); await refresh() }}>
                            ×
                          </button>
                          {' '}<button title='Present' onClick={async()=>{ const start=new Date(sh.start).getTime(), end=new Date(sh.end).getTime(); const hours=Math.round(((end-start)/3600000)*100)/100; await fetch('/api/attendance',{ method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ shiftId: sh.id, volunteerId: s.volunteerId, status:'present', hours }) }); alert('Marked present'); }}>
                            ✓
                          </button>
                          {' '}<button title='No show' onClick={async()=>{ await fetch('/api/attendance',{ method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ shiftId: sh.id, volunteerId: s.volunteerId, status:'no_show' }) }); alert('Marked no-show'); }}>
                            !
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>
                  <div style={{ marginTop:8, display:'flex', gap:6, alignItems:'center' }}>
                  <AssignForm trimByRequiredSkills={trimByRequiredSkills} shiftId={sh.id} initialVolunteers={volunteers} options={Array.from(new Set([...(sh.requirements?.map(r=>r.skill)||[]), ...allSkills]))} onAssign={async (volunteerId, role) => { const res=await fetch('/api/shifts/'+sh.id+'/assign',{ method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ volunteerId, role }) }); if(!res.ok){ const d=await res.json().catch(()=>({})); alert(d?.error==='not_available'?'Volunteer not available for this shift': 'Assignment failed'); } await refresh() }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
          ))}
      </div>

      {modal.open && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.3)', display:'grid', placeItems:'center' }}>
          <div style={{ background:'#fff', padding:16, borderRadius:8, width:680, maxWidth:'90vw' }}>
            <h3>{modal.editing ? 'Edit Event' : 'Add Event'}</h3>
            <div style={{ display:'grid', gap:8, marginTop:8 }}>
              <input placeholder="Title" value={form.title} onChange={e=>setForm({...form, title:e.target.value})} />
              <label>Start <input type="datetime-local" value={form.start} onChange={e=>setForm({...form, start:e.target.value})} /></label>
              <label>End <input type="datetime-local" value={form.end} onChange={e=>setForm({...form, end:e.target.value})} /></label>
              <label>Category
                <select value={form.category} onChange={e=>setForm({...form, category:e.target.value})}>
                  {categories.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </label>
              <label>Project
                <select value={form.projectId || ''} onChange={e=>setForm({...form, projectId: e.target.value || undefined})}>
                  <option value=''>—</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </label>
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

function AssignForm({ shiftId, initialVolunteers, options, onAssign, trimByRequiredSkills = false }: { shiftId: string; initialVolunteers: {id:string; name:string; skills:string[]}[]; options: string[]; onAssign: (volunteerId:string, role?:string)=>Promise<void>; trimByRequiredSkills?: boolean }) {
  const [volunteerId, setVolunteerId] = useState('')
  const [roleList, setRoleList] = useState<string[]>([])
  const [onlyAvail, setOnlyAvail] = useState(true)
  const [list, setList] = useState(initialVolunteers)
  useEffect(() => { setList(initialVolunteers) }, [initialVolunteers])
  useEffect(() => {
    (async () => {
      if (!onlyAvail) { setList(initialVolunteers); return }
      const params = new URLSearchParams({ availableForShift: shiftId })
      if (trimByRequiredSkills) params.set('requireSkills', 'true')
      const res = await fetch('/api/volunteers?'+params.toString())
      const data = await res.json()
      setList(data.volunteers || [])
    })()
  }, [onlyAvail, shiftId, initialVolunteers])
  const role = roleList[0]
  return (
    <div style={{ display:'flex', gap:6, alignItems:'center', flexWrap:'wrap' }}>
      <select value={volunteerId} onChange={e=>setVolunteerId(e.target.value)}>
        <option value=''>Select volunteer…</option>
        {list.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
      </select>
      <div style={{ minWidth:220 }}><TagMultiSelect value={roleList} options={options} onChange={list=>setRoleList(list.slice(0,1))} placeholder='Role (optional)' onRequestCreate={async (label) => { const res = await fetch('/api/skills', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ name: label }) }); if (res.ok) { const data = await res.json(); return data.skill.name } }} /></div>
      <label style={{ display:'flex', alignItems:'center', gap:4 }}>
        <input type='checkbox' checked={onlyAvail} onChange={e=>setOnlyAvail(e.target.checked)} /> Only available
      </label>
      <button disabled={!volunteerId} onClick={async()=>{ try { await onAssign(volunteerId, role || undefined); } catch (e:any) { alert(e?.message || 'Failed to assign') } finally { setVolunteerId(''); setRoleList([]) } }}>Add</button>
    </div>
  )
}

function RequirementsEditor({ shiftId, requirements, countsBySkill, onChanged, options }: { shiftId: string; requirements: {skill:string; minCount:number; id?:string}[]; countsBySkill: Record<string, number>; onChanged: ()=>void; options: string[] }) {
  const [skills, setSkills] = useState<string[]>([])
  const [minCount, setMin] = useState(1)
  return (
    <div>
      <div style={{ display:'flex', gap:12, marginTop:6, flexWrap:'wrap' }}>
        {requirements?.map((r:any) => (
          <span key={r.id || r.skill} style={{ padding:'2px 6px', border:'1px solid #ddd', borderRadius:12, fontSize:12 }}>
            {r.skill}: {countsBySkill[r.skill] ?? 0}/{r.minCount}
            {' '}<button title='Edit min' onClick={async()=>{ const v = prompt('Set minimum count', String(r.minCount)); if(!v) return; const n = Number(v); if(Number.isNaN(n)) return; await fetch('/api/requirements/'+r.id,{ method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ minCount: n })}); onChanged() }}>✎</button>
            {' '}<button title='Delete' onClick={async()=>{ if(!confirm('Delete requirement?')) return; await fetch('/api/requirements/'+r.id,{ method:'DELETE' }); onChanged() }}>×</button>
          </span>
        ))}
      </div>
      <div style={{ display:'flex', gap:6, alignItems:'center', marginTop:8 }}>
        <div style={{ minWidth:260 }}><TagMultiSelect value={skills} options={options} onChange={setSkills} placeholder='Skills' onRequestCreate={async (label) => { const res = await fetch('/api/skills', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ name: label }) }); if (res.ok) { const data = await res.json(); return data.skill.name } }} /></div>
        <input type='number' min={1} style={{ width:80 }} value={minCount} onChange={e=>setMin(Number(e.target.value))} />
        <button disabled={!skills.length} onClick={async()=>{ for (const s of skills) { await fetch('/api/shifts/'+shiftId+'/requirements',{ method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ skill: s, minCount }) }) } setSkills([]); setMin(1); onChanged() }}>Add requirement(s)</button>
      </div>
    </div>
  )
}

function AddShiftForm({ eventId, onAdded }: { eventId: string; onAdded: ()=>void }) {
  const [open, setOpen] = useState(false)
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [description, setDescription] = useState('')
  if (!open) return <button onClick={()=>setOpen(true)}>Add shift</button>
  return (
    <div style={{ display:'flex', gap:6, alignItems:'center', flexWrap:'wrap' }}>
      <label>Start <input type='datetime-local' value={start} onChange={e=>setStart(e.target.value)} /></label>
      <label>End <input type='datetime-local' value={end} onChange={e=>setEnd(e.target.value)} /></label>
      <input placeholder='Description' value={description} onChange={e=>setDescription(e.target.value)} />
      <button disabled={!start || !end} onClick={async()=>{ await fetch('/api/events/'+eventId+'/shifts',{ method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ start: new Date(start).toISOString(), end: new Date(end).toISOString(), description }) }); setOpen(false); setStart(''); setEnd(''); setDescription(''); onAdded() }}>Create</button>
      <button onClick={()=>{ setOpen(false); setStart(''); setEnd(''); setDescription('') }}>Cancel</button>
    </div>
  )
}
