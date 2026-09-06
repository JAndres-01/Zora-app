import React from 'react'
import { render, fireEvent } from '@testing-library/react-native'
import { MinimalistTaskRow } from '@/components/tasks/MinimalistTaskRow'
import type { Task } from '@/types/personal'

describe('MinimalistTaskRow Component', () => {
  const mockTask: Task = {
    id: 'test-task-1',
    title: 'Estudiar para examen de Termodinámica',
    description: 'Capítulos 1 al 4',
    status: 'pending',
    subject: {
      id: 'subj-1',
      name: 'Física Térmica',
      color: '#FFFFFF',
    },
    created_at: new Date().toISOString(),
  }

  test('renderiza correctamente el título de la tarea y la materia', async () => {
    const { getByText } = await render(
      <MinimalistTaskRow
        task={mockTask}
        onToggleStatus={jest.fn()}
        onOpenDetail={jest.fn()}
        onEdit={jest.fn()}
        onDelete={jest.fn()}
      />
    )

    expect(getByText('Estudiar para examen de Termodinámica')).toBeTruthy()
    expect(getByText('Física Térmica')).toBeTruthy()
  })

  test('al tocar el título de la tarea ejecuta onOpenDetail con el objeto tarea', async () => {
    const onOpenDetailMock = jest.fn()
    const { getByText } = await render(
      <MinimalistTaskRow
        task={mockTask}
        onToggleStatus={jest.fn()}
        onOpenDetail={onOpenDetailMock}
        onEdit={jest.fn()}
        onDelete={jest.fn()}
      />
    )

    fireEvent.press(getByText('Estudiar para examen de Termodinámica'))
    expect(onOpenDetailMock).toHaveBeenCalledWith(mockTask)
  })
})
