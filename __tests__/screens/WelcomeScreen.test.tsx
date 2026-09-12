import React from 'react'
import { render, fireEvent, act } from '@testing-library/react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import WelcomeScreen, { ONBOARDING_COMPLETED_KEY } from '../../app/welcome'

describe('WelcomeScreen (3-Step Carousel Onboarding)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  test('renderiza inicialmente el paso 1 (Tareas) con mockup y controles', async () => {
    const { getByText, getByTestId, queryByTestId } = await render(<WelcomeScreen />)

    // Barra superior
    expect(getByText('ZORA')).toBeTruthy()
    expect(getByTestId('welcome-skip-button')).toBeTruthy()

    // Contenido del paso 1
    expect(getByText('Control y registro de tareas')).toBeTruthy()
    expect(getByText('Taller de Cálculo Diferencial')).toBeTruthy()

    // Botones de control
    expect(getByTestId('welcome-next-button')).toBeTruthy()
    expect(queryByTestId('welcome-back-button')).toBeNull()
  })

  test('avanza al paso 2 (Horario) y paso 3 (Métricas) al pulsar siguiente', async () => {
    const { getByText, getByTestId } = await render(<WelcomeScreen />)

    // Avanzar a paso 2
    await act(async () => {
      fireEvent.press(getByTestId('welcome-next-button'))
    })

    expect(getByText('Horario académico estructurado')).toBeTruthy()
    expect(getByText('Álgebra Lineal')).toBeTruthy()
    expect(getByTestId('welcome-back-button')).toBeTruthy()

    // Avanzar a paso 3
    await act(async () => {
      fireEvent.press(getByTestId('welcome-next-button'))
    })

    expect(getByText('Métricas de rendimiento')).toBeTruthy()
    expect(getByText('94%')).toBeTruthy()
    expect(getByText('Comenzar')).toBeTruthy()
  })

  test('permite retroceder al paso anterior con el botón de retroceso', async () => {
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

  test('al completar el paso 3 guarda en AsyncStorage y redirige a /auth', async () => {
    const mockReplace = jest.fn()
    jest.spyOn(require('expo-router'), 'useRouter').mockReturnValue({
      push: jest.fn(),
      replace: mockReplace,
      back: jest.fn(),
    })

    const { getByTestId } = await render(<WelcomeScreen />)

    // Avanzar a paso 2
    await act(async () => {
      fireEvent.press(getByTestId('welcome-next-button'))
    })

    // Avanzar a paso 3
    await act(async () => {
      fireEvent.press(getByTestId('welcome-next-button'))
    })

    // Finalizar en paso 3
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
