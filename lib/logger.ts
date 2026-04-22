import { isLocalTestMode, isProduction } from '@/lib/runtime-mode'

export function logInfo(...args: unknown[]) {
  if (!isProduction() || isLocalTestMode()) {
    console.info(...args)
  }
}

export function logWarn(...args: unknown[]) {
  if (!isProduction() || isLocalTestMode()) {
    console.warn(...args)
  }
}

export function logError(...args: unknown[]) {
  if (!isProduction() || isLocalTestMode()) {
    console.error(...args)
  }
}

export function logDebug(...args: unknown[]) {
  if (isLocalTestMode()) {
    console.debug(...args)
  }
}
