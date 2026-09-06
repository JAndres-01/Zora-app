import { useEffect, useState, useCallback } from 'react'
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { PersonalAuthProvider } from '@/context/PersonalAuthContext'
import { StyleSheet } from 'react-native'
import * as SplashScreen from 'expo-splash-screen'
import { personalStorage } from '@/lib/personalStorage'
import { setupNotificationInfrastructure } from '@/lib/personalNotifications'
import { logger } from '@/lib/logger'

// Retener el Splash Screen nativo hasta que los datos estén 100% listos en memoria
SplashScreen.preventAutoHideAsync().catch(() => {})

export default function RootLayout() {
  const [appIsReady, setAppIsReady] = useState(false)

  useEffect(() => {
    async function prepare() {
      try {
        // Inicializar infraestructura de notificaciones de forma controlada
        setupNotificationInfrastructure()
        // Precarga ultrarrápida en memoria (~100-200ms)
        await personalStorage.preloadAll()
      } catch (e) {
        logger.warn('[RootLayout] Error precargando datos:', e)
      } finally {
        setAppIsReady(true)
      }
    }

    prepare()
  }, [])

  const onLayoutRootView = useCallback(async () => {
    if (appIsReady) {
      // Ocultar suavemente el Splash Screen nativo una vez montada la UI
      await SplashScreen.hideAsync().catch(() => {})
    }
  }, [appIsReady])

  if (!appIsReady) {
    return null
  }

  return (
    <GestureHandlerRootView style={styles.container} onLayout={onLayoutRootView}>
      <SafeAreaProvider>
        <PersonalAuthProvider>
          <StatusBar style="light" />
          <Stack
            screenOptions={{
              headerShown: false,
              animation: 'fade',
              contentStyle: { backgroundColor: '#09090B' },
            }}
          >
            <Stack.Screen name="index" />
            <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
          </Stack>
        </PersonalAuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#09090B',
  },
})
