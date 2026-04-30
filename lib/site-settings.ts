import { z } from 'zod'
import { getSupabaseAdmin } from '@/lib/supabaseServer'
import { logError } from '@/lib/logger'

export type WifiSettings = {
  ssid: string
  password: string
  security: 'WPA' | 'WEP' | 'nopass'
  hidden: boolean
}

export const DEFAULT_WIFI_SETTINGS: WifiSettings = {
  ssid: 'Leafwalk Resort',
  password: 'Password-123456',
  security: 'WPA',
  hidden: false,
}

export const wifiSettingsSchema = z.object({
  ssid: z.string().trim().min(1).max(120),
  password: z.string().trim().min(1).max(120),
  security: z.enum(['WPA', 'WEP', 'nopass']).default('WPA'),
  hidden: z.boolean().default(false),
})

export function normalizeWifiSettingsInput(value: unknown) {
  const record = typeof value === 'object' && value ? value as Record<string, unknown> : {}
  return {
    ssid: String(record.ssid || '').trim(),
    password: String(record.password || '').trim(),
    security: String(record.security || DEFAULT_WIFI_SETTINGS.security).trim().toUpperCase(),
    hidden: Boolean(record.hidden),
  }
}

function toWifiSettings(value: {
  ssid?: string
  password?: string
  security?: 'WPA' | 'WEP' | 'nopass'
  hidden?: boolean
}): WifiSettings {
  return {
    ssid: String(value.ssid || DEFAULT_WIFI_SETTINGS.ssid),
    password: String(value.password || DEFAULT_WIFI_SETTINGS.password),
    security: value.security || DEFAULT_WIFI_SETTINGS.security,
    hidden: Boolean(value.hidden),
  }
}

export async function getWifiSettings(): Promise<WifiSettings> {
  try {
    const { data, error } = await getSupabaseAdmin()
      .from('site_settings')
      .select('wifi_ssid, wifi_password, wifi_security, wifi_hidden')
      .eq('key', 'global')
      .maybeSingle() as any

    if (error) {
      throw error
    }

    if (!data) {
      return DEFAULT_WIFI_SETTINGS
    }

    const parsed = wifiSettingsSchema.safeParse({
      ssid: data.wifi_ssid || DEFAULT_WIFI_SETTINGS.ssid,
      password: data.wifi_password || DEFAULT_WIFI_SETTINGS.password,
      security: data.wifi_security || DEFAULT_WIFI_SETTINGS.security,
      hidden: Boolean(data.wifi_hidden),
    })

    return parsed.success ? toWifiSettings(parsed.data) : DEFAULT_WIFI_SETTINGS
  } catch (error) {
    logError('Failed to load Wi-Fi settings; using defaults', error)
    return DEFAULT_WIFI_SETTINGS
  }
}

export async function saveWifiSettings(settings: WifiSettings, updatedBy?: string | null) {
  const payload = {
    key: 'global',
    wifi_ssid: settings.ssid,
    wifi_password: settings.password,
    wifi_security: settings.security,
    wifi_hidden: settings.hidden,
    updated_at: new Date().toISOString(),
    updated_by: updatedBy || null,
  }

  const { error } = await getSupabaseAdmin()
    .from('site_settings')
    .upsert(payload as any, { onConflict: 'key' })

  if (error) {
    throw error
  }

  return settings
}
