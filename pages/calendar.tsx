
import CalendarBoard from '../components/CalendarBoard'

export async function getServerSideProps() {
  const initial = {
    volunteers: [
      { id: 'v1', name: 'Alex Carpenter', skills: ['carpentry'], primarySkill: 'carpentry', availSummary: 'Mon/Wed', familyColor:'#FFE9A8' },
      { id: 'v2', name: 'Pat Painter', skills: ['paint'], primarySkill: 'paint', availSummary: 'Tue/Thu' },
      { id: 'v3', name: 'Chris Concrete', skills: ['concrete'], primarySkill: 'concrete', availSummary: 'Fri' }
    ],
    events: [
      {
        id: 'shift_123',
        title: 'Build Day – Framing',
        start: new Date().toISOString(),
        end: new Date(Date.now()+3*60*60*1000).toISOString(),
        extendedProps: {
          shiftId: 'shift_123',
          requirements: [{ skill:'carpentry', minCount:2 }, { skill:'paint', minCount:1 }],
          signedups: [{ volunteerId:'v1', role:'carpentry', status:'confirmed' }],
          familyColor: '#FFE9A8'
        }
      }
    ]
  }
  return { props: { initial } }
}

export default function CalendarPage({ initial }: any) {
  return <CalendarBoard initial={initial} />
}
