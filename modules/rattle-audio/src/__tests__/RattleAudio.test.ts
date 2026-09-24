import { isRattleAvailable, prepareRattle, playRattleClicks, stopRattle } from '../RattleAudio'

/**
 * En el entorno de Jest no hay módulo nativo: el wrapper debe degradar sin lanzar
 * y los callers (StudyPickerModal/personalAudio) caen al fallback por-clic.
 */
describe('RattleAudio (wrapper JS)', () => {
  it('no rompe en entornos sin módulo nativo', async () => {
    // Sin importar si requireNativeModule lanza o devuelve un mock, ninguna llamada
    // debe propagar excepción al caller.
    await expect(prepareRattle({} as never)).resolves.toBeUndefined()
    expect(() => playRattleClicks([0, 33, 66])).not.toThrow()
    expect(() => stopRattle()).not.toThrow()
    // En Jest el nativo no está disponible → la ráfaga no se programa
    expect(isRattleAvailable()).toBe(false)
    expect(playRattleClicks([0, 33, 66])).toBe(false)
  })
})