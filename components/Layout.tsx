import Link from 'next/link'
import { useRouter } from 'next/router'
import { ReactNode } from 'react'

const tabs = [
  { href: '/', label: 'Calendar' },
  { href: '/events', label: 'Events' },
  { href: '/projects', label: 'Projects' },
  { href: '/volunteers', label: 'Volunteers' }
]

export default function Layout({ children }: { children: ReactNode }) {
  const router = useRouter()
  return (
    <div style={{ minHeight: '100%' }}>
      <nav style={{ borderBottom: '1px solid #e5e7eb', padding: '8px 16px' }}>
        <div className="container" style={{ display: 'flex', gap: '12px' }}>
          {tabs.map((t) => {
            const active = router.pathname === t.href
            return (
              <Link key={t.href} href={t.href} legacyBehavior>
                <a style={{
                  padding: '6px 10px',
                  borderRadius: 6,
                  textDecoration: 'none',
                  background: active ? '#eef2ff' : 'transparent',
                  color: active ? '#1f2937' : '#374151',
                  border: active ? '1px solid #c7d2fe' : '1px solid transparent'
                }}>{t.label}</a>
              </Link>
            )
          })}
        </div>
      </nav>
      <main className="container" style={{ paddingTop: 16 }}>{children}</main>
    </div>
  )
}

