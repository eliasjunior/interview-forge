export type CostBand = {
  cost: number
  label: string
  guidance: string
}

export const COST_RUBRIC: CostBand[] = [
  {
    cost: 1,
    label: 'Lightweight',
    guidance: 'Contract tweak or local implementation choice with low coordination cost.',
  },
  {
    cost: 2,
    label: 'Moderate',
    guidance: 'Touches more than one layer or team workflow, but stays locally contained.',
  },
  {
    cost: 3,
    label: 'Heavy',
    guidance: 'Introduces durable state, operational process, or cross-cutting coordination.',
  },
  {
    cost: 4,
    label: 'Transformational',
    guidance: 'Large redesign with broad migration, tooling, or organizational overhead.',
  },
]
