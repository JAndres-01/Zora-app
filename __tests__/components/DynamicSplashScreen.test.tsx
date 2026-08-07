import React from 'react'
import { render, fireEvent, act } from '@testing-library/react-native'
import { DynamicSplashScreen } from '@/components/common/DynamicSplashScreen'

describe('DynamicSplashScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  test('renderiza la tipografía ZORA y omite el texto de sistema académico', async () => {
    const { getByText, getByTestId, queryByText } = await render(<DynamicSplashScreen autoFinish={false} />)

    expect(getByTestId('dynamic-splash-screen')).toBeTruthy()
    expect(getByText('ZORA')).toBeTruthy()
    expect(queryByText('SISTEMA ACADÉMICO')).toBeNull()
  })

  test('bloquea los toques en pantalla para evitar cierres accidentales durante la animación', async () => {
    const mockFinish = jest.fn()
    const { getByTestId } = await render(
      <DynamicSplashScreen autoFinish={false} onFinish={mockFinish} />
    )

    await act(async () => {
      fireEvent.press(getByTestId('dynamic-splash-screen'))
    })

    expect(mockFinish).not.toHaveBeenCalled()
  })

  test('dispara onFinish automáticamente tras cumplir la duración de 3000ms', async () => {
    jest.useFakeTimers()
    const mockFinish = jest.fn()
    await render(<DynamicSplashScreen autoFinish={true} duration={3000} onFinish={mockFinish} />)

    act(() => {
      jest.advanceTimersByTime(3000)
    })

    expect(mockFinish).toHaveBeenCalledTimes(1)
    jest.useRealTimers()
  })
})
