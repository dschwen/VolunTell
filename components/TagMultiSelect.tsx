import { useEffect, useMemo, useRef, useState } from 'react'

type Props = {
  value: string[]
  options?: string[]
  placeholder?: string
  onChange: (next: string[]) => void
}

export default function TagMultiSelect({ value, options = [], placeholder, onChange }: Props) {
  const [input, setInput] = useState('')
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onDoc = (e: MouseEvent) => { if (!ref.current?.contains(e.target as any)) setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const normalized = useMemo(() => new Set(value.map(v => v.trim()).filter(Boolean)), [value])
  const add = (s: string) => {
    const v = s.trim()
    if (!v) return
    if (normalized.has(v)) return
    onChange([ ...value, v ])
    setInput('')
    setOpen(false)
  }
  const del = (s: string) => onChange(value.filter(v => v !== s))

  const filtered = useMemo(() => {
    const q = input.toLowerCase().trim()
    return options.filter(o => !normalized.has(o) && (!q || o.toLowerCase().includes(q))).slice(0, 8)
  }, [options, normalized, input])

  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault(); add(input)
    } else if (e.key === 'Backspace' && !input && value.length) {
      del(value[value.length - 1])
    }
  }

  return (
    <div ref={ref} style={{ border:'1px solid #ddd', borderRadius:8, padding:6 }}>
      <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
        {value.map(v => (
          <span key={v} style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'2px 6px', border:'1px solid #ddd', borderRadius:12, fontSize:12 }}>
            {v}
            <button aria-label={`remove ${v}`} onClick={()=>del(v)} style={{ border:'none', background:'transparent', cursor:'pointer' }}>×</button>
          </span>
        ))}
        <input
          value={input}
          onChange={e=>{ setInput(e.target.value); setOpen(true) }}
          onKeyDown={onKey}
          onFocus={()=>setOpen(true)}
          placeholder={placeholder || 'Add…'}
          style={{ flex:'1 1 160px', minWidth:120, border:'none', outline:'none' }}
        />
      </div>
      {open && filtered.length > 0 && (
        <div style={{ position:'absolute', background:'#fff', border:'1px solid #eee', boxShadow:'0 4px 16px rgba(0,0,0,.08)', marginTop:4, borderRadius:8, zIndex:10 }}>
          {filtered.map(opt => (
            <div key={opt} style={{ padding:'6px 10px', cursor:'pointer' }} onMouseDown={e=>e.preventDefault()} onClick={()=>add(opt)}>
              {opt}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

