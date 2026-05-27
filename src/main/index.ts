import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import { readFileSync } from 'fs'
import initSqlJs, { Database } from 'sql.js'
import { LearningService } from './services/learningService'
import { SettingsService } from './services/settingsService'
import { StateService } from './services/stateService'

// Database path
const isDev = is.dev
const dbPath = isDev
  ? join(__dirname, '../../resources/stardict.db')
  : join(process.resourcesPath, 'resources', 'stardict.db')
let db: Database
let learningService: LearningService
const settingsService = new SettingsService()
const stateService = new StateService()

async function initDatabase(): Promise<void> {
  console.log('[DB] Initializing database...')
  console.log('[DB] Database path:', dbPath)

  const SQL = await initSqlJs({
    locateFile: (file) =>
      isDev ? join(__dirname, file) : join(process.resourcesPath, 'resources', file)
  })
  const fileBuffer = readFileSync(dbPath)
  console.log('[DB] File size:', fileBuffer.length, 'bytes')

  db = new SQL.Database(fileBuffer)
  console.log('[DB] Database loaded successfully')

  // Probe database structure
  console.log('\n=== Database Structure ===')
  const tablesResult = db.exec("SELECT name FROM sqlite_master WHERE type='table'")
  const tables = tablesResult.length > 0 ? tablesResult[0].values : []
  console.log('[DB] Tables found:', tables.map((t) => t[0]))

  for (const table of tables) {
    const tableName = table[0] as string
    const columnsResult = db.exec(`PRAGMA table_info(${tableName})`)
    console.log(`\n[DB] Table: ${tableName}`)
    console.log('[DB] Columns:', columnsResult.length > 0 ? columnsResult[0].values : [])
  }
  console.log('=== End Database Structure ===')

  // Test query: check total rows
  const totalResult = db.exec('SELECT COUNT(*) FROM stardict')
  const totalRows = totalResult.length > 0 ? totalResult[0].values[0][0] : 0
  console.log(`\n[DB] Total rows in stardict: ${totalRows}`)

  // Test query: get first 5 words
  console.log('\n[DB] First 5 words:')
  const firstFive = db.exec('SELECT word, tag FROM stardict LIMIT 5')
  if (firstFive.length > 0) {
    for (const row of firstFive[0].values) {
      console.log(`  Word: ${row[0]}, Tag: ${row[1]}`)
    }
  }

  // Test query: search for words starting with 'a'
  console.log("\n[DB] Test search for 'a%':")
  const testSearch = db.exec("SELECT word FROM stardict WHERE LOWER(word) LIKE 'a%' LIMIT 10")
  if (testSearch.length > 0) {
    for (const row of testSearch[0].values) {
      console.log(`  Found: ${row[0]}`)
    }
  } else {
    console.log('  [DB] No results found!')
  }

  // Count words by tag patterns
  const cet4Result = db.exec("SELECT COUNT(*) FROM stardict WHERE tag LIKE '%cet4%'")
  const cet6Result = db.exec("SELECT COUNT(*) FROM stardict WHERE tag LIKE '%cet6%'")
  console.log(`\n[DB] Words with 'cet4' tag: ${cet4Result[0]?.values[0]?.[0] || 0}`)
  console.log(`[DB] Words with 'cet6' tag: ${cet6Result[0]?.values[0]?.[0] || 0}`)
  console.log('=== End Debug ===\n')
}

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// IPC handler for ping
ipcMain.handle('ping', () => {
  return 'pong'
})

// IPC handler for query-word
ipcMain.handle('query-word', (_event, word: string) => {
  console.log('[IPC] query-word called with:', word)
  const stmt = db.prepare('SELECT * FROM stardict WHERE word = :word')
  stmt.bind({ ':word': word })
  if (stmt.step()) {
    const columns = stmt.getColumnNames()
    const values = stmt.get()
    stmt.free()
    const row: Record<string, unknown> = {}
    columns.forEach((col, i) => {
      row[col] = values[i]
    })
    console.log('[IPC] query-word result:', row.word)
    return row
  }
  stmt.free()
  console.log('[IPC] query-word: not found')
  return null
})

