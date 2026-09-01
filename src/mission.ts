import generated from './generated/mission-status.json'

export type MilestoneStatus =
  | 'complete'
  | 'upcoming'
  | 'planned'
  | 'conditional'
  | 'not_required'
  | 'awaiting_confirmation'

export interface Milestone {
  id: string
  title: string
  timing: string
  actualAt?: string
  staleAfter?: string
  status: MilestoneStatus
  description: string
  source: string
}

const staticMission = {
  name: 'Nancy Grace Roman Space Telescope',
  shortName: 'Roman',
  launchTime: '2026-08-30T11:26:00Z',
  destination: 'Sun–Earth L2',
  journeyDistanceMiles: 1_000_000,
  orbitalInsertionTiming: '~100 days after launch',
  nasaMissionPage: 'https://science.nasa.gov/mission/roman-space-telescope/',
  commissioningPage:
    'https://science.nasa.gov/missions/roman-space-telescope/roman-commissioning/',
}

export const mission = {
  ...staticMission,
  ...generated.mission,
}

export const milestones = generated.milestones as Milestone[]
