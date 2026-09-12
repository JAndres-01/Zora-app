import React from 'react'
import { render, fireEvent } from '@testing-library/react-native'
import { DualBalanceWidget } from '@/components/widgets/DualBalanceWidget'
import { computeDualBalanceData, isTaskDueToday } from '@/lib/widgetSync'
import type { Task } from '@/types/personal'
import { useRouter } from 'expo-router'

describe('DualBalanceWidget Component (#3A)', () => {
  const todayIso = new Date().toISOString()
  const nextWeekIso = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

  const mockTasks: Task[] = [
    // 2 tareas pendientes para hoy
    { id: 't1', title: 'Tarea 1', status: 'pending', due_date: todayIso },
    { id: 't2', title: 'Tarea 2', status: 'pending', due_date: todayIso },
    // 3 tareas pendientes futuras
    { id: 't3', title: 'Tarea 3', status: 'pending', due_date: nextWeekIso },
    { id: 't4', title: 'Tarea 4', status: 'pending', due_date: nextWeekIso },
    { id: 't5', title: 'Tarea 5', status: 'pending' },
    // 14 tareas completadas
    ...Array.from({ length: 14 }, (_, i) => ({
      id: `done-${i}`,
      title: `Tarea completada ${i}`,
      status: 'completed' as const,
      completed_at: todayIso,
    })),
  ]

  test('renderiza métricas duales, total de tareas y porcentaje fiel a la maqueta #3A', async () => {
    const { getByTestId, getByText } = await render(
      <DualBalanceWidget tasks={mockTasks} testID="test-widget" />
    )

    // Header
    expect(getByText('BALANCE GENERAL')).toBeTruthy()
    expect(getByTestId('test-widget-percentage')).toHaveTextContent('74%')

    // Columnas
    expect(getByTestId('test-widget-pending-count')).toHaveTextContent('5')
    expect(getByTestId('test-widget-completed-count')).toHaveTextContent('14')
    expect(getByText('PENDIENTES')).toBeTruthy()
    expect(getByText('ENTREGADAS')).toBeTruthy()

    // Footer
    expect(getByTestId('test-widget-total-tasks')).toHaveTextContent('19 tareas')
    expect(getByTestId('test-widget-due-today')).toHaveTextContent('2 para hoy')
  })

  test('al presionar el widget navega directamente a /(tabs)/tasks', async () => {
    const router = useRouter()
    const { getByTestId } = await render(
      <DualBalanceWidget tasks={mockTasks} testID="test-widget" />
    )

    fireEvent.press(getByTestId('test-widget'))
    expect(router.navigate).toHaveBeenCalledWith('/(tabs)/tasks')
  })

  test('ejecuta un onPress personalizado si se suministra', async () => {
    const customPress = jest.fn()
    const { getByTestId } = await render(
      <DualBalanceWidget tasks={mockTasks} onPress={customPress} testID="test-widget" />
    )

    fireEvent.press(getByTestId('test-widget'))
    expect(customPress).toHaveBeenCalledTimes(1)
  })

  test('maneja estado cuando todas las tareas están completadas (100% y ¡Todo listo!)', async () => {
    const allDoneTasks: Task[] = [
      { id: 't1', title: 'Tarea 1', status: 'completed' },
      { id: 't2', title: 'Tarea 2', status: 'completed' },
    ]

    const { getByTestId } = await render(
      <DualBalanceWidget tasks={allDoneTasks} testID="test-widget" />
    )

    expect(getByTestId('test-widget-percentage')).toHaveTextContent('100%')
    expect(getByTestId('test-widget-pending-count')).toHaveTextContent('0')
    expect(getByTestId('test-widget-completed-count')).toHaveTextContent('2')
    expect(getByTestId('test-widget-due-today')).toHaveTextContent('¡Todo listo!')
  })

  test('maneja caso con 0 tareas sin fallar', async () => {
    const { getByTestId } = await render(
      <DualBalanceWidget tasks={[]} testID="test-widget" />
    )

    expect(getByTestId('test-widget-percentage')).toHaveTextContent('100%')
    expect(getByTestId('test-widget-pending-count')).toHaveTextContent('0')
    expect(getByTestId('test-widget-completed-count')).toHaveTextContent('0')
    expect(getByTestId('test-widget-total-tasks')).toHaveTextContent('0 tareas')
  })
})

describe('widgetSync Utilities', () => {
  test('computeDualBalanceData calcula correctamente las métricas', () => {
    const now = new Date()
    const todayIso = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 14, 0, 0).toISOString()
    const nextWeekIso = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7, 10, 0, 0).toISOString()

    const sampleTasks: Task[] = [
      { id: '1', title: 'T1', status: 'pending', due_date: todayIso },
      { id: '2', title: 'T2', status: 'pending', due_date: nextWeekIso },
      { id: '3', title: 'T3', status: 'completed' },
    ]

    const result = computeDualBalanceData(sampleTasks, now)
    expect(result.pendingCount).toBe(2)
    expect(result.completedCount).toBe(1)
    expect(result.totalCount).toBe(3)
    expect(result.completionRate).toBe(33) // 1/3 = 33.33% -> 33%
    expect(result.dueTodayCount).toBe(1)
  })

  test('isTaskDueToday reconoce fechas del mismo día y descarta otras', () => {
    const now = new Date()
    const sameDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 20, 0, 0).toISOString()
    const differentDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 3, 12, 0, 0).toISOString()

    expect(isTaskDueToday(sameDay, now)).toBe(true)
    expect(isTaskDueToday(differentDay, now)).toBe(false)
    expect(isTaskDueToday(null, now)).toBe(false)
    expect(isTaskDueToday('invalid-date', now)).toBe(false)
  })
})
