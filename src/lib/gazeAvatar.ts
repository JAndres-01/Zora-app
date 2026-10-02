import AsyncStorage from '@react-native-async-storage/async-storage'
import { logger } from './logger'

/**
 * Utilidades para avatares animados procedurales de DiceBear (estilo Gaze).
 * https://github.com/dicebear/dicebear
 *
 * El estilo Gaze genera avatares SVG con animaciones CSS puras (@keyframes)
 * para parpadeo (dbgaBlink), mirada errante (dbgaLook) y rebote sutil (dbgaHop).
 */

export const DICEBEAR_GAZE_API_VERSION = '10.x'
const CACHE_PREFIX = '@synapse_avatar_svg_'

// SVG animado por defecto pre-compilado para renderizado instantáneo a 0ms sin esperar red
const DEFAULT_GAZE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="none" shape-rendering="auto" aria-hidden="true"><defs><g id="eyes-small"><g class="dbga-eye"><circle cx="8" cy="8" r="3.9" fill="#0f172a"/></g></g><g id="spacing-snug"><use transform="translate(11) translate(8, 8) scale(0.8995) translate(-8, -8)" href="#eyes-small"/><use transform="translate(33) translate(8, 8) scale(0.8995) translate(-8, -8)" href="#eyes-small"/></g><g id="shape-circle"><circle cx="50" cy="50" r="34" fill="#52dcd8"/><g class="dbga-look"><use transform="translate(20 46)" href="#spacing-snug"/></g></g><g id="animation-medium"><g class="dbga-medium"/><style>@keyframes dbgaLook{0%,16%{transform:translate(0,0)}24%,38%{transform:translate(-3.6px,0.9px)}46%,60%{transform:translate(3.4px,-0.7px)}68%,82%{transform:translate(0.7px,1.7px)}90%,100%{transform:translate(0,0)}}@keyframes dbgaBlink{0%,94%,97%,100%{transform:scaleY(1)}95.5%{transform:scaleY(0.06)}}@keyframes dbgaHop{0%,58%,100%{transform:translateY(0) scale(1,1)}64%{transform:translateY(0) scale(1.06,0.94)}73%{transform:translateY(-4px) scale(0.96,1.05)}82%{transform:translateY(0) scale(1.05,0.95)}90%{transform:translateY(0) scale(0.99,1.01)}}.dbga-eye,.dbga-look{transform-box:fill-box;transform-origin:center}.dbga-hop{transform-box:fill-box;transform-origin:50% 100%}.dbga-look{animation:dbgaLook 6.4s ease-in-out infinite}.dbga-eye{animation:dbgaBlink 4.4s linear infinite}.dbga-hop{animation:dbgaHop 5.2s ease-out infinite}.dbga-eye,.dbga-look,.dbga-hop{animation-play-state:running!important}}</style></g><clipPath id="clip"><rect width="100" height="100" rx="0" ry="0"/></clipPath></defs><g clip-path="url(#clip)"><g class="dbga-hop"><use transform="rotate(10.6247, 50, 50) translate(50, 50) scale(1.0491) translate(-50, -50)" href="#shape-circle"/></g><use href="#animation-medium"/></g></svg>`

const _memorySvgCache = new Map<string, string>([
  ['student_avatar', DEFAULT_GAZE_SVG],
])

/**
 * Retorna la URL directa del SVG animado de DiceBear Gaze para una semilla dada.
 */
export function getGazeAvatarUrl(seed: string): string {
  const safeSeed = encodeURIComponent(seed || 'student_avatar')
  return `https://api.dicebear.com/${DICEBEAR_GAZE_API_VERSION}/gaze/svg?seed=${safeSeed}&animationVariant=medium`
}

/**
 * Retorna el SVG XML por defecto pre-compilado en memoria para inicio a 0ms.
 */
export function getDefaultGazeSvg(): string {
  return DEFAULT_GAZE_SVG
}

/**
 * Obtiene el SVG XML almacenado en caché localmente (Memoria -> AsyncStorage).
 * Permite renderizado 100% offline a 0ms.
 */
export async function getCachedGazeSvg(seed: string): Promise<string | null> {
  const safeSeed = seed || 'student_avatar'
  if (_memorySvgCache.has(safeSeed)) {
    return _memorySvgCache.get(safeSeed) || DEFAULT_GAZE_SVG
  }
  try {
    const cached = await AsyncStorage.getItem(`${CACHE_PREFIX}${safeSeed}`)
    if (cached && cached.startsWith('<svg')) {
      _memorySvgCache.set(safeSeed, cached)
      return cached
    }
  } catch (err) {
    logger.warn('[gazeAvatar] Error leyendo caché local de avatar:', err)
  }
  return _memorySvgCache.get('student_avatar') || DEFAULT_GAZE_SVG
}

/**
 * Descarga el SVG animado desde la API y lo persiste permanentemente en caché local
 * para que funcione sin conexión a internet en todas las sesiones futuras.
 */
export async function fetchAndCacheGazeSvg(seed: string): Promise<string | null> {
  const safeSeed = seed || 'student_avatar'
  const cached = await getCachedGazeSvg(safeSeed)
  if (cached && cached !== DEFAULT_GAZE_SVG) return cached

  const url = getGazeAvatarUrl(safeSeed)
  try {
    const response = await fetch(url)
    if (response.ok) {
      const svgText = await response.text()
      if (svgText && svgText.includes('<svg')) {
        _memorySvgCache.set(safeSeed, svgText)
        await AsyncStorage.setItem(`${CACHE_PREFIX}${safeSeed}`, svgText)
        return svgText
      }
    }
  } catch (err) {
    logger.warn('[gazeAvatar] No se pudo descargar avatar (posiblemente offline):', err)
  }
  return cached || DEFAULT_GAZE_SVG
}

/**
 * Genera el documento HTML autocontenido para renderizar el SVG animado en WKWebView/WebView
 * con fondo transparente, centrado perfecto y aceleración por hardware.
 * Embebe el SVG inline para que los keyframes CSS corran a 60 FPS sin bloqueos.
 */
export function getGazeAvatarHtml(seed: string, svgXml?: string | null): string {
  const svgContent = svgXml || DEFAULT_GAZE_SVG

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
      -webkit-touch-callout: none;
      -webkit-user-select: none;
      user-select: none;
    }
    html, body {
      width: 100%;
      height: 100%;
      background: transparent;
      overflow: hidden;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 50%;
    }
    svg {
      width: 100%;
      height: 100%;
      display: block;
      border-radius: 50%;
    }
    .dbga-eye, .dbga-look, .dbga-hop {
      animation-play-state: running !important;
      --dbga-p: running !important;
      --dbga-t: 1 !important;
    }
  </style>
</head>
<body>
  ${svgContent}
</body>
</html>`
}
