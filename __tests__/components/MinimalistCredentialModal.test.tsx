import React from 'react'
import { render, fireEvent, act } from '@testing-library/react-native'
import { Alert } from 'react-native'
import * as Sharing from 'expo-sharing'
import { MinimalistCredentialModal } from '@/components/profile/MinimalistCredentialModal'

describe('MinimalistCredentialModal Component', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.spyOn(Alert, 'alert')
  })

  test('renderiza correctamente cuando visible es true con PDF', async () => {
    const onCloseMock = jest.fn()
    const { getByText, getByLabelText, getByTestId } = await render(
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

    expect(getByText('Credencial Digital')).toBeTruthy()
    expect(getByText('PDF')).toBeTruthy()
    expect(getByLabelText('Cerrar')).toBeTruthy()
    expect(getByLabelText('Opciones de credencial')).toBeTruthy()
    expect(getByTestId('credential-options-menu')).toBeTruthy()
  })

  test('renderiza credencial en formato imagen con etiqueta IMG', async () => {
    const { getByText, getByLabelText, getByTestId } = await render(
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

    expect(getByText('Credencial Digital')).toBeTruthy()
    expect(getByText('IMG')).toBeTruthy()
    expect(getByLabelText('Cerrar')).toBeTruthy()
    expect(getByLabelText('Opciones de credencial')).toBeTruthy()
    expect(getByTestId('credential-options-menu')).toBeTruthy()
  })

  test('muestra estado vacío cuando no hay credencial', async () => {
    const { getByText } = await render(
      <MinimalistCredentialModal
        visible={true}
        credentialUrl={null}
        onClose={jest.fn()}
        onChangeCredential={jest.fn()}
        onDeleteCredential={jest.fn()}
      />
    )

    expect(getByText('Sin credencial seleccionada')).toBeTruthy()
  })

  test('permite presionar el botón Cerrar', async () => {
    const onCloseMock = jest.fn()
    const { getByLabelText } = await render(
      <MinimalistCredentialModal
        visible={true}
        credentialUrl="file:///data/user/0/credentials/credencial.pdf"
        studentName="José Andrés"
        onClose={onCloseMock}
        onChangeCredential={jest.fn()}
        onDeleteCredential={jest.fn()}
      />
    )

    const closeBtn = getByLabelText('Cerrar')
    expect(closeBtn).toBeTruthy()
    fireEvent.press(closeBtn)
  })

  test('ejecuta acción de compartir cuando se selecciona en el menú', async () => {
    jest.spyOn(Sharing, 'isAvailableAsync').mockResolvedValue(true)
    jest.spyOn(Sharing, 'shareAsync').mockResolvedValue(undefined as any)

    const { getByTestId } = await render(
      <MinimalistCredentialModal
        visible={true}
        credentialUrl="file:///data/user/0/credentials/credencial.pdf"
        studentName="José Andrés"
        onClose={jest.fn()}
        onChangeCredential={jest.fn()}
        onDeleteCredential={jest.fn()}
      />
    )

    const menu = getByTestId('credential-options-menu')
    expect(menu).toBeTruthy()
    await act(async () => {
      menu.props.onPressAction({ nativeEvent: { event: 'share' } })
    })
    expect(Sharing.shareAsync).toHaveBeenCalledWith(
      expect.stringContaining('credentials/credencial.pdf'),
      expect.objectContaining({
        dialogTitle: 'Credencial Digital - José Andrés',
        mimeType: 'application/pdf',
      })
    )
  })

  test('ejecuta acción de cambiar credencial desde el menú', async () => {
    const onChangeMock = jest.fn()
    const { getByTestId } = await render(
      <MinimalistCredentialModal
        visible={true}
        credentialUrl="file:///data/user/0/credentials/credencial.pdf"
        studentName="José Andrés"
        onClose={jest.fn()}
        onChangeCredential={onChangeMock}
        onDeleteCredential={jest.fn()}
      />
    )

    const menu = getByTestId('credential-options-menu')
    expect(menu).toBeTruthy()
    await act(async () => {
      menu.props.onPressAction({ nativeEvent: { event: 'change' } })
    })
    expect(onChangeMock).toHaveBeenCalled()
  })

  test('ejecuta acción de eliminar credencial con confirmación en Alert', async () => {
    const onDeleteMock = jest.fn()
    const { getByTestId } = await render(
      <MinimalistCredentialModal
        visible={true}
        credentialUrl="file:///data/user/0/credentials/credencial.pdf"
        studentName="José Andrés"
        onClose={jest.fn()}
        onChangeCredential={jest.fn()}
        onDeleteCredential={onDeleteMock}
      />
    )

    const menu = getByTestId('credential-options-menu')
    expect(menu).toBeTruthy()
    await act(async () => {
      menu.props.onPressAction({ nativeEvent: { event: 'delete' } })
    })
    expect(Alert.alert).toHaveBeenCalledWith(
      'Eliminar Credencial',
      expect.any(String),
      expect.any(Array)
    )

    const alertButtons = (Alert.alert as jest.Mock).mock.calls[0][2]
    const deleteAction = alertButtons.find((btn: any) => btn.text === 'Eliminar')
    await act(async () => {
      deleteAction.onPress()
    })
    expect(onDeleteMock).toHaveBeenCalled()
  })
})
