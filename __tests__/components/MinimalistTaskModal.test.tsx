import React from 'react'
import { render, fireEvent, waitFor, act } from '@testing-library/react-native'
import { MinimalistTaskModal } from '@/components/tasks/MinimalistTaskModal'
import type { Task, Subject } from '@/types/personal'

describe('MinimalistTaskModal Component', () => {
  const mockSubjects: Subject[] = [
    { id: 'subj-1', name: 'Álgebra Lineal', color: '#10B981' },
    { id: 'subj-2', name: 'Programación Orientada a Objetos', color: '#3B82F6' },
  ]

  test('en modo creación permite escribir el título y descripción', async () => {
    const { getByPlaceholderText, getByDisplayValue, getByText } = await render(
      <MinimalistTaskModal
        mode="create"
        task={null}
        userId="user-test"
        subjects={mockSubjects}
        onClose={jest.fn()}
        onTaskSaved={jest.fn()}
      />
    )

    const titleInput = getByPlaceholderText('¿Qué tienes que hacer?')
    expect(titleInput).toBeTruthy()
    expect(getByText('Nueva Tarea')).toBeTruthy()
    expect(getByText('Guardar')).toBeTruthy()

    await act(async () => {
      fireEvent.changeText(titleInput, 'Proyecto Final de Álgebra')
    })

    await waitFor(() => {
      expect(getByDisplayValue('Proyecto Final de Álgebra')).toBeTruthy()
    })
  })

  test('en modo detalle renderiza la información de la tarea y botón de editar', async () => {
    const task: Task = {
      id: 't-1',
      title: 'Entrega de práctica 2',
      description: 'Entregar en PDF',
      status: 'pending',
      subject: mockSubjects[0],
    }

    const { getByText } = await render(
      <MinimalistTaskModal
        mode="detail"
        task={task}
        userId="user-test"
        subjects={mockSubjects}
        onClose={jest.fn()}
        onTaskSaved={jest.fn()}
      />
    )

    expect(getByText('Entrega de práctica 2')).toBeTruthy()
    expect(getByText('Entregar en PDF')).toBeTruthy()
  })
})
