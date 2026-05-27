export interface Card {
  word: string
  easeFactor: number
  interval: number
  repetitions: number
  nextReviewDate: string | null
  correctStreak: number
  status: 'new' | 'learning' | 'review' | 'mastered'
  level: 'cet4' | 'cet6'
  createdAt: string
  markedTrash: boolean
  masteredBy: 'normal' | 'trash' | null
}

function formatDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function addDays(dateStr: string, days: number): string {
  const date = new Date(dateStr)
  date.setDate(date.getDate() + days)
  return formatDate(date)
}

export function getToday(): string {
  return formatDate(new Date())
}

export function createNewCard(word: string, level: 'cet4' | 'cet6' = 'cet4'): Card {
  return {
    word,
    easeFactor: 2.5,
    interval: 0,
    repetitions: 0,
    nextReviewDate: null,
    correctStreak: 0,
    status: 'new',
    level,
    createdAt: getToday(),
    markedTrash: false,
    masteredBy: null
  }
}

export function calcSM2(card: Card, quality: number): Card {
  const updated = { ...card }
  const today = getToday()

  if (quality >= 3) {
    if (updated.repetitions === 0) {
      updated.interval = 1
    } else if (updated.repetitions === 1) {
      updated.interval = 6
    } else {
      updated.interval = Math.round(updated.interval * updated.easeFactor)
    }
    updated.repetitions += 1
  } else {
    updated.interval = 1
    updated.repetitions = 0
  }

  updated.easeFactor =
    updated.easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
  if (updated.easeFactor < 1.3) {
    updated.easeFactor = 1.3
  }

  updated.nextReviewDate = addDays(today, updated.interval)

  return updated
}
