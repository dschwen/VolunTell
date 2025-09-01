
import FullCalendar from '@fullcalendar/react'
import timeGridPlugin from '@fullcalendar/timegrid'
import dayGridPlugin from '@fullcalendar/daygrid'
import interactionPlugin, { Draggable } from '@fullcalendar/interaction'
import { useEffect, useRef, useState } from 'react'

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

export default function CalendarBoard({ initial, onPickTime, onCreate }: { initial: { events: EventItem[]; volunteers: Volunteer[] }, onPickTime?: (iso: string) => void, onCreate?: (opts: { start: string; end: string; title: string; category: string; description?: string }) => Promise<void> }) {
  const [events, setEvents] = useState<EventItem[]>(initial.events)
  const volunteerPaneRef = useRef<HTMLDivElement>(null)
  const [drawer, setDrawer] = useState<{ open: boolean; shiftId?: string; details?: any }>({ open: false })
  const [creator, setCreator] = useState<{ open: boolean; start?: string; end?: string; title: string; category: string; description: string }>({ open:false, title:'', category:'BUILD', description:'' })

  useEffect(() => {
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
  }, [])

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
    const shiftId = info.event.extendedProps.shiftId
    const res = await fetch('/api/shifts/'+shiftId+'/assign', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ volunteerId, role })
    })
    if (!res.ok) {
      const data = await res.json().catch(()=>({}))
      alert(data?.error === 'double_booked' ? `Volunteer already booked: ${data.conflict?.eventTitle}` : 'Assignment failed')
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
  }

  return (
    <div className="container" style={{display:'grid', gridTemplateColumns:'1fr 3fr', gap:'1rem'}}>
      <div>
        <h3>Volunteers</h3>
        <div ref={volunteerPaneRef} className="sidebar" style={{maxHeight:'70vh', overflowY:'auto'}}>
          {initial.volunteers.map(v => (
            <div key={v.id} className="vol-chip" data-id={v.id} data-name={v.name} data-role={v.primarySkill||''}
              style={{background: v.familyColor || '#f7f7f7'}}>
              <div><strong>{v.name}</strong></div>
              <div style={{fontSize:'12px'}}>{(v.skills||[]).join(', ')}</div>
              <div style={{fontSize:'11px',opacity:.7}}>Avail: {v.availSummary}</div>
            </div>
          ))}
        </div>
      </div>
      <div>
        <FullCalendar
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView="timeGridWeek"
          editable
          droppable
          selectable
          eventReceive={handleReceive}
          dateClick={(arg:any)=>{ onPickTime?.(arg.date.toISOString()) }}
          select={(sel:any)=>{ if(!onCreate) return; setCreator({ open:true, start: sel.startStr, end: sel.endStr, title:'', category:'BUILD', description:'' }) }}
          eventClick={async (arg:any)=>{ const d = arg.event.start; if(d) onPickTime?.(d.toISOString()); await openRoster(arg.event.extendedProps.shiftId) }}
          eventContent={eventContent as any}
          events={events as any}
          height="80vh"
        />
      </div>
      {creator.open && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.3)', display:'grid', placeItems:'center' }}>
          <div style={{ background:'#fff', padding:16, borderRadius:8, width:520 }}>
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
              <input placeholder='Shift description (optional)' value={creator.description} onChange={e=>setCreator(c=>({...c, description:e.target.value}))} />
            </div>
            <div style={{ display:'flex', gap:8, justifyContent:'flex-end', marginTop:12 }}>
              <button onClick={()=>setCreator({ open:false, title:'', category:'BUILD', description:'' })}>Cancel</button>
              <button disabled={!creator.start || !creator.end || !creator.title} onClick={async()=>{ await onCreate!({ start: creator.start!, end: creator.end!, title: creator.title, category: creator.category, description: creator.description || undefined }); setCreator({ open:false, title:'', category:'BUILD', description:'' }) }}>Create</button>
            </div>
          </div>
        </div>
      )}
      
      {drawer.open && drawer.details && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.3)', display:'grid', placeItems:'center' }}>
          <div style={{ background:'#fff', padding:16, borderRadius:8, width:560, maxHeight:'80vh', overflow:'auto' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <h3>Roster – {drawer.details.event?.title}</h3>
              <button onClick={()=>setDrawer({ open:false })}>Close</button>
            </div>
            <div style={{ fontSize:13, opacity:.7 }}>Shift: {new Date(drawer.details.start).toLocaleString()} → {new Date(drawer.details.end).toLocaleString()}</div>
            <RequirementsInline details={drawer.details} onChanged={async()=>{ const res=await fetch('/api/shifts/'+drawer.shiftId); setDrawer(d=>({ ...d!, details: (await res.json()).shift })) }} />
            <div style={{ marginTop:12 }}>
              <div style={{ fontWeight:600, marginBottom:4 }}>Assigned</div>
              {drawer.details.signups.map((s:any)=>(
                <div key={s.id} style={{ display:'flex', alignItems:'center', gap:8, borderBottom:'1px solid #f2f2f2', padding:'6px 0' }}>
                  <span style={{ minWidth:180 }}>{s.volunteer?.name || s.volunteerId}</span>
                  <select value={s.role || ''} onChange={async(e)=>{ const role=e.target.value||null; await fetch('/api/signups/'+s.id,{ method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ role }) }); const res=await fetch('/api/shifts/'+drawer.shiftId); setDrawer(d=>({ ...d!, details: (await res.json()).shift })) }}>
                    <option value=''>Role</option>
                    {drawer.details.requirements.map((r:any)=>(<option key={r.id} value={r.skill}>{r.skill}</option>))}
                  </select>
                  <button onClick={async()=>{ if(!confirm('Remove from shift?')) return; await fetch('/api/signups/'+s.id,{ method:'DELETE' }); const res=await fetch('/api/shifts/'+drawer.shiftId); setDrawer(d=>({ ...d!, details: (await res.json()).shift }));
                    // update meter in calendar event too
                    setEvents(evts=>evts.map(ev=> ev.extendedProps.shiftId===drawer.shiftId ? ({...ev, extendedProps:{...ev.extendedProps, signedups: (ev.extendedProps.signedups||[]).filter((x:any)=>x.volunteerId!==s.volunteerId)}}) : ev))
                  }}>Remove</button>
                  <AttendanceControls shift={drawer.details} signup={s} />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
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

function RequirementsInline({ details, onChanged }: { details: any; onChanged: ()=>void }) {
  const [skill, setSkill] = useState('')
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
        <input placeholder='Skill' value={skill} onChange={e=>setSkill(e.target.value)} />
        <input type='number' min={1} style={{ width:80 }} value={minCount} onChange={e=>setMin(Number(e.target.value))} />
        <button disabled={!skill} onClick={async()=>{ await fetch('/api/shifts/'+details.id+'/requirements',{ method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ skill, minCount }) }); setSkill(''); setMin(1); onChanged() }}>Add</button>
      </div>
    </div>
  )
}
