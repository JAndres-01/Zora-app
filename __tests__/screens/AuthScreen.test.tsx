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

describe('AuthScreen (Minimalist Auth: Login & Register)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockSearchParams = {}
  })

  test('renderiza la pantalla Bienvenido de vuelta (Login) por defecto sin recuperación de contraseña ni botones de terceros', async () => {
    mockSearchParams = { mode: 'login' }
    const { getByText, queryByText } = await render(<AuthScreen />)

    // Título y subtítulo
    expect(getByText('Bienvenido de vuelta')).toBeTruthy()
    expect(getByText('Ingresa para continuar en tu espacio.')).toBeTruthy()

    // Campos presentes
    expect(getByText('CORREO ELECTRÓNICO')).toBeTruthy()
    expect(getByText('CONTRASEÑA')).toBeTruthy()
    expect(queryByText('NOMBRE')).toBeNull()

    // Botones presentes
    expect(getByText('Iniciar Sesión')).toBeTruthy()
    expect(getByText('Ingreso con Face ID / Huella')).toBeTruthy()

    // Verificaciones estrictas de requerimiento:
    // 1. Sin opción de recuperar contraseña
    expect(queryByText(/olvidaste/i)).toBeNull()
    expect(queryByText(/recuperar/i)).toBeNull()

    // 2. Sin botones de Apple ni Google
    expect(queryByText(/apple/i)).toBeNull()
    expect(queryByText(/google/i)).toBeNull()

    // Enlace a registrarse
    expect(getByText('Regístrate')).toBeTruthy()
  })

  test('renderiza la pantalla Crear cuenta cuando mode=register sólo para ingresar por correo', async () => {
    mockSearchParams = { mode: 'register' }
    const { getByText, queryByText } = await render(<AuthScreen />)

    // Título y subtítulo
    expect(getByText('Crear cuenta')).toBeTruthy()
    expect(getByText('Inicia tu espacio de trabajo minimalista.')).toBeTruthy()

    // Campos requeridos en card style
    expect(getByText('NOMBRE')).toBeTruthy()
    expect(getByText('CORREO ELECTRÓNICO')).toBeTruthy()
    expect(getByText('CONTRASEÑA')).toBeTruthy()

    // Botón de acción principal
    expect(getByText('Completar Registro')).toBeTruthy()

    // Sin botón biométrico en registro
    expect(queryByText('Ingreso con Face ID / Huella')).toBeNull()

    // Sin botones de Apple ni Google
    expect(queryByText(/apple/i)).toBeNull()
    expect(queryByText(/google/i)).toBeNull()

    // Enlace a iniciar sesión
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

  test('el botón discreto de retroceso ejecuta router.back()', async () => {
    const { getByTestId } = await render(<AuthScreen />)

    await act(async () => {
      fireEvent.press(getByTestId('auth-back-button'))
    })

    expect(mockBack).toHaveBeenCalled()
  })

  test('al pulsar el botón biométrico muestra mensaje discreto', async () => {
    mockSearchParams = { mode: 'login' }
    const { getByTestId, getByText } = await render(<AuthScreen />)

    await act(async () => {
      fireEvent.press(getByTestId('auth-biometric-button'))
    })

    expect(getByText(/Autenticación biométrica disponible/i)).toBeTruthy()
  })
})