// IPC handler for get-word-list
ipcMain.handle(
  'get-word-list',
  (_event, options: { level: string; offset: number; limit: number }) => {
    console.log('[IPC] get-word-list called with:', options)
    const { level, offset, limit } = options
    const tagPattern = `%${level}%`
    const stmt = db.prepare(
      'SELECT word FROM stardict WHERE tag LIKE :tag LIMIT :limit OFFSET :offset'
    )
    stmt.bind({ ':tag': tagPattern, ':limit': limit, ':offset': offset })
    const rows: { word: string }[] = []
    while (stmt.step()) {
      const values = stmt.get()
      rows.push({ word: values[0] as string })
    }
    stmt.free()
    console.log('[IPC] get-word-list returned', rows.length, 'words')
    return rows
  }
)

// IPC handler for search-words (with level filter)
ipcMain.handle(
  'search-words',
  (_event, options: { keyword: string; level: string }) => {
    console.log('[IPC] search-words called with:', options)
    const { keyword, level } = options
    const pattern = `${keyword}%`
    const tagPattern = `%${level}%`
    const stmt = db.prepare(
      'SELECT word FROM stardict WHERE tag LIKE :tag AND LOWER(word) LIKE LOWER(:pattern) LIMIT 100'
    )
    stmt.bind({ ':tag': tagPattern, ':pattern': pattern })
    const rows: { word: string }[] = []
    while (stmt.step()) {
      const values = stmt.get()
      rows.push({ word: values[0] as string })
    }
    stmt.free()
    console.log('[IPC] search-words returned', rows.length, 'words')
    return rows
  }
)

// IPC handler for get-word-count
ipcMain.handle('get-word-count', (_event, level: string) => {
  console.log('[IPC] get-word-count called with level:', level)
  const tagPattern = `%${level}%`
  const stmt = db.prepare('SELECT COUNT(*) FROM stardict WHERE tag LIKE :tag')
  stmt.bind({ ':tag': tagPattern })
  let count = 0
  if (stmt.step()) {
    count = stmt.get()[0] as number
  }
  stmt.free()
  console.log('[IPC] get-word-count result:', count)
  return count
})

// IPC handler for search-all-words (global search, no level filter)
ipcMain.handle('search-all-words', (_event, keyword: string) => {
  console.log('[IPC] search-all-words called with keyword:', keyword)
  try {
    const pattern = `${keyword}%`
    console.log('[IPC] Search pattern:', pattern)

    if (!db) {
      console.error('[IPC] Database not initialized!')
      return []
    }

    // Filter out phrases, prioritize CET4/CET6 words, then alphabetical
    const stmt = db.prepare(
      `SELECT word, phonetic, translation, definition, tag
       FROM stardict
       WHERE LOWER(word) LIKE LOWER(:pattern)
         AND word NOT LIKE '% %'
         AND word NOT LIKE '%(%'
         AND word NOT LIKE '%)%'
         AND word NOT LIKE '%-%'
       ORDER BY
         CASE WHEN tag LIKE '%cet4%' OR tag LIKE '%cet6%' THEN 0 ELSE 1 END,
         LOWER(word) ASC
       LIMIT 100`
    )
    stmt.bind({ ':pattern': pattern })
    const rows: {
      word: string
      phonetic: string
      translation: string
      definition: string
      tag: string
    }[] = []
    while (stmt.step()) {
      const values = stmt.get()
      rows.push({
        word: values[0] as string,
        phonetic: (values[1] as string) || '',
        translation: (values[2] as string) || '',
        definition: (values[3] as string) || '',
        tag: (values[4] as string) || ''
      })
    }
    stmt.free()
    console.log('[IPC] search-all-words returned', rows.length, 'results')
    if (rows.length > 0) {
      console.log('[IPC] First 3 results:', rows.slice(0, 3))
    }
    return rows
  } catch (error) {
    console.error('[IPC] search-all-words error:', error)
    return []
  }
})

// Settings IPC handlers
ipcMain.handle('get-settings', () => {
  return settingsService.getSettings()
})

ipcMain.handle('update-settings', (_event, settings: Partial<{ learnGroupSize: number; reviewGroupSize: number }>) => {
  console.log('[IPC] update-settings called with:', settings)
  const result = settingsService.updateSettings(settings)
  console.log('[IPC] update-settings result:', result)
  return result
})

