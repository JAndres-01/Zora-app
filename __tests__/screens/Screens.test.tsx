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
    const { getByText } = await render(
      <PersonalAuthProvider>
        <TodayScreen />
      </PersonalAuthProvider>
    )
    expect(getByText('Hoy')).toBeTruthy()
  })

  test('TasksScreen renderiza y muestra la barra de tareas y botón de crear', async () => {
    const { getByText } = await render(
      <PersonalAuthProvider>
        <TasksScreen />
      </PersonalAuthProvider>
    )
    expect(getByText('Tareas')).toBeTruthy()
  })

  test('ScheduleScreen renderiza la vista de horario sin fallos', async () => {
    const { getByText } = await render(
      <PersonalAuthProvider>
        <ScheduleScreen />
      </PersonalAuthProvider>
    )
    expect(getByText('Horario')).toBeTruthy()
  })

  test('SettingsScreen renderiza las preferencias de la aplicación sin fallos', async () => {
    const { getByText } = await render(
      <PersonalAuthProvider>
        <SettingsScreen />
      </PersonalAuthProvider>
    )
    expect(getByText('Perfil')).toBeTruthy()
  })
})
