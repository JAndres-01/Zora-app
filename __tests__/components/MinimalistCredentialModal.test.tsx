import React from 'react'
import { render, fireEvent, waitFor } from '@testing-library/react-native'
import { MinimalistCredentialModal } from '@/components/profile/MinimalistCredentialModal'
import * as Sharing from 'expo-sharing'

describe('MinimalistCredentialModal Component', () => {
  test('renderiza correctamente cuando visible es true con PDF', async () => {
    const onCloseMock = jest.fn()
    const { getByText } = await render(
      <MinimalistCredentialModal
        visible={true}
        credentialUrl="file:///data/user/0/credentials/credencial.pdf"
        credentialName="Credencial_Estudiante.pdf"
        studentName="José Andrés"
        onClose={onCloseMock}
        onChangeCredential={jest.fn()}
        onDeleteCredential={jest.fn()}
      />
    )

    await waitFor(() => {
      expect(getByText('Credencial Digital')).toBeTruthy()
      expect(getByText(/José Andrés/i)).toBeTruthy()
      expect(getByText('PDF')).toBeTruthy()
      expect(getByText('Cambiar PDF')).toBeTruthy()
      expect(getByText('Compartir')).toBeTruthy()
    })
  })

  test('renderiza credencial en formato imagen con etiqueta IMG', async () => {
    const { getByText } = await render(
      <MinimalistCredentialModal
        visible={true}
        credentialUrl="file:///data/user/0/credentials/foto_credencial.jpg"
        credentialName="foto_credencial.jpg"
        studentName="José Andrés"
        onClose={jest.fn()}
        onChangeCredential={jest.fn()}
        onDeleteCredential={jest.fn()}
      />
    )

    await waitFor(() => {
      expect(getByText('Credencial Digital')).toBeTruthy()
      expect(getByText('IMG')).toBeTruthy()
    })
  })

  test('al pulsar compartir ejecuta Sharing.shareAsync', async () => {
    const { getByText } = await render(
      <MinimalistCredentialModal
        visible={true}
        credentialUrl="file:///data/user/0/credentials/credencial.pdf"
        credentialName="Credencial.pdf"
        studentName="José Andrés"
        onClose={jest.fn()}
        onChangeCredential={jest.fn()}
        onDeleteCredential={jest.fn()}
      />
    )

    const shareBtn = getByText('Compartir')
    fireEvent.press(shareBtn)
    await waitFor(() => {
      expect(Sharing.shareAsync).toHaveBeenCalled()
    })
  })
})
