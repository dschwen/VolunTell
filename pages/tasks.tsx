import { useEffect, useMemo, useState } from 'react'

type Task = { id: string; type: string; status: string; notes?: string; dueDate?: string; volunteer?: { id: string; name: string; email?: string; phone?: string } }
type Requirement = { skill: string; minCount: number }
type Signup = { role?: string; status: string }
type Shift = { id: string; start: string; end: string; requirements: Requirement[]; signups: Signup[]; event?: { id: string; title: string } }
type EventItem = { id: string; title: string; start: string; end: string; shifts: Shift[] }

export default function TasksPage() {
  const [loading, setLoading] = useState(false)
  const [tasks, setTasks] = useState<Task[]>([])
  const [rangeFrom, setFrom] = useState<string>(()=>new Date().toISOString().slice(0,10))
  const [rangeTo, setTo] = useState<string>(()=>new Date(Date.now()+14*24*3600*1000).toISOString().slice(0,10))
  const [events, setEvents] = useState<EventItem[]>([])
  const [contactModal, setContactModal] = useState<{ open: boolean; volunteerId?: string; when: string; method: 'phone'|'email'|'other'; comments: string; closeTaskId?: string }>({ open:false, when:'', method:'phone', comments:'' })

  useEffect(() => { refresh() }, [])

  async function refresh() {
    setLoading(true)
    try {
      const fromIso = new Date(rangeFrom).toISOString()
      const dt = new Date(rangeTo); dt.setHours(23,59,59,999)
      const toIso = dt.toISOString()
      const [tres, eres] = await Promise.all([
        fetch('/api/tasks?status=open&type=followup'),
        fetch(`/api/events?from=${encodeURIComponent(fromIso)}&to=${encodeURIComponent(toIso)}`)
      ])
      const tdata = await tres.json(); const edata = await eres.json()
      setTasks(tdata.tasks || [])
      setEvents(edata.events || [])
    } finally { setLoading(false) }
  }

  const underfilled = useMemo(() => {
    const items: { shift: Shift; deficits: { skill: string; need: number; have: number }[] }[] = []
    for (const ev of events) {
      for (const sh of ev.shifts || []) {
        const deficits: { skill: string; need: number; have: number }[] = []
        for (const r of sh.requirements || []) {
          const have = (sh.signups || []).filter(s => s.role === r.skill).length
          if (have < r.minCount) deficits.push({ skill: r.skill, need: r.minCount, have })
        }
        if (deficits.length) items.push({ shift: { ...sh, event: { id: ev.id, title: ev.title } }, deficits })
      }
    }
    // sort soonest first
    return items.sort((a,b)=> new Date(a.shift.start).getTime() - new Date(b.shift.start).getTime())
  }, [events])

  function openLogContact(vId: string, closeTaskId?: string) {
    const now = new Date()
    const pad = (n:number)=>String(n).padStart(2,'0')
    const local = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`
    setContactModal({ open:true, volunteerId: vId, when: local, method:'phone', comments:'', closeTaskId })
  }

  return (
    <div>
      <h1>Tasks</h1>
      <div style={{ display:'flex', gap:12, alignItems:'center', flexWrap:'wrap', margin:'8px 0' }}>
        <label>From <input type='date' value={rangeFrom} onChange={e=>setFrom(e.target.value)} /></label>
        <label>To <input type='date' value={rangeTo} onChange={e=>setTo(e.target.value)} /></label>
        <button onClick={refresh} disabled={loading}>Refresh</button>
      </div>

      <section style={{ marginTop:12 }}>
        <h3>Contact follow‑ups</h3>
        <table width='100%' cellPadding={6} style={{ borderCollapse:'collapse' }}>
          <thead><tr style={{ textAlign:'left', borderBottom:'1px solid #eee' }}><th>Volunteer</th><th>Contact</th><th>Notes</th><th></th></tr></thead>
          <tbody>
            {tasks.map(t => (
              <tr key={t.id} style={{ borderBottom:'1px solid #f5f5f5' }}>
                <td>{t.volunteer?.name || t.volunteer?.id}</td>
                <td>{t.volunteer?.email || '—'}{t.volunteer?.phone?` / ${t.volunteer.phone}`:''}</td>
                <td>{t.notes || '—'}</td>
                <td style={{ textAlign:'right', display:'flex', gap:6, justifyContent:'flex-end' }}>
                  <button onClick={()=>openLogContact(t.volunteer?.id!, t.id)}>Log + Done</button>
                  <button onClick={async()=>{ await fetch('/api/tasks/'+t.id,{ method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ status:'done' }) }); await refresh() }}>Done</button>
                </td>
              </tr>
            ))}
            {!tasks.length && (<tr><td colSpan={4} style={{ opacity:.7 }}>No follow‑ups.</td></tr>)}
          </tbody>
        </table>
      </section>

      <section style={{ marginTop:16 }}>
        <h3>Underfilled shifts</h3>
        <table width='100%' cellPadding={6} style={{ borderCollapse:'collapse' }}>
          <thead><tr style={{ textAlign:'left', borderBottom:'1px solid #eee' }}><th>When</th><th>Event</th><th>Deficits</th><th></th></tr></thead>
          <tbody>
            {underfilled.map(item => (
              <tr key={item.shift.id} style={{ borderBottom:'1px solid #f5f5f5' }}>
                <td>{new Date(item.shift.start).toLocaleString()} → {new Date(item.shift.end).toLocaleString()}</td>
                <td>{item.shift.event?.title || '—'}</td>
                <td>
                  {item.deficits.map(d => (
                    <span key={d.skill} style={{ padding:'2px 6px', border:'1px solid #eee', borderRadius:12, marginRight:6, display:'inline-block' }}>
                      {d.skill}: {d.have}/{d.minCount}
                    </span>
                  ))}
                </td>
                <td style={{ textAlign:'right' }}>
                  <a href='/events'><button>Open Events</button></a>
                </td>
              </tr>
            ))}
            {!underfilled.length && (<tr><td colSpan={4} style={{ opacity:.7 }}>All shifts meet requirements in the selected range.</td></tr>)}
          </tbody>
        </table>
      </section>

      {contactModal.open && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.35)', display:'grid', placeItems:'center', zIndex:3000 }}>
          <div style={{ background:'#fff', padding:16, borderRadius:8, width:520, maxWidth:'90vw' }}>
            <h3>Log contact</h3>
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
                if (!contactModal.volunteerId) return
                const body = { method: contactModal.method, at: new Date(contactModal.when).toISOString(), comments: contactModal.comments || undefined }
                await fetch(`/api/volunteers/${contactModal.volunteerId}/contacts`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) })
                if (contactModal.closeTaskId) {
                  await fetch('/api/tasks/'+contactModal.closeTaskId, { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ status:'done' }) })
                }
                setContactModal({ open:false, when:'', method:'phone', comments:'' })
                await refresh()
              }}>Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

