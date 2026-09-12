import React from 'react'
import { render, fireEvent, act } from '@testing-library/react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useRouter } from 'expo-router'
import WelcomeScreen, { ONBOARDING_COMPLETED_KEY } from '../../app/welcome'

describe('WelcomeScreen (First-Launch Onboarding)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  test('renderiza el título, subtítulo funcional y las 3 capacidades de la app', async () => {
    const { getByText, getByTestId } = await render(<WelcomeScreen />)

    expect(getByText('Z O R A')).toBeTruthy()
    expect(getByText('Organización académica y tareas.')).toBeTruthy()

    // Capacidades funcionales sin marketing
    expect(getByText('Horario y Materias')).toBeTruthy()
    expect(getByText('Tareas y Entregas')).toBeTruthy()
    expect(getByText('Modo Local o Sincronizado')).toBeTruthy()

    // Botón de continuar
    expect(getByTestId('welcome-continue-button')).toBeTruthy()
    expect(getByText('Continuar')).toBeTruthy()
  })

  test('al presionar Continuar guarda la bandera en AsyncStorage y navega a /auth', async () => {
    const mockReplace = jest.fn()
    jest.spyOn(require('expo-router'), 'useRouter').mockReturnValue({
      push: jest.fn(),
      replace: mockReplace,
      back: jest.fn(),
    })

    const { getByTestId } = await render(<WelcomeScreen />)

    const continueButton = getByTestId('welcome-continue-button')

    await act(async () => {
      fireEvent.press(continueButton)
    })

    expect(AsyncStorage.setItem).toHaveBeenCalledWith(ONBOARDING_COMPLETED_KEY, 'true')
    expect(mockReplace).toHaveBeenCalledWith('/auth')
  })
})
