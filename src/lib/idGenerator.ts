/**
 * Generador robusto de identificadores únicos no colisionables.
 * Utiliza el estándar Web Crypto API (globalThis.crypto.randomUUID) con fallback a timestamp de alta precisión.
 */
export function generateId(prefix: string = 'id'): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return `${prefix}_${globalThis.crypto.randomUUID()}`
  }
  const timestamp = Date.now().toString(36)
  const randomPart = Math.random().toString(36).substring(2, 12)
  return `${prefix}_${timestamp}_${randomPart}`
}
