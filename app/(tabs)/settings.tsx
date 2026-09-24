import { useEffect, useState, useCallback, useRef } from 'react'
import {
  View,
  Text,
  Animated,
  Pressable,
  StyleSheet,
  Alert,
  Platform,
  AccessibilityInfo,
} from 'react-native'
import { BlurView } from 'expo-blur'
import {
  GlassView,
  isLiquidGlassAvailable,
  isGlassEffectAPIAvailable,
} from 'expo-glass-effect'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Stack, useRouter } from 'expo-router'
import { Settings as SettingsIcon } from 'lucide-react-native'
import * as DocumentPicker from 'expo-document-picker'
import * as FileSystem from 'expo-file-system/legacy'
import { usePersonalAuth } from '@/context/PersonalAuthContext'
import { useClassAuth } from '@/context/ClassAuthContext'
import { personalStorage, subscribeToPersonalStorage } from '@/lib/personalStorage'
import { samePreferences } from '@/lib/dataEquality'
import { triggerHaptic, setGlobalHapticsEnabled } from '@/lib/personalHaptics'
import {
  syncAllNotifications,
  requestNotificationPermissions,
} from '@/lib/personalNotifications'
import { MinimalistVitalStats } from '@/components/stats/MinimalistVitalStats'
import { MinimalistActivityHeatmap } from '@/components/stats/MinimalistActivityHeatmap'
import { MinimalistSubjectBalance } from '@/components/stats/MinimalistSubjectBalance'
import { MinimalistCredentialModal } from '@/components/profile/MinimalistCredentialModal'
import { ProfileHeroCard } from '@/components/settings/ProfileHeroCard'
import { SystemSettingsModal } from '@/components/settings/SystemSettingsModal'
import { formatDateKey } from '@/lib/heatmapUtils'
import { useCardEntrance, getCardEntranceStyle } from '@/hooks/useCardEntrance'
import { useDeferredFocusLoad } from '@/hooks/useDeferredFocusLoad'
import type { AppPreferences } from '@/types/personal'
import { DEFAULT_ADVANCE_REMINDER_TIME, DEFAULT_STUDENT_NAME } from '@/constants/defaults'
import {
  setGlobalSoundEnabled,
  playConfettiSound,
  playWarningSound,
  playTrashSound,
} from '@/lib/personalAudio'
import { logger } from '@/lib/logger'

const GLASS_AVAILABLE =
  Platform.OS === 'ios' &&
  typeof isLiquidGlassAvailable === 'function' &&
  isLiquidGlassAvailable() &&
  typeof isGlassEffectAPIAvailable === 'function' &&
  isGlassEffectAPIAvailable()

function GlassSettingsButton({ onPress }: { onPress: () => void }) {
  const [reduceTransparency, setReduceTransparency] = useState(false)
  const scaleAnim = useRef(new Animated.Value(1)).current

  useEffect(() => {
    if (Platform.OS !== 'ios') return
    let active = true
    AccessibilityInfo.isReduceTransparencyEnabled().then((val) => {
      if (active) setReduceTransparency(val)
    })
    return () => {
      active = false
    }
  }, [])

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.9,
      useNativeDriver: true,
      speed: 40,
      bounciness: 4,
    }).start()
  }

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      speed: 30,
      bounciness: 6,
    }).start()
  }

  const useGlass = GLASS_AVAILABLE && !reduceTransparency

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      {useGlass ? (
        <GlassView
          isInteractive
          colorScheme="light"
          style={[styles.glassBtn, styles.glassBtnWhite]}
        >
          <Pressable
            onPress={() => {
              triggerHaptic('light')
              onPress()
            }}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Ajustes"
            style={styles.glassBtnInner}
          >
            <SettingsIcon size={20} color="#18181B" strokeWidth={2.2} />
          </Pressable>
        </GlassView>
      ) : (
        <Pressable
          onPress={() => {
            triggerHaptic('light')
            onPress()
          }}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Ajustes"
          style={[styles.blurBtn, styles.blurBtnWhite]}
        >
          {Platform.OS === 'ios' && (
            <BlurView
              intensity={50}
              tint="light"
              style={StyleSheet.absoluteFill}
            />
          )}
          <SettingsIcon size={20} color="#18181B" strokeWidth={2.2} />
        </Pressable>
      )}
    </Animated.View>
  )
}

