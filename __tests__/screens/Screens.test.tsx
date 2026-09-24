import React from 'react'
import { render } from '@testing-library/react-native'
import { PersonalAuthProvider } from '@/context/PersonalAuthContext'
import TodayScreen from '../../app/(tabs)/today'
import TasksScreen from '../../app/(tabs)/tasks'
import ScheduleScreen from '../../app/(tabs)/schedule'
import SettingsScreen from '../../app/(tabs)/settings'

describe('Smoke and Regression Tests for All Main Screens', () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.clearAllTimers()
    jest.useRealTimers()
  })

  test('TodayScreen renderiza sin fallos', async () => {
    const { getAllByText } = await render(
      <PersonalAuthProvider>
        <TodayScreen />
      </PersonalAuthProvider>
    )
    expect(getAllByText('Hoy').length).toBeGreaterThanOrEqual(1)
  })

  test('TasksScreen renderiza y muestra la barra de tareas y botón de crear', async () => {
    const { getAllByText } = await render(
      <PersonalAuthProvider>
        <TasksScreen />
      </PersonalAuthProvider>
    )
    expect(getAllByText('Tareas').length).toBeGreaterThanOrEqual(1)
  })

  test('ScheduleScreen renderiza la vista de horario sin fallos', async () => {
    const { getAllByText } = await render(
      <PersonalAuthProvider>
        <ScheduleScreen />
      </PersonalAuthProvider>
    )
    expect(getAllByText('Horario').length).toBeGreaterThanOrEqual(1)
  })

  test('SettingsScreen renderiza las preferencias de la aplicación sin fallos', async () => {
    const { getAllByText, getByText } = await render(
      <PersonalAuthProvider>
        <SettingsScreen />
      </PersonalAuthProvider>
    )
    expect(getAllByText('Perfil').length).toBeGreaterThanOrEqual(1)
    expect(getByText('Distribución de Carga')).toBeTruthy()
  })
})
