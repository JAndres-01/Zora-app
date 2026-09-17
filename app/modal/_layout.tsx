import { Stack } from 'expo-router'
import { Platform } from 'react-native'

export default function ModalLayout() {
  return (
    <Stack
      screenOptions={{
        presentation: 'formSheet',
        sheetAllowedDetents: [0.6, 0.95],
        sheetGrabberVisible: true,
        sheetInitialDetentIndex: 0,
        sheetCornerRadius: 28,
        contentStyle: { backgroundColor: '#1C1C1E' },
        headerStyle: { backgroundColor: '#1C1C1E' },
        headerShadowVisible: false,
        headerTintColor: '#FFFFFF',
        headerTitleStyle: { color: '#FFFFFF', fontWeight: '700' },
        headerShown: false,
        animation: Platform.OS === 'ios' ? 'default' : 'slide_from_bottom',
      }}
    />
  )
}