export default function ProfileScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { profile, updateCredential, clearData } = usePersonalAuth()
  const { isConnected } = useClassAuth()

  // Modales
  const [showSettingsModal, setShowSettingsModal] = useState(false)
  const [showCredentialModal, setShowCredentialModal] = useState(false)

  // Preferencias del Sistema
  const [hapticsEnabled, setHapticsEnabled] = useState(true)
  const [confettiEnabled, setConfettiEnabled] = useState(true)
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [advanceReminderEnabled, setAdvanceReminderEnabled] = useState(true)
  const [advanceReminderTime, setAdvanceReminderTime] = useState(DEFAULT_ADVANCE_REMINDER_TIME)
  const [classReminderEnabled, setClassReminderEnabled] = useState(true)

  // Periodos de Semestre
  const currentYear = new Date().getFullYear()
  const [fallStart, setFallStart] = useState(`${currentYear}-08-01`)
  const [fallEnd, setFallEnd] = useState(`${currentYear}-12-31`)
  const [springStart, setSpringStart] = useState(`${currentYear}-02-01`)
  const [springEnd, setSpringEnd] = useState(`${currentYear}-06-30`)

  // Animaciones de Entrada Escalonada
  const cardEntranceAnims = useCardEntrance(5, 'settings')

  // Animación de Scroll para Colapso de Header Estilo Apple Notes
  const scrollY = useRef(new Animated.Value(0)).current

  const headerBgOpacity = scrollY.interpolate({
    inputRange: [18, 38],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  })

  const compactTitleOpacity = scrollY.interpolate({
    inputRange: [40, 60],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  })

  const compactTitleTranslateY = scrollY.interpolate({
    inputRange: [40, 60],
    outputRange: [6, 0],
    extrapolate: 'clamp',
  })

  const largeTitleOpacity = scrollY.interpolate({
    inputRange: [4, 45],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  })

  const titleCollapseY = largeTitleOpacity.interpolate({
    inputRange: [0, 1],
    outputRange: [-24, 0],
    extrapolate: 'clamp',
  })

  const titleCollapseScale = largeTitleOpacity.interpolate({
    inputRange: [0, 1],
    outputRange: [0.92, 1],
    extrapolate: 'clamp',
  })

  const lastPrefsRef = useRef<AppPreferences | null>(null)

  const loadData = useCallback(async () => {
    const prefs = await personalStorage.getPreferences()
    const prev = lastPrefsRef.current
    lastPrefsRef.current = prefs
    // Skip setState cuando las prefs no cambiaron: la entrada a una pestaña ya
    // cargada no debe re-renderizar toda la pantalla (congelaba el frame del
    // switch en Android y hacía caer el FPS de JS de 90 a 60).
    if (prev && samePreferences(prev, prefs)) return
    setHapticsEnabled(prefs.haptics_enabled)
    setConfettiEnabled(prefs.confetti_enabled)
    setSoundEnabled(prefs.sound_enabled ?? true)
    setGlobalSoundEnabled(prefs.sound_enabled ?? true)
    setAdvanceReminderEnabled(prefs.advance_reminder_enabled)
    setAdvanceReminderTime(prefs.advance_reminder_time || DEFAULT_ADVANCE_REMINDER_TIME)
    setClassReminderEnabled(prefs.class_reminder_enabled)
    setGlobalHapticsEnabled(prefs.haptics_enabled)
    if (prefs.semester_fall_start) setFallStart(prefs.semester_fall_start)
    if (prefs.semester_fall_end) setFallEnd(prefs.semester_fall_end)
    if (prefs.semester_spring_start) setSpringStart(prefs.semester_spring_start)
    if (prefs.semester_spring_end) setSpringEnd(prefs.semester_spring_end)
  }, [])

  // Refresco DIFERIDO tras el paint del switch: la entrada no espera al re-render.
  useDeferredFocusLoad(loadData)

  useEffect(() => {
    const unsubscribe = subscribeToPersonalStorage(() => {
      loadData()
    })
    return unsubscribe
  }, [loadData])

  // Handlers para el Perfil
  const handlePickCredential = async () => {
    triggerHaptic('light')
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/*'],
        copyToCacheDirectory: true,
      })

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0]
        let permanentUri = asset.uri
        try {
          const destDir = `${FileSystem.documentDirectory ?? ''}credentials/`
          const dirInfo = await FileSystem.getInfoAsync(destDir)
          if (!dirInfo.exists) {
            await FileSystem.makeDirectoryAsync(destDir, { intermediates: true })
          }
          const isImg = asset.mimeType?.startsWith('image/') || asset.name?.match(/\.(jpeg|jpg|png|webp|gif|heic)/i)
          const fallbackName = isImg ? 'Credencial.jpg' : 'Credencial.pdf'
          const rawName = asset.name || fallbackName
          const cleanName = rawName.replace(/[^a-zA-Z0-9._-]/g, '_')
          const destUri = `${destDir}${Date.now()}_${cleanName}`
          await FileSystem.copyAsync({ from: asset.uri, to: destUri })
          permanentUri = destUri
        } catch (copyErr) {
          logger.warn('[ProfileScreen] Copia permanente:', copyErr)
        }

        const isImg = asset.mimeType?.startsWith('image/') || asset.name?.match(/\.(jpeg|jpg|png|webp|gif|heic)/i)
        const finalName = asset.name || (isImg ? 'Credencial_Digital.jpg' : 'Credencial_Digital.pdf')
        await updateCredential(permanentUri, finalName)
        triggerHaptic('success')
        setShowCredentialModal(true)
      }
    } catch (err: unknown) {
      logger.error('[ProfileScreen] Error al seleccionar credencial:', err)
      Alert.alert('Error', 'No se pudo cargar el archivo de la credencial.')
      triggerHaptic('error')
    }
  }

  const handleDeleteCredential = async () => {
    await updateCredential(null, null)
    setShowCredentialModal(false)
    triggerHaptic('success')
  }

  // Handlers de Preferencias
  const handleToggleHaptics = async (val: boolean) => {
    setHapticsEnabled(val)
    setGlobalHapticsEnabled(val)
    if (val) triggerHaptic('selection')
    const current = await personalStorage.getPreferences()
    await personalStorage.setPreferences({ ...current, haptics_enabled: val })
  }

  const handleToggleConfetti = async (val: boolean) => {
    setConfettiEnabled(val)
    triggerHaptic('selection')
    const current = await personalStorage.getPreferences()
    await personalStorage.setPreferences({ ...current, confetti_enabled: val })
  }

  const handleToggleSound = async (val: boolean) => {
    setSoundEnabled(val)
    setGlobalSoundEnabled(val)
    triggerHaptic('selection')
    if (val) playConfettiSound()
    const current = await personalStorage.getPreferences()
    await personalStorage.setPreferences({ ...current, sound_enabled: val })
  }

  const handleToggleAdvanceReminder = async (val: boolean) => {
    if (val) {
      const granted = await requestNotificationPermissions()
      if (!granted) {
        playWarningSound()
        Alert.alert(
          'Permiso de Notificaciones',
          'Activa las notificaciones en los Ajustes de tu teléfono para recibir recordatorios.'
        )
      }
    }
    setAdvanceReminderEnabled(val)
    triggerHaptic('selection')
    const current = await personalStorage.getPreferences()
    const updated = { ...current, advance_reminder_enabled: val }
    await personalStorage.setPreferences(updated)
    await syncAllNotifications(undefined, undefined, updated)
  }

  const handleToggleClassReminder = async (val: boolean) => {
    if (val) {
      const granted = await requestNotificationPermissions()
      if (!granted) {
        playWarningSound()
        Alert.alert(
          'Permiso de Notificaciones',
          'Activa las notificaciones en los Ajustes de tu teléfono para recibir avisos de clase.'
        )
      }
    }
    setClassReminderEnabled(val)
    triggerHaptic('selection')
    const current = await personalStorage.getPreferences()
    const updated = { ...current, class_reminder_enabled: val }
    await personalStorage.setPreferences(updated)
    await syncAllNotifications(undefined, undefined, updated)
  }

  const handleSelectHour = async (timeStr: string) => {
    setAdvanceReminderTime(timeStr)
    const current = await personalStorage.getPreferences()
    const updated = { ...current, advance_reminder_time: timeStr }
    await personalStorage.setPreferences(updated)
    await syncAllNotifications(undefined, undefined, updated)
  }

  const handleUpdateSemesterDate = async (
    target: 'fall_start' | 'fall_end' | 'spring_start' | 'spring_end',
    selectedDate: Date
  ) => {
    const dateKey = formatDateKey(selectedDate)
    triggerHaptic('selection')
    const current = await personalStorage.getPreferences()
    const updated = { ...current }

    if (target === 'fall_start') {
      setFallStart(dateKey)
      updated.semester_fall_start = dateKey
    } else if (target === 'fall_end') {
      setFallEnd(dateKey)
      updated.semester_fall_end = dateKey
    } else if (target === 'spring_start') {
      setSpringStart(dateKey)
      updated.semester_spring_start = dateKey
    } else if (target === 'spring_end') {
      setSpringEnd(dateKey)
      updated.semester_spring_end = dateKey
    }

    await personalStorage.setPreferences(updated)
  }

  const handleResetSemesterDates = async () => {
    triggerHaptic('medium')
    const defaultFallStart = `${currentYear}-08-01`
    const defaultFallEnd = `${currentYear}-12-31`
    const defaultSpringStart = `${currentYear}-02-01`
    const defaultSpringEnd = `${currentYear}-06-30`

    setFallStart(defaultFallStart)
    setFallEnd(defaultFallEnd)
    setSpringStart(defaultSpringStart)
    setSpringEnd(defaultSpringEnd)

    const current = await personalStorage.getPreferences()
    const updated = {
      ...current,
      semester_fall_start: defaultFallStart,
      semester_fall_end: defaultFallEnd,
      semester_spring_start: defaultSpringStart,
      semester_spring_end: defaultSpringEnd,
    }
    await personalStorage.setPreferences(updated)
  }

  const handleClearAllData = () => {
    triggerHaptic('warning')
    if (Platform.OS === 'web') {
      const confirmed =
        typeof window !== 'undefined'
          ? window.confirm('¿Deseas eliminar todas las materias, horarios y tareas del dispositivo? Esta acción no se puede deshacer.')
          : true
      if (confirmed) {
        triggerHaptic('error')
        clearData().then(() => {
          loadData()
          setShowSettingsModal(false)
        })
      }
      return
    }

    playWarningSound()
    Alert.alert(
      'Restablecer App',
      '¿Deseas eliminar todas las materias, horarios y tareas del dispositivo? Esta acción no se puede deshacer.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Restablecer Todo',
          style: 'destructive',
          onPress: async () => {
            playTrashSound()
            triggerHaptic('error')
            await clearData()
            loadData()
            setShowSettingsModal(false)
            Alert.alert('Restablecido', 'La app ha quedado limpia como en su primer uso.')
          },
        },
      ]
    )
  }

  return (
    <View style={styles.screenWrapper}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Barra de Navegación Sticky Superior (Estilo Apple Notes de iOS) */}
      <View
        pointerEvents="box-none"
        style={[
          styles.stickyHeaderBar,
          {
            height: insets.top + 56,
            paddingTop: insets.top,
          },
        ]}
      >
        {/* Fondo Translúcido / Frosted Glass con Transición en Scroll */}
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            { opacity: headerBgOpacity },
            Platform.OS === 'android' && { backgroundColor: '#000000' },
          ]}
          pointerEvents="none"
        >
          {Platform.OS === 'ios' && (
            <BlurView
              intensity={75}
              tint="dark"
              style={StyleSheet.absoluteFill}
            />
          )}
          <View style={styles.stickyHeaderBorder} />
        </Animated.View>

        {/* Contenido de la Barra: Título Compacto Centrado y Botón Liquid Glass a la Derecha */}
        <View style={styles.stickyHeaderContent} pointerEvents="box-none">
          <View style={styles.stickyHeaderLeft} />

          <Animated.View
            style={[
              styles.compactTitleWrapper,
              {
                opacity: compactTitleOpacity,
                transform: [{ translateY: compactTitleTranslateY }],
              },
            ]}
            pointerEvents="none"
          >
            <Text style={styles.compactTitle}>Perfil</Text>
          </Animated.View>

          <View style={styles.stickyHeaderRight}>
            <GlassSettingsButton onPress={() => setShowSettingsModal(true)} />
          </View>
        </View>
      </View>

      <Animated.ScrollView
        style={styles.container}
        contentInsetAdjustmentBehavior="never"
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: insets.top + 60,
            paddingBottom: Math.max(insets.bottom, 24) + 64,
          },
        ]}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true }
        )}
      >
        {/* Card 0: Cabecera iOS con Large Title (entra con la cascada) */}
        <Animated.View style={getCardEntranceStyle(cardEntranceAnims[0])}>
          <Animated.View
            style={[
              styles.titleCoverBlock,
              {
                opacity: largeTitleOpacity,
                transform: [
                  { translateY: titleCollapseY },
                  { scale: titleCollapseScale },
                ],
              },
            ]}
          >
            <Text style={styles.title}>Perfil</Text>
          </Animated.View>
        </Animated.View>

        {/* Card 1: Tarjeta Hero de Perfil */}
        <Animated.View style={getCardEntranceStyle(cardEntranceAnims[1])}>
          <ProfileHeroCard
            fullName={profile?.full_name}
            credentialUrl={profile?.student_credential_url}
            onOpenCredential={() => setShowCredentialModal(true)}
            onUploadCredential={handlePickCredential}
          />
        </Animated.View>

        {/* Card 2: Métricas Vitales Académicas */}
        <Animated.View style={getCardEntranceStyle(cardEntranceAnims[2])}>
          <MinimalistVitalStats />
        </Animated.View>

        {/* Card 3: Mapa de Actividad Estilo GitHub */}
        <Animated.View style={getCardEntranceStyle(cardEntranceAnims[3])}>
          <MinimalistActivityHeatmap />
        </Animated.View>

        {/* Card 4: Balance de Materias */}
        <Animated.View style={getCardEntranceStyle(cardEntranceAnims[4])}>
          <MinimalistSubjectBalance />
        </Animated.View>
      </Animated.ScrollView>

      {/* Modal Principal de Ajustes del Sistema */}
      <SystemSettingsModal
        visible={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
        profile={profile}
        onOpenClassAuth={() => router.push('/auth')}
        isConnected={isConnected}
        onClassAuthSuccess={loadData}
        advanceReminderEnabled={advanceReminderEnabled}
        onToggleAdvanceReminder={handleToggleAdvanceReminder}
        advanceReminderTime={advanceReminderTime}
        onSelectReminderTime={handleSelectHour}
        classReminderEnabled={classReminderEnabled}
        onToggleClassReminder={handleToggleClassReminder}
        fallStart={fallStart}
        fallEnd={fallEnd}
        springStart={springStart}
        springEnd={springEnd}
        onUpdateSemesterDate={handleUpdateSemesterDate}
        onResetSemesterDates={handleResetSemesterDates}
        hapticsEnabled={hapticsEnabled}
        onToggleHaptics={handleToggleHaptics}
        confettiEnabled={confettiEnabled}
        onToggleConfetti={handleToggleConfetti}
        soundEnabled={soundEnabled}
        onToggleSound={handleToggleSound}
        onClearData={handleClearAllData}
      />

      {/* Modal de Credencial Digital (PDF con QR) */}
      <MinimalistCredentialModal
        visible={showCredentialModal}
        credentialUrl={profile?.student_credential_url || null}
        credentialName={profile?.student_credential_name || null}
        studentName={profile?.full_name || DEFAULT_STUDENT_NAME}
        onClose={() => setShowCredentialModal(false)}
        onChangeCredential={handlePickCredential}
        onDeleteCredential={handleDeleteCredential}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  screenWrapper: {
    flex: 1,
    backgroundColor: '#000000',
  },
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    gap: 16,
  },
  stickyHeaderBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    elevation: 20,
  },
  stickyHeaderBorder: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
  },
  stickyHeaderContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  compactTitleWrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 8,
  },
  compactTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.4,
    textAlign: 'center',
  },
  stickyHeaderLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  stickyHeaderRight: {
    flex: 1,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  glassBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    padding: 6,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
  },
  glassBtnWhite: {
    // Variante del botón "Ajustes": material glass CLARO (colorScheme="light")
    // teñido de blanco, mismo patrón que "+" en Tareas y "Materias" en Horarios.
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    borderColor: 'rgba(255, 255, 255, 1)',
  },
  glassBtnInner: {
    width: 44,
    height: 44,
    padding: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  blurBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    padding: 4,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Platform.OS === 'android' ? '#18181B' : 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.16)',
    overflow: 'hidden',
  },
  blurBtnWhite: {
    // Fallback sin liquid glass: blanco nítido
    backgroundColor: '#FFFFFF',
    borderColor: 'rgba(255, 255, 255, 0.9)',
  },
  titleCoverBlock: {
    backgroundColor: '#000000',
    zIndex: 20,
    paddingHorizontal: 2,
    marginBottom: 2,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 34,
    fontWeight: '800',
    letterSpacing: -0.8,
  },
})
