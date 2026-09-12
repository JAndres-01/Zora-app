import React from 'react'
import { render, fireEvent, act } from '@testing-library/react-native'
import AuthScreen from '../../app/auth'

const mockPush = jest.fn()
const mockReplace = jest.fn()
const mockBack = jest.fn()
let mockSearchParams: { mode?: string } = {}

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: mockReplace,
    back: mockBack,
    canGoBack: () => true,
  }),
  useLocalSearchParams: () => mockSearchParams,
}))

const mockSignIn = jest.fn().mockResolvedValue({ error: null })
const mockSignUp = jest.fn().mockResolvedValue({ error: null })

jest.mock('@/context/ClassAuthContext', () => ({
  useClassAuth: () => ({
    isConnected: false,
    isLoading: false,
    signIn: mockSignIn,
    signUp: mockSignUp,
  }),
}))

describe('AuthScreen (Minimalist Auth: Centered & Clean)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockSearchParams = {}
  })

  test('renderiza Bienvenido de vuelta (Login) centrado, con retroceso sin fondo y sin botón biométrico', async () => {
    mockSearchParams = { mode: 'login' }
    const { getByText, queryByText, getByTestId, queryByTestId } = await render(<AuthScreen />)

    // Título y subtítulo
    expect(getByText('Bienvenido de vuelta')).toBeTruthy()
    expect(getByText('Ingresa para continuar en tu espacio.')).toBeTruthy()

    // Campos presentes
    expect(getByText('CORREO ELECTRÓNICO')).toBeTruthy()
    expect(getByText('CONTRASEÑA')).toBeTruthy()
    expect(queryByText('NOMBRE')).toBeNull()

    // Botón principal presente
    expect(getByText('Iniciar Sesión')).toBeTruthy()

    // Verificaciones estrictas de requerimiento del usuario:
    // 1. Botón biométrico eliminado
    expect(queryByTestId('auth-biometric-button')).toBeNull()
    expect(queryByText(/Face ID/i)).toBeNull()
    expect(queryByText(/Huella/i)).toBeNull()

    // 2. Sin opción de recuperar contraseña
    expect(queryByText(/olvidaste/i)).toBeNull()
    expect(queryByText(/recuperar/i)).toBeNull()

    // 3. Sin botones de terceros (Apple / Google)
    expect(queryByText(/apple/i)).toBeNull()
    expect(queryByText(/google/i)).toBeNull()

    // 4. Botón de retroceso sin fondo presente para volver al onboarding
    expect(getByTestId('auth-back-button')).toBeTruthy()

    // Enlace a alternar modo
    expect(getByText('Regístrate')).toBeTruthy()
  })

  test('renderiza Crear cuenta cuando mode=register sólo para ingresar por correo', async () => {
    mockSearchParams = { mode: 'register' }
    const { getByText, queryByText, getByTestId, queryByTestId } = await render(<AuthScreen />)

    // Título y subtítulo
    expect(getByText('Crear cuenta')).toBeTruthy()
    expect(getByText('Inicia tu espacio de trabajo minimalista.')).toBeTruthy()

    // Campos requeridos
    expect(getByText('NOMBRE')).toBeTruthy()
    expect(getByText('CORREO ELECTRÓNICO')).toBeTruthy()
    expect(getByText('CONTRASEÑA')).toBeTruthy()

    // Botón de acción principal
    expect(getByText('Completar Registro')).toBeTruthy()

    // Sin botón biométrico
    expect(queryByTestId('auth-biometric-button')).toBeNull()

    // Sin botones de Apple ni Google
    expect(queryByText(/apple/i)).toBeNull()
    expect(queryByText(/google/i)).toBeNull()

    // Botón de retroceso presente
    expect(getByTestId('auth-back-button')).toBeTruthy()

    // Enlace a alternar modo
    expect(getByText('Inicia sesión')).toBeTruthy()
  })

  test('permite alternar entre Crear cuenta e Iniciar sesión dinámicamente', async () => {
    mockSearchParams = { mode: 'login' }
    const { getByText, queryByText, getByTestId } = await render(<AuthScreen />)

    expect(getByText('Bienvenido de vuelta')).toBeTruthy()

    // Cambiar a registro
    await act(async () => {
      fireEvent.press(getByTestId('auth-toggle-mode-button'))
    })

    expect(getByText('Crear cuenta')).toBeTruthy()
    expect(getByText('NOMBRE')).toBeTruthy()
    expect(getByText('Completar Registro')).toBeTruthy()

    // Cambiar nuevamente a login
    await act(async () => {
      fireEvent.press(getByTestId('auth-toggle-mode-button'))
    })

    expect(getByText('Bienvenido de vuelta')).toBeTruthy()
    expect(queryByText('NOMBRE')).toBeNull()
  })

  test('el botón de retroceso ejecuta router.back() para volver a la pantalla de cuenta', async () => {
    const { getByTestId } = await render(<AuthScreen />)

    await act(async () => {
      fireEvent.press(getByTestId('auth-back-button'))
    })

    expect(mockBack).toHaveBeenCalled()
  })
})
