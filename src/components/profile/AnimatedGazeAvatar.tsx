import { memo, useState, useEffect } from 'react'
import {
  View,
  StyleSheet,
  Text,
  type StyleProp,
  type ViewStyle,
} from 'react-native'
import { WebView } from 'react-native-webview'
import {
  getGazeAvatarHtml,
  getDefaultGazeSvg,
  getCachedGazeSvg,
  fetchAndCacheGazeSvg,
} from '@/lib/gazeAvatar'

export interface AnimatedGazeAvatarProps {
  seed?: string | null
  size?: number
  fallbackInitials?: string
  style?: StyleProp<ViewStyle>
}

/**
 * Componente visual para avatares animados procedurales de DiceBear (Estilo Gaze).
 * Renderiza el SVG con animación CSS activa (parpadeo, mirada, rebote) a 60 FPS.
 *
 * - 100% Offline-First: Incluye SVG animado en memoria y caché local (AsyncStorage).
 * - En iOS/Android: Utiliza WKWebView / Android WebView con transparencia y aceleración nativa.
 * - Frame 0 listo: Inicia instantáneamente sin esperar peticiones de red.
 */
export const AnimatedGazeAvatar = memo(function AnimatedGazeAvatar({
  seed = 'student_avatar',
  size = 48,
  fallbackInitials = 'ES',
  style,
}: AnimatedGazeAvatarProps) {
  const [hasError, setHasError] = useState(false)
  const avatarSeed = seed || 'student_avatar'
  const [svgXml, setSvgXml] = useState<string>(() => getDefaultGazeSvg())

  useEffect(() => {
    let isMounted = true
    getCachedGazeSvg(avatarSeed).then((cached) => {
      if (cached && isMounted) {
        setSvgXml(cached)
      } else {
        fetchAndCacheGazeSvg(avatarSeed).then((fetched) => {
          if (fetched && isMounted) {
            setSvgXml(fetched)
          }
        })
      }
    })
    return () => {
      isMounted = false
    }
  }, [avatarSeed])

  const avatarHtml = getGazeAvatarHtml(avatarSeed, svgXml)
  const radius = Math.round(size / 2)

  return (
    <View
      style={[
        styles.container,
        { width: size, height: size, borderRadius: radius },
        style,
      ]}
      pointerEvents="none"
    >
      {/* Capa base de respaldo con iniciales si hay error */}
      {hasError ? (
        <View style={[styles.fallbackContainer, { width: size, height: size, borderRadius: radius }]}>
          <Text style={[styles.fallbackText, { fontSize: Math.round(size * 0.38) }]}>
            {fallbackInitials}
          </Text>
        </View>
      ) : (
        <WebView
          originWhitelist={['*']}
          source={{ html: avatarHtml, baseUrl: 'about:blank' }}
          style={styles.webView}
          containerStyle={[styles.webViewContainer, { width: size, height: size, borderRadius: radius }]}
          scrollEnabled={false}
          showsHorizontalScrollIndicator={false}
          showsVerticalScrollIndicator={false}
          scalesPageToFit={false}
          bounces={false}
          overScrollMode="never"
          opaque={false}
          onError={() => setHasError(true)}
          pointerEvents="none"
        />
      )}
    </View>
  )
})

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    backgroundColor: '#1C1C1E',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  webViewContainer: {
    backgroundColor: 'transparent',
    overflow: 'hidden',
  },
  webView: {
    backgroundColor: 'transparent',
    width: '100%',
    height: '100%',
  },
  fallbackContainer: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#1C1C1E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fallbackText: {
    color: '#FFFFFF',
    fontWeight: '800',
    letterSpacing: -0.3,
  },
})
