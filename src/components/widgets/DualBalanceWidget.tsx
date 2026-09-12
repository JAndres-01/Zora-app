import React, { useEffect, useState, useMemo } from 'react'
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ViewStyle,
  StyleProp,
} from 'react-native'
import { useRouter } from 'expo-router'
import type { Task } from '@/types/personal'
import { personalStorage, subscribeToPersonalStorage } from '@/lib/personalStorage'
import { triggerHaptic } from '@/lib/personalHaptics'
import { computeDualBalanceData, syncWidgetData, DualBalanceWidgetData } from '@/lib/widgetSync'

export interface DualBalanceWidgetProps {
  tasks?: Task[]
  onPress?: () => void
  style?: StyleProp<ViewStyle>
  size?: 'small' | 'fluid'
  testID?: string
}

export function DualBalanceWidget({
  tasks: propTasks,
  onPress,
  style,
  size = 'small',
  testID = 'dual-balance-widget',
}: DualBalanceWidgetProps) {
  const router = useRouter()
  const [internalTasks, setInternalTasks] = useState<Task[]>(() => {
    return propTasks ?? personalStorage.getCachedTasksWithSubjects()
  })

  // Sincronización reactiva con personalStorage cuando no se suministran tareas fijas por props
  useEffect(() => {
    if (propTasks) {
      setInternalTasks(propTasks)
      return
    }

    const refresh = async () => {
      const resolved = await personalStorage.getTasksWithSubjects()
      setInternalTasks(resolved)
      syncWidgetData(resolved).catch(() => {})
    }

    refresh()
    const unsubscribe = subscribeToPersonalStorage(() => {
      refresh()
    })
    return unsubscribe
  }, [propTasks])

  const metrics: DualBalanceWidgetData = useMemo(() => {
    return computeDualBalanceData(propTasks ?? internalTasks)
  }, [propTasks, internalTasks])

  const { pendingCount, completedCount, totalCount, completionRate, dueTodayCount } = metrics

  const handlePress = () => {
    triggerHaptic('light')
    if (onPress) {
      onPress()
    } else {
      router.navigate('/(tabs)/tasks')
    }
  }

  const todayLabel =
    dueTodayCount > 0
      ? `${dueTodayCount} para hoy`
      : pendingCount === 0 && totalCount > 0
      ? '¡Todo listo!'
      : '0 para hoy'

  return (
    <Pressable
      testID={testID}
      onPress={handlePress}
      accessible={true}
      accessibilityRole="button"
      accessibilityLabel={`Widget Balance General: ${pendingCount} tareas pendientes, ${completedCount} entregadas, ${completionRate} por ciento completado`}
      accessibilityHint="Abre la pestaña de tareas"
      style={({ pressed }) => [
        styles.cardBase,
        size === 'small' ? styles.sizeSmall : styles.sizeFluid,
        pressed && styles.cardPressed,
        style,
      ]}
    >
      {/* Encabezado: Título discreto + Porcentaje con respiro amplio */}
      <View style={styles.headerRow}>
        <Text
          style={styles.tagSub}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.8}
        >
          BALANCE GENERAL
        </Text>
        <Text style={styles.percentageBadge} testID={`${testID}-percentage`}>
          {completionRate}%
        </Text>
      </View>

      {/* Columnas Métricas Duales con respiro */}
      <View style={styles.metricsRow}>
        {/* Columna Pendientes */}
        <View style={styles.metricColumn} testID={`${testID}-pending-col`}>
          <Text style={styles.pendingNumber} testID={`${testID}-pending-count`}>
            {pendingCount}
          </Text>
          <Text
            style={styles.metricLabel}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.75}
          >
            PENDIENTES
          </Text>
        </View>

        {/* Divisor vertical */}
        <View style={styles.divider} />

        {/* Columna Entregadas */}
        <View style={styles.metricColumn} testID={`${testID}-completed-col`}>
          <Text style={styles.completedNumber} testID={`${testID}-completed-count`}>
            {completedCount}
          </Text>
          <Text
            style={styles.metricLabel}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.75}
          >
            ENTREGADAS
          </Text>
        </View>
      </View>

      {/* Pie con Totales y Barra Segmentada */}
      <View style={styles.footerContainer}>
        <View style={styles.footerMetaRow}>
          <Text
            style={styles.footerText}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.8}
            testID={`${testID}-total-tasks`}
          >
            {totalCount} {totalCount === 1 ? 'tarea' : 'tareas'}
          </Text>
          <Text
            style={styles.footerText}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.8}
            testID={`${testID}-due-today`}
          >
            {todayLabel}
          </Text>
        </View>

        {/* Barra de progreso segmentada */}
        <View style={styles.progressBarBackground} testID={`${testID}-progress-bar`}>
          <View
            style={[
              styles.progressBarFill,
              { width: `${Math.min(100, Math.max(0, completionRate))}%` },
            ]}
          />
          {completionRate < 100 && (
            <View
              style={[
                styles.progressBarRemaining,
                { width: `${100 - Math.min(100, Math.max(0, completionRate))}%` },
              ]}
            />
          )}
        </View>
      </View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  cardBase: {
    backgroundColor: '#121215',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 24,
    padding: 13,
    justifyContent: 'space-between',
    overflow: 'hidden',
  },
  sizeSmall: {
    width: 162,
    height: 162,
  },
  sizeFluid: {
    width: '100%',
    minHeight: 148,
  },
  cardPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.975 }],
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  tagSub: {
    fontSize: 9,
    fontWeight: '700',
    color: '#A1A1AA',
    letterSpacing: 0.3,
    flexShrink: 1,
  },
  percentageBadge: {
    fontSize: 11,
    fontWeight: '800',
    color: '#10B981',
  },
  metricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    marginVertical: 2,
    gap: 4,
  },
  metricColumn: {
    alignItems: 'center',
    flex: 1,
    paddingHorizontal: 2,
  },
  divider: {
    width: 1,
    height: 28,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  pendingNumber: {
    fontSize: 28,
    fontWeight: '800',
    lineHeight: 32,
    color: '#FFFFFF',
    textAlign: 'center',
  },
  completedNumber: {
    fontSize: 28,
    fontWeight: '800',
    lineHeight: 32,
    color: '#10B981',
    textAlign: 'center',
  },
  metricLabel: {
    fontSize: 8,
    fontWeight: '700',
    color: '#71717A',
    letterSpacing: 0.2,
    textAlign: 'center',
    marginTop: 3,
    width: '100%',
  },
  footerContainer: {
    width: '100%',
  },
  footerMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 5,
    gap: 4,
  },
  footerText: {
    fontSize: 9,
    fontWeight: '500',
    color: '#71717A',
    flexShrink: 1,
  },
  progressBarBackground: {
    width: '100%',
    height: 4.5,
    backgroundColor: '#27272A',
    borderRadius: 2.25,
    overflow: 'hidden',
    flexDirection: 'row',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#10B981',
  },
  progressBarRemaining: {
    height: '100%',
    backgroundColor: '#3F3F46',
  },
})
