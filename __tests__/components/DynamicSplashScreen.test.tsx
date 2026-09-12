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

  test('permite omitir y disparar onFinish al presionar la pantalla', async () => {
    const mockFinish = jest.fn()
    const { getByTestId } = await render(
      <DynamicSplashScreen autoFinish={false} onFinish={mockFinish} />
    )

    await act(async () => {
      fireEvent.press(getByTestId('dynamic-splash-screen'))
    })

    expect(mockFinish).toHaveBeenCalledTimes(1)
  })
})
