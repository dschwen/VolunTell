import { Availability, Blackout } from '@prisma/client'

function toMinutes(t: string) {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

export function isTimeInWindow(time: string, start: string, end: string) {
  const x = toMinutes(time), s = toMinutes(start), e = toMinutes(end)
  return x >= s && x <= e
}

export function windowsOverlap(startA: string, endA: string, startB: string, endB: string) {
  const a1 = toMinutes(startA), a2 = toMinutes(endA)
  const b1 = toMinutes(startB), b2 = toMinutes(endB)
  return a1 <= b2 && b1 <= a2
}

export function availableOnWeekday(
  weekday: number,
  startTime: string,
  endTime: string,
  availability: Availability[],
  blackouts: Blackout[]
) {
  // If no availability windows are set, treat as available by default
  const hasWindows = availability && availability.length > 0
  const availMatch = hasWindows
    ? availability.some(a => a.weekday === weekday && windowsOverlap(startTime, endTime, a.startTime, a.endTime))
    : true
  if (!availMatch) return false
  const blocked = blackouts.some(b => {
    if (b.weekday == null) return false
    if (b.weekday !== weekday) return false
    return windowsOverlap(startTime, endTime, b.startTime, b.endTime)
  })
  return !blocked
}

// Check availability for a specific date range (UTC-based comparison)
export function availableForRange(
  start: Date,
  end: Date,
  availability: Availability[],
  blackouts: Blackout[]
) {
  // Use local wall time for comparisons to align with how users enter availability/blackouts
  const weekday = start.getDay()
  const toHHMM = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  const startTime = toHHMM(start)
  const endTime = toHHMM(end)

  const toLocalYMD = (d: Date) => {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  }

  // Specific-date blackouts
  const startYMD = toLocalYMD(start)
  const hasDateBlackout = blackouts.some(b => b.date && toLocalYMD(b.date) === startYMD && windowsOverlap(startTime, endTime, b.startTime, b.endTime))
  if (hasDateBlackout) return false

  return availableOnWeekday(weekday, startTime, endTime, availability, blackouts)
}
