// Plain records can later come from an API without coupling content to the UI.
export type Achievement = {
  // Stable identity for future edits and deletes; independent of display order.
  id: string
  year: number
  event: string
  title?: string
  description?: string
  result: string
  team?: string
  division?: string
  // Public rendering respects the publication flag; API adapters map `published`.
  isPublished: boolean
  createdAt?: string
  updatedAt?: string
}

export const achievements: readonly Achievement[] = [
  {
    id: 'bup-hackathon-2026',
    year: 2026,
    event: 'BUP Hackathon 2026',
    result: 'Finalist',
    team: 'AI_Hunter',
    isPublished: true,
  },
  {
    id: 'chemistry-olympiad-2021',
    year: 2021,
    event: 'Chemistry Olympiad 2021',
    result: 'Finalist',
    isPublished: true,
  },
  {
    id: 'math-olympiad-2019',
    year: 2019,
    event: 'Math Olympiad 2019',
    result: 'Finalist',
    division: 'Chittagong Division',
    isPublished: true,
  },
]
