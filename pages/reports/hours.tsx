import { useState } from 'react'

export default function HoursReportPage() {
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const url = '/api/reports/hours' + (from || to ? ('?' + new URLSearchParams({ ...(from?{from:new Date(from).toISOString()}:{}), ...(to?{to:new Date(to).toISOString()}:{}), }).toString()) : '')
  return (
    <div>
      <h1>Hours Report</h1>
      <div style={{ display:'flex', gap:8, alignItems:'center' }}>
        <label>From <input type='date' value={from} onChange={e=>setFrom(e.target.value)} /></label>
        <label>To <input type='date' value={to} onChange={e=>setTo(e.target.value)} /></label>
        <a href={url}><button>Download CSV</button></a>
      </div>
    </div>
  )
}

