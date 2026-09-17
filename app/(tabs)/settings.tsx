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
import { SymbolView } from 'expo-symbols'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Stack, useFocusEffect } from 'expo-router'
import { Settings as SettingsIcon } from 'lucide-react-native'
import * as DocumentPicker from 'expo-document-picker'
import * as FileSystem from 'expo-file-system/legacy'
import { usePersonalAuth } from '@/context/PersonalAuthContext'
import { personalStorage, subscribeToPersonalStorage } from '@/lib/personalStorage'
import { triggerHaptic, setGlobalHapticsEnabled } from '@/lib/personalHaptics'
import {
  syncAllNotifications,
  requestNotificationPermissions,
} from '@/lib/personalNotifications'
import { MinimalistVitalStats } from '@/components/stats/MinimalistVitalStats'
import { MinimalistActivityHeatmap } from '@/components/stats/MinimalistActivityHeatmap'
import { MinimalistSubjectBalance } from '@/components/stats/MinimalistSubjectBalance'
import { DualBalanceWidget } from '@/components/widgets/DualBalanceWidget'
import { MinimalistCredentialModal } from '@/components/profile/MinimalistCredentialModal'
import { ProfileHeroCard } from '@/components/settings/ProfileHeroCard'
import { SystemSettingsModal } from '@/components/settings/SystemSettingsModal'
import { ReminderTimeModal } from '@/components/settings/ReminderTimeModal'
import { formatDateKey } from '@/lib/heatmapUtils'
import { useCardEntrance, getCardEntranceStyle } from '@/hooks/useCardEntrance'
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
        <GlassView isInteractive style={styles.glassBtn}>
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
            <SymbolView
              name="gearshape"
              tintColor="#FFFFFF"
              size={18}
              weight="regular"
            />
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
          style={styles.blurBtn}
        >
          <BlurView
            intensity={Platform.OS === 'ios' ? 50 : 85}
            tint="dark"
            style={StyleSheet.absoluteFill}
          />
          <SettingsIcon size={17} color="#FFFFFF" strokeWidth={2} />
        </Pressable>
      )}
    </Animated.View>
  )
}