// App state IPC handlers
ipcMain.handle('get-app-state', () => {
  return stateService.getState()
})

ipcMain.handle('save-app-state', (_event, data: Record<string, unknown>) => {
  return stateService.saveState(data)
})

ipcMain.handle('restore-review-session', (_event, sessionId: string) => {
  return learningService.restoreReviewSession(sessionId)
})

ipcMain.handle('get-active-session', (_event, level: string) => {
  return stateService.getActiveSessionForLevel(level)
})

// Learning IPC handlers
ipcMain.handle('create-session', (_event, options: { level: string; groupSize?: number }) => {
  console.log('[IPC] create-session called with:', options)
  const groupSize = options.groupSize || settingsService.getSettings().learnGroupSize
  const result = learningService.createSession(options.level, groupSize)
  console.log('[IPC] create-session result:', result.sessionId, result.words.length, 'words')
  stateService.saveState({
    activeSession: { type: 'learn', sessionId: result.sessionId, level: options.level }
  })
  return result
})

ipcMain.handle('get-next-word', (_event, sessionId: string) => {
  console.log('[IPC] get-next-word called with sessionId:', sessionId)
  const result = learningService.getNextWord(sessionId)
  console.log('[IPC] get-next-word result:', result.done ? 'done' : result.word)
  return result
})

ipcMain.handle(
  'submit-answer',
  (_event, options: { sessionId: string; word: string; answer: string }) => {
    console.log('[IPC] submit-answer called with:', options)
    const result = learningService.submitAnswer(
      options.sessionId,
      options.word,
      options.answer
    )
    console.log('[IPC] submit-answer result:', result.correct, result.mastered)
    return result
  }
)

ipcMain.handle('get-session-stats', (_event, sessionId: string) => {
  console.log('[IPC] get-session-stats called with sessionId:', sessionId)
  const result = learningService.getSessionStats(sessionId)
  return result
})

ipcMain.handle('end-session', (_event, sessionId: string) => {
  console.log('[IPC] end-session called with sessionId:', sessionId)
  const result = learningService.endSession(sessionId)
  console.log('[IPC] end-session result:', result)
  stateService.clearActiveSession()
  return result
})

ipcMain.handle('get-review-queue', (_event, level: string) => {
  console.log('[IPC] get-review-queue called with level:', level)
  const maxSize = settingsService.getSettings().reviewGroupSize
  const result = learningService.getReviewQueue(level).slice(0, maxSize)
  console.log('[IPC] get-review-queue returned', result.length, 'words')
  return result
})

ipcMain.handle('create-review-session', (_event, level: string) => {
  console.log('[IPC] create-review-session called with level:', level)
  const groupSize = settingsService.getSettings().reviewGroupSize
  const result = learningService.createReviewSession(level, groupSize)
  console.log('[IPC] create-review-session result:', result)
  stateService.saveState({
    activeSession: { type: 'review', sessionId: result.sessionId, level }
  })
  return result
})

ipcMain.handle('get-next-review-word', (_event, sessionId: string) => {
  const result = learningService.getNextReviewWord(sessionId)
  return result
})

ipcMain.handle(
  'submit-review-answer',
  (_event, options: { sessionId: string; word: string; quality: number }) => {
    console.log('[IPC] submit-review-answer called with:', options)
    const result = learningService.submitReviewAnswer(
      options.sessionId,
      options.word,
      options.quality
    )
    console.log('[IPC] submit-review-answer result:', result)
    return result
  }
)

ipcMain.handle(
  'complete-phase1-word',
  (_event, options: { sessionId: string; word: string; label: 'know' | 'vague' | 'unknown' }) => {
    const result = learningService.completePhase1Word(
      options.sessionId,
      options.word,
      options.label
    )
    return result
  }
)

ipcMain.handle(
  'complete-reinforcement-word',
  (_event, options: { sessionId: string; word: string; quality: number }) => {
    const result = learningService.completeReinforcementWord(
      options.sessionId,
      options.word,
      options.quality
    )
    return result
  }
)

ipcMain.handle(
  'requeue-reinforcement-word',
  (_event, options: { sessionId: string; word: string }) => {
    console.log('[IPC] requeue-reinforcement-word called with:', options)
    const result = learningService.requeueReinforcementWord(
      options.sessionId,
      options.word
    )
    return result
  }
)

