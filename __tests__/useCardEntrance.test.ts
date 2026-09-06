import { renderHook } from '@testing-library/react-native'
import { useCardEntrance, resetPlayedEntrances } from '@/hooks/useCardEntrance'

describe('useCardEntrance', () => {
  beforeEach(() => {
    resetPlayedEntrances()
  })

  it('inicializa los valores animados según el conteo solicitado', async () => {
    const { result } = await renderHook(() => useCardEntrance(3, 'test_screen'))
    expect(result.current.length).toBe(3)
  })

  it('no reinicia los valores si la pantalla ya jugó su animación', async () => {
    const { result: first } = await renderHook(() => useCardEntrance(2, 'screen_cached'))
    expect(first.current.length).toBe(2)

    const { result: second } = await renderHook(() => useCardEntrance(2, 'screen_cached'))
    expect(second.current.length).toBe(2)
  })
})
