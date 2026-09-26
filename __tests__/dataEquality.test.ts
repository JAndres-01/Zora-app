import {
  samePreferences,
  sameSchedules,
  sameSubjects,
  sameTasks,
} from '@/lib/dataEquality'
import type { AppPreferences, Schedule, Subject, Task } from '@/types/personal'

const task = (overrides: Partial<Task> = {}): Task => ({
  id: 't1',
  subject_id: 's1',
  title: 'Tarea',
  status: 'pending',
  ...overrides,
})

const subject = (overrides: Partial<Subject> = {}): Subject => ({
  id: 's1',
  name: 'Matemáticas',
  color: '#3B82F6',
  ...overrides,
})

const schedule = (overrides: Partial<Schedule> = {}): Schedule => ({
  id: 'sch1',
  day_of_week: 1,
  block_number: 1,
  subject_id: 's1',
  start_time: '08:00',
  end_time: '09:00',
  ...overrides,
})

describe('sameTasks', () => {
  it('true para contenido idéntico aunque los objetos sean distintos (relectura de caché)', () => {
    const a = [task({ id: 'a' }), task({ id: 'b', status: 'completed', completed_at: 'x' })]
    const b = [task({ id: 'a' }), task({ id: 'b', status: 'completed', completed_at: 'x' })]
    expect(sameTasks(a, b)).toBe(true)
  })

  it('false si cambia el estado o el orden', () => {
    const a = [task({ id: 'a' }), task({ id: 'b', status: 'completed' })]
    const b = [task({ id: 'a', status: 'completed' }), task({ id: 'b' })]
    expect(sameTasks(a, b)).toBe(false)
  })

  it('false si cambia updated_at (edit real)', () => {
    expect(sameTasks([task({ id: 'a', updated_at: '1' })], [task({ id: 'a', updated_at: '2' })])).toBe(false)
  })

  it('false si cambia la materia adjunta', () => {
    const a = [task({ id: 'a', subject: subject({ id: 's1', name: 'Física' }) })]
    const b = [task({ id: 'a', subject: subject({ id: 's1', name: 'Química' }) })]
    expect(sameTasks(a, b)).toBe(false)
  })

  it('false con longitudes distintas', () => {
    expect(sameTasks([task()], [task(), task()])).toBe(false)
  })

  it('true con listas vacías y por referencia', () => {
    expect(sameTasks([], [])).toBe(true)
    const list = [task()]
    expect(sameTasks(list, list)).toBe(true)
  })
})

describe('sameSubjects / sameSchedules', () => {
  it('subjects: detecta cambio de color/nombre y longitudes', () => {
    expect(sameSubjects([subject()], [subject()])).toBe(true)
    expect(sameSubjects([subject({ color: '#111' })], [subject({ color: '#222' })])).toBe(false)
    expect(sameSubjects([subject()], [subject(), subject()])).toBe(false)
  })

  it('schedules: detecta cambio de horario/bloque y materia adjunta', () => {
    expect(sameSchedules([schedule()], [schedule()])).toBe(true)
    expect(sameSchedules([schedule({ start_time: '09:00' })], [schedule({ start_time: '10:00' })])).toBe(false)
    expect(
      sameSchedules(
        [schedule({ subject: subject({ id: 's1', color: '#aaa' }) })],
        [schedule({ subject: subject({ id: 's1', color: '#bbb' }) })]
      )
    ).toBe(false)
  })
})

describe('samePreferences', () => {
  const prefs = (overrides: Partial<AppPreferences> = {}): AppPreferences => ({
    haptics_enabled: true,
    confetti_enabled: true,
    advance_reminder_enabled: false,
    advance_reminder_time: '20:00',
    class_reminder_enabled: true,
    ...overrides,
  })

  it('true si todo es igual', () => {
    expect(samePreferences(prefs(), prefs())).toBe(true)
  })

  it('false si cambia cualquier campo usado por settings', () => {
    expect(samePreferences(prefs(), prefs({ sound_enabled: false }))).toBe(false)
    expect(samePreferences(prefs(), prefs({ semester_fall_start: '2026-08-01' }))).toBe(false)
    expect(samePreferences(prefs(), prefs({ advance_reminder_time: '07:00' }))).toBe(false)
  })
})