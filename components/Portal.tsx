import { ReactNode, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

export default function Portal({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true); return () => setMounted(false) }, [])
  if (!mounted) return null
  const root = document.body
  return createPortal(children, root)
}

