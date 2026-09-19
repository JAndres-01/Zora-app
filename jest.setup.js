jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
)

// Mock Animated timing and spring to complete synchronously in tests
jest.mock('react-native/Libraries/Animated/Animated', () => {
  const ActualAnimated = jest.requireActual('react-native/Libraries/Animated/Animated')
  return {
    ...ActualAnimated,
    timing: (value, config) => ({
      start: (callback) => {
        value.setValue(config.toValue)
        if (callback) callback({ finished: true })
      },
      stop: () => {},
    }),
    spring: (value, config) => ({
      start: (callback) => {
        value.setValue(config.toValue)
        if (callback) callback({ finished: true })
      },
      stop: () => {},
    }),
    sequence: (animations) => ({
      start: (callback) => {
        animations.forEach((anim) => anim.start())
        if (callback) callback({ finished: true })
      },
      stop: () => {},
    }),
    stagger: (time, animations) => ({
      start: (callback) => {
        animations.forEach((anim) => anim.start())
        if (callback) callback({ finished: true })
      },
      stop: () => {},
    }),
    delay: (time) => ({
      start: (callback) => {
        if (callback) callback({ finished: true })
      },
      stop: () => {},
    }),
    parallel: (animations) => ({
      start: (callback) => {
        animations.forEach((anim) => anim.start())
        if (callback) callback({ finished: true })
      },
      stop: () => {},
    }),
    loop: (animation) => ({
      start: (callback) => {},
      stop: () => {},
    }),
  }
})

// Mock Haptics
jest.mock('expo-haptics', () => ({
  selectionAsync: jest.fn(),
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
  NotificationFeedbackType: { Success: 'success', Warning: 'warning', Error: 'error' },
}))

// Mock BlurView
jest.mock('expo-blur', () => {
  const { View } = require('react-native')
  return {
    BlurView: View,
  }
})

// Mock Expo Router
const mockRouter = {
  push: jest.fn(),
  replace: jest.fn(),
  back: jest.fn(),
  navigate: jest.fn(),
}
const MockScreen = ({ children, options }) => {
  const { View, Text } = require('react-native')
  return (
    <View testID="mock-stack-screen">
      {options?.title ? <Text>{options.title}</Text> : null}
      {typeof options?.headerRight === 'function' ? options.headerRight() : null}
      {children || null}
    </View>
  )
}
const MockStack = Object.assign(({ children }) => children || null, {
  Screen: MockScreen,
})

jest.mock('expo-router', () => ({
  router: mockRouter,
  useRouter: () => mockRouter,
  useLocalSearchParams: () => ({}),
  useFocusEffect: (cb) => {
    const { useEffect } = require('react')
    useEffect(cb, [])
  },
  Redirect: jest.fn(({ href }) => null),
  Stack: MockStack,
}))

// Mock Expo Notifications
jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  setNotificationChannelAsync: jest.fn().mockResolvedValue(undefined),
  getPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  requestPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  scheduleNotificationAsync: jest.fn().mockResolvedValue('notif-id-123'),
  cancelScheduledNotificationAsync: jest.fn().mockResolvedValue(undefined),
  cancelAllScheduledNotificationsAsync: jest.fn().mockResolvedValue(undefined),
  getAllScheduledNotificationsAsync: jest.fn().mockResolvedValue([]),
  AndroidImportance: { MAX: 5 },
  SchedulableTriggerInputTypes: {
    CALENDAR: 'calendar',
    TIME_INTERVAL: 'timeInterval',
  },
}))

// Mock Expo DocumentPicker & ImagePicker
jest.mock('expo-document-picker', () => ({
  getDocumentAsync: jest.fn().mockResolvedValue({ canceled: true }),
}))

jest.mock('expo-image-picker', () => ({
  launchImageLibraryAsync: jest.fn().mockResolvedValue({ canceled: true }),
  launchCameraAsync: jest.fn().mockResolvedValue({ canceled: true }),
  requestMediaLibraryPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  requestCameraPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
}))

jest.mock('expo-sharing', () => ({
  isAvailableAsync: jest.fn().mockResolvedValue(true),
  shareAsync: jest.fn().mockResolvedValue(true),
}))


