import { useEffect, useState } from 'react'

type Project = { id: string; name: string; colorTag?: string; notes?: string }

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(false)
  const [modal, setModal] = useState<{ open: boolean; editing?: Project }>({ open: false })
  const [form, setForm] = useState({ name: '', colorTag: '', notes: '' })

  useEffect(() => { refresh() }, [])

  async function refresh() {
    setLoading(true)
    const res = await fetch('/api/projects')
    const data = await res.json()
    setProjects(data.projects || [])
    setLoading(false)
  }

  function openAdd() { setForm({ name:'', colorTag:'', notes:'' }); setModal({ open:true }) }
  function openEdit(p: Project) {
    setForm({ name: p.name, colorTag: p.colorTag || '', notes: p.notes || '' })
    setModal({ open: true, editing: p })
  }
  async function submit() {
    if (!modal.editing) {
      await fetch('/api/projects', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(form) })
    } else {
      await fetch('/api/projects/'+modal.editing.id, { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify(form) })
    }
    setModal({ open:false })
    await refresh()
  }
  async function remove(p: Project) {
    if (!confirm(`Delete project "${p.name}"? This cannot be undone.`)) return
    await fetch('/api/projects/'+p.id, { method:'DELETE' })
    await refresh()
  }

  return (
    <div>
      <h1>Projects</h1>
      <div style={{ display:'flex', gap:8, margin:'8px 0' }}>
        <button onClick={refresh} disabled={loading}>Refresh</button>
        <button onClick={openAdd}>Add Project</button>
      </div>
      <table width="100%" cellPadding={6} style={{ borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ textAlign:'left', borderBottom:'1px solid #eee' }}>
            <th>Name</th><th>Color</th><th>Notes</th><th></th>
          </tr>
        </thead>
        <tbody>
          {projects.map(p => (
            <tr key={p.id} style={{ borderBottom:'1px solid #f2f2f2' }}>
              <td>{p.name}</td>
              <td><span style={{display:'inline-block',width:12,height:12,background:p.colorTag||'#ddd',border:'1px solid #ccc',verticalAlign:'middle',marginRight:6}}/> {p.colorTag}</td>
              <td>{p.notes}</td>
              <td style={{ textAlign:'right' }}>
                <button onClick={() => openEdit(p)}>Edit</button>{' '}
                <button onClick={() => remove(p)}>Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {modal.open && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.3)', display:'grid', placeItems:'center' }}>
          <div style={{ background:'#fff', padding:16, borderRadius:8, width:420 }}>
            <h3>{modal.editing ? 'Edit Project' : 'Add Project'}</h3>
            <div style={{ display:'grid', gap:8, marginTop:8 }}>
              <input placeholder="Name" value={form.name} onChange={e=>setForm({...form, name:e.target.value})} />
              <input placeholder="Color #hex" value={form.colorTag} onChange={e=>setForm({...form, colorTag:e.target.value})} />
              <textarea placeholder="Notes" value={form.notes} onChange={e=>setForm({...form, notes:e.target.value})} />
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

