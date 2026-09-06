import { renderHook, act } from '@testing-library/react-native'
import { useModalAnimation } from '@/hooks/useModalAnimation'

jest.mock('@/lib/personalHaptics', () => ({
  triggerHaptic: jest.fn(),
}))

describe('useModalAnimation', () => {
  it('inicializa con modalVisible según la prop visible', async () => {
    const onClose = jest.fn()
    const { result } = await renderHook(() => useModalAnimation({ visible: true, onClose }))
    expect(result.current.modalVisible).toBe(true)
  })

  it('inicializa como falso cuando visible es false', async () => {
    const onClose = jest.fn()
    const { result } = await renderHook(() => useModalAnimation({ visible: false, onClose }))
    expect(result.current.modalVisible).toBe(false)
  })

  it('proporciona animaciones y panResponder válidos', async () => {
    const onClose = jest.fn()
    const { result } = await renderHook(() => useModalAnimation({ visible: true, onClose }))
    expect(result.current.fadeAnim).toBeDefined()
    expect(result.current.slideAnim).toBeDefined()
    expect(result.current.panY).toBeDefined()
    expect(result.current.panResponder).toBeDefined()
    expect(typeof result.current.handleSmoothClose).toBe('function')
  })

  it('llama a onClose al ejecutar handleSmoothClose', async () => {
    jest.useFakeTimers()
    const onClose = jest.fn()
    const onClosed = jest.fn()
    const { result } = await renderHook(() =>
      useModalAnimation({ visible: true, onClose, onClosed })
    )

    act(() => {
      result.current.handleSmoothClose()
      jest.runAllTimers()
    })

    expect(onClose).toHaveBeenCalled()
    expect(onClosed).toHaveBeenCalled()
    jest.useRealTimers()
  })
})