jest.mock('expo-file-system/legacy', () => ({
  documentDirectory: 'file:///mock/documents/',
  copyAsync: jest.fn().mockResolvedValue(undefined),
  readAsStringAsync: jest.fn().mockResolvedValue('mock-content'),
  writeAsStringAsync: jest.fn().mockResolvedValue(undefined),
  deleteAsync: jest.fn().mockResolvedValue(undefined),
  getInfoAsync: jest.fn().mockResolvedValue({ exists: true }),
  makeDirectoryAsync: jest.fn().mockResolvedValue(undefined),
  EncodingType: {
    UTF8: 'utf8',
    Base64: 'base64',
  },
}))

// Mock Safe Area Insets
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 44, bottom: 34, left: 0, right: 0 }),
  SafeAreaProvider: ({ children }) => children,
}))

// Mock WebView
jest.mock('react-native-webview', () => {
  const { View } = require('react-native')
  return { WebView: View }
})

// Mock InteractionManager
jest.mock('react-native/Libraries/Interaction/InteractionManager', () => ({
  runAfterInteractions: (cb) => {
    if (cb) cb()
    return { cancel: () => {} }
  },
  createInteractionHandle: () => 1,
  clearInteractionHandle: () => {},
  setDeadline: () => {},
}))

// Mock Expo Share Intent
jest.mock('expo-share-intent', () => ({
  useShareIntent: jest.fn(() => ({
    hasShareIntent: false,
    shareIntent: { files: null, text: null, webUrl: null, type: null },
    resetShareIntent: jest.fn(),
    isReady: true,
    error: null,
  })),
}))

// Mock expo-audio
jest.mock('expo-audio', () => {
  const mockPlayer = {
    play: jest.fn(),
    pause: jest.fn(),
    remove: jest.fn(),
    seekTo: jest.fn().mockResolvedValue(undefined),
    volume: 1,
    currentTime: 0,
    isLoaded: true,
  }
  return {
    createAudioPlayer: jest.fn(() => mockPlayer),
    useAudioPlayer: jest.fn(() => mockPlayer),
    setIsAudioActiveAsync: jest.fn().mockResolvedValue(undefined),
    setAudioModeAsync: jest.fn().mockResolvedValue(undefined),
    AudioModule: {
      setAudioModeAsync: jest.fn().mockResolvedValue(undefined),
      setIsAudioActiveAsync: jest.fn().mockResolvedValue(undefined),
    },
  }
})

// Mock context menus nativos (iOS UIMenu / Android PopupMenu)
jest.mock('@react-native-menu/menu', () => {
  const React = require('react')
  const { View } = require('react-native')
  return {
    MenuView: ({ children, actions, onPressAction, title, ...rest }) =>
      React.createElement(View, rest, children),
  }
})

// Mock de @expo/ui (SwiftUI/Compose) — renderiza como Views para que los
// componentes universales (Host/Button/Icon) sean probables en Jest.
// Los modifiers swift-ui se simulan como configs planas {type, ...}.
jest.mock('@expo/ui', () => {
  const React = require('react')
  const { View, Text } = require('react-native')
  const Host = ({ children, ...rest }) => React.createElement(View, rest, children)
  const findModifier = (modifiers, type) =>
    (modifiers || []).find((m) => m && m.type === type)
  const Button = ({ children, label, testID, modifiers, ...rest }) => {
    const acc = findModifier(modifiers, 'accessibilityLabel')
    return React.createElement(
      View,
      { testID, accessibilityLabel: acc ? acc.label : undefined, ...rest },
      children != null ? children : label != null ? React.createElement(Text, null, label) : null
    )
  }
  const Icon = (props) => React.createElement(View, props)
  return { Host, Button, Icon }
})

jest.mock('@expo/ui/swift-ui/modifiers', () => {
  const mod = (type, params = {}) => ({ type, ...params })
  return {
    buttonStyle: (style) => mod('buttonStyle', { style }),
    buttonBorderShape: (shape, cornerRadius) => mod('buttonBorderShape', { shape, cornerRadius }),
    frame: (params) => mod('frame', params),
    padding: (params) => mod('padding', params),
    accessibilityLabel: (label) => mod('accessibilityLabel', { label }),
  }
})

