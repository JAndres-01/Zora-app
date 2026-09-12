import React from 'react'
import { render } from '@testing-library/react-native'
import { ClassAuthModal } from '@/components/auth/ClassAuthModal'
import { PersonalAuthProvider } from '@/context/PersonalAuthContext'

const mockSignOut = jest.fn().mockResolvedValue(undefined)

jest.mock('@/context/ClassAuthContext', () => ({
  useClassAuth: () => ({
    isConnected: true,
    user: { email: 'estudiante@zora.io', user_metadata: { full_name: 'Estudiante Zora' } },
    isAdmin: false,
    signOut: mockSignOut,
  }),
}))

describe('ClassAuthModal Component', () => {
  test('renderiza correctamente el modal de Feed de Clase y botón de Cerrar Sesión', async () => {
    const { getByText, queryByText } = await render(
      <PersonalAuthProvider>
        <ClassAuthModal visible={true} onClose={jest.fn()} />
      </PersonalAuthProvider>
    )

    // Cabecera y datos del feed
    expect(getByText('Feed de Clase')).toBeTruthy()
    expect(getByText('USUARIO')).toBeTruthy()
    expect(getByText('CORREO ELECTRÓNICO')).toBeTruthy()
    expect(getByText('Cerrar Sesión')).toBeTruthy()

    // Verificación estricta: el formulario antiguo de auth está completamente eliminado
    expect(queryByText('Entrar')).toBeNull()
    expect(queryByText('Unirme')).toBeNull()
    expect(queryByText('NOMBRE COMPLETO')).toBeNull()
  })
})

