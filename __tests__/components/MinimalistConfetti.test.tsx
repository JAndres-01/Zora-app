import React from 'react'
import { render, act } from '@testing-library/react-native'
import { MinimalistConfetti, MagicConfetti } from '@/components/effects/MinimalistConfetti'

describe('MinimalistConfetti (Magic UI dual cannon)', () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.clearAllTimers()
    jest.useRealTimers()
  })

  test('no renderiza nada cuando burstTrigger es 0 o negativo', async () => {
    const { queryByTestId } = await render(<MinimalistConfetti burstTrigger={0} />)
    expect(queryByTestId('magic-confetti-overlay')).toBeNull()
  })

  test('renderiza partículas al activar un burstTrigger positivo', async () => {
    const screen = await render(<MinimalistConfetti burstTrigger={0} />)
    expect(screen.queryByTestId('magic-confetti-overlay')).toBeNull()

    await act(async () => {
      screen.rerender(<MinimalistConfetti burstTrigger={1} />)
    })

    expect(screen.queryByTestId('magic-confetti-overlay')).toBeTruthy()
    const particles = screen.getAllByTestId('magic-confetti-particle')
    expect(particles.length).toBe(52)
  })

  test('exporta MagicConfetti como alias idéntico para conveniencia', () => {
    expect(MagicConfetti).toBe(MinimalistConfetti)
  })

  test('limpia la ráfaga después de que finalizan las animaciones', async () => {
    const screen = await render(<MinimalistConfetti burstTrigger={1} />)
    expect(screen.queryByTestId('magic-confetti-overlay')).toBeTruthy()

    await act(async () => {
      jest.advanceTimersByTime(3000)
    })

    expect(screen.queryByTestId('magic-confetti-overlay')).toBeNull()
  })
})
