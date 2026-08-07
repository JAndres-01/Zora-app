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
    const { getByPlaceholderText, getByDisplayValue, getByText, getByLabelText } = await render(
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
    expect(getByLabelText('Cerrar')).toBeTruthy()
    expect(getByLabelText('Guardar tarea')).toBeTruthy()

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

  test('permite guardar una tarea y llama onTaskSaved correctamente', async () => {
    const mockOnTaskSaved = jest.fn()
    const mockOnClose = jest.fn()

    const { getByPlaceholderText, getByLabelText } = await render(
      <MinimalistTaskModal
        mode="create"
        task={null}
        userId="user-test"
        subjects={mockSubjects}
        onClose={mockOnClose}
        onTaskSaved={mockOnTaskSaved}
      />
    )

    const titleInput = getByPlaceholderText('¿Qué tienes que hacer?')
    await act(async () => {
      fireEvent.changeText(titleInput, 'Tarea de prueba local')
    })

    const saveBtn = getByLabelText('Guardar tarea')
    await act(async () => {
      fireEvent.press(saveBtn)
    })

    expect(mockOnTaskSaved).toHaveBeenCalledTimes(1)
    const saved = mockOnTaskSaved.mock.calls[0][0]
    expect(saved.title).toBe('Tarea de prueba local')
    expect(saved.status).toBe('pending')
  })
})
