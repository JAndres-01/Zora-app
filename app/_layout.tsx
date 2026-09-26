import React, { useEffect, useState, useCallback, type ReactNode } from 'react'
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { ThemeProvider, DarkTheme } from '@react-navigation/native'
import { PersonalAuthProvider } from '@/context/PersonalAuthContext'
import { ClassAuthProvider } from '@/context/ClassAuthContext'
import { StyleSheet, Platform, View, Text, Alert } from 'react-native'
import * as SplashScreen from 'expo-splash-screen'
import { personalStorage } from '@/lib/personalStorage'
import { setupNotificationInfrastructure } from '@/lib/personalNotifications'
import { preloadAllAudio } from '@/lib/personalAudio'
import { logger } from '@/lib/logger'

const ZoraDarkTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: '#FFFFFF',
    background: '#000000',
    card: '#000000',
    text: '#FFFFFF',
    border: 'rgba(255, 255, 255, 0.08)',
    notification: '#F43F5E',
  },
}

// Retener el Splash Screen nativo de forma segura con protección de excepciones
try {
  SplashScreen.preventAutoHideAsync().catch(() => {})
} catch {}

// Configurar captura global de errores de JS para evitar que escalen a abort() nativo
if (typeof (globalThis as any).ErrorUtils !== 'undefined') {
  const originalHandler = (globalThis as any).ErrorUtils.getGlobalHandler?.()
  ;(globalThis as any).ErrorUtils.setGlobalHandler((error: any, isFatal?: boolean) => {
    logger.error('[GlobalErrorHandler]', error)
    if (isFatal) {
      const msg = error?.message || (typeof error === 'string' ? error : 'Error inesperado al inicializar la app')
      Alert.alert('Aviso de Zora', msg, [{ text: 'Continuar' }])
    }
    if (originalHandler) {
      // Siempre forzar isFatal a false para que el runtime nativo no invoque abort()
      originalHandler(error, false)
    }
  })
}

interface ErrorBoundaryProps {
  children: ReactNode
}
interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

class RootErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    logger.error('[RootErrorBoundary] Error de renderizado:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>Error al iniciar Zora</Text>
          <Text style={styles.errorMessage}>
            {this.state.error?.message || 'Ocurrió un error inesperado al renderizar la interfaz.'}
          </Text>
        </View>
      )
    }
    return this.props.children
  }
}

export default function RootLayout() {
  const [appIsReady, setAppIsReady] = useState(false)

  useEffect(() => {
    // Timeout de seguridad: asegura que la interfaz monte en máximo 800ms incluso si el storage o nativo demoran
    const fallbackTimer = setTimeout(() => {
      setAppIsReady(true)
    }, 800)

    async function prepare() {
      try {
        // 1. Inicializar infraestructura de notificaciones
        try {
          setupNotificationInfrastructure()
        } catch (e) {
          logger.warn('[RootLayout] Notificaciones omitidas:', e)
        }

        // 2. Precarga ultrarrápida en memoria
        try {
          await personalStorage.preloadAll()
        } catch (e) {
          logger.warn('[RootLayout] Preload storage omitido:', e)
        }

        // 3. Precargar sistema de audio nativo
        try {
          await preloadAllAudio()
        } catch (e) {
          logger.warn('[RootLayout] Audio preload omitido:', e)
        }
      } catch (e) {
        logger.warn('[RootLayout] Error en prepare:', e)
      } finally {
        setAppIsReady(true)
        clearTimeout(fallbackTimer)
      }
    }

    prepare()

    return () => {
      clearTimeout(fallbackTimer)
    }
  }, [])

  useEffect(() => {
    if (appIsReady) {
      try {
        SplashScreen.hideAsync().catch(() => {})
      } catch {}
    }
  }, [appIsReady])

  const onLayoutRootView = useCallback(async () => {
    if (appIsReady) {
      try {
        await SplashScreen.hideAsync().catch(() => {})
      } catch {}
    }
  }, [appIsReady])

  if (!appIsReady) {
    return null
  }

  return (
    <RootErrorBoundary>
      <GestureHandlerRootView style={styles.container} onLayout={onLayoutRootView}>
        <SafeAreaProvider>
          <PersonalAuthProvider>
            <ClassAuthProvider>
              <ThemeProvider value={ZoraDarkTheme}>
                <StatusBar style="light" />
                <Stack
                  screenOptions={{
                    headerShown: false,
                    animation: 'default',
                    contentStyle: { backgroundColor: '#000000' },
                  }}
                >
                  <Stack.Screen name="index" options={{ gestureEnabled: false }} />
                  <Stack.Screen name="welcome" options={{ animation: 'default' }} />
                  <Stack.Screen name="auth" options={{ animation: 'default' }} />
                  <Stack.Screen name="(tabs)" options={{ animation: 'default' }} />
                  <Stack.Screen
                    name="modal"
                    options={{
                      presentation: 'formSheet',
                      sheetAllowedDetents: [0.6, 0.95],
                      sheetGrabberVisible: true,
                      sheetInitialDetentIndex: 0,
                      sheetCornerRadius: 28,
                      contentStyle: { backgroundColor: '#1C1C1E' },
                      headerStyle: { backgroundColor: '#1C1C1E' },
                      headerShadowVisible: false,
                      headerTintColor: '#FFFFFF',
                      headerShown: false,
                    }}
                  />
                </Stack>
              </ThemeProvider>
            </ClassAuthProvider>
          </PersonalAuthProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </RootErrorBoundary>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    height: Platform.OS === 'web' ? ('100vh' as any) : '100%',
    width: '100%',
    backgroundColor: '#000000',
  },
  errorContainer: {
    flex: 1,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorTitle: {
    color: '#F43F5E',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  errorMessage: {
    color: '#A1A1AA',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
})
