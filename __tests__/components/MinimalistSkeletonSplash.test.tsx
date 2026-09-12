import React from 'react'
import { render } from '@testing-library/react-native'
import { MinimalistSkeletonSplash } from '@/components/common/MinimalistSkeletonSplash'

describe('MinimalistSkeletonSplash', () => {
  test('renderiza la estructura de carga skeleton con testID y elementos clave', async () => {
    const { getByTestId } = await render(<MinimalistSkeletonSplash />)
    const skeleton = getByTestId('skeleton-loading-screen')
    expect(skeleton).toBeTruthy()
  })
})
