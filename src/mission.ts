export type MilestoneStatus = 'complete' | 'upcoming' | 'planned' | 'conditional'

export interface Milestone {
  id: string
  title: string
  timing: string
  actualAt?: string
  status: MilestoneStatus
  description: string
  source: string
}

export const mission = {
  name: 'Nancy Grace Roman Space Telescope',
  shortName: 'Roman',
  phase: 'Commissioning',
  launchTime: '2026-08-30T11:26:00Z',
  destination: 'Sun–Earth L2',
  journeyDistanceMiles: 1_000_000,
  orbitalInsertionTiming: '~100 days after launch',
  latestOfficialUpdate: '2026-08-31T19:33:00Z',
  latestHeadline: 'First mid-course correction complete',
  latestSummary:
    'Roman completed an approximately three-minute burn to refine its trajectory toward the Sun–Earth L2 region.',
  latestSource:
    'https://science.nasa.gov/blogs/roman/2026/08/31/nasas-roman-completes-first-mid-course-correction-burn/',
  nasaMissionPage: 'https://science.nasa.gov/mission/roman-space-telescope/',
  commissioningPage:
    'https://science.nasa.gov/missions/roman-space-telescope/roman-commissioning/',
}

export const milestones: Milestone[] = [
  {
    id: 'launch',
    title: 'Launch',
    timing: '30 Aug 2026',
    actualAt: '2026-08-30T11:26:00Z',
    status: 'complete',
    description: 'Lifted off on a SpaceX Falcon Heavy from Launch Complex 39A.',
    source:
      'https://science.nasa.gov/blogs/roman/2026/08/30/nasas-roman-space-telescope-launches/',
  },
  {
    id: 'mcc1',
    title: 'Mid-course correction #1',
    timing: '31 Aug 2026',
    actualAt: '2026-08-31T16:02:00Z',
    status: 'complete',
    description: 'Approximately three-minute burn to refine Roman’s trajectory toward L2.',
    source:
      'https://science.nasa.gov/blogs/roman/2026/08/31/nasas-roman-completes-first-mid-course-correction-burn/',
  },
  {
    id: 'deployments',
    title: 'High-gain antenna & aperture-cover deployments',
    timing: 'Early commissioning',
    status: 'upcoming',
    description: 'Major observatory deployments during the opening days of commissioning.',
    source:
      'https://science.nasa.gov/missions/roman-space-telescope/roman-commissioning/',
  },
  {
    id: 'mcc2',
    title: 'Mid-course correction #2',
    timing: 'Later this week, if needed',
    status: 'conditional',
    description: 'Second planned trajectory correction; NASA says it will be performed if needed.',
    source:
      'https://science.nasa.gov/blogs/roman/2026/08/31/nasas-roman-completes-first-mid-course-correction-burn/',
  },
  {
    id: 'coronagraph',
    title: 'Coronagraph activation',
    timing: '~1 week after launch',
    status: 'planned',
    description: 'Commissioning begins for Roman’s technology-demonstration Coronagraph Instrument.',
    source:
      'https://science.nasa.gov/missions/roman-space-telescope/roman-commissioning/',
  },
  {
    id: 'wfi',
    title: 'Wide Field Instrument power-on',
    timing: '~3 weeks after launch',
    status: 'planned',
    description: 'Roman’s primary science instrument enters its commissioning sequence.',
    source:
      'https://science.nasa.gov/missions/roman-space-telescope/roman-commissioning/',
  },
  {
    id: 'alignment',
    title: 'Alignment & focus',
    timing: '~2 months after launch',
    status: 'planned',
    description: 'Optical alignment, focusing, calibration, and observatory checkout continue.',
    source:
      'https://science.nasa.gov/missions/roman-space-telescope/roman-commissioning/',
  },
  {
    id: 'l2',
    title: 'L2 orbit insertion',
    timing: '~100 days after launch',
    status: 'planned',
    description: 'Roman enters its operational orbit around the Sun–Earth L2 region.',
    source:
      'https://science.nasa.gov/blogs/roman/2026/08/31/nasas-roman-completes-first-mid-course-correction-burn/',
  },
  {
    id: 'science',
    title: 'First-look observations & science operations',
    timing: 'After commissioning',
    status: 'planned',
    description: 'The mission transitions from checkout into its science programme.',
    source: 'https://science.nasa.gov/mission/roman-space-telescope/',
  },
]
