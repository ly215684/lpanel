import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export interface PanelSettings {
  panelTitle: string
  panelDescription: string
  monitorInterval: number
  maxFileSize: number
  defaultTheme: string
}

const DEFAULT_SETTINGS: PanelSettings = {
  panelTitle: 'LPanel',
  panelDescription: 'Linux Server Management Panel',
  monitorInterval: 5000,
  maxFileSize: 52428800,
  defaultTheme: 'light'
}

export async function getSettings(): Promise<PanelSettings> {
  const settings = await prisma.panelSetting.findMany()
  const settingsMap = new Map<string, string>(settings.map((s: { key: string; value: string }) => [s.key, s.value]))

  const getString = (key: string, defaultValue: string): string => {
    const value = settingsMap.get(key)
    return value !== undefined ? value : defaultValue
  }

  const getNumber = (key: string, defaultValue: number): number => {
    const value = settingsMap.get(key)
    return value !== undefined ? parseInt(value) : defaultValue
  }

  return {
    panelTitle: getString('panelTitle', DEFAULT_SETTINGS.panelTitle),
    panelDescription: getString('panelDescription', DEFAULT_SETTINGS.panelDescription),
    monitorInterval: getNumber('monitorInterval', DEFAULT_SETTINGS.monitorInterval),
    maxFileSize: getNumber('maxFileSize', DEFAULT_SETTINGS.maxFileSize),
    defaultTheme: getString('defaultTheme', DEFAULT_SETTINGS.defaultTheme)
  }
}

export async function updateSettings(settings: Partial<PanelSettings>) {
  const entries = Object.entries(settings) as [keyof PanelSettings, string | number][]

  for (const [key, value] of entries) {
    await prisma.panelSetting.upsert({
      where: { key },
      update: { value: String(value) },
      create: {
        key,
        value: String(value),
        description: getSettingDescription(key)
      }
    })
  }

  return getSettings()
}

function getSettingDescription(key: keyof PanelSettings): string {
  const descriptions: Record<keyof PanelSettings, string> = {
    panelTitle: '面板标题',
    panelDescription: '面板描述',
    monitorInterval: '监控刷新间隔（毫秒）',
    maxFileSize: '最大文件上传大小（字节）',
    defaultTheme: '默认主题（light/dark）'
  }
  return descriptions[key]
}