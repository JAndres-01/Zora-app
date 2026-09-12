import React from 'react'
import { render, fireEvent, act } from '@testing-library/react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import WelcomeScreen, { ONBOARDING_COMPLETED_KEY } from '../../app/welcome'

describe('WelcomeScreen (4-Step Immersive Onboarding)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  test('renderiza inicialmente el paso 0 (Bienvenida General) con logo y controles', async () => {
    const { getByText, getByTestId, queryByTestId } = await render(<WelcomeScreen />)

    // Barra superior
    expect(getByText('ZORA')).toBeTruthy()
    expect(getByTestId('welcome-skip-button')).toBeTruthy()

    // Contenido del paso 0 (Bienvenida General)
    expect(getByText('Bienvenido a Zora')).toBeTruthy()
    expect(getByText('// 00 · SISTEMA ACADÉMICO')).toBeTruthy()
    expect(getByText('Modo local sin dependencia de red')).toBeTruthy()

    // Botones de control
    expect(getByTestId('welcome-next-button')).toBeTruthy()
    expect(queryByTestId('welcome-back-button')).toBeNull()
  })

  test('avanza por todos los pasos: 1 (Tareas), 2 (Horario) y 3 (Métricas con inicio en domingo y sin racha)', async () => {
    const { getByText, getByTestId, queryByText } = await render(<WelcomeScreen />)

    // Avanzar a paso 1: Tareas
    await act(async () => {
      fireEvent.press(getByTestId('welcome-next-button'))
    })

    expect(getByText('Control y registro de tareas')).toBeTruthy()
    expect(getByText('Infografia')).toBeTruthy()
    expect(getByText('Expo de modelo')).toBeTruthy()
    expect(getByText('10 Consultas')).toBeTruthy()
    expect(getByTestId('welcome-back-button')).toBeTruthy()

    // Avanzar a paso 2: Horario
    await act(async () => {
      fireEvent.press(getByTestId('welcome-next-button'))
    })

    expect(getByText('Horario académico estructurado')).toBeTruthy()
    expect(getByText('Ing de software')).toBeTruthy()
    expect(getByText('Redes II')).toBeTruthy()
    expect(getByText('C1')).toBeTruthy()

    // Avanzar a paso 3: Métricas
    await act(async () => {
      fireEvent.press(getByTestId('welcome-next-button'))
    })

    expect(getByText('Métricas de rendimiento')).toBeTruthy()
    // Verificamos que diga "14 Días" y NO "14 Días de racha"
    expect(getByText('14 Días')).toBeTruthy()
    expect(queryByText('14 Días de racha')).toBeNull()
    expect(getByText('28 entregas registradas')).toBeTruthy()
    // Verificamos que la semana empiece con D (Domingo)
    expect(getByText('D')).toBeTruthy()
    expect(getByText('Comenzar')).toBeTruthy()
  })

  test('permite retroceder al paso anterior con el botón de retroceso', async () => {
    const { getByText, getByTestId } = await render(<WelcomeScreen />)

    // Ir a paso 1
    await act(async () => {
      fireEvent.press(getByTestId('welcome-next-button'))
    })
    expect(getByText('Control y registro de tareas')).toBeTruthy()

    // Retroceder al paso 0
    await act(async () => {
      fireEvent.press(getByTestId('welcome-back-button'))
    })
    expect(getByText('Bienvenido a Zora')).toBeTruthy()
  })

  test('al completar el paso 3 (Comenzar) guarda en AsyncStorage y redirige a /auth', async () => {
    const mockReplace = jest.fn()
    jest.spyOn(require('expo-router'), 'useRouter').mockReturnValue({
      push: jest.fn(),
      replace: mockReplace,
      back: jest.fn(),
    })

    const { getByTestId } = await render(<WelcomeScreen />)

    // Avanzar a paso 1
    await act(async () => {
      fireEvent.press(getByTestId('welcome-next-button'))
    })

    // Avanzar a paso 2
    await act(async () => {
      fireEvent.press(getByTestId('welcome-next-button'))
    })

    // Avanzar a paso 3
    await act(async () => {
      fireEvent.press(getByTestId('welcome-next-button'))
    })

    // Finalizar en paso 3 pulsando Comenzar
    await act(async () => {
      fireEvent.press(getByTestId('welcome-next-button'))
    })

    expect(AsyncStorage.setItem).toHaveBeenCalledWith(ONBOARDING_COMPLETED_KEY, 'true')
    expect(mockReplace).toHaveBeenCalledWith('/auth')
  })

  test('al tocar Omitir guarda en AsyncStorage y redirige de inmediato a /auth', async () => {
    const mockReplace = jest.fn()
    jest.spyOn(require('expo-router'), 'useRouter').mockReturnValue({
      push: jest.fn(),
      replace: mockReplace,
      back: jest.fn(),
    })

    const { getByTestId } = await render(<WelcomeScreen />)

    await act(async () => {
      fireEvent.press(getByTestId('welcome-skip-button'))
    })

    expect(AsyncStorage.setItem).toHaveBeenCalledWith(ONBOARDING_COMPLETED_KEY, 'true')
    expect(mockReplace).toHaveBeenCalledWith('/auth')
  })
})
