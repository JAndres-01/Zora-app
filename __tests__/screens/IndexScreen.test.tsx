import React from 'react'
import { render, waitFor } from '@testing-library/react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { Redirect } from 'expo-router'
import Index from '../../app/index'
import { ONBOARDING_COMPLETED_KEY } from '../../app/welcome'
import * as ClassAuthContext from '@/context/ClassAuthContext'

describe('Index Screen Routing', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  test('redirige a /welcome cuando no se ha completado el onboarding', async () => {
    ;(AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(null)
    jest.spyOn(ClassAuthContext, 'useClassAuth').mockReturnValue({
      isConnected: false,
      isLoading: false,
      userRole: null,
      session: null,
      user: null,
      classCode: null,
      classGroup: null,
      signIn: jest.fn(),
      signUp: jest.fn(),
      signOut: jest.fn(),
      refreshSession: jest.fn(),
    } as any)

    await render(<Index />)

    await waitFor(() => {
      expect(Redirect).toHaveBeenCalledWith({ href: '/welcome' }, undefined)
    })
  })

  test('redirige a /auth cuando ya se completó el onboarding pero no está conectado', async () => {
    ;(AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce('true')
    jest.spyOn(ClassAuthContext, 'useClassAuth').mockReturnValue({
      isConnected: false,
      isLoading: false,
      userRole: null,
      session: null,
      user: null,
      classCode: null,
      classGroup: null,
      signIn: jest.fn(),
      signUp: jest.fn(),
      signOut: jest.fn(),
      refreshSession: jest.fn(),
    } as any)

    await render(<Index />)

    await waitFor(() => {
      expect(Redirect).toHaveBeenCalledWith({ href: '/auth' }, undefined)
    })
  })

  test('redirige a /(tabs)/today cuando ya completó onboarding y está conectado', async () => {
    ;(AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce('true')
    jest.spyOn(ClassAuthContext, 'useClassAuth').mockReturnValue({
      isConnected: true,
      isLoading: false,
      userRole: 'student',
      session: {} as any,
      user: {} as any,
      classCode: 'GRP-101',
      classGroup: {} as any,
      signIn: jest.fn(),
      signUp: jest.fn(),
      signOut: jest.fn(),
      refreshSession: jest.fn(),
    } as any)

    await render(<Index />)

    await waitFor(() => {
      expect(Redirect).toHaveBeenCalledWith({ href: '/(tabs)/today' }, undefined)
    })
  })

  test('renderiza pantalla de carga skeleton cuando ya completó onboarding pero isLoading es true', async () => {
    ;(AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce('true')
    jest.spyOn(ClassAuthContext, 'useClassAuth').mockReturnValue({
      isConnected: false,
      isLoading: true,
      userRole: null,
      session: null,
      user: null,
      classCode: null,
      classGroup: null,
      signIn: jest.fn(),
      signUp: jest.fn(),
      signOut: jest.fn(),
      refreshSession: jest.fn(),
    } as any)

    const { getByTestId } = await render(<Index />)

    await waitFor(() => {
      expect(getByTestId('skeleton-loading-screen')).toBeTruthy()
    })
  })
})