export default function ProfileScreen() {
  const insets = useSafeAreaInsets()
  const { profile, updateCredential, clearData } = usePersonalAuth()

  // Modales
  const [showSettingsModal, setShowSettingsModal] = useState(false)
  const [showTimeModal, setShowTimeModal] = useState(false)
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
    inputRange: [0, 25, 60],
    outputRange: [0, 0.5, 1],
    extrapolate: 'clamp',
  })

  const compactTitleOpacity = scrollY.interpolate({
    inputRange: [25, 60],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  })

  const compactTitleTranslateY = scrollY.interpolate({
    inputRange: [25, 60],
    outputRange: [6, 0],
    extrapolate: 'clamp',
  })

  const largeTitleOpacity = scrollY.interpolate({
    inputRange: [0, 40],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  })

  const largeTitleTranslateY = scrollY.interpolate({
    inputRange: [-80, 0, 50],
    outputRange: [20, 0, -14],
    extrapolate: 'clamp',
  })

  const largeTitleScale = scrollY.interpolate({
    inputRange: [-100, 0],
    outputRange: [1.08, 1],
    extrapolateRight: 'clamp',
  })

  const loadData = useCallback(async () => {
    const prefs = await personalStorage.getPreferences()
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

  useFocusEffect(
    useCallback(() => {
      loadData()
    }, [loadData])
  )

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
            height: insets.top + 44,
            paddingTop: insets.top,
          },
        ]}
      >
        {/* Fondo Translúcido / Frosted Glass con Transición en Scroll */}
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            { opacity: headerBgOpacity },
          ]}
          pointerEvents="none"
        >
          <BlurView
            intensity={Platform.OS === 'ios' ? 75 : 90}
            tint="dark"
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.stickyHeaderBorder} />
        </Animated.View>

        {/* Contenido de la Barra: Título Centrado y Botón Liquid Glass a la Derecha */}
        <View style={styles.stickyHeaderContent} pointerEvents="box-none">
          <View style={styles.stickyHeaderLeftSpacer} />

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
            paddingTop: insets.top + 10,
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
        {/* Cabecera iOS con Large Title y Subtítulo en el Cuerpo */}
        <Animated.View
          style={[
            styles.largeHeader,
            {
              opacity: largeTitleOpacity,
              transform: [
                { translateY: largeTitleTranslateY },
                { scale: largeTitleScale },
              ],
            },
          ]}
        >
          <View style={styles.titleColumn}>
            <Text style={styles.title}>Perfil</Text>
            <Text style={styles.subtitle}>Estudiante • Ajustes y estadísticas</Text>
          </View>
        </Animated.View>

        {/* Card 0: Tarjeta Hero de Perfil */}
        <Animated.View style={getCardEntranceStyle(cardEntranceAnims[0])}>
          <ProfileHeroCard
            fullName={profile?.full_name}
            credentialUrl={profile?.student_credential_url}
            onOpenCredential={() => setShowCredentialModal(true)}
            onUploadCredential={handlePickCredential}
          />
        </Animated.View>

        {/* Card 1: Métricas Vitales Académicas */}
        <Animated.View style={getCardEntranceStyle(cardEntranceAnims[1])}>
          <MinimalistVitalStats />
        </Animated.View>

        {/* Card 2: Mapa de Actividad Estilo GitHub */}
        <Animated.View style={getCardEntranceStyle(cardEntranceAnims[2])}>
          <MinimalistActivityHeatmap />
        </Animated.View>

        {/* Card 3: Balance de Materias */}
        <Animated.View style={getCardEntranceStyle(cardEntranceAnims[3])}>
          <MinimalistSubjectBalance />
        </Animated.View>

        {/* Card 4: Previsualización de Widget #3A Dual Balance */}
        <Animated.View style={getCardEntranceStyle(cardEntranceAnims[4])}>
          <View style={styles.widgetSectionCard}>
            <View style={styles.widgetSectionHeader}>
              <View>
                <Text style={styles.widgetSectionTitle}>WIDGETS · PANTALLA DE INICIO</Text>
                <Text style={styles.widgetSectionSubtitle}>#3A Dual Balance · Toca el widget para abrir Tareas</Text>
              </View>
            </View>
            <View style={styles.widgetPreviewContainer}>
              <DualBalanceWidget size="small" />
            </View>
          </View>
        </Animated.View>
      </Animated.ScrollView>

      {/* Modal Principal de Ajustes del Sistema */}
      <SystemSettingsModal
        visible={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
        profile={profile}
        onOpenCredential={() => setShowCredentialModal(true)}
        onUploadCredential={handlePickCredential}
        advanceReminderEnabled={advanceReminderEnabled}
        onToggleAdvanceReminder={handleToggleAdvanceReminder}
        advanceReminderTime={advanceReminderTime}
        onOpenTimeModal={() => setShowTimeModal(true)}
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

      {/* Modal para Seleccionar Hora */}
      <ReminderTimeModal
        visible={showTimeModal}
        currentTime={advanceReminderTime}
        onClose={() => setShowTimeModal(false)}
        onSelectTime={handleSelectHour}
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
    paddingHorizontal: 16,
  },
  stickyHeaderLeftSpacer: {
    width: 36,
  },
  compactTitleWrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  compactTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.4,
    textAlign: 'center',
  },
  stickyHeaderRight: {
    width: 36,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  glassBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderCurve: 'continuous',
  },
  glassBtnInner: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  blurBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.16)',
    overflow: 'hidden',
  },
  largeHeader: {
    paddingHorizontal: 2,
    marginBottom: 4,
  },
  titleColumn: {
    gap: 2,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 34,
    fontWeight: '800',
    letterSpacing: -0.8,
  },
  subtitle: {
    color: '#71717A',
    fontSize: 13,
    fontWeight: '500',
  },
  widgetSectionCard: {
    backgroundColor: '#000000',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    padding: 16,
    gap: 14,
  },
  widgetSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  widgetSectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#A1A1AA',
    letterSpacing: 0.5,
  },
  widgetSectionSubtitle: {
    fontSize: 12,
    fontWeight: '500',
    color: '#71717A',
    marginTop: 2,
  },
  widgetPreviewContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
})
