import Store from 'electron-store'

export interface ActiveSession {
  type: 'learn' | 'review'
  sessionId: string
  level: string
}

export interface AppState {
  lastRoute: string
  lastLevel: 'cet4' | 'cet6' | null
  activeSession: ActiveSession | null
}

const DEFAULT_STATE: AppState = {
  lastRoute: '/',
  lastLevel: null,
  activeSession: null
}

export class StateService {
  private store: Store

  constructor() {
    this.store = new Store({
      name: 'app-state',
      defaults: { state: DEFAULT_STATE }
    })
  }

  getState(): AppState {
    const raw = this.store.get('state') as Record<string, unknown> || {}
    return {
      lastRoute: (raw.lastRoute as string) || DEFAULT_STATE.lastRoute,
      lastLevel: (raw.lastLevel as 'cet4' | 'cet6' | null) || null,
      activeSession: (raw.activeSession as ActiveSession) || null
    }
  }

  saveState(partial: Partial<AppState>): AppState {
    const current = this.getState()
    const merged = { ...current, ...partial }
    this.store.set('state', merged)
    return merged
  }

  clearActiveSession(): void {
    const current = this.getState()
    current.activeSession = null
    this.store.set('state', current)
  }

  getActiveSessionForLevel(level: string): ActiveSession | null {
    const state = this.getState()
    if (state.activeSession && state.activeSession.level === level) {
      return state.activeSession
    }
    return null
  }

  setLastRoute(route: string, level?: string): void {
    const current = this.getState()
    current.lastRoute = route
    if (level) {
      current.lastLevel = level as 'cet4' | 'cet6'
    }
    this.store.set('state', current)
  }
}
