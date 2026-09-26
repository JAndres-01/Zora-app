import {
  createNativeBottomTabNavigator,
  type NativeBottomTabNavigationOptions,
  type NativeBottomTabNavigationEventMap,
} from '@react-navigation/bottom-tabs/unstable'
import { withLayoutContext } from 'expo-router'
import type { ParamListBase, TabNavigationState } from '@react-navigation/native'

const { Navigator } = createNativeBottomTabNavigator()

export const NativeBottomTabs = withLayoutContext<
  NativeBottomTabNavigationOptions,
  typeof Navigator,
  TabNavigationState<ParamListBase>,
  NativeBottomTabNavigationEventMap
>(Navigator)
