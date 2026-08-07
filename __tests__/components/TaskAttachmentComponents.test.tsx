import React from 'react'
import { render, fireEvent, act, waitFor } from '@testing-library/react-native'
import * as ImagePicker from 'expo-image-picker'
import { TaskAttachmentMenu } from '@/components/tasks/modal/TaskAttachmentMenu'
import { TaskCameraView } from '@/components/tasks/modal/TaskCameraView'
import { TaskPhotosView } from '@/components/tasks/modal/TaskPhotosView'

describe('Task Attachment Components', () => {
  describe('TaskAttachmentMenu', () => {
    test('renders options and fires onSelectOption for camera, photos, files', async () => {
      const onSelectOption = jest.fn()
      const onClose = jest.fn()

      const { getByText } = await render(
        <TaskAttachmentMenu
          visible={true}
          onClose={onClose}
          onSelectOption={onSelectOption}
        />
      )

      expect(getByText('Cámara')).toBeTruthy()
      expect(getByText('Fotos')).toBeTruthy()
      expect(getByText('Archivos')).toBeTruthy()

      await act(async () => {
        fireEvent.press(getByText('Cámara'))
      })
      expect(onSelectOption).toHaveBeenCalledWith('camera')

      await act(async () => {
        fireEvent.press(getByText('Fotos'))
      })
      expect(onSelectOption).toHaveBeenCalledWith('photos')

      await act(async () => {
        fireEvent.press(getByText('Archivos'))
      })
      expect(onSelectOption).toHaveBeenCalledWith('files')
    })
  })

  describe('TaskCameraView', () => {
    test('renders camera controls and handles back and capture', async () => {
      const onCapture = jest.fn()
      const onBack = jest.fn()

      const { getByLabelText } = await render(
        <TaskCameraView onCapture={onCapture} onBack={onBack} />
      )

      const backButton = getByLabelText('Volver')
      expect(backButton).toBeTruthy()

      await act(async () => {
        fireEvent.press(backButton)
      })
      expect(onBack).toHaveBeenCalled()

      const shutter = getByLabelText('Tomar foto')
      expect(shutter).toBeTruthy()

      await act(async () => {
        fireEvent.press(shutter)
      })

      await waitFor(() => {
        expect(onCapture).toHaveBeenCalled()
      })

      expect(onCapture.mock.calls[0][0]).toMatchObject({
        file_type: 'image',
        file_url: expect.stringContaining('file://'),
      })
    })
  })

  describe('TaskPhotosView', () => {
    test('renders photo gallery, handles photo selection and back button', async () => {
      const onSelectPhoto = jest.fn()
      const onBack = jest.fn()

      const { getByText, getByLabelText, getByTestId } = await render(
        <TaskPhotosView onSelectPhoto={onSelectPhoto} onBack={onBack} />
      )

      expect(getByText('Fotos recientes')).toBeTruthy()

      const backButton = getByLabelText('Volver')
      expect(backButton).toBeTruthy()

      await act(async () => {
        fireEvent.press(backButton)
      })
      expect(onBack).toHaveBeenCalledTimes(1)

      // Press the first photo tile
      const firstTile = getByTestId('photo-tile-asset-1')
      expect(firstTile).toBeTruthy()

      await act(async () => {
        fireEvent.press(firstTile)
      })

      expect(onSelectPhoto).toHaveBeenCalledTimes(1)
      expect(onSelectPhoto.mock.calls[0][0]).toMatchObject({
        file_name: 'IMG_0001.JPG',
        file_url: 'file:///var/mobile/Photos/IMG_0001.JPG',
        file_type: 'image',
      })
    })

    test('opens native image library via Todas las fotos button and emits selected attachment', async () => {
      const onSelectPhoto = jest.fn()
      const onBack = jest.fn()

      jest.spyOn(ImagePicker, 'launchImageLibraryAsync').mockResolvedValueOnce({
        canceled: false,
        assets: [
          {
            uri: 'file://chosen-photo.jpg',
            fileName: 'custom-photo.jpg',
            fileSize: 54321,
            width: 800,
            height: 600,
          },
        ],
      })

      const { getByLabelText } = await render(
        <TaskPhotosView onSelectPhoto={onSelectPhoto} onBack={onBack} />
      )

      const allPhotosButton = getByLabelText('Todas las fotos')
      expect(allPhotosButton).toBeTruthy()

      await act(async () => {
        fireEvent.press(allPhotosButton)
      })

      expect(ImagePicker.launchImageLibraryAsync).toHaveBeenCalled()
      expect(onSelectPhoto).toHaveBeenCalledWith(
        expect.objectContaining({
          file_name: 'custom-photo.jpg',
          file_url: 'file://chosen-photo.jpg',
          file_type: 'image',
          size_bytes: 54321,
        })
      )
    })
  })
})




