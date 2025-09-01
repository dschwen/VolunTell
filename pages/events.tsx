import { useEffect, useMemo, useState } from 'react'

type Project = { id: string; name: string }
type Event = { id: string; title: string; start: string; end: string; category: string; projectId?: string; project?: Project }

export default function EventsPage() {
  const [events, setEvents] = useState<Event[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [filters, setFilters] = useState<{projectId?: string; category?: string}>({})
  const [loading, setLoading] = useState(false)
  const [modal, setModal] = useState<{ open: boolean; editing?: Event }>({ open: false })
  const [form, setForm] = useState<{ title: string; start: string; end: string; category: string; projectId?: string; location?: string; notes?: string }>(
    { title:'', start:'', end:'', category:'BUILD' }
  )

  useEffect(() => { refresh(); fetchProjects() }, [])
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
  function openAdd() { setForm({ title:'', start:'', end:'', category:'BUILD', projectId: filters.projectId }); setModal({ open:true }) }
  function openEdit(ev: Event) {
    setForm({ title: ev.title, start: ev.start.slice(0,16), end: ev.end.slice(0,16), category: ev.category, projectId: ev.projectId })
    setModal({ open: true, editing: ev })
  }
  async function submit() {
    const payload = { ...form, start: form.start, end: form.end }
    if (!modal.editing) {
      await fetch('/api/events', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) })
    } else {
      await fetch('/api/events/'+modal.editing.id, { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) })
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

      {modal.open && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.3)', display:'grid', placeItems:'center' }}>
          <div style={{ background:'#fff', padding:16, borderRadius:8, width:520 }}>
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

