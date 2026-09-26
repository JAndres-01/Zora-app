// index.js - Zora Root Entry Point with Global Fatal Interceptor
// This executes before any route or expo-router module is loaded.

if (typeof global !== 'undefined') {
  // 1. Intercept Global JavaScript Errors via React Native ErrorUtils
  const originalHandler = global.ErrorUtils?.getGlobalHandler?.();
  if (global.ErrorUtils?.setGlobalHandler) {
    global.ErrorUtils.setGlobalHandler((error, isFatal) => {
      const message = error?.message || (typeof error === 'string' ? error : 'Error desconocido en JavaScript');
      console.warn('[Zora GlobalErrorHandler Intercepted]:', message);
      if (error?.stack) {
        console.warn('[Zora GlobalErrorHandler Stack]:', error.stack);
      }
      // Force isFatal to false so NativeExceptionsManager NEVER calls reportFatal -> RCTFatal -> SIGABRT!
      if (typeof originalHandler === 'function') {
        try {
          originalHandler(error, false);
        } catch (e) {
          console.error('[Zora GlobalErrorHandler Fallback]:', e);
        }
      }
    });
    console.log('[Zora Entry] Global ErrorUtils fatal interceptor active');
  }

  // 2. Intercept unhandled promise rejections
  if (typeof global.onunhandledrejection === 'undefined') {
    global.onunhandledrejection = (event) => {
      console.warn('[Zora UnhandledPromiseRejection]:', event?.reason || event);
    };
  }
}

// 3. Load standard Expo Router entry point
import 'expo-router/entry';
