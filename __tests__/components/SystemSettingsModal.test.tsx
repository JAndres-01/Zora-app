import React from 'react'
import { render, fireEvent, act } from '@testing-library/react-native'
import { SystemSettingsModal } from '@/components/settings/SystemSettingsModal'
import { PersonalAuthProvider } from '@/context/PersonalAuthContext'

describe('SystemSettingsModal Debug Subpage', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.clearAllTimers()
    jest.useRealTimers()
  })

  const baseProps = {
    visible: true,
    onClose: jest.fn(),
    profile: {
      id: 'test_user',
      full_name: 'Estudiante Demo',
      avatar_seed: 'alex',
      created_at: '2026-01-01T00:00:00Z',
    },
    advanceReminderEnabled: true,
    onToggleAdvanceReminder: jest.fn(),
    advanceReminderTime: '20:00',
    onSelectReminderTime: jest.fn(),
    classReminderEnabled: true,
    onToggleClassReminder: jest.fn(),
    fallStart: '2026-08-01',
    fallEnd: '2026-12-31',
    springStart: '2026-02-01',
    springEnd: '2026-06-30',
    onUpdateSemesterDate: jest.fn(),
    onResetSemesterDates: jest.fn(),
    hapticsEnabled: true,
    onToggleHaptics: jest.fn(),
    confettiEnabled: true,
    onToggleConfetti: jest.fn(),
    soundEnabled: true,
    onToggleSound: jest.fn(),
    onClearData: jest.fn(),
  }

  test('renderiza el botón Debug en el menú principal y permite navegar a su subpágina con switches y botón de limpiar', async () => {
    const rendered = await render(
      <PersonalAuthProvider>
        <SystemSettingsModal {...baseProps} />
      </PersonalAuthProvider>
    )

    const debugBtn = rendered.getByLabelText('Abrir opciones de depuración')
    expect(debugBtn).toBeTruthy()

    await act(async () => {
      fireEvent.press(debugBtn)
    })

    // Debe mostrar las opciones y el botón de limpiar
    expect(rendered.getByText('Mostrar bienvenido')).toBeTruthy()
    expect(rendered.getByText('Pestaña Hoy activa')).toBeTruthy()
    expect(rendered.getByText('Mapa de actividad (Otoño)')).toBeTruthy()
    expect(rendered.getByText('Limpiar datos de prueba')).toBeTruthy()
  })
})
