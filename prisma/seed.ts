
import { PrismaClient } from '@prisma/client'
import * as bcrypt from 'bcryptjs'

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

  const ev = await prisma.event.create({ data: { title: 'Build Day', start: new Date(), end: new Date(Date.now()+4*60*60*1000) } })
  const sh = await prisma.shift.create({ data: { eventId: ev.id, start: ev.start, end: ev.end, description: 'Framing & Paint' } })
  await prisma.requirement.createMany({ data: [
    { shiftId: sh.id, skill: 'carpentry', minCount: 2 },
    { shiftId: sh.id, skill: 'paint', minCount: 1 }
  ]})
  await prisma.signup.create({ data: { shiftId: sh.id, volunteerId: v1.id, role:'carpentry', status:'confirmed' } })
}

main().catch(e => { console.error(e); process.exit(1) }).finally(async () => { await prisma.$disconnect() })
