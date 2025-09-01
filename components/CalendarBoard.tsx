
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

export default function CalendarBoard({ initial }: { initial: { events: EventItem[]; volunteers: Volunteer[] } }) {
  const [events, setEvents] = useState<EventItem[]>(initial.events)
  const volunteerPaneRef = useRef<HTMLDivElement>(null)

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
    await fetch('/api/shifts/'+shiftId+'/assign', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ volunteerId, role })
    })
    info.event.setExtendedProp('signedups', [
      ...(info.event.extendedProps.signedups||[]),
      { volunteerId, role, status:'confirmed' }
    ])
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
          eventReceive={handleReceive}
          eventContent={eventContent as any}
          events={events as any}
          height="80vh"
        />
      </div>
    </div>
  )
}
