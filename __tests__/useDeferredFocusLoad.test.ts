import { renderHook } from '@testing-library/react-native'
import { useDeferredFocusLoad } from '@/hooks/useDeferredFocusLoad'

describe('useDeferredFocusLoad', () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('difiere el refresco hasta después del retardo (tras el paint del switch)', async () => {
    const load = jest.fn()
    await renderHook(() => useDeferredFocusLoad(load, 50))

    expect(load).not.toHaveBeenCalled()
    jest.advanceTimersByTime(49)
    expect(load).not.toHaveBeenCalled()
    jest.advanceTimersByTime(1)
    expect(load).toHaveBeenCalledTimes(1)
  })

  it('cancela el refresco si la pantalla pierde el foco antes de ejecutarse', async () => {
    const load = jest.fn()
    const { unmount } = await renderHook(() => useDeferredFocusLoad(load, 50))

    await unmount()
    jest.advanceTimersByTime(200)
    expect(load).not.toHaveBeenCalled()
  })

  it('usa la función más reciente aunque cambie entre renders', async () => {
    const load = jest.fn()
    const load2 = jest.fn()
    const { rerender } = await renderHook(
      (props: { fn: () => void }) => useDeferredFocusLoad(props.fn, 50),
      { initialProps: { fn: load } }
    )

    await rerender({ fn: load2 })
    jest.advanceTimersByTime(50)
    expect(load).not.toHaveBeenCalled()
    expect(load2).toHaveBeenCalledTimes(1)
  })
})