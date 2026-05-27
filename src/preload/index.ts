import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  ping: (): Promise<string> => ipcRenderer.invoke('ping'),
  queryWord: (word: string): Promise<Record<string, unknown> | null> =>
    ipcRenderer.invoke('query-word', word),
  getWordList: (options: {
    level: string
    offset: number
    limit: number
  }): Promise<Record<string, unknown>[]> => ipcRenderer.invoke('get-word-list', options),
  searchWords: (keyword: string, level: string): Promise<{ word: string }[]> =>
    ipcRenderer.invoke('search-words', { keyword, level }),
  getWordCount: (level: string): Promise<number> =>
    ipcRenderer.invoke('get-word-count', level),
  searchAllWords: (keyword: string): Promise<SearchResult[]> =>
    ipcRenderer.invoke('search-all-words', keyword),
  createSession: (
    level: string,
    groupSize?: number
  ): Promise<{ sessionId: string; words: string[] }> =>
    ipcRenderer.invoke('create-session', { level, groupSize }),
  getNextWord: (sessionId: string): Promise<NextWordResult> =>
    ipcRenderer.invoke('get-next-word', sessionId),
  submitAnswer: (
    sessionId: string,
    word: string,
    answer: string
  ): Promise<SubmitResult> =>
    ipcRenderer.invoke('submit-answer', { sessionId, word, answer }),
  getSessionStats: (sessionId: string): Promise<SessionStats | null> =>
    ipcRenderer.invoke('get-session-stats', sessionId),
  endSession: (sessionId: string): Promise<SessionStats | null> =>
    ipcRenderer.invoke('end-session', sessionId),
  getStats: (level: string): Promise<WordStats> =>
    ipcRenderer.invoke('get-stats', level),
  getReviewCount: (level: string): Promise<number> =>
    ipcRenderer.invoke('get-review-count', level),
  getReviewQueue: (
    level: string
  ): Promise<{ word: string; phonetic: string; translation: string; definition: string }[]> =>
    ipcRenderer.invoke('get-review-queue', level),
  createReviewSession: (level: string): Promise<{ sessionId: string; totalWords: number }> =>
    ipcRenderer.invoke('create-review-session', level),
  getNextReviewWord: (sessionId: string): Promise<ReviewWordResult> =>
    ipcRenderer.invoke('get-next-review-word', sessionId),
  submitReviewAnswer: (
    sessionId: string,
    word: string,
    quality: number
  ): Promise<ReviewSubmitResult> =>
    ipcRenderer.invoke('submit-review-answer', { sessionId, word, quality }),
  completePhase1Word: (
    sessionId: string,
    word: string,
    label: 'know' | 'vague' | 'unknown'
  ): Promise<ReviewSubmitResult> =>
    ipcRenderer.invoke('complete-phase1-word', { sessionId, word, label }),
  completeReinforcementWord: (
    sessionId: string,
    word: string,
    quality: number
  ): Promise<ReviewSubmitResult> =>
    ipcRenderer.invoke('complete-reinforcement-word', { sessionId, word, quality }),
  requeueReinforcementWord: (
    sessionId: string,
    word: string
  ): Promise<ReviewSubmitResult> =>
    ipcRenderer.invoke('requeue-reinforcement-word', { sessionId, word }),
  getReviewPhase: (sessionId: string): Promise<1 | 2> =>
    ipcRenderer.invoke('get-review-phase', sessionId),
  changeReinforcementLabel: (sessionId: string, word: string, newLabel: 'vague' | 'unknown'): Promise<boolean> =>
    ipcRenderer.invoke('change-reinforcement-label', { sessionId, word, newLabel }),
  getFirstReinforcementWord: (sessionId: string): Promise<ReviewSubmitResult> =>
    ipcRenderer.invoke('get-first-reinforcement-word', sessionId),
  getSettings: (): Promise<AppSettings> =>
    ipcRenderer.invoke('get-settings'),
  updateSettings: (settings: Partial<{ learnGroupSize: number; reviewGroupSize: number }>): Promise<AppSettings> =>
    ipcRenderer.invoke('update-settings', settings),
  markMasteredTrash: (level: string, word: string): Promise<boolean> =>
    ipcRenderer.invoke('mark-mastered-trash', { level, word }),
  getTrashWords: (level?: string): Promise<{ word: string; translation: string; level: string }[]> =>
    ipcRenderer.invoke('get-trash-words', level ? { level } : undefined),
  removeTrashMark: (level: string, word: string): Promise<boolean> =>
    ipcRenderer.invoke('remove-trash-mark', { level, word }),
  getMasteredWords: (level?: string): Promise<{ word: string; translation: string; level: string; masteredBy: string }[]> =>
    ipcRenderer.invoke('get-mastered-words', level ? { level } : undefined),
  resetMasteredWords: (level?: string): Promise<number> =>
    ipcRenderer.invoke('reset-mastered-words', level ? { level } : undefined),
  resetWord: (level: string, word: string): Promise<boolean> =>
    ipcRenderer.invoke('reset-word', { level, word }),
  getAppState: (): Promise<Record<string, unknown>> =>
    ipcRenderer.invoke('get-app-state'),
  saveAppState: (data: Record<string, unknown>): Promise<Record<string, unknown>> =>
    ipcRenderer.invoke('save-app-state', data),
  restoreReviewSession: (sessionId: string): Promise<boolean> =>
    ipcRenderer.invoke('restore-review-session', sessionId),
  getActiveSession: (level: string): Promise<Record<string, unknown> | null> =>
    ipcRenderer.invoke('get-active-session', level),
  markAsWrong: (word: string, level: string, sessionType: 'learn' | 'review', sessionId?: string): Promise<boolean> =>
    ipcRenderer.invoke('mark-as-wrong', { word, level, sessionType, sessionId }),
  clearTrashMarks: (): Promise<number> =>
    ipcRenderer.invoke('clear-trash-marks'),
  resetLevel: (level: 'cet4' | 'cet6'): Promise<number> =>
    ipcRenderer.invoke('reset-level', { level }),
  resetAll: (): Promise<boolean> =>
    ipcRenderer.invoke('reset-all'),
  getStatsSummary: (level?: 'cet4' | 'cet6'): Promise<{
    totalWords: number
    mastered: number
    learning: number
    review: number
    newWords: number
    totalErrors: number
    streakDays: number
  }> =>
    ipcRenderer.invoke('get-stats-summary', level ? { level } : undefined),
  getDailyStats: (days: number): Promise<{ date: string; learned: number; reviewed: number; errors: number }[]> =>
    ipcRenderer.invoke('get-daily-stats', { days })
})
