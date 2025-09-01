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
  const availMatch = availability.some(a => a.weekday === weekday && windowsOverlap(startTime, endTime, a.startTime, a.endTime))
  if (!availMatch) return false
  const blocked = blackouts.some(b => {
    if (b.weekday == null) return false
    if (b.weekday !== weekday) return false
    return windowsOverlap(startTime, endTime, b.startTime, b.endTime)
  })
  return !blocked
}

