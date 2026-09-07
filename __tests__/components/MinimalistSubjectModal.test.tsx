import React from 'react'
import { render } from '@testing-library/react-native'
import { MinimalistSubjectModal } from '@/components/schedule/MinimalistSubjectModal'
import type { Subject } from '@/types/personal'

describe('MinimalistSubjectModal Component', () => {
  const mockSubjects: Subject[] = [
    { id: 'subj-1', name: 'Calculo Multivariable', teacher_name: 'Ing. Morales', color: '#3B82F6' },
  ]

  test('renderiza correctamente cuando visible=true sin crashear', async () => {
    const { getByText, getByPlaceholderText } = await render(
      <MinimalistSubjectModal
        visible={true}
        subjects={mockSubjects}
        onClose={jest.fn()}
        onSubjectsUpdated={jest.fn()}
      />
    )

    expect(getByText('Gestionar Materias')).toBeTruthy()
    expect(getByText('Calculo Multivariable')).toBeTruthy()
    expect(getByPlaceholderText('Ej. Cálculo Multivariable, Física...')).toBeTruthy()
  })

  test('maneja lista de materias vacia defensivamente', async () => {
    const { getByText } = await render(
      <MinimalistSubjectModal
        visible={true}
        subjects={[]}
        onClose={jest.fn()}
        onSubjectsUpdated={jest.fn()}
      />
    )

    expect(getByText('Gestionar Materias')).toBeTruthy()
    expect(getByText('0 registradas')).toBeTruthy()
  })
})
