import Store from 'electron-store'
import { Card, createNewCard, calcSM2, getToday } from './sm2'
import { Database } from 'sql.js'

interface LearningData {
  [word: string]: Card
}

interface QueueEntry {
  word: string
  currentStep: 1 | 2 | 3 | 4
  correctStreak: number
  wrongCount: number
}

interface LearningSession {
  sessionId: string
  level: string
  queue: QueueEntry[]
  completed: string[]
  startTime: number
  totalErrorCount: number
}

interface SimilarWordsCache {
  [word: string]: string[]
}

interface ReviewQueueItem {
  word: string
  phonetic: string
  translation: string
  definition: string
  reviewRepeatCount: number
  lastQuality: number
  reinforcementLabel: 'vague' | 'unknown' | null
}

interface ReviewSession {
  sessionId: string
  level: string
  queue: ReviewQueueItem[]
  completed: ReviewQueueItem[]
  stats: { correct: number; vague: number; wrong: number }
  phase: 1 | 2
  reinforcementQueue: ReviewQueueItem[]
}

export interface ReviewWordResult {
  done: boolean
  word?: string
  phonetic?: string
  translation?: string
  definition?: string
  optionItems?: OptionItem[]
  reinforcementLabel?: 'vague' | 'unknown'
  stats?: { correct: number; vague: number; wrong: number }
}

export interface ReviewSubmitResult {
  done: boolean
  repeated: boolean
  stats?: { correct: number; vague: number; wrong: number }
  nextWord?: ReviewWordResult
  phase?: 1 | 2
  reinforcementCount?: number
}

interface SessionStats {
  totalWords: number
  masteredCount: number
  errorCount: number
  inProgressCount: number
}

export interface OptionItem {
  word: string
  translation: string
}

export interface NextWordResult {
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

export interface SubmitResult {
  correct: boolean
  currentStep: 1 | 2 | 3 | 4
  correctStreak: number
  mastered: boolean
  isDone: boolean
  correctAnswer?: string
  nextWord?: NextWordResult
}

function levenshtein(a: string, b: string): number {
  const m = a.length
  const n = b.length
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0))
  for (let i = 0; i <= m; i++) dp[i][0] = i
  for (let j = 0; j <= n; j++) dp[0][j] = j
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost)
    }
  }
  return dp[m][n]
}

