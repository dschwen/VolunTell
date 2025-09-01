
import { useEffect, useMemo, useState } from 'react'
import CalendarBoard from '../components/CalendarBoard'

type Project = { id: string; name: string }

export default function CalendarPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [filters, setFilters] = useState<{ projectId?: string; category?: string; onlyAvail?: boolean; at?: string }>({ onlyAvail: false, at: '' })
  const [initial, setInitial] = useState({ events: [], volunteers: [] } as any)
  const categories = ['BUILD','RESTORE','RENOVATION']

  useEffect(() => { fetchProjects() }, [])
  useEffect(() => { refresh() }, [filters.projectId, filters.category])

  async function fetchProjects() {
    const res = await fetch('/api/projects')
    const data = await res.json()
    setProjects(data.projects || [])
  }

  function mapToCalendar(events: any[]) {
    const out: any[] = []
    for (const ev of events) {
      for (const sh of (ev.shifts || [])) {
        out.push({
          id: sh.id,
          title: ev.title,
          start: sh.start,
          end: sh.end,
          extendedProps: {
            shiftId: sh.id,
            requirements: (sh.requirements || []).map((r: any) => ({ skill: r.skill, minCount: r.minCount })),
            signedups: (sh.signups || []).map((s: any) => ({ volunteerId: s.volunteerId, role: s.role, status: s.status }))
          }
        })
      }
    }
    return out
  }

  async function refresh() {
    const params = new URLSearchParams()
    if (filters.projectId) params.set('projectId', filters.projectId)
    if (filters.category) params.set('category', filters.category)
    const [evRes, volRes] = await Promise.all([
      fetch('/api/events?'+params.toString()),
      fetch('/api/volunteers?'+new URLSearchParams({ active:'true', ...(filters.onlyAvail && filters.at ? { availableAt: new Date(filters.at).toISOString() } : {}) as any }))
    ])
    const evData = await evRes.json()
    const volData = await volRes.json()
    setInitial({ events: mapToCalendar(evData.events || []), volunteers: (volData.volunteers || []).map((v:any)=>({ id:v.id, name:v.name, skills:v.skills })) })
  }

  const Controls = useMemo(() => (
    <div style={{ display:'flex', gap:8, marginBottom:8, flexWrap:'wrap' }}>
      <select value={filters.projectId || ''} onChange={e=>setFilters(f=>({...f, projectId: e.target.value || undefined}))}>
        <option value=''>All Projects</option>
        {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
      </select>
      <select value={filters.category || ''} onChange={e=>setFilters(f=>({...f, category: e.target.value || undefined}))}>
        <option value=''>All Categories</option>
        {categories.map(c => <option key={c} value={c}>{c}</option>)}
      </select>
      <label style={{ display:'flex', alignItems:'center', gap:6 }}>
        <input type='checkbox' checked={!!filters.onlyAvail} onChange={e=>setFilters(f=>({ ...f, onlyAvail: e.target.checked }))} /> Only show available at
        <input type='datetime-local' value={filters.at || ''} onChange={e=>setFilters(f=>({ ...f, at: e.target.value }))} />
      </label>
      <button onClick={refresh}>Refresh</button>
    </div>
  ), [filters, projects])

  return (
    <div>
      {Controls}
      <CalendarBoard initial={initial} />
    </div>
  )
}
