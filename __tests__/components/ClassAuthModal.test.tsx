import React from 'react'
import { render } from '@testing-library/react-native'
import { ClassAuthModal } from '@/components/auth/ClassAuthModal'
import { PersonalAuthProvider } from '@/context/PersonalAuthContext'
import { ClassAuthProvider } from '@/context/ClassAuthContext'

describe('ClassAuthModal Component', () => {
  test('renderiza correctamente el modal de Feed de Clase sin errores', async () => {
    const { getByText } = await render(
      <PersonalAuthProvider>
        <ClassAuthProvider>
          <ClassAuthModal visible={true} onClose={jest.fn()} />
        </ClassAuthProvider>
      </PersonalAuthProvider>
    )

    expect(getByText('Feed de Clase')).toBeTruthy()
    expect(getByText('Entrar')).toBeTruthy()
    expect(getByText('Unirme')).toBeTruthy()
  })
})
