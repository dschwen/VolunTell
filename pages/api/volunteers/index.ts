import type { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '../../../lib/prisma'
import { availableOnWeekday, availableForRange, availabilityDebugForRange, availableForRangeUTC } from '../../../lib/availability'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method === 'GET') {
      const { skill, active, availableAt, availableForShift, requireSkills, debug } = req.query
      const where: any = {}
      if (typeof skill === 'string') where.skills = { has: skill }
      if (typeof active === 'string') where.isActive = active === 'true'
      // For availableForShift, we need availability + blackouts and conflict check
      // When checking availability for a shift, default to active volunteers only
      if (typeof availableForShift === 'string') where.isActive = true
      const volunteers = await prisma.volunteer.findMany({ where, include: { availability: true, blackouts: true, family: true, contactLogs: { orderBy: { at: 'desc' }, take: 1 }, tasks: { where: { status: 'open', type: 'followup' }, select: { id: true } } } })
      if (typeof availableForShift === 'string') {
        const shift = await prisma.shift.findUnique({ where: { id: availableForShift }, include: { signups: { where: { status: 'confirmed' } }, requirements: true } })
        if (!shift) return res.status(404).json({ error: 'shift_not_found' })
        // Build set of volunteers with overlapping confirmed signups
        const conflicts = await prisma.signup.findMany({
          where: { status: 'confirmed', shift: { start: { lt: shift.end }, end: { gt: shift.start } } },
          include: { shift: { select: { id: true, start: true, end: true, event: { select: { title: true } } } } }
        })
        const conflictSet = new Set(conflicts.map(c => c.volunteerId))
        const conflictByVolunteer = new Map<string, typeof conflicts[number]>()
        for (const c of conflicts) if (!conflictByVolunteer.has(c.volunteerId)) conflictByVolunteer.set(c.volunteerId, c)
        const reqSkills = Array.from(new Set((shift.requirements || []).map(r => r.skill)))
        let mustMatchSkills = false
        let allowUtcLegacy = false
        if (typeof requireSkills === 'string') {
          mustMatchSkills = requireSkills === 'true' && reqSkills.length > 0
        } else {
          // Fallback to global setting if not specified
          const [row, legacy] = await Promise.all([
            prisma.appSetting.findUnique({ where: { key: 'requireSkillsForAvailability' } }),
            prisma.appSetting.findUnique({ where: { key: 'allowUtcLegacyAvailability' } })
          ])
          mustMatchSkills = (row?.value === 'true') && reqSkills.length > 0
          allowUtcLegacy = (legacy?.value === 'true')
        }
        const filtered = volunteers.filter(v => {
          if (conflictSet.has(v.id)) return false
          let ok = availableForRange(shift.start, shift.end, v.availability, v.blackouts)
          if (!ok && allowUtcLegacy) ok = availableForRangeUTC(shift.start, shift.end, v.availability, v.blackouts)
          if (!ok) return false
          if (mustMatchSkills) {
            const skills = v.skills || []
            if (!skills.some((s: string) => reqSkills.includes(s))) return false
          }
          return true
        })
        if (String(debug) === 'true') {
          const excluded = volunteers
            .filter(v => !filtered.some(f => f.id === v.id))
            .map(v => {
              const reasons: string[] = []
              if (conflictSet.has(v.id)) reasons.push('double_booked')
              const avail = availabilityDebugForRange(shift.start, shift.end, v.availability, v.blackouts)
              if (!avail.ok) reasons.push(...avail.reasons)
              if (mustMatchSkills) {
                const skills = v.skills || []
                if (!skills.some((s: string) => reqSkills.includes(s))) reasons.push('missing_required_skill')
              }
              const conflict = conflictByVolunteer.get(v.id)
              const conflictInfo = conflict ? {
                shiftId: conflict.shift.id,
                start: conflict.shift.start,
                end: conflict.shift.end,
                eventTitle: conflict.shift.event?.title,
              } : undefined
              return { id: v.id, name: v.name, reasons, conflict: conflictInfo, availabilityContext: avail.context, availability: v.availability, blackouts: v.blackouts, skills: v.skills }
            })
          return res.status(200).json({ volunteers: filtered, debug: { excluded, requireSkillsApplied: mustMatchSkills, requiredSkills: reqSkills, allowUtcLegacy } })
        }
        return res.status(200).json({ volunteers: filtered })
      }
      let filtered = volunteers
      if (typeof availableAt === 'string') {
        const dt = new Date(availableAt)
        const weekday = dt.getDay()
        const hhmm = (d: Date) => `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
        const start = hhmm(dt)
        // assume 1-hour window for instant check
        const end   = hhmm(new Date(dt.getTime() + 60*60*1000))
        filtered = volunteers.filter(v => availableOnWeekday(weekday, start, end, v.availability, v.blackouts))
      }
      return res.status(200).json({ volunteers: filtered })
    }
    if (req.method === 'POST') {
      const { name, email, phone, skills, familyId, notes, isActive } = req.body || {}
      if (!name) return res.status(400).json({ error: 'name required' })
      const volunteer = await prisma.volunteer.create({ data: { name, email, phone, skills: skills || [], familyId, notes, isActive: isActive ?? true } })
      return res.status(201).json({ volunteer })
    }
    return res.status(405).end()
  } catch (e: any) {
    console.error(e)
    return res.status(500).json({ error: 'server_error' })
  }
}
