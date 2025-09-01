const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')

const prisma = new PrismaClient()

async function main() {
  const password = await bcrypt.hash('Passw0rd!', 10)
  await prisma.user.upsert({
    where: { email: 'coordinator@example.com' },
    update: {},
    create: { email: 'coordinator@example.com', password, role: 'coordinator' }
  })

  const fam = await prisma.family.create({ data: { name: 'Smith Family', colorTag: '#FFE9A8' } })
  const v1 = await prisma.volunteer.create({ data: { name: 'Alex Carpenter', email:'alex@example.com', skills: ['carpentry'], familyId: fam.id } })
  const v2 = await prisma.volunteer.create({ data: { name: 'Pat Painter', email:'pat@example.com', skills: ['paint'] } })
  await prisma.availability.createMany({ data: [
    { volunteerId: v1.id, weekday: 1, startTime: '08:00', endTime: '16:00' },
    { volunteerId: v1.id, weekday: 3, startTime: '08:00', endTime: '16:00' },
    { volunteerId: v2.id, weekday: 2, startTime: '09:00', endTime: '17:00' }
  ]})
  await prisma.blackout.create({ data: { volunteerId: v1.id, weekday: 0, startTime: '00:00', endTime: '23:59', notes: 'No Sundays' } })
  await prisma.blackout.create({ data: { volunteerId: v1.id, weekday: 1, startTime: '00:00', endTime: '15:59', notes: 'Not before 4pm Monday' } })

  const project = await prisma.project.create({ data: { name: 'Anderson Home', colorTag: '#A8E6FF', notes: 'New build project' } })
  const now = new Date()
  const end = new Date(now.getTime()+4*60*60*1000)
  const ev = await prisma.event.create({ data: { title: 'Build Day', category:'BUILD', projectId: project.id, start: now, end } })
  const sh = await prisma.shift.create({ data: { eventId: ev.id, start: ev.start, end: ev.end, description: 'Framing & Paint' } })
  await prisma.requirement.createMany({ data: [
    { shiftId: sh.id, skill: 'carpentry', minCount: 2 },
    { shiftId: sh.id, skill: 'paint', minCount: 1 }
  ]})
  await prisma.signup.create({ data: { shiftId: sh.id, volunteerId: v1.id, role:'carpentry', status:'confirmed' } })

  // Skills
  const skills = ['carpentry','paint','concrete','plumbing','electrical']
  for (const s of skills) {
    await prisma.skill.upsert({ where: { name: s }, update: {}, create: { name: s } })
  }
  // Settings
  await prisma.appSetting.upsert({ where: { key: 'defaultShiftHours' }, update: { value: '6' }, create: { key: 'defaultShiftHours', value: '6' } })
}

main().catch(e => { console.error(e); process.exit(1) }).finally(async () => { await prisma.$disconnect() })
