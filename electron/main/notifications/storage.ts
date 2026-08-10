import { app } from 'electron'
import { join } from 'path'
import { existsSync, readFileSync, writeFileSync, readdirSync } from 'fs'
import logger from 'electron-log/main'
import type { NotificationSettings, NotificationItem } from '../../preload/index'

/**
 * Where notification settings, history and custom sounds live on disk. Kept
 * apart from the poller: this part is about files, that one is about tickets.
 */
export function notificationSettingsPath(): string {
  return join(app.getPath('userData'), 'notifications_settings.json')
}

export function notificationHistoryPath(): string {
  return join(app.getPath('userData'), 'notifications_history.json')
}

export function soundsDir(): string {
  return join(app.getPath('userData'), 'notification_sounds')
}

export function readNotificationSettings(): NotificationSettings {
  const defaultSettings: NotificationSettings = {
    myTicketsEnabled: true,
    myTicketsSound: 'synth-chime',
    myTicketsVolume: 1.0,
    myTicketsSoundEnabled: true,
    myTicketsToastEnabled: true,
    scoreEnabled: true,
    rules: []
  }
  try {
    const p = notificationSettingsPath()
    if (existsSync(p)) {
      return JSON.parse(readFileSync(p, 'utf8'))
    }
  } catch (err) {
    logger.error(err)
  }
  return defaultSettings
}

export function writeNotificationSettings(settings: NotificationSettings): void {
  try {
    const p = notificationSettingsPath()
    writeFileSync(p, JSON.stringify(settings, null, 2), 'utf8')
  } catch (err) {
    logger.error(err)
  }
}

export function readNotificationHistory(): NotificationItem[] {
  try {
    const p = notificationHistoryPath()
    if (existsSync(p)) {
      return JSON.parse(readFileSync(p, 'utf8'))
    }
  } catch (err) {
    logger.error(err)
  }
  return []
}

export function writeNotificationHistory(history: NotificationItem[]): void {
  try {
    const p = notificationHistoryPath()
    writeFileSync(p, JSON.stringify(history, null, 2), 'utf8')
  } catch (err) {
    logger.error(err)
  }
}

export function getAvailableSounds() {
  const sounds: { name: string; dataUrl: string | null }[] = [
    { name: 'synth-chime', dataUrl: null }
  ]
  try {
    const dir = soundsDir()
    if (existsSync(dir)) {
      const files = readdirSync(dir)
      files.forEach((file: string) => {
        const p = join(dir, file)
        const buf = readFileSync(p)
        let mime = 'audio/mpeg'
        if (file.endsWith('.wav')) mime = 'audio/wav'
        if (file.endsWith('.ogg')) mime = 'audio/ogg'
        sounds.push({
          name: file,
          dataUrl: `data:${mime};base64,${buf.toString('base64')}`
        })
      })
    }
  } catch (err) {
    logger.error(err)
  }
  return sounds
}
