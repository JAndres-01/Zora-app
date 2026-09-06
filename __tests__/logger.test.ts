import { logger } from '@/lib/logger'

describe('logger', () => {
  const originalWarn = console.warn
  const originalError = console.error
  const originalLog = console.log

  beforeEach(() => {
    console.warn = jest.fn()
    console.error = jest.fn()
    console.log = jest.fn()
  })

  afterAll(() => {
    console.warn = originalWarn
    console.error = originalError
    console.log = originalLog
  })

  it('emite logs en entorno de desarrollo/test (__DEV__ === true)', () => {
    logger.log('test log')
    expect(console.log).toHaveBeenCalledWith('test log')

    logger.warn('test warn')
    expect(console.warn).toHaveBeenCalledWith('test warn')

    logger.error('test error')
    expect(console.error).toHaveBeenCalledWith('test error')
  })
})