function shuffleArray<T>(arr: T[]): T[] {
  const result = [...arr]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

export class LearningService {
  private store: Store
  private db: Database
  private levelWordCache: Map<string, string[]> = new Map()
  private reviewSessions: Map<string, ReviewSession> = new Map()

  constructor(db: Database) {
    this.db = db
    this.store = new Store({
      name: 'learning-data',
      defaults: {
        cards: {},
        'current-session': null,
        'similar-cache': {},
        'current-review-session': null,
        'daily-stats': {}
      }
    })
  }

  private getTodayStr(): string {
    const d = new Date()
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  }

  private recordDailyStat(field: 'learned' | 'reviewed' | 'errors', increment = 1): void {
    const today = this.getTodayStr()
    const stats = (this.store.get('daily-stats') || {}) as Record<string, { learned: number; reviewed: number; errors: number }>
    if (!stats[today]) {
      stats[today] = { learned: 0, reviewed: 0, errors: 0 }
    }
    stats[today][field] += increment
    this.store.set('daily-stats', stats)
  }

  private persistReviewSession(sessionId: string): void {
    const session = this.reviewSessions.get(sessionId)
    if (session) {
      this.store.set('current-review-session', session)
    }
  }

  restoreReviewSession(sessionId: string): boolean {
    const saved = this.store.get('current-review-session') as ReviewSession | null
    if (!saved || saved.sessionId !== sessionId) return false
    // Backward compatibility: add missing fields for old persisted sessions
    if (!saved.phase) saved.phase = 1
    if (!saved.reinforcementQueue) saved.reinforcementQueue = []
    for (const item of saved.queue) {
      if (item.reinforcementLabel === undefined) item.reinforcementLabel = null
    }
    for (const item of saved.reinforcementQueue) {
      if (item.reinforcementLabel === undefined) item.reinforcementLabel = null
    }
    this.reviewSessions.set(sessionId, saved)
    return true
  }

  clearPersistedReviewSession(): void {
    this.store.set('current-review-session', null)
  }

  endReviewSession(sessionId: string): { correct: number; vague: number; wrong: number } | null {
    const session = this.reviewSessions.get(sessionId)
    if (!session) return null
    const stats = { ...session.stats }
    this.reviewSessions.delete(sessionId)
    this.clearPersistedReviewSession()
    return stats
  }

  markWordAsWrongInLearn(word: string, level: string): boolean {
    const session = this.getSession()
    if (!session) return false

    const levelKey = level as 'cet4' | 'cet6'
    let card = this.getCard(word)

    // Reset card state
    if (card) {
      card.status = 'learning'
      card.correctStreak = 0
      card = calcSM2(card, 1)
      this.saveCard(card)
    }

    // Check if word is already in queue
    const existingIdx = session.queue.findIndex((e) => e.word === word)
    if (existingIdx !== -1) {
      // Reset existing entry
      session.queue[existingIdx].currentStep = 1
      session.queue[existingIdx].correctStreak = 0
      session.queue[existingIdx].wrongCount++
      // Move to end
      const entry = session.queue.splice(existingIdx, 1)[0]
      session.queue.push(entry)
    } else {
      // Word was mastered/removed — re-add to queue
      session.queue.push({ word, currentStep: 1, correctStreak: 0, wrongCount: 1 })
      // Remove from completed if present
      const compIdx = session.completed.indexOf(word)
      if (compIdx !== -1) session.completed.splice(compIdx, 1)
    }

    session.totalErrorCount++
    this.saveSession(session)
    return true
  }

  markWordAsWrongInReview(word: string, sessionId: string): boolean {
    const session = this.reviewSessions.get(sessionId)
    if (!session) return false

    // Reset SM-2 card to initial state
    const levelKey = session.level as 'cet4' | 'cet6'
    let card = this.getCard(word)
    if (card) {
      card.easeFactor = 2.5
      card.interval = 0
      card.repetitions = 0
      card.nextReviewDate = getToday()
      card.correctStreak = 0
      card.status = 'review'
      card = calcSM2(card, 1)
      this.saveCard(card)
    }

    // Check all queues for the word
    const existingIdx = session.queue.findIndex((item) => item.word === word)
    const reinIdx = session.reinforcementQueue.findIndex((item) => item.word === word)

    if (existingIdx !== -1) {
      session.queue[existingIdx].reviewRepeatCount = 0
      session.queue[existingIdx].reinforcementLabel = null
      const item = session.queue.splice(existingIdx, 1)[0]
      session.queue.push(item)
    } else if (reinIdx !== -1) {
      // Remove from reinforcement queue, re-add to main queue
      const item = session.reinforcementQueue.splice(reinIdx, 1)[0]
      item.reinforcementLabel = null
      item.reviewRepeatCount = 0
      session.queue.push(item)
    } else {
      // Word was completed — re-add to queue
      const detail = this.getWordDetail(word)
      const compIdx = session.completed.findIndex((item) => item.word === word)
      const lastQ = compIdx !== -1 ? session.completed[compIdx].lastQuality : 5
      session.queue.push({
        word,
        phonetic: detail.phonetic,
        translation: detail.translation,
        definition: detail.definition,
        reviewRepeatCount: 0,
        lastQuality: 0,
        reinforcementLabel: null
      })
      if (compIdx !== -1) session.completed.splice(compIdx, 1)
      if (lastQ >= 5) session.stats.correct = Math.max(0, session.stats.correct - 1)
      else if (lastQ >= 3) session.stats.vague = Math.max(0, session.stats.vague - 1)
      else session.stats.wrong = Math.max(0, session.stats.wrong - 1)
    }

    session.stats.wrong++
    this.persistReviewSession(sessionId)
    return true
  }

  private getCards(): LearningData {
    return (this.store.get('cards') as LearningData) || {}
  }

  private saveCards(data: LearningData): void {
    this.store.set('cards', data)
  }

  private getCard(word: string): Card | null {
    return this.getCards()[word] || null
  }

  private getOrCreateCard(word: string, level: 'cet4' | 'cet6'): Card {
    return this.getCard(word) || createNewCard(word, level)
  }

  private saveCard(card: Card): void {
    const data = this.getCards()
    data[card.word] = card
    this.saveCards(data)
  }

  private getSession(): LearningSession | null {
    return this.store.get('current-session') as LearningSession | null
  }

  private saveSession(session: LearningSession): void {
    this.store.set('current-session', session)
  }

  private clearSession(): void {
    this.store.set('current-session', null)
  }

  private getSimilarCache(): SimilarWordsCache {
    return (this.store.get('similar-cache') as SimilarWordsCache) || {}
  }

  private saveSimilarCache(cache: SimilarWordsCache): void {
    this.store.set('similar-cache', cache)
  }

  private getLevelWords(level: string): string[] {
    const cached = this.levelWordCache.get(level)
    if (cached) return cached

    const tagPattern = `%${level}%`
    const stmt = this.db.prepare(
      `SELECT word FROM stardict WHERE tag LIKE :tag
       AND word NOT LIKE '% %'
       AND word NOT LIKE '%(%'
       AND word NOT LIKE '%)%'
       AND word NOT LIKE '%-%'`
    )
    stmt.bind({ ':tag': tagPattern })
    const words: string[] = []
    while (stmt.step()) {
      words.push(stmt.get()[0] as string)
    }
    stmt.free()

    this.levelWordCache.set(level, words)
    return words
  }

  getSimilarWords(word: string, level: string, count: number = 3): string[] {
    const cache = this.getSimilarCache()
    const cacheKey = `${level}:${word}`
    if (cache[cacheKey]) return cache[cacheKey]

    const allWords = this.getLevelWords(level)
    const lowerWord = word.toLowerCase()

    const withDist: { w: string; d: number }[] = []
    for (const w of allWords) {
      if (w.toLowerCase() === lowerWord) continue
      const d = levenshtein(lowerWord, w.toLowerCase())
      if (d >= 1 && d <= 2) {
        withDist.push({ w, d })
      }
    }

    withDist.sort((a, b) => a.d - b.d)

    let result: string[] = []
    if (withDist.length >= count) {
      const shuffled = shuffleArray(withDist)
      result = shuffled.slice(0, count).map((x) => x.w)
    } else {
      result = withDist.map((x) => x.w)
      if (result.length < count) {
        const dist3 = shuffleArray(
          allWords.filter((w) => {
            if (w.toLowerCase() === lowerWord) return false
            if (result.includes(w)) return false
            const d = levenshtein(lowerWord, w.toLowerCase())
            return d === 3
          })
        )
        result.push(...dist3.slice(0, count - result.length))
      }
      if (result.length < count) {
        const len = word.length
        const similar = shuffleArray(
          allWords.filter((w) => {
            if (w.toLowerCase() === lowerWord) return false
            if (result.includes(w)) return false
            return Math.abs(w.length - len) <= 1
          })
        )
        result.push(...similar.slice(0, count - result.length))
      }
      result = result.slice(0, count)
    }

    cache[cacheKey] = result
    this.saveSimilarCache(cache)
    return result
  }

  getWordDetail(word: string): { phonetic: string; translation: string; definition: string } {
    const stmt = this.db.prepare(
      'SELECT phonetic, translation, definition FROM stardict WHERE word = :word'
    )
    stmt.bind({ ':word': word })
    let phonetic = ''
    let translation = ''
    let definition = ''
    if (stmt.step()) {
      const values = stmt.get()
      phonetic = (values[0] as string) || ''
      translation = (values[1] as string) || ''
      definition = (values[2] as string) || ''
    }
    stmt.free()
    return { phonetic, translation, definition }
  }

  createSession(level: string, groupSize: number = 20): {
    sessionId: string
    words: string[]
  } {
    const cards = this.getCards()
    const today = getToday()
    const levelKey = level as 'cet4' | 'cet6'
    const allDbWords = this.getLevelWords(level)

    const reviewWords: string[] = []
    const learningWords: string[] = []
    const newWords: string[] = []

    for (const word of allDbWords) {
      const card = cards[word]
      if (!card) {
        newWords.push(word)
      } else if (card.status === 'mastered') {
        continue
      } else if (
        card.status === 'review' &&
        card.nextReviewDate &&
        card.nextReviewDate <= today
      ) {
        reviewWords.push(word)
      } else if (card.status === 'new' || card.status === 'learning') {
        learningWords.push(word)
      }
    }

    const allPools = [shuffleArray(reviewWords), shuffleArray(learningWords), shuffleArray(newWords)]
    const selected: string[] = []
    for (const pool of allPools) {
      for (const w of pool) {
        if (selected.length >= groupSize) break
        selected.push(w)
      }
      if (selected.length >= groupSize) break
    }

    const finalWords = shuffleArray(selected)

    const sessionId = `session_${Date.now()}`
    const session: LearningSession = {
      sessionId,
      level,
      queue: finalWords.map((w) => ({
        word: w,
        currentStep: 1,
        correctStreak: 0,
        wrongCount: 0
      })),
      completed: [],
      startTime: Date.now(),
      totalErrorCount: 0
    }

    this.saveSession(session)

    return { sessionId, words: finalWords }
  }

  getNextWord(sessionId: string): NextWordResult {
    const session = this.getSession()
    if (!session || session.sessionId !== sessionId) {
      return { done: true }
    }

    if (session.queue.length === 0) {
      return {
        done: true,
        stats: {
          totalWords: session.completed.length + session.queue.length,
          masteredCount: session.completed.length,
          errorCount: session.totalErrorCount,
          inProgressCount: 0
        }
      }
    }

    const entry = session.queue[0]
    const detail = this.getWordDetail(entry.word)
    const masteredCount = session.completed.length
    const totalCount = session.completed.length + session.queue.length

    const result: NextWordResult = {
      done: false,
      word: entry.word,
      step: entry.currentStep,
      phonetic: detail.phonetic,
      translation: detail.translation,
      definition: detail.definition,
      masteredCount,
      totalCount
    }

    if (entry.currentStep === 2 || entry.currentStep === 3) {
      const similar = this.getSimilarWords(entry.word, session.level, 3)
      if (entry.currentStep === 2) {
        const allWords = [entry.word, ...similar]
        const items: OptionItem[] = allWords.map((w) => {
          const d = this.getWordDetail(w)
          return { word: w, translation: d.translation || '（无释义）' }
        })
        const shuffled = shuffleArray(items)
        result.optionItems = shuffled
        result.options = shuffled.map((item) => item.word)
      } else {
        const wrongPairs: OptionItem[] = []
        for (const sw of similar) {
          const d = this.getWordDetail(sw)
          wrongPairs.push({ word: sw, translation: d.translation || '（无释义）' })
        }
        while (wrongPairs.length < 3) {
          wrongPairs.push({ word: '???', translation: '（无释义）' })
        }
        const correctItem: OptionItem = { word: entry.word, translation: detail.translation || '（无释义）' }
        const shuffled = shuffleArray([correctItem, ...wrongPairs.slice(0, 3)])
        result.optionItems = shuffled
        result.meaningOptions = shuffled.map((item) => item.translation)
      }
    }

    this.saveSession(session)
    return result
  }

  submitAnswer(
    sessionId: string,
    word: string,
    answer: string
  ): SubmitResult {
    const session = this.getSession()
    if (!session || session.sessionId !== sessionId) {
      return {
        correct: false,
        currentStep: 1,
        correctStreak: 0,
        mastered: false,
        isDone: true
      }
    }

    const entryIndex = session.queue.findIndex((e) => e.word === word)
    if (entryIndex === -1) {
      return {
        correct: false,
        currentStep: 1,
        correctStreak: 0,
        mastered: false,
        isDone: true
      }
    }

    const entry = session.queue[entryIndex]
    let correct = false

    switch (entry.currentStep) {
      case 1:
        correct = answer === 'know'
        break
      case 2:
        correct = answer.toLowerCase() === entry.word.toLowerCase()
        break
      case 3: {
        const detail = this.getWordDetail(entry.word)
        correct = answer === detail.translation
        break
      }
      case 4:
        correct = answer.trim().toLowerCase() === entry.word.toLowerCase()
        break
    }

    const levelKey = session.level as 'cet4' | 'cet6'
    let card = this.getOrCreateCard(entry.word, levelKey)

    if (correct) {
      entry.correctStreak++
      if (entry.currentStep < 4) {
        entry.currentStep = (entry.currentStep + 1) as 1 | 2 | 3 | 4
        session.queue.splice(entryIndex, 1)
        session.queue.push(entry)
      } else {
        session.queue.splice(entryIndex, 1)
        session.completed.push(entry.word)
        card.status = 'mastered'
        card.correctStreak = 4
        card.masteredBy = 'normal'
        card.markedTrash = false
        card = calcSM2(card, 5)
        this.saveCard(card)
        this.recordDailyStat('learned')
      }
    } else {
      session.totalErrorCount++
      entry.wrongCount++
      this.recordDailyStat('errors')

      if (entry.currentStep < 4) {
        // Steps 1-3: rollback step and streak, requeue
        const newStep = entry.currentStep - 1
        entry.currentStep = (newStep < 1 ? 1 : newStep) as 1 | 2 | 3 | 4
        entry.correctStreak = Math.max(0, entry.correctStreak - 1)

        card.correctStreak = entry.correctStreak
        card = calcSM2(card, 1)
        if (card.status === 'new') card.status = 'learning'
        this.saveCard(card)

        session.queue.splice(entryIndex, 1)
        session.queue.push(entry)
      }
      // Step 4: no rollback, no SM-2, no requeue — stay on same word
    }

    this.saveSession(session)

    const isDone = session.queue.length === 0
    const nextWord = isDone ? undefined : this.getNextWord(sessionId)

    let correctAnswer: string | undefined
    if (!correct) {
      if (entry.currentStep === 2) {
        // Was step 3 (meaning), show translation as correct answer
        correctAnswer = this.getWordDetail(entry.word).translation
      } else {
        correctAnswer = entry.word
      }
    }

    return {
      correct,
      currentStep: entry.currentStep,
      correctStreak: entry.correctStreak,
      mastered: correct && entry.currentStep === 4,
      isDone,
      correctAnswer,
      nextWord: nextWord?.done ? undefined : nextWord
    }
  }

  getSessionStats(sessionId: string): SessionStats | null {
    const session = this.getSession()
    if (!session || session.sessionId !== sessionId) return null
    return {
      totalWords: session.completed.length + session.queue.length,
      masteredCount: session.completed.length,
      errorCount: session.totalErrorCount,
      inProgressCount: session.queue.length
    }
  }

  endSession(sessionId: string): SessionStats | null {
    const session = this.getSession()
    if (!session || session.sessionId !== sessionId) return null

    const stats: SessionStats = {
      totalWords: session.completed.length + session.queue.length,
      masteredCount: session.completed.length,
      errorCount: session.totalErrorCount,
      inProgressCount: 0
    }

    this.clearSession()
    return stats
  }

  getStats(level: string): { total: number; mastered: number; learning: number; review: number; new: number } {
    const cards = this.getCards()
    const allWords = this.getLevelWords(level)

    let mastered = 0
    let learning = 0
    let review = 0
    let newCount = 0

    for (const word of allWords) {
      const card = cards[word]
      if (!card || card.status === 'new') {
        newCount++
      } else if (card.status === 'mastered') {
        mastered++
      } else if (card.status === 'learning') {
        learning++
      } else if (card.status === 'review') {
        review++
      }
    }

    return { total: allWords.length, mastered, learning, review, new: newCount }
  }

  getReviewCount(level: string): number {
    const today = getToday()
    const cards = this.getCards()
    let count = 0
    for (const word in cards) {
      const card = cards[word]
      if (
        card.level === level &&
        card.nextReviewDate &&
        card.nextReviewDate <= today &&
        card.status !== 'new'
      ) {
        count++
      }
    }
    return count
  }

  getReviewStepOptions(word: string, level: string): OptionItem[] {
    const similar = this.getSimilarWords(word, level, 3)
    const allWords = [word, ...similar]
    return shuffleArray(
      allWords.map((w) => {
        const d = this.getWordDetail(w)
        return { word: w, translation: d.translation || '（无释义）' }
      })
    )
  }

  getReviewQueue(level: string): {
    word: string
    phonetic: string
    translation: string
    definition: string
  }[] {
    const today = getToday()
    const cards = this.getCards()

    const dueCards: Card[] = []
    for (const word in cards) {
      const card = cards[word]
      if (
        card.level === level &&
        card.nextReviewDate &&
        card.nextReviewDate <= today &&
        card.status !== 'new'
      ) {
        dueCards.push(card)
      }
    }

    dueCards.sort((a, b) => {
      const dateA = a.nextReviewDate || ''
      const dateB = b.nextReviewDate || ''
      return dateA < dateB ? -1 : dateA > dateB ? 1 : 0
    })

    return dueCards.map((card) => {
      const detail = this.getWordDetail(card.word)
      return {
        word: card.word,
        phonetic: detail.phonetic,
        translation: detail.translation,
        definition: detail.definition
      }
    })
  }

  recordReviewAnswer(
    level: string,
    word: string,
    quality: number
  ): { status: string; nextReviewDate: string | null } {
    const levelKey = level as 'cet4' | 'cet6'
    let card = this.getOrCreateCard(word, levelKey)

    if (quality < 3) {
      card.status = 'learning'
      card.correctStreak = 0
    }

    card = calcSM2(card, quality)

    if (quality >= 3 && card.status !== 'mastered') {
      card.status = card.interval >= 21 ? 'mastered' : 'review'
    }

    this.saveCard(card)

    return { status: card.status, nextReviewDate: card.nextReviewDate }
  }

  createReviewSession(level: string, groupSize: number = 20): { sessionId: string; totalWords: number } {
    const rawQueue = this.getReviewQueue(level).slice(0, groupSize)
    const queue: ReviewQueueItem[] = rawQueue.map((item) => ({
      ...item,
      reviewRepeatCount: 0,
      lastQuality: 0,
      reinforcementLabel: null
    }))

    const sessionId = `review_${Date.now()}`
    const session: ReviewSession = {
      sessionId,
      level,
      queue,
      completed: [],
      stats: { correct: 0, vague: 0, wrong: 0 },
      phase: 1,
      reinforcementQueue: []
    }

    this.reviewSessions.set(sessionId, session)
    this.persistReviewSession(sessionId)
    return { sessionId, totalWords: queue.length }
  }

  getNextReviewWord(sessionId: string): ReviewWordResult {
    const session = this.reviewSessions.get(sessionId)
    if (!session) return { done: true }

    if (session.phase === 1) {
      if (session.queue.length === 0) {
        return { done: true, stats: { ...session.stats } }
      }
      const item = session.queue[0]
      return {
        done: false,
        word: item.word,
        phonetic: item.phonetic,
        translation: item.translation,
        definition: item.definition
      }
    }

    // Phase 2
    return this.getNextReinforcementWord(sessionId)
  }

  getNextReinforcementWord(sessionId: string): ReviewWordResult {
    const session = this.reviewSessions.get(sessionId)
    if (!session) return { done: true }

    if (session.reinforcementQueue.length === 0) {
      return { done: true, stats: { ...session.stats } }
    }

    const item = session.reinforcementQueue[0]
    const optionItems = this.getReviewStepOptions(item.word, session.level)
    return {
      done: false,
      word: item.word,
      phonetic: item.phonetic,
      translation: item.translation,
      definition: item.definition,
      optionItems,
      reinforcementLabel: item.reinforcementLabel || undefined
    }
  }

  getReviewPhase(sessionId: string): 1 | 2 {
    const session = this.reviewSessions.get(sessionId)
    return session ? session.phase : 1
  }

  changeReinforcementLabel(
    sessionId: string,
    word: string,
    newLabel: 'vague' | 'unknown'
  ): boolean {
    const session = this.reviewSessions.get(sessionId)
    if (!session) return false
    const item = session.reinforcementQueue.find((i) => i.word === word)
    if (!item) return false
    item.reinforcementLabel = newLabel
    this.persistReviewSession(sessionId)
    return true
  }

  getFirstReinforcementWord(sessionId: string): ReviewSubmitResult {
    const session = this.reviewSessions.get(sessionId)
    if (!session) return { done: true, repeated: false, phase: 1 }

    if (session.reinforcementQueue.length === 0) {
      this.clearPersistedReviewSession()
      return {
        done: true,
        repeated: false,
        stats: { ...session.stats },
        phase: 1
      }
    }

    session.phase = 2
    this.persistReviewSession(sessionId)
    return {
      done: false,
      repeated: false,
      phase: 2,
      reinforcementCount: session.reinforcementQueue.length,
      nextWord: this.getNextReinforcementWord(sessionId)
    }
  }

  completePhase1Word(
    sessionId: string,
    word: string,
    label: 'know' | 'vague' | 'unknown'
  ): ReviewSubmitResult {
    const session = this.reviewSessions.get(sessionId)
    if (!session) return { done: true, repeated: false, phase: 1 }

    const idx = session.queue.findIndex((item) => item.word === word)
    if (idx === -1) return { done: true, repeated: false, phase: 1 }

    const item = session.queue[idx]

    if (label === 'know') {
      // SM-2 update with quality=5
      const levelKey = session.level as 'cet4' | 'cet6'
      let card = this.getOrCreateCard(word, levelKey)
      session.stats.correct++
      card = calcSM2(card, 5)
      card.correctStreak = (card.correctStreak || 0) + 1
      if (card.status !== 'mastered') {
        card.status = card.interval >= 21 ? 'mastered' : 'review'
      }
      this.saveCard(card)
      item.lastQuality = 5
      session.queue.splice(idx, 1)
      session.completed.push(item)
      this.recordDailyStat('reviewed')
    } else {
      // Move to reinforcement queue
      item.reinforcementLabel = label === 'vague' ? 'vague' : 'unknown'
      session.queue.splice(idx, 1)
      session.reinforcementQueue.push(item)
    }

    const phase1Done = session.queue.length === 0

    if (phase1Done) {
      // Check if there are reinforcement words
      if (session.reinforcementQueue.length === 0) {
        // No reinforcement needed — session complete
        this.clearPersistedReviewSession()
        return {
          done: true,
          repeated: false,
          stats: { ...session.stats },
          phase: 1
        }
      }
      // Phase 1 queue empty, reinforcement words pending — signal frontend to transition
      this.persistReviewSession(sessionId)
      return {
        done: false,
        repeated: false,
        phase: 1,
        reinforcementCount: session.reinforcementQueue.length
      }
    }

    // Phase 1 not done — return next word
    this.persistReviewSession(sessionId)
    const next = this.getNextReviewWord(sessionId)
    return {
      done: false,
      repeated: false,
      phase: 1,
      nextWord: next.done ? undefined : next
    }
  }

  requeueReinforcementWord(
    sessionId: string,
    word: string
  ): ReviewSubmitResult {
    const session = this.reviewSessions.get(sessionId)
    if (!session) return { done: true, repeated: false, phase: 2 }

    const idx = session.reinforcementQueue.findIndex((item) => item.word === word)
    if (idx === -1) return { done: true, repeated: false, phase: 2 }

    // Move word from head to tail of reinforcement queue
    const item = session.reinforcementQueue.splice(idx, 1)[0]
    session.reinforcementQueue.push(item)

    this.persistReviewSession(sessionId)

    const nextWord = this.getNextReinforcementWord(sessionId)
    return {
      done: false,
      repeated: false,
      phase: 2,
      nextWord: nextWord?.done ? undefined : nextWord
    }
  }

  completeReinforcementWord(
    sessionId: string,
    word: string,
    quality: number
  ): ReviewSubmitResult {
    const session = this.reviewSessions.get(sessionId)
    if (!session) return { done: true, repeated: false, phase: 2 }

    const idx = session.reinforcementQueue.findIndex((item) => item.word === word)
    if (idx === -1) return { done: true, repeated: false, phase: 2 }

    const item = session.reinforcementQueue[idx]
    const levelKey = session.level as 'cet4' | 'cet6'
    let card = this.getOrCreateCard(word, levelKey)

    // Update stats
    if (quality >= 5) {
      session.stats.correct++
    } else if (quality >= 3) {
      session.stats.vague++
    } else {
      session.stats.wrong++
    }

    // Update SM-2
    card = calcSM2(card, quality)
    card.correctStreak = quality >= 5 ? (card.correctStreak || 0) + 1 : 0
    if (card.status !== 'mastered') {
      card.status = card.interval >= 21 ? 'mastered' : 'review'
    }
    if (quality < 3) {
      card.status = 'learning'
    }
    this.saveCard(card)

    // Move to completed
    item.lastQuality = quality
    session.reinforcementQueue.splice(idx, 1)
    session.completed.push(item)
    this.recordDailyStat('reviewed')

    const done = session.reinforcementQueue.length === 0
    if (done) {
      this.clearPersistedReviewSession()
    } else {
      this.persistReviewSession(sessionId)
    }

    const nextWord = done ? undefined : this.getNextReinforcementWord(sessionId)

    return {
      done,
      repeated: false,
      stats: done ? { ...session.stats } : undefined,
      phase: 2,
      nextWord: nextWord?.done ? undefined : nextWord
    }
  }

  // Legacy method — kept for backward compatibility
  submitReviewAnswer(sessionId: string, word: string, quality: number): ReviewSubmitResult {
    const session = this.reviewSessions.get(sessionId)
    if (!session) return { done: true, repeated: false }

    if (session.phase === 2) {
      return this.completeReinforcementWord(sessionId, word, quality)
    }

    // Phase 1 fallback (should not be called in new flow)
    return this.completePhase1Word(sessionId, word, quality >= 5 ? 'know' : quality >= 3 ? 'vague' : 'unknown')
  }

  markAsMasteredByTrash(level: string, word: string): boolean {
    const levelKey = level as 'cet4' | 'cet6'
    const card = this.getOrCreateCard(word, levelKey)
    card.status = 'mastered'
    card.markedTrash = true
    card.masteredBy = 'trash'
    card.correctStreak = 0
    this.saveCard(card)

    // Remove from current session queue if present
    const session = this.getSession()
    if (session) {
      const idx = session.queue.findIndex((e) => e.word === word)
      if (idx !== -1) {
        session.queue.splice(idx, 1)
        session.completed.push(word)
        this.saveSession(session)
      }
    }

    return true
  }

  getTrashWords(level?: string): { word: string; translation: string; level: string }[] {
    const cards = this.getCards()
    const result: { word: string; translation: string; level: string }[] = []
    for (const word in cards) {
      const card = cards[word]
      if (card.markedTrash && (!level || card.level === level)) {
        const detail = this.getWordDetail(word)
        result.push({ word, translation: detail.translation, level: card.level })
      }
    }
    return result
  }

  removeTrashMark(level: string, word: string): boolean {
    const card = this.getCard(word)
    if (!card) return false
    card.markedTrash = false
    card.masteredBy = null
    card.status = 'new'
    card.correctStreak = 0
    card.interval = 0
    card.repetitions = 0
    card.nextReviewDate = null
    this.saveCard(card)
    return true
  }

  getMasteredWords(level?: string): { word: string; translation: string; level: string; masteredBy: string }[] {
    const cards = this.getCards()
    const result: { word: string; translation: string; level: string; masteredBy: string }[] = []
    for (const word in cards) {
      const card = cards[word]
      if (card.status === 'mastered' && (!level || card.level === level)) {
        const detail = this.getWordDetail(word)
        result.push({
          word,
          translation: detail.translation,
          level: card.level,
          masteredBy: card.masteredBy || 'normal'
        })
      }
    }
    return result
  }

  resetMasteredWords(level?: string): number {
    const cards = this.getCards()
    let count = 0
    for (const word in cards) {
      const card = cards[word]
      if (card.status === 'mastered' && (!level || card.level === level)) {
        card.status = 'new'
        card.correctStreak = 0
        card.interval = 0
        card.repetitions = 0
        card.nextReviewDate = null
        card.markedTrash = false
        card.masteredBy = null
        this.saveCard(card)
        count++
      }
    }
    return count
  }

  resetWord(level: string, word: string): boolean {
    const card = this.getCard(word)
    if (!card) return false
    card.status = 'new'
    card.correctStreak = 0
    card.interval = 0
    card.repetitions = 0
    card.nextReviewDate = null
    card.markedTrash = false
    card.masteredBy = null
    this.saveCard(card)
    return true
  }

  clearTrashMarks(): number {
    const cards = this.getCards()
    let count = 0
    for (const word in cards) {
      const card = cards[word]
      if (card.markedTrash) {
        card.status = 'new'
        card.markedTrash = false
        card.masteredBy = null
        card.correctStreak = 0
        card.interval = 0
        card.repetitions = 0
        card.nextReviewDate = null
        this.saveCard(card)
        count++
      }
    }
    return count
  }

  resetLevel(level: 'cet4' | 'cet6'): number {
    const cards = this.getCards()
    let count = 0
    for (const word in cards) {
      const card = cards[word]
      if (card.level === level && card.status !== 'new') {
        card.status = 'new'
        card.easeFactor = 2.5
        card.interval = 0
        card.repetitions = 0
        card.nextReviewDate = null
        card.correctStreak = 0
        card.markedTrash = false
        card.masteredBy = null
        this.saveCard(card)
        count++
      }
    }
    return count
  }

  resetAll(): void {
    this.store.set('cards', {})
    this.store.set('daily-stats', {})
  }

  getStatsSummary(level?: 'cet4' | 'cet6' | null): {
    totalWords: number
    mastered: number
    learning: number
    review: number
    newWords: number
    totalErrors: number
    streakDays: number
  } {
    const cards = this.getCards()
    let mastered = 0
    let learning = 0
    let review = 0
    let newWords = 0
    let totalWords = 0

    if (level) {
      const allWords = this.getLevelWords(level)
      totalWords = allWords.length
      for (const word of allWords) {
        const card = cards[word]
        if (!card || card.status === 'new') newWords++
        else if (card.status === 'mastered') mastered++
        else if (card.status === 'learning') learning++
        else if (card.status === 'review') review++
      }
    } else {
      for (const word in cards) {
        const card = cards[word]
        totalWords++
        if (card.status === 'new') newWords++
        else if (card.status === 'mastered') mastered++
        else if (card.status === 'learning') learning++
        else if (card.status === 'review') review++
      }
    }

    const dailyStats = (this.store.get('daily-stats') || {}) as Record<string, { learned: number; reviewed: number; errors: number }>
    let totalErrors = 0
    for (const date in dailyStats) {
      totalErrors += dailyStats[date].errors || 0
    }

    // Calculate streak days from today backwards
    let streakDays = 0
    const today = new Date()
    for (let i = 0; i < 365; i++) {
      const d = new Date(today)
      d.setDate(d.getDate() - i)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      const entry = dailyStats[key]
      if (entry && (entry.learned > 0 || entry.reviewed > 0)) {
        streakDays++
      } else if (i > 0) {
        break
      }
    }

    return { totalWords, mastered, learning, review, newWords, totalErrors, streakDays }
  }

  getDailyStats(days: number): { date: string; learned: number; reviewed: number; errors: number }[] {
    const dailyStats = (this.store.get('daily-stats') || {}) as Record<string, { learned: number; reviewed: number; errors: number }>
    const result: { date: string; learned: number; reviewed: number; errors: number }[] = []
    const today = new Date()

    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(today)
      d.setDate(d.getDate() - i)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      const entry = dailyStats[key]
      result.push({
        date: key,
        learned: entry?.learned || 0,
        reviewed: entry?.reviewed || 0,
        errors: entry?.errors || 0
      })
    }

    return result
  }
}
