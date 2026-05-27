import Store from 'electron-store'

export interface AppSettings {
  learnGroupSize: number
  reviewGroupSize: number
}

const DEFAULTS: AppSettings = {
  learnGroupSize: 20,
  reviewGroupSize: 20
}

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val))
}

export class SettingsService {
  private store: Store

  constructor() {
    this.store = new Store({
      name: 'app-settings',
      defaults: {
        settings: DEFAULTS
      }
    })
  }

  getSettings(): AppSettings {
    const raw = this.store.get('settings') as Record<string, unknown> || {}
    // Migrate old groupSize field
    if ('groupSize' in raw && !('learnGroupSize' in raw)) {
      const migrated: AppSettings = {
        learnGroupSize: (raw.groupSize as number) || 20,
        reviewGroupSize: (raw.groupSize as number) || 20
      }
      this.store.set('settings', migrated)
      return migrated
    }
    return {
      learnGroupSize: clamp((raw.learnGroupSize as number) ?? DEFAULTS.learnGroupSize, 5, 50),
      reviewGroupSize: clamp((raw.reviewGroupSize as number) ?? DEFAULTS.reviewGroupSize, 5, 50)
    }
  }

  updateSettings(partial: Partial<AppSettings>): AppSettings {
    const current = this.getSettings()
    const merged = { ...current, ...partial }
    merged.learnGroupSize = clamp(merged.learnGroupSize, 5, 50)
    merged.reviewGroupSize = clamp(merged.reviewGroupSize, 5, 50)
    this.store.set('settings', merged)
    return merged
  }
}
