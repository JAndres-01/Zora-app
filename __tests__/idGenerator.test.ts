import { generateId } from '@/lib/idGenerator'

describe('idGenerator', () => {
  it('genera IDs únicos con el prefijo especificado', () => {
    const id1 = generateId('task')
    const id2 = generateId('task')

    expect(id1.startsWith('task_')).toBe(true)
    expect(id2.startsWith('task_')).toBe(true)
    expect(id1).not.toBe(id2)
  })

  it('genera IDs con prefijo por defecto', () => {
    const id = generateId()
    expect(id.startsWith('id_')).toBe(true)
  })

  it('genera IDs sin colisiones en volumen', () => {
    const set = new Set<string>()
    for (let i = 0; i < 1000; i++) {
      const id = generateId('item')
      expect(set.has(id)).toBe(false)
      set.add(id)
    }
    expect(set.size).toBe(1000)
  })
})
