import React, { useState } from 'react'
import { render, fireEvent } from '@testing-library/react-native'
import { StudyPickerModal } from '@/components/today/StudyPickerModal'
import type { Task } from '@/types/personal'

const makeTask = (overrides: Partial<Task> = {}): Task => ({
  id: 't1',
  title: 'Tarea de prueba',
  description: null,
  status: 'pending',
  due_date: null,
  subject: { id: 's1', name: 'Mate', color: '#E11D48' },
  created_at: new Date().toISOString(),
  ...overrides,
})

/**
 * Harness que simula al padre (pantalla "Hoy"): conserva el ganador entre
 * aperturas (pickerWinner) y solo lo cambia al aterrizar / limpiar un giro nuevo.
 */
function Harness({ visible, onPicked }: { visible: boolean; onPicked?: (t: Task) => void }) {
  const [winner, setWinner] = useState<Task | null>(null)
  return (
    <StudyPickerModal
      visible={visible}
      tasks={[makeTask()]}
      initialWinner={winner}
      onClose={() => {}}
      onPicked={(t) => {
        setWinner(t)
        onPicked?.(t)
      }}
      onSpinStart={() => setWinner(null)}
    />
  )
}

describe('StudyPickerModal', () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.clearAllTimers()
    jest.useRealTimers()
  })

  test('se oculta cerrado y abre sin crashear (regresión: hooks tras return temprano)', async () => {
    const { getByText, queryByText, rerender } = await render(
      <StudyPickerModal visible={false} tasks={[makeTask()]} onClose={() => {}} />
    )

    expect(queryByText('¿Qué Tarea Hago?')).toBeNull()

    // Transición false -> true: antes crasheaba con "Rendered more hooks..."
    rerender(<StudyPickerModal visible tasks={[makeTask()]} onClose={() => {}} />)

    // El render-phase update del hook y la animación de apertura se procesan al avanzar timers
    await jest.advanceTimersByTimeAsync(600)

    expect(getByText('¿Qué Tarea Hago?')).toBeTruthy()
    expect(getByText('Toca girar 🎲')).toBeTruthy()
  })

  test('muestra el estado vacío cuando no hay tareas pendientes', async () => {
    const { getByText } = await render(
      <StudyPickerModal visible tasks={[makeTask({ status: 'completed' })]} onClose={() => {}} />
    )

    expect(getByText('¡Al día! Nada pendiente')).toBeTruthy()
    expect(getByText(/Sin tareas pendientes/)).toBeTruthy()
  })

  test('la tarea ganadora persiste al cerrar y reabrir; solo un nuevo giro la cambia y el confetti NO se dispara al entrar', async () => {
    const onPicked = jest.fn()
    const { getByText, getByLabelText, queryByText, queryAllByTestId, rerender } = await render(
      <Harness visible onPicked={onPicked} />
    )
    await jest.advanceTimersByTimeAsync(600)
    expect(getByText('Toca girar 🎲')).toBeTruthy()

    // Gira y espera al aterrizaje (3.8s + margen)
    fireEvent.press(getByLabelText('Girar ruleta'))
    await jest.advanceTimersByTimeAsync(4200)

    // Aterrizó: ganador + el handler del confetti se disparó EXACTAMENTE una vez
    expect(queryByText('Toca girar 🎲')).toBeNull()
    expect(getByText('¡Pendiente elegido!')).toBeTruthy()
    expect(onPicked).toHaveBeenCalledTimes(1)

    // Un nuevo giro redefine el ganador: el segundo aterrizaje invoca de nuevo el
// handler del confetti. (El hint transitorio "Girando…" puede quedar diferido
// por el flush de animaciones del efecto; lo relevante es el nuevo aterrizaje.)
    fireEvent.press(getByLabelText('Girar ruleta'))
    await jest.advanceTimersByTimeAsync(4200)
    expect(onPicked).toHaveBeenCalledTimes(2)
    expect(getByText('¡Pendiente elegido!')).toBeTruthy()

    // Cierra y reabre el modal
    rerender(<Harness visible={false} onPicked={onPicked} />)
    await jest.advanceTimersByTimeAsync(700)
    rerender(<Harness visible onPicked={onPicked} />)
    await jest.advanceTimersByTimeAsync(700)

    // La tarea SIGUE ahí (sin idle) y el confetti NO se disparó al entrar:
    // el trigger se resetea al cerrar, así el remount recibe burstTrigger=0.
    expect(queryByText('Toca girar 🎲')).toBeNull()
    expect(getByText('¡Pendiente elegido!')).toBeTruthy()
    expect(onPicked).toHaveBeenCalledTimes(2)
    expect(queryAllByTestId('magic-confetti-particle').length).toBe(0)
  })
})