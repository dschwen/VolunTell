
import FullCalendar from '@fullcalendar/react'
import timeGridPlugin from '@fullcalendar/timegrid'
import dayGridPlugin from '@fullcalendar/daygrid'
import interactionPlugin, { Draggable } from '@fullcalendar/interaction'
import { useEffect, useRef, useState } from 'react'
import Portal from './Portal'
import TagMultiSelect from './TagMultiSelect'

type Volunteer = { id: string; name: string; skills?: string[]; availSummary?: string; familyColor?: string; primarySkill?: string }
type Requirement = { skill: string; minCount: number }
type Signup = { volunteerId: string; role?: string; status: string }
type EventItem = {
  id: string; title: string; start: string; end: string;
  extendedProps: {
    shiftId: string;
    requirements?: Requirement[];
    signedups?: Signup[];
    familyColor?: string;
  }
}

export default function CalendarBoard({ initial, onPickTime, onCreate, onRefresh, defaultShiftHours = 6, projects = [], defaultProjectId, trimByRequiredSkills = false, enableDnD = false }: { initial: { events: EventItem[]; volunteers: Volunteer[] }, onPickTime?: (iso: string) => void, onCreate?: (opts: { start: string; end: string; title: string; category: string; description?: string; projectId?: string }) => Promise<void>, onRefresh?: () => void | Promise<void>, defaultShiftHours?: number, projects?: { id: string; name: string }[], defaultProjectId?: string, trimByRequiredSkills?: boolean, enableDnD?: boolean }) {
  const [events, setEvents] = useState<EventItem[]>(initial.events)
  const volunteerPaneRef = useRef<HTMLDivElement>(null)
  const [drawer, setDrawer] = useState<{ open: boolean; shiftId?: string; details?: any }>({ open: false })
  const [skillOptions, setSkillOptions] = useState<string[]>([])
  const [availList, setAvailList] = useState<{ id: string; name: string; skills?: string[] }[]>([])
  const [availSet, setAvailSet] = useState<Set<string>>(new Set())
  const [assignForm, setAssignForm] = useState<{ volunteerId: string; roleList: string[] }>({ volunteerId: '', roleList: [] })
  const [assignModal, setAssignModal] = useState<{ open: boolean; shiftId?: string; volunteerId?: string; options: string[]; selected: string[] }>({ open:false, options: [], selected: [] })
  const [toasts, setToasts] = useState<{ id: number; text: string }[]>([])

  function showToast(text: string) {
    const id = Date.now() + Math.floor(Math.random()*1000)
    setToasts(t => [...t, { id, text }])
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 2500)
  }
  const [creator, setCreator] = useState<{ open: boolean; start?: string; end?: string; title: string; category: string; description: string; projectId?: string }>({ open:false, title:'', category:'BUILD', description:'', projectId: defaultProjectId })

  useEffect(() => {
    if (!enableDnD) return
    if (!volunteerPaneRef.current) return
    new Draggable(volunteerPaneRef.current, {
      itemSelector: '.vol-chip',
      eventData: (el) => ({
        title: el.getAttribute('data-name') || 'Volunteer',
        extendedProps: {
          volunteerId: el.getAttribute('data-id'),
          role: el.getAttribute('data-role') || undefined,
        }
      })
    })
  }, [enableDnD])

  // Keep local events in sync when parent provides new data
  useEffect(() => { setEvents(initial.events) }, [initial.events])

  const eventContent = (arg: any) => {
    const req: Requirement[] = arg.event.extendedProps.requirements || []
    const signed: Signup[] = arg.event.extendedProps.signedups || []
    const bySkill = req.map(r => {
      const filled = signed.filter(s => s.role === r.skill).length
      const ok = filled >= r.minCount
      return `<div style="display:flex;gap:.25rem;align-items:center">
        <span>${r.skill}</span>
        <span>(${filled}/${r.minCount})</span>
        <span style="width:6px;height:6px;border-radius:50%;background:${ok?'#2ecc71':'#e74c3c'}"></span>
      </div>`
    }).join('')
    const fam = arg.event.extendedProps.familyColor ? `border-left:6px solid ${arg.event.extendedProps.familyColor};` : ''
    return { html: `<div style="padding:2px;${fam}"><strong>${arg.event.title}</strong><div style="font-size:12px">${bySkill}</div></div>` }
  }

  const handleReceive = async (info: any) => {
    const volunteerId = info.draggedEl.getAttribute('data-id')!
    const role = info.draggedEl.getAttribute('data-role') || undefined
    let shiftId = info.event.extendedProps.shiftId as string | undefined
    let reqs: string[] = (info.event.extendedProps.requirements||[]).map((r:any)=>r.skill)
    // Fallback: if drop created a new event (no shiftId), infer target shift by time containment
    if (!shiftId) {
      const t = info.event.start as Date
      const target = (events as any[]).find(e => {
        const s = new Date(e.start as any).getTime()
        const ed = new Date(e.end as any).getTime()
        const tt = t?.getTime() || 0
        return s <= tt && tt < ed
      })
      if (target) {
        shiftId = target.extendedProps.shiftId
        reqs = (target.extendedProps.requirements||[]).map((r:any)=>r.skill)
      } else {
        showToast('Drop onto an existing shift to assign')
        info.event.remove()
        info.draggedEl.classList.add('shake')
        setTimeout(()=>info.draggedEl.classList.remove('shake'), 600)
        return
      }
    }
    const allVols = [...(initial.volunteers||[]), ...availList]
    const vol = allVols.find((v:any) => v.id === volunteerId)
    const intersect = (reqs as string[]).filter(s => (vol?.skills||[]).includes(s))
    // If no role provided, open compact dropdown with intersection
    if (!role) {
      if (intersect.length === 0) {
        try {
          const dbg = new URLSearchParams()
          dbg.set('availableForShift', shiftId!)
          dbg.set('debug', 'true')
          const dres = await fetch('/api/volunteers?'+ dbg.toString())
          const data = await dres.json()
          const ex = (data?.debug?.excluded||[]).find((x:any)=>x.id===volunteerId)
          if (ex && Array.isArray(ex.reasons)) {
            if (ex.reasons.includes('outside_availability') || ex.reasons.find((r:string)=>r.startsWith('blackout'))) {
              showToast('Volunteer not available for this shift')
            } else if (ex.reasons.includes('double_booked')) {
              showToast('Volunteer already booked for overlapping shift')
            } else if (ex.reasons.includes('missing_required_skill')) {
              showToast('Volunteer has no required skills for this shift')
            } else {
              showToast('Cannot assign: no matching role')
            }
          } else {
            showToast('Cannot assign: no matching role')
          }
        } catch {
          showToast('Cannot assign: no matching role')
        }
        info.event.remove()
        info.draggedEl.classList.add('shake')
        setTimeout(()=>info.draggedEl.classList.remove('shake'), 600)
        return
      }
      // Show dropdown with intersect options
      setAssignModal({ open:true, shiftId, volunteerId, options: intersect, selected: [] })
      info.event.remove()
      return
    }
    // If role provided, validate it against requirements and volunteer skills
    if (!reqs.includes(role) || !(vol?.skills||[]).includes(role)) {
      showToast('Cannot assign: role not required or not in volunteer skills')
      info.event.remove()
      info.draggedEl.classList.add('shake')
      setTimeout(()=>info.draggedEl.classList.remove('shake'), 600)
      return
    }
    const res = await fetch('/api/shifts/'+shiftId+'/assign', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ volunteerId, role })
    })
    if (!res.ok) {
      const data = await res.json().catch(()=>({}))
      if (data?.error === 'double_booked') showToast(`Volunteer already booked: ${data.conflict?.eventTitle || ''}`)
      else if (data?.error === 'not_available') showToast('Volunteer not available for this shift')
      else showToast('Assignment failed')
      info.draggedEl.classList.add('shake')
      setTimeout(()=>info.draggedEl.classList.remove('shake'), 600)
      return
    }
    info.event.setExtendedProp('signedups', [ ...(info.event.extendedProps.signedups||[]), { volunteerId, role, status:'confirmed' } ])
  }

  const openRoster = async (shiftId: string) => {
    const res = await fetch('/api/shifts/' + shiftId)
    const data = await res.json()
    setDrawer({ open: true, shiftId, details: data.shift })
    try {
      const params = new URLSearchParams({ availableForShift: shiftId })
      if (trimByRequiredSkills) params.set('requireSkills', 'true')
      const [sres, avres] = await Promise.all([
        fetch('/api/skills'),
        fetch('/api/volunteers?' + params.toString())
      ])
      const sdata = await sres.json()
      setSkillOptions((sdata.skills||[]).map((s:any)=>s.name))
      const avdata = await avres.json()
      const list = (avdata.volunteers||[]).map((v:any)=>({ id: v.id, name: v.name, skills: v.skills||[] }))
      setAvailList(list)
      setAvailSet(new Set(list.map((v:any)=>v.id)))
    } catch {}
  }

  return (
    <div className="container" style={{display:'grid', gridTemplateColumns: enableDnD ? '1fr 3fr' : '1fr', gap:'1rem'}}>
      {enableDnD && (
        <div>
          <h3>Volunteers</h3>
          <div ref={volunteerPaneRef} className="sidebar" style={{maxHeight:'70vh', overflowY:'auto'}}>
            {initial.volunteers.map(v => (
              <div key={v.id} className="vol-chip" data-id={v.id} data-name={v.name} data-role={v.primarySkill||''}
                style={{background: v.familyColor || '#f7f7f7', position:'relative'}}>
                {drawer.open && (
                  <span title={availSet.has(v.id)?'Available':'Not available'} style={{ position:'absolute', top:6, right:6, width:8, height:8, borderRadius:4, background: availSet.has(v.id)?'#22c55e':'#ef4444' }} />
                )}
                <div><strong>{v.name}</strong></div>
                <div style={{fontSize:'12px'}}>{(v.skills||[]).join(', ')}</div>
                <div style={{fontSize:'11px',opacity:.7}}>Avail: {v.availSummary}</div>
              </div>
            ))}
          </div>
        </div>
      )}
      {assignModal.open && (
        <Portal>
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.35)', display:'grid', placeItems:'center', zIndex:2100 }}>
          <div style={{ background:'#fff', padding:16, borderRadius:8, width:520, maxWidth:'90vw', boxShadow:'0 10px 30px rgba(0,0,0,.2)' }}>
            <h3>Select Role</h3>
            <div style={{ marginTop:8 }}>
              <select value={assignModal.selected[0] || ''} onChange={e=>setAssignModal(am=>({ ...am, selected: e.target.value ? [e.target.value] : [] }))}>
                <option value=''>Choose role…</option>
                {assignModal.options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
              </select>
            </div>
            <div style={{ display:'flex', gap:8, marginTop:12, justifyContent:'flex-end' }}>
              <button onClick={()=>setAssignModal({ open:false, options: [], selected: [] })}>Cancel</button>
              <button onClick={async()=>{
                const role = assignModal.selected[0]
                if (assignModal.shiftId && assignModal.volunteerId) {
                  const res = await fetch('/api/shifts/'+assignModal.shiftId+'/assign',{ method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ volunteerId: assignModal.volunteerId, role }) })
                  if (!res.ok) {
                    const data = await res.json().catch(()=>({}))
                    if (data?.error === 'double_booked') showToast(`Volunteer already booked: ${data.conflict?.eventTitle || ''}`)
                    else if (data?.error === 'not_available') showToast('Volunteer not available for this shift')
                    else showToast('Assignment failed')
                  }
                }
                setAssignModal({ open:false, options: [], selected: [] })
                await onRefresh?.()
              }}>Assign</button>
            </div>
          </div>
        </div>
        </Portal>
      )}
      <div>
        <FullCalendar
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          timeZone="local"
          initialView="timeGridWeek"
          editable
          droppable={enableDnD}
          selectable
          eventReceive={handleReceive}
          dateClick={(arg:any)=>{ onPickTime?.(arg.date.toISOString()) }}
          select={(sel:any)=>{ if(!onCreate) return; const pad=(n:number)=>String(n).padStart(2,'0'); const toLocal=(d:Date)=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`; const hours=Number(defaultShiftHours)||6; const startLocal = toLocal(sel.start); const endLocal = toLocal(new Date(sel.start.getTime()+hours*60*60*1000)); setCreator({ open:true, start: startLocal, end: endLocal, title:'', category:'BUILD', description:'', projectId: defaultProjectId }) }}
          eventClick={async (arg:any)=>{ const d = arg.event.start; if(d) onPickTime?.(d.toISOString()); await openRoster(arg.event.extendedProps.shiftId) }}
          eventContent={eventContent as any}
          events={events as any}
          height="80vh"
        />
      </div>
      {creator.open && (
        <Portal>
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.3)', display:'grid', placeItems:'center', zIndex:2000 }}>
          <div style={{ background:'#fff', padding:16, borderRadius:8, width:720, maxWidth:'90vw', boxShadow:'0 10px 30px rgba(0,0,0,.2)' }}>
            <h3>Create Event + Shift</h3>
            <div style={{ display:'grid', gap:8 }}>
              <label>Start <input type='datetime-local' value={creator.start?.slice(0,16) || ''} onChange={e=>setCreator(c=>({...c, start:e.target.value}))} /></label>
              <label>End <input type='datetime-local' value={creator.end?.slice(0,16) || ''} onChange={e=>setCreator(c=>({...c, end:e.target.value}))} /></label>
              <input placeholder='Title' value={creator.title} onChange={e=>setCreator(c=>({...c, title:e.target.value}))} />
              <label>Category
                <select value={creator.category} onChange={e=>setCreator(c=>({...c, category:e.target.value}))}>
                  <option value='BUILD'>BUILD</option>
                  <option value='RESTORE'>RESTORE</option>
                  <option value='RENOVATION'>RENOVATION</option>
                </select>
              </label>
              <label>Project
                <select value={creator.projectId || ''} onChange={e=>setCreator(c=>({...c, projectId: e.target.value || undefined}))}>
                  <option value=''>—</option>
                  {(projects||[]).map((p:any)=>(<option key={p.id} value={p.id}>{p.name}</option>))}
                </select>
              </label>
              <input placeholder='Shift description (optional)' value={creator.description} onChange={e=>setCreator(c=>({...c, description:e.target.value}))} />
            </div>
            <div style={{ display:'flex', gap:8, justifyContent:'flex-end', marginTop:12 }}>
              <button onClick={()=>{ setCreator({ open:false, title:'', category:'BUILD', description:'', projectId: undefined }); onRefresh?.() }}>Cancel</button>
              <button disabled={!creator.start || !creator.end || !creator.title} onClick={async()=>{ await onCreate!({ start: creator.start!, end: creator.end!, title: creator.title, category: creator.category, description: creator.description || undefined, projectId: creator.projectId }); setCreator({ open:false, title:'', category:'BUILD', description:'', projectId: undefined }); await onRefresh?.() }}>Create</button>
            </div>
          </div>
        </div>
        </Portal>
      )}
      
      {drawer.open && drawer.details && (
        <Portal>
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.3)', display:'grid', placeItems:'center', zIndex:2000 }}>
          <div style={{ background:'#fff', padding:16, borderRadius:8, width:720, maxWidth:'90vw', maxHeight:'80vh', overflow:'auto', boxShadow:'0 10px 30px rgba(0,0,0,.2)' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <h3>Roster – {drawer.details.event?.title}</h3>
              <button onClick={async ()=>{ setDrawer({ open:false }); await onRefresh?.() }}>Close</button>
            </div>
            <div style={{ fontSize:13, opacity:.7 }}>Shift: {new Date(drawer.details.start).toLocaleString()} → {new Date(drawer.details.end).toLocaleString()}</div>
            <RequirementsInline options={skillOptions} details={drawer.details} onChanged={async()=>{ const res=await fetch('/api/shifts/'+drawer.shiftId); const parsed = await res.json(); setDrawer(d=>({ ...d!, details: parsed.shift })) }} />
            <div style={{ marginTop:12 }}>
              <div style={{ fontWeight:600, marginBottom:4 }}>Assigned</div>
              {drawer.details.signups.map((s:any)=>(
                <div key={s.id} style={{ display:'flex', alignItems:'center', gap:8, borderBottom:'1px solid #f2f2f2', padding:'6px 0' }}>
                  <span style={{ minWidth:180 }}>{s.volunteer?.name || s.volunteerId}</span>
                  <select value={s.role || ''} onChange={async(e)=>{ const role=e.target.value||null; await fetch('/api/signups/'+s.id,{ method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ role }) }); const res=await fetch('/api/shifts/'+drawer.shiftId); const parsed = await res.json(); setDrawer(d=>({ ...d!, details: parsed.shift })) }}>
                    <option value=''>Role</option>
                    {drawer.details.requirements.map((r:any)=>(<option key={r.id} value={r.skill}>{r.skill}</option>))}
                  </select>
                  <button onClick={async()=>{ if(!confirm('Remove from shift?')) return; await fetch('/api/signups/'+s.id,{ method:'DELETE' }); const res=await fetch('/api/shifts/'+drawer.shiftId); const parsed = await res.json(); setDrawer(d=>({ ...d!, details: parsed.shift }));
                    // update meter in calendar event too
                    setEvents(evts=>evts.map(ev=> ev.extendedProps.shiftId===drawer.shiftId ? ({...ev, extendedProps:{...ev.extendedProps, signedups: (ev.extendedProps.signedups||[]).filter((x:any)=>x.volunteerId!==s.volunteerId)}}) : ev))
                  }}>Remove</button>
                  <AttendanceControls shift={drawer.details} signup={s} />
                </div>
              ))}
            </div>
            <div style={{ marginTop:16 }}>
              <div style={{ fontWeight:600, marginBottom:6 }}>Available volunteers</div>
              <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
                <select value={assignForm.volunteerId} onChange={e=>setAssignForm(f=>({ ...f, volunteerId: e.target.value, roleList: f.roleList.filter(r => {
                  const v = availList.find(x=>x.id===e.target.value)
                  return !v?.skills?.length || v.skills.includes(r)
                }) }))}>
                  <option value=''>Select…</option>
                  {availList.filter(v => !(drawer.details.signups||[]).some((s:any)=>s.volunteerId===v.id)).map(v => (
                    <option key={v.id} value={v.id}>{v.name}</option>
                  ))}
                </select>
                <div style={{ minWidth:220 }}>
                  {(() => {
                    const base = Array.from(new Set([...(drawer.details.requirements||[]).map((r:any)=>r.skill)]))
                    const vol = assignForm.volunteerId ? availList.find(v=>v.id===assignForm.volunteerId) : null
                    const options = vol?.skills?.length ? base.filter(s => (vol.skills||[]).includes(s)) : base
                    return (
                      <TagMultiSelect value={assignForm.roleList} options={options} onChange={list=>setAssignForm(f=>({...f, roleList: list.slice(0,1)}))} placeholder='Role (optional)' onRequestCreate={async (label) => { const res = await fetch('/api/skills', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ name: label }) }); if (res.ok) { const data = await res.json(); return data.skill.name } }} />
                    )
                  })()}
                </div>
                <button disabled={!assignForm.volunteerId} onClick={async()=>{ if(!drawer.shiftId) return; const role = assignForm.roleList[0]; await fetch('/api/shifts/'+drawer.shiftId+'/assign',{ method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ volunteerId: assignForm.volunteerId, role }) }); const ref=await fetch('/api/shifts/'+drawer.shiftId); const parsed=await ref.json(); setDrawer(d=>({ ...d!, details: parsed.shift })); setAssignForm({ volunteerId:'', roleList: [] }) }}>Assign</button>
              </div>
            </div>
          </div>
        </div>
        </Portal>
      )}
      {/* Toasts */}
      <div style={{ position:'fixed', top:12, right:12, display:'grid', gap:8, zIndex:3000 }}>
        {toasts.map(t => (
          <div key={t.id} style={{ background:'#111', color:'#fff', padding:'8px 12px', borderRadius:6, boxShadow:'0 4px 12px rgba(0,0,0,.3)', opacity:.95 }}>
            {t.text}
          </div>
        ))}
      </div>
    </div>
  )
}

function AttendanceControls({ shift, signup }: { shift: any; signup: any }) {
  const [status, setStatus] = useState('present')
  const [hours, setHours] = useState(()=>{
    const ms = new Date(shift.end).getTime() - new Date(shift.start).getTime()
    return Math.round((ms/3600000)*100)/100
  })
  return (
    <div style={{ marginLeft:'auto', display:'flex', gap:6, alignItems:'center' }}>
      <select value={status} onChange={e=>setStatus(e.target.value)}>
        <option value='present'>present</option>
        <option value='no_show'>no_show</option>
        <option value='partial'>partial</option>
        <option value='cancelled'>cancelled</option>
      </select>
      <input type='number' step='0.25' min='0' value={hours} onChange={e=>setHours(Number(e.target.value))} style={{ width:80 }} />
      <button onClick={async()=>{ await fetch('/api/attendance',{ method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ shiftId: shift.id, volunteerId: signup.volunteerId, status, hours }) }); alert('Attendance saved') }}>Save</button>
    </div>
  )
}

function RequirementsInline({ details, onChanged, options }: { details: any; onChanged: ()=>void; options: string[] }) {
  const [skills, setSkills] = useState<string[]>([])
  const [minCount, setMin] = useState(1)
  return (
    <div style={{ marginTop:8 }}>
      <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
        {details.requirements?.map((r:any)=>(
          <span key={r.id} style={{ padding:'2px 6px', border:'1px solid #ddd', borderRadius:12, fontSize:12 }}>
            {r.skill}: {details.signups.filter((s:any)=>s.role===r.skill).length}/{r.minCount}
            {' '}<button onClick={async()=>{ const v=prompt('Set minimum count', String(r.minCount)); if(!v) return; const n=Number(v); if(Number.isNaN(n)) return; await fetch('/api/requirements/'+r.id,{ method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ minCount:n }) }); onChanged() }}>✎</button>
            {' '}<button onClick={async()=>{ if(!confirm('Delete requirement?')) return; await fetch('/api/requirements/'+r.id,{ method:'DELETE' }); onChanged() }}>×</button>
          </span>
        ))}
      </div>
      <div style={{ display:'flex', gap:6, alignItems:'center', marginTop:8 }}>
        <div style={{ minWidth:260 }}><TagMultiSelect value={skills} options={options} onChange={setSkills} placeholder='Skills' onRequestCreate={async (label) => { const res = await fetch('/api/skills', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ name: label }) }); if (res.ok) { const data = await res.json(); return data.skill.name } }} /></div>
        <input type='number' min={1} style={{ width:80 }} value={minCount} onChange={e=>setMin(Number(e.target.value))} />
        <button disabled={!skills.length} onClick={async()=>{ for (const s of skills) { await fetch('/api/shifts/'+details.id+'/requirements',{ method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ skill: s, minCount }) }) } setSkills([]); setMin(1); onChanged() }}>Add</button>
      </div>
    </div>
  )
}
