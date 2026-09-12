import React from 'react'
import { render, fireEvent, act } from '@testing-library/react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import WelcomeScreen, { ONBOARDING_COMPLETED_KEY } from '../../app/welcome'

describe('WelcomeScreen (4-Step Minimalist Onboarding)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  test('renderiza inicialmente el paso 1 (Tareas) con omitir discreto a la izquierda', async () => {
    const { getByText, getByTestId, queryByTestId, queryByText } = await render(<WelcomeScreen />)

    // Barra superior
    expect(getByText('ZORA')).toBeTruthy()
    expect(getByTestId('welcome-skip-button')).toBeTruthy()

    // Contenido del paso 1: Tareas
    expect(getByText('Control y registro de tareas')).toBeTruthy()
    expect(getByText('Infografia')).toBeTruthy()
    expect(getByText('Expo de modelo')).toBeTruthy()
    expect(getByText('10 Consultas')).toBeTruthy()

    // Verificamos ausencia de comentarios tipo //...
    expect(queryByText('// 01 · TAREAS Y ENTREGAS')).toBeNull()

    // Botón de control siguiente presente, retroceso ausente en paso 1
    expect(getByTestId('welcome-next-button')).toBeTruthy()
    expect(queryByTestId('welcome-back-button')).toBeNull()
  })

  test('avanza por Horario, Métricas y la 4ª pantalla con Crear cuenta y Ya tengo cuenta', async () => {
    const { getByText, getByTestId, queryByTestId, queryByText } = await render(<WelcomeScreen />)

    // Avanzar a paso 2: Horario
    await act(async () => {
      fireEvent.press(getByTestId('welcome-next-button'))
    })

    expect(getByText('Horario académico estructurado')).toBeTruthy()
    expect(getByText('Ing de software')).toBeTruthy()
    expect(getByText('Redes II')).toBeTruthy()
    expect(getByText('C1')).toBeTruthy()
    expect(queryByText('// 02 · CRONOGRAMA SEMANAL')).toBeNull()
    expect(getByTestId('welcome-back-button')).toBeTruthy()

    // Avanzar a paso 3: Métricas
    await act(async () => {
      fireEvent.press(getByTestId('welcome-next-button'))
    })

    expect(getByText('Métricas de rendimiento')).toBeTruthy()
    expect(getByText('Registro de Actividad')).toBeTruthy()
    expect(getByText('28 entregas registradas')).toBeTruthy()
    expect(getByText('D')).toBeTruthy()
    expect(queryByText('14 Días')).toBeNull()

    // Avanzar a la 4ª pantalla: Selección de Cuenta
    await act(async () => {
      fireEvent.press(getByTestId('welcome-next-button'))
    })

    expect(getByText('Comienza con Zora')).toBeTruthy()
    expect(getByText('Tu espacio académico y personal minimalista')).toBeTruthy()
    expect(getByTestId('welcome-create-account-button')).toBeTruthy()
    expect(getByTestId('welcome-login-button')).toBeTruthy()
    // El botón circular siguiente ya no debe mostrarse en la última pantalla
    expect(queryByTestId('welcome-next-button')).toBeNull()
  })

  test('permite retroceder al paso anterior con el botón discreto de retroceso', async () => {
    const { getByText, getByTestId } = await render(<WelcomeScreen />)

    // Ir a paso 2
    await act(async () => {
      fireEvent.press(getByTestId('welcome-next-button'))
    })
    expect(getByText('Horario académico estructurado')).toBeTruthy()

    // Retroceder al paso 1
    await act(async () => {
      fireEvent.press(getByTestId('welcome-back-button'))
    })
    expect(getByText('Control y registro de tareas')).toBeTruthy()
  })

  test('en la 4ª pantalla, Crear cuenta redirige a /auth con mode=register', async () => {
    const mockPush = jest.fn()
    jest.spyOn(require('expo-router'), 'useRouter').mockReturnValue({
      push: mockPush,
      replace: jest.fn(),
      back: jest.fn(),
    })

    const { getByTestId } = await render(<WelcomeScreen />)

    // Avanzar hasta la 4ª pantalla (3 clics)
    await act(async () => {
      fireEvent.press(getByTestId('welcome-next-button'))
    })
    await act(async () => {
      fireEvent.press(getByTestId('welcome-next-button'))
    })
    await act(async () => {
      fireEvent.press(getByTestId('welcome-next-button'))
    })

    // Pulsar Crear cuenta
    await act(async () => {
      fireEvent.press(getByTestId('welcome-create-account-button'))
    })

    expect(AsyncStorage.setItem).toHaveBeenCalledWith(ONBOARDING_COMPLETED_KEY, 'true')
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/auth', params: { mode: 'register' } })
  })

  test('en la 4ª pantalla, Ya tengo cuenta redirige a /auth con mode=login', async () => {
    const mockPush = jest.fn()
    jest.spyOn(require('expo-router'), 'useRouter').mockReturnValue({
      push: mockPush,
      replace: jest.fn(),
      back: jest.fn(),
    })

    const { getByTestId } = await render(<WelcomeScreen />)

    // Avanzar hasta la 4ª pantalla
    await act(async () => {
      fireEvent.press(getByTestId('welcome-next-button'))
    })
    await act(async () => {
      fireEvent.press(getByTestId('welcome-next-button'))
    })
    await act(async () => {
      fireEvent.press(getByTestId('welcome-next-button'))
    })

    // Pulsar Ya tengo cuenta
    await act(async () => {
      fireEvent.press(getByTestId('welcome-login-button'))
    })

    expect(AsyncStorage.setItem).toHaveBeenCalledWith(ONBOARDING_COMPLETED_KEY, 'true')
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/auth', params: { mode: 'login' } })
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
