import { renderHook, act } from '@testing-library/react-native'
import { useModalAnimation } from '@/hooks/useModalAnimation'
import { playModalCloseSound } from '@/lib/personalAudio'

jest.mock('@/lib/personalHaptics', () => ({
  triggerHaptic: jest.fn(),
}))

jest.mock('@/lib/personalAudio', () => ({
  playModalOpenSound: jest.fn(),
  playModalCloseSound: jest.fn(),
}))

describe('useModalAnimation', () => {
  it('inicializa con modalVisible segun la prop visible', async () => {
    const onClose = jest.fn()
    const { result } = await renderHook(() => useModalAnimation({ visible: true, onClose }))
    expect(result.current.modalVisible).toBe(true)
  })

  it('inicializa como falso cuando visible es false', async () => {
    const onClose = jest.fn()
    const { result } = await renderHook(() => useModalAnimation({ visible: false, onClose }))
    expect(result.current.modalVisible).toBe(false)
  })

  it('proporciona animaciones y panResponder validos', async () => {
    const onClose = jest.fn()
    const { result } = await renderHook(() => useModalAnimation({ visible: true, onClose }))
    expect(result.current.fadeAnim).toBeDefined()
    expect(result.current.slideAnim).toBeDefined()
    expect(result.current.panY).toBeDefined()
    expect(result.current.panResponder).toBeDefined()
    expect(typeof result.current.handleSmoothClose).toBe('function')
  })

  it('llama a onClose al ejecutar handleSmoothClose', async () => {
    const onClose = jest.fn()
    const onClosed = jest.fn()
    const { result, unmount } = await renderHook(() =>
      useModalAnimation({ visible: true, onClose, onClosed })
    )

    jest.useFakeTimers()
    act(() => {
      result.current.handleSmoothClose()
      jest.runAllTimers()
    })
    jest.useRealTimers()

    expect(onClose).toHaveBeenCalled()
    expect(onClosed).toHaveBeenCalled()
    expect(playModalCloseSound).toHaveBeenCalled()
    unmount()
  })
})