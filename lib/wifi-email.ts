import { logError } from '@/lib/logger'
import { DEFAULT_WIFI_SETTINGS, getWifiSettings, type WifiSettings } from '@/lib/site-settings'

type WifiEmailAttachment = {
  filename: string
  content: Buffer
  contentType: string
  cid: string
  disposition: 'inline'
}

export type WifiEmailPayload = {
  wifi: WifiSettings
  qrAttachment?: WifiEmailAttachment
}

const WIFI_QR_CID = 'leafwalk-wifi-qr'

function escapeWifiValue(value: string) {
  return value.replace(/([\\;,:"])/g, '\\$1')
}

function buildWifiQrText(settings: WifiSettings) {
  const base = `WIFI:T:${settings.security};S:${escapeWifiValue(settings.ssid)};`
  if (settings.security !== 'nopass') {
    return `${base}P:${escapeWifiValue(settings.password)};H:${settings.hidden ? 'true' : 'false'};;`
  }
  return `${base}H:${settings.hidden ? 'true' : 'false'};;`
}

export function buildWifiQrPreviewUrl(settings: WifiSettings) {
  return `https://quickchart.io/qr?size=220&text=${encodeURIComponent(buildWifiQrText(settings))}`
}

export async function buildWifiEmailPayload(): Promise<WifiEmailPayload> {
  const wifi = await getWifiSettings()

  try {
    const response = await fetch(buildWifiQrPreviewUrl(wifi), {
      cache: 'no-store',
      headers: {
        Accept: 'image/png',
      },
    })

    if (!response.ok) {
      throw new Error(`QR provider returned ${response.status}`)
    }

    const bytes = Buffer.from(await response.arrayBuffer())
    return {
      wifi,
      qrAttachment: {
        filename: 'leafwalk-wifi-qr.png',
        content: bytes,
        contentType: 'image/png',
        cid: WIFI_QR_CID,
        disposition: 'inline',
      },
    }
  } catch (error) {
    logError('Failed to generate Wi-Fi QR for email; continuing without QR image', error)
    return {
      wifi: wifi || DEFAULT_WIFI_SETTINGS,
    }
  }
}

export function getWifiQrCid() {
  return WIFI_QR_CID
}
