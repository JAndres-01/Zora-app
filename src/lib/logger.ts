/**
 * Utilidad de registro centralizada con gating en modo desarrollo (__DEV__).
 * En producción (__DEV__ === false), suprime logs y warnings para optimizar rendimiento
 * y no emitir salidas innecesarias en runtime de dispositivos.
 */

export const logger = {
  log: (...args: unknown[]): void => {
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      console.log(...args)
    }
  },
  warn: (...args: unknown[]): void => {
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      console.warn(...args)
    }
  },
  error: (...args: unknown[]): void => {
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      console.error(...args)
    }
  },
}
