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

  // Normalize potential wrap-around by mapping to linear time and checking both base and +24h offsets
  const norm = (s: number, e: number) => e >= s ? [s, e] as const : [s, e + 1440] as const
  const [na1, na2] = norm(a1, a2)
  const [nb1, nb2] = norm(b1, b2)

  const overlap = (x1: number, x2: number, y1: number, y2: number) => x1 <= y2 && y1 <= x2
  // Check base and shifted version of B (to account for cross-midnight comparisons)
  return overlap(na1, na2, nb1, nb2) || overlap(na1, na2, nb1 + 1440, nb2 + 1440)
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
  const weekdayStart = start.getDay()
  const weekdayEnd = end.getDay()
  const toHHMM = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  const startTime = toHHMM(start)
  const endTime = toHHMM(end)

  const toLocalYMD = (d: Date) => {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  }
  const startYMD = toLocalYMD(start)
  const endYMD = toLocalYMD(end)

  // If shift is within the same local day
  if (startYMD === endYMD) {
    // Specific-date blackouts on that date
    const hasDateBlackout = blackouts.some(b => b.date && toLocalYMD(b.date) === startYMD && windowsOverlap(startTime, endTime, b.startTime, b.endTime))
    if (hasDateBlackout) return false
    return availableOnWeekday(weekdayStart, startTime, endTime, availability, blackouts)
  }

  // Shift crosses midnight: consider two segments
  const seg1Start = startTime
  const seg1End = '23:59'
  const seg2Start = '00:00'
  const seg2End = endTime

  // Any blackout overlapping either segment blocks availability
  const hasBlackoutStartDate = blackouts.some(b => b.date && toLocalYMD(b.date) === startYMD && windowsOverlap(seg1Start, seg1End, b.startTime, b.endTime))
  const hasBlackoutEndDate = blackouts.some(b => b.date && toLocalYMD(b.date) === endYMD && windowsOverlap(seg2Start, seg2End, b.startTime, b.endTime))
  if (hasBlackoutStartDate || hasBlackoutEndDate) return false

  // For overlap semantics, being available for either segment counts as available
  const availSeg1 = availableOnWeekday(weekdayStart, seg1Start, seg1End, availability, blackouts)
  const availSeg2 = availableOnWeekday(weekdayEnd, seg2Start, seg2End, availability, blackouts)
  return availSeg1 || availSeg2
}

// Legacy UTC-based availability check for pre-migration data
export function availableForRangeUTC(
  start: Date,
  end: Date,
  availability: Availability[],
  blackouts: Blackout[]
) {
  const weekday = start.getUTCDay()
  const toHHMM = (d: Date) => `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`
  const startTime = toHHMM(start)
  const endTime = toHHMM(end)

  // Specific-date blackouts using UTC date string comparison
  const startYMD = start.toISOString().slice(0, 10)
  const hasDateBlackout = blackouts.some(b => b.date && b.date.toISOString().slice(0,10) === startYMD && windowsOverlap(startTime, endTime, b.startTime, b.endTime))
  if (hasDateBlackout) return false

  return availableOnWeekday(weekday, startTime, endTime, availability, blackouts)
}

// Detailed availability check with reasons for debugging
export function availabilityDebugForRange(
  start: Date,
  end: Date,
  availability: Availability[],
  blackouts: Blackout[]
) {
  const weekday = start.getDay()
  const utcWeekday = start.getUTCDay()
  const hhmm = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  const hhmmUTC = (d: Date) => `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`
  const startTime = hhmm(start)
  const endTime = hhmm(end)
  const startTimeUTC = hhmmUTC(start)
  const endTimeUTC = hhmmUTC(end)
  const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
  const startYMD = ymd(start)
  const endYMD = ymd(end)

  // Specific-date blackout
  const dateBlk = blackouts.find(b => b.date && ymd(b.date) === startYMD && windowsOverlap(startTime, endTime, b.startTime, b.endTime))
  if (dateBlk) {
    return { ok: false, reasons: ['blackout_date'], context: { weekday, utcWeekday, startTime, endTime, startTimeUTC, endTimeUTC, startYMD, endYMD } }
  }

  const hasWindows = availability && availability.length > 0
  let localOverlap = false
  let utcOverlap = false
  if (hasWindows) {
    const weekdayEnd = end.getDay()
    const seg1Overlap = availability.some(a => a.weekday === weekday && windowsOverlap(startTime, '23:59', a.startTime, a.endTime))
    const seg2Overlap = availability.some(a => a.weekday === weekdayEnd && windowsOverlap('00:00', endTime, a.startTime, a.endTime))
    localOverlap = (startYMD === endYMD)
      ? availability.some(a => a.weekday === weekday && windowsOverlap(startTime, endTime, a.startTime, a.endTime))
      : (seg1Overlap || seg2Overlap)
    utcOverlap = availability.some(a => a.weekday === utcWeekday && windowsOverlap(startTimeUTC, endTimeUTC, a.startTime, a.endTime))
    if (!localOverlap) return { ok: false, reasons: ['outside_availability'], context: { weekday, utcWeekday, startTime, endTime, startTimeUTC, endTimeUTC, startYMD, endYMD, localOverlap, utcOverlap, windowsLocal: availability.filter(a=>a.weekday===weekday), windowsUTC: availability.filter(a=>a.weekday===utcWeekday) } }
  }

  const wkBlk = blackouts.find(b => b.weekday != null && b.weekday === weekday && windowsOverlap(startTime, endTime, b.startTime, b.endTime))
  if (wkBlk) {
    return { ok: false, reasons: ['blackout_weekday'], context: { weekday, utcWeekday, startTime, endTime, startTimeUTC, endTimeUTC, startYMD, endYMD } }
  }

  return { ok: true, reasons: [], context: { weekday, utcWeekday, startTime, endTime, startTimeUTC, endTimeUTC, startYMD, endYMD, localOverlap: true, utcOverlap } }
}