ipcMain.handle('get-review-phase', (_event, sessionId: string) => {
  return learningService.getReviewPhase(sessionId)
})

ipcMain.handle(
  'change-reinforcement-label',
  (_event, options: { sessionId: string; word: string; newLabel: 'vague' | 'unknown' }) => {
    console.log('[IPC] change-reinforcement-label called with:', options)
    return learningService.changeReinforcementLabel(options.sessionId, options.word, options.newLabel)
  }
)

ipcMain.handle(
  'get-first-reinforcement-word',
  (_event, sessionId: string) => {
    return learningService.getFirstReinforcementWord(sessionId)
  }
)

ipcMain.handle(
  'mark-as-wrong',
  (_event, options: { word: string; level: string; sessionType: 'learn' | 'review'; sessionId?: string }) => {
    console.log('[IPC] mark-as-wrong called with:', options)
    if (options.sessionType === 'learn') {
      return learningService.markWordAsWrongInLearn(options.word, options.level)
    } else {
      return learningService.markWordAsWrongInReview(options.word, options.sessionId || '')
    }
  }
)

ipcMain.handle('get-stats', (_event, level: string) => {
  console.log('[IPC] get-stats called with level:', level)
  const result = learningService.getStats(level)
  console.log('[IPC] get-stats result:', result)
  return result
})

ipcMain.handle('get-review-count', (_event, level: string) => {
  console.log('[IPC] get-review-count called with level:', level)
  const result = learningService.getReviewCount(level)
  console.log('[IPC] get-review-count result:', result)
  return result
})

ipcMain.handle('mark-mastered-trash', (_event, options: { level: string; word: string }) => {
  console.log('[IPC] mark-mastered-trash called with:', options)
  const result = learningService.markAsMasteredByTrash(options.level, options.word)
  return result
})

ipcMain.handle('get-trash-words', (_event, options?: { level?: string }) => {
  const result = learningService.getTrashWords(options?.level)
  return result
})

ipcMain.handle('remove-trash-mark', (_event, options: { level: string; word: string }) => {
  console.log('[IPC] remove-trash-mark called with:', options)
  const result = learningService.removeTrashMark(options.level, options.word)
  return result
})

ipcMain.handle('get-mastered-words', (_event, options?: { level?: string }) => {
  const result = learningService.getMasteredWords(options?.level)
  return result
})

ipcMain.handle('reset-mastered-words', (_event, options?: { level?: string }) => {
  console.log('[IPC] reset-mastered-words called with:', options)
  const result = learningService.resetMasteredWords(options?.level)
  return result
})

ipcMain.handle('reset-word', (_event, options: { level: string; word: string }) => {
  console.log('[IPC] reset-word called with:', options)
  const result = learningService.resetWord(options.level, options.word)
  return result
})

ipcMain.handle('clear-trash-marks', () => {
  console.log('[IPC] clear-trash-marks called')
  const result = learningService.clearTrashMarks()
  console.log('[IPC] clear-trash-marks result:', result)
  return result
})

ipcMain.handle('reset-level', (_event, options: { level: 'cet4' | 'cet6' }) => {
  console.log('[IPC] reset-level called with:', options)
  const result = learningService.resetLevel(options.level)
  console.log('[IPC] reset-level result:', result)
  return result
})

ipcMain.handle('reset-all', () => {
  console.log('[IPC] reset-all called')
  learningService.resetAll()
  return true
})

ipcMain.handle('get-stats-summary', (_event, options?: { level?: 'cet4' | 'cet6' }) => {
  console.log('[IPC] get-stats-summary called with:', options)
  const result = learningService.getStatsSummary(options?.level)
  return result
})

ipcMain.handle('get-daily-stats', (_event, options: { days: number }) => {
  console.log('[IPC] get-daily-stats called with:', options)
  const result = learningService.getDailyStats(options.days)
  return result
})

app.whenReady().then(async () => {
  await initDatabase()
  learningService = new LearningService(db)
  createWindow()

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', () => {
  // Final state save — safety net in case last operation didn't persist
  if (stateService) {
    const state = stateService.getState()
    stateService.saveState(state)
  }
})
