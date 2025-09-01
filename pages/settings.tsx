import { useEffect, useState } from 'react'

type Skill = { id: string; name: string }

export default function SettingsPage() {
  const [skills, setSkills] = useState<Skill[]>([])
  const [newSkill, setNewSkill] = useState('')
  const [defaultHours, setDefaultHours] = useState<number>(6)
  const [trimByRequiredSkills, setTrimByRequiredSkills] = useState<boolean>(false)
  const [allowUtcLegacy, setAllowUtcLegacy] = useState<boolean>(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => { refresh() }, [])

  async function refresh() {
    setLoading(true)
    const [sRes, setRes] = await Promise.all([
      fetch('/api/skills'),
      fetch('/api/settings?keys=defaultShiftHours,requireSkillsForAvailability,allowUtcLegacyAvailability')
    ])
    const sData = await sRes.json(); const stData = await setRes.json()
    setSkills(sData.skills || [])
    const v = Number(stData.settings?.defaultShiftHours || '6')
    setDefaultHours(Number.isFinite(v) && v > 0 ? v : 6)
    setTrimByRequiredSkills((stData.settings?.requireSkillsForAvailability || 'false') === 'true')
    setAllowUtcLegacy((stData.settings?.allowUtcLegacyAvailability || 'false') === 'true')
    setLoading(false)
  }

  async function addSkill() {
    if (!newSkill.trim()) return
    const res = await fetch('/api/skills', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ name: newSkill.trim() }) })
    if (!res.ok) { alert('Failed to add skill'); return }
    setNewSkill(''); refresh()
  }
  async function removeSkill(id: string) {
    if (!confirm('Delete skill?')) return
    await fetch('/api/skills/'+id, { method:'DELETE' })
    refresh()
  }
  async function saveDefaultHours() {
    await fetch('/api/settings', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ defaultShiftHours: String(defaultHours) }) })
    alert('Saved')
  }
  async function saveAvailabilityTrim() {
    await fetch('/api/settings', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ requireSkillsForAvailability: trimByRequiredSkills ? 'true' : 'false' }) })
    alert('Saved')
  }
  async function saveUtcLegacy() {
    await fetch('/api/settings', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ allowUtcLegacyAvailability: allowUtcLegacy ? 'true' : 'false' }) })
    alert('Saved')
  }

  return (
    <div>
      <h1>Settings</h1>
      <div style={{ display:'grid', gap:16, maxWidth:800 }}>
        <section>
          <h3>Default Shift Length</h3>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <input type='number' min={1} max={12} step={1} value={defaultHours} onChange={e=>setDefaultHours(Number(e.target.value)||6)} />
            <span>hours</span>
            <button onClick={saveDefaultHours} disabled={loading}>Save</button>
          </div>
          <div style={{ fontSize:12, opacity:.7 }}>Used when creating shifts from calendar selection.</div>
        </section>
        <section>
          <h3>Available Skills</h3>
          <div style={{ display:'flex', gap:8, alignItems:'center', marginBottom:8 }}>
            <input placeholder='New skill' value={newSkill} onChange={e=>setNewSkill(e.target.value)} />
            <button onClick={addSkill}>Add</button>
          </div>
          <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
            {skills.map(s => (
              <span key={s.id} style={{ padding:'4px 8px', border:'1px solid #ddd', borderRadius:12 }}>
                {s.name} <button onClick={()=>removeSkill(s.id)}>×</button>
              </span>
            ))}
          </div>
        </section>
        <section>
          <h3>Availability Compatibility</h3>
          <label style={{ display:'flex', alignItems:'center', gap:8 }}>
            <input type='checkbox' checked={allowUtcLegacy} onChange={e=>setAllowUtcLegacy(e.target.checked)} />
            Allow legacy UTC availability fallback
          </label>
          <div style={{ fontSize:12, opacity:.7, marginTop:4 }}>If early data was saved with UTC weekdays, enabling this treats those windows as valid when local checks fail.</div>
          <div style={{ marginTop:8 }}>
            <button onClick={saveUtcLegacy} disabled={loading}>Save</button>
          </div>
        </section>
        <section>
          <h3>Available List Behavior</h3>
          <label style={{ display:'flex', alignItems:'center', gap:8 }}>
            <input type='checkbox' checked={trimByRequiredSkills} onChange={e=>setTrimByRequiredSkills(e.target.checked)} />
            Only show volunteers with at least one required skill
          </label>
          <div style={{ marginTop:8 }}>
            <button onClick={saveAvailabilityTrim} disabled={loading}>Save</button>
          </div>
          <div style={{ fontSize:12, opacity:.7 }}>Affects the “Available volunteers” lists in Calendar and Events.</div>
        </section>
      </div>
    </div>
  )
}
