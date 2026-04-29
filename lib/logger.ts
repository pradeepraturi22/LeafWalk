import { isLocalTestMode, isProduction } from '@/lib/runtime-mode'

export function logInfo(...args: unknown[]) {
  if (!isProduction() || isLocalTestMode()) {
    console.info(...args)
  }
}

export function logWarn(...args: unknown[]) {
  console.warn(...args)
}

export function logError(...args: unknown[]) {
  console.error(...args)
}

export function logDebug(...args: unknown[]) {
  if (isLocalTestMode()) {
    console.debug(...args)
  }
}
