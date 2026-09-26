import { renderHook, act } from '@testing-library/react-native'
import { useIncomingShareIntent } from '@/lib/useIncomingShareIntent'
import { useShareIntent } from 'expo-share-intent'

const mockUseShareIntent = useShareIntent as jest.MockedFunction<typeof useShareIntent>

describe('useIncomingShareIntent Hook', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  test('procesa correctamente un archivo PDF compartido', async () => {
    const mockReset = jest.fn()
    mockUseShareIntent.mockReturnValue({
      hasShareIntent: true,
      shareIntent: {
        files: [
          {
            path: 'file:///data/user/0/com.zora.app/cache/Taller_Fisica_1.pdf',
            fileName: 'Taller_Fisica_1.pdf',
            mimeType: 'application/pdf',
            size: 204800,
            width: null,
            height: null,
            duration: null,
          },
        ],
        text: null,
        webUrl: null,
        type: 'file',
      },
      resetShareIntent: mockReset,
      isReady: true,
      error: null,
    })

    const { result } = await renderHook(() => useIncomingShareIntent())

    expect(result.current.isShareModalOpen).toBe(true)
    expect(result.current.incomingTitle).toBe('Taller Fisica 1')
    expect(result.current.incomingAttachments).toHaveLength(1)
    expect(result.current.incomingAttachments[0].file_type).toBe('document')
    expect(result.current.incomingAttachments[0].file_name).toBe('Taller_Fisica_1.pdf')
  })

  test('procesa correctamente una imagen compartida', async () => {
    const mockReset = jest.fn()
    mockUseShareIntent.mockReturnValue({
      hasShareIntent: true,
      shareIntent: {
        files: [
          {
            path: 'file:///data/user/0/com.zora.app/cache/IMG_2026_Tarea.png',
            fileName: 'IMG_2026_Tarea.png',
            mimeType: 'image/png',
            size: 1024000,
            width: 1080,
            height: 1920,
            duration: null,
          },
        ],
        text: null,
        webUrl: null,
        type: 'media',
      },
      resetShareIntent: mockReset,
      isReady: true,
      error: null,
    })

    const { result } = await renderHook(() => useIncomingShareIntent())

    expect(result.current.isShareModalOpen).toBe(true)
    expect(result.current.incomingTitle).toBe('IMG 2026 Tarea')
    expect(result.current.incomingAttachments).toHaveLength(1)
    expect(result.current.incomingAttachments[0].file_type).toBe('image')
  })

  test('procesa texto compartido colocándolo en la descripción de la tarea', async () => {
    const mockReset = jest.fn()
    mockUseShareIntent.mockReturnValue({
      hasShareIntent: true,
      shareIntent: {
        files: null,
        text: 'Resolver los ejercicios 1 al 10 del capítulo 4 para el próximo viernes.',
        webUrl: null,
        type: 'text',
      },
      resetShareIntent: mockReset,
      isReady: true,
      error: null,
    })

    const { result } = await renderHook(() => useIncomingShareIntent())

    expect(result.current.isShareModalOpen).toBe(true)
    expect(result.current.incomingDescription).toBe(
      'Resolver los ejercicios 1 al 10 del capítulo 4 para el próximo viernes.'
    )
  })

  test('procesa un enlace web compartido', async () => {
    const mockReset = jest.fn()
    mockUseShareIntent.mockReturnValue({
      hasShareIntent: true,
      shareIntent: {
        files: null,
        text: 'https://campus.universidad.edu/tarea/123',
        webUrl: 'https://campus.universidad.edu/tarea/123',
        type: 'weburl',
      },
      resetShareIntent: mockReset,
      isReady: true,
      error: null,
    })

    const { result } = await renderHook(() => useIncomingShareIntent())

    expect(result.current.isShareModalOpen).toBe(true)
    expect(result.current.incomingAttachments).toHaveLength(1)
    expect(result.current.incomingAttachments[0].file_type).toBe('link')
    expect(result.current.incomingAttachments[0].file_url).toBe(
      'https://campus.universidad.edu/tarea/123'
    )
  })

  test('al cerrar el modal resetea el estado y llama a resetShareIntent', async () => {
    const mockReset = jest.fn()
    mockUseShareIntent.mockReturnValue({
      hasShareIntent: true,
      shareIntent: {
        files: null,
        text: 'Nota rápida',
        webUrl: null,
        type: 'text',
      },
      resetShareIntent: mockReset,
      isReady: true,
      error: null,
    })

    const { result } = await renderHook(() => useIncomingShareIntent())

    expect(result.current.isShareModalOpen).toBe(true)

    await act(async () => {
      result.current.closeIncomingShareModal()
    })

    expect(result.current.isShareModalOpen).toBe(false)
    expect(result.current.incomingAttachments).toEqual([])
    expect(result.current.incomingTitle).toBe('')
    expect(result.current.incomingDescription).toBe('')
    expect(mockReset).toHaveBeenCalledWith(true)
  })
})
