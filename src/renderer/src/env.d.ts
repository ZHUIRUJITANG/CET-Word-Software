/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<object, object, unknown>
  export default component
}

interface WordRecord {
  word: string
  phonetic: string
  translation: string
  exchange?: string
  tag?: string
  frq?: number
  bnc?: number
  definition?: string
  example?: string
}

interface OptionItem {
  word: string
  translation: string
}

interface SearchResult {
  word: string
  phonetic: string
  translation: string
  definition: string
  tag: string
}

interface NextWordResult {
  done: boolean
  word?: string
  step?: 1 | 2 | 3 | 4
  phonetic?: string
  translation?: string
  definition?: string
  options?: string[]
  meaningOptions?: string[]
  optionItems?: OptionItem[]
  masteredCount?: number
  totalCount?: number
  stats?: SessionStats
}

interface SubmitResult {
  correct: boolean
  currentStep: 1 | 2 | 3 | 4
  correctStreak: number
  mastered: boolean
  isDone: boolean
  correctAnswer?: string
  nextWord?: NextWordResult
}

interface SessionStats {
  totalWords: number
  masteredCount: number
  errorCount: number
  inProgressCount: number
}

interface WordStats {
  total: number
  mastered: number
  learning: number
  review: number
  new: number
}

interface ReviewWordResult {
  done: boolean
  word?: string
  phonetic?: string
  translation?: string
  definition?: string
  optionItems?: OptionItem[]
  reinforcementLabel?: 'vague' | 'unknown'
  stats?: { correct: number; vague: number; wrong: number }
}

interface ReviewSubmitResult {
  done: boolean
  repeated: boolean
  stats?: { correct: number; vague: number; wrong: number }
  nextWord?: ReviewWordResult
  phase?: 1 | 2
  reinforcementCount?: number
}

interface AppSettings {
  learnGroupSize: number
  reviewGroupSize: number
}

interface ActiveSession {
  type: 'learn' | 'review'
  sessionId: string
  level: string
}

interface AppState {
  lastRoute: string
  lastLevel: 'cet4' | 'cet6' | null
  activeSession: ActiveSession | null
}

interface ElectronAPI {
  ping: () => Promise<string>
  queryWord: (word: string) => Promise<WordRecord | null>
  getWordList: (options: {
    level: string
    offset: number
    limit: number
  }) => Promise<{ word: string }[]>
  searchWords: (keyword: string, level: string) => Promise<{ word: string }[]>
  getWordCount: (level: string) => Promise<number>
  searchAllWords: (keyword: string) => Promise<SearchResult[]>
  createSession: (
    level: string,
    groupSize?: number
  ) => Promise<{ sessionId: string; words: string[] }>
  getNextWord: (sessionId: string) => Promise<NextWordResult>
  submitAnswer: (
    sessionId: string,
    word: string,
    answer: string
  ) => Promise<SubmitResult>
  getSessionStats: (sessionId: string) => Promise<SessionStats | null>
  endSession: (sessionId: string) => Promise<SessionStats | null>
  getStats: (level: string) => Promise<WordStats>
  getReviewCount: (level: string) => Promise<number>
  getReviewQueue: (
    level: string
  ) => Promise<{ word: string; phonetic: string; translation: string; definition: string }[]>
  createReviewSession: (level: string) => Promise<{ sessionId: string; totalWords: number }>
  getNextReviewWord: (sessionId: string) => Promise<ReviewWordResult>
  submitReviewAnswer: (
    sessionId: string,
    word: string,
    quality: number
  ) => Promise<ReviewSubmitResult>
  completePhase1Word: (
    sessionId: string,
    word: string,
    label: 'know' | 'vague' | 'unknown'
  ) => Promise<ReviewSubmitResult>
  completeReinforcementWord: (
    sessionId: string,
    word: string,
    quality: number
  ) => Promise<ReviewSubmitResult>
  requeueReinforcementWord: (
    sessionId: string,
    word: string
  ) => Promise<ReviewSubmitResult>
  getReviewPhase: (sessionId: string) => Promise<1 | 2>
  changeReinforcementLabel: (sessionId: string, word: string, newLabel: 'vague' | 'unknown') => Promise<boolean>
  getFirstReinforcementWord: (sessionId: string) => Promise<ReviewSubmitResult>
  getSettings: () => Promise<AppSettings>
  updateSettings: (settings: Partial<AppSettings>) => Promise<AppSettings>
  markMasteredTrash: (level: string, word: string) => Promise<boolean>
  getTrashWords: (level?: string) => Promise<{ word: string; translation: string; level: string }[]>
  removeTrashMark: (level: string, word: string) => Promise<boolean>
  getMasteredWords: (level?: string) => Promise<{ word: string; translation: string; level: string; masteredBy: string }[]>
  resetMasteredWords: (level?: string) => Promise<number>
  resetWord: (level: string, word: string) => Promise<boolean>
  getAppState: () => Promise<AppState>
  saveAppState: (data: Partial<AppState>) => Promise<AppState>
  restoreReviewSession: (sessionId: string) => Promise<boolean>
  getActiveSession: (level: string) => Promise<ActiveSession | null>
  markAsWrong: (word: string, level: string, sessionType: 'learn' | 'review', sessionId?: string) => Promise<boolean>
  clearTrashMarks: () => Promise<number>
  resetLevel: (level: 'cet4' | 'cet6') => Promise<number>
  resetAll: () => Promise<boolean>
  getStatsSummary: (level?: 'cet4' | 'cet6') => Promise<{
    totalWords: number
    mastered: number
    learning: number
    review: number
    newWords: number
    totalErrors: number
    streakDays: number
  }>
  getDailyStats: (days: number) => Promise<{ date: string; learned: number; reviewed: number; errors: number }[]>
}

interface Window {
  electronAPI: ElectronAPI
}
