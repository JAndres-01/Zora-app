const fs = require('fs')
const path = require('path')

const jsiPackagePath = path.join(process.cwd(), 'node_modules', 'expo-modules-jsi', 'apple', 'Package.swift')
if (fs.existsSync(jsiPackagePath)) {
  const content = `// swift-tools-version: 6.0
// The swift-tools-version declares the minimum version of Swift required to build this package.

import Foundation
import PackageDescription

let packageDir = URL(fileURLWithPath: #filePath).deletingLastPathComponent().path
let podsRoot = resolvePodsRoot()

let publicHeaders = "\\(podsRoot)/Headers/Public"
let reactNative =
  ProcessInfo.processInfo.environment["RN_ROOT"]
  ?? ProcessInfo.processInfo.environment["REACT_NATIVE_PATH"]
  ?? "\\(podsRoot)/../../node_modules/react-native"
let headerSearchPaths = [
  publicHeaders,
  "\\(publicHeaders)/React-jsi",
  "\\(publicHeaders)/hermes-engine",
  "\\(publicHeaders)/React-runtimescheduler",
  "\\(publicHeaders)/React-rendererconsistency",
  "\\(publicHeaders)/React-performancetimeline",
  "\\(publicHeaders)/React-timing",
  "\\(publicHeaders)/React-debug",
  "\\(publicHeaders)/React-callinvoker",
  "\\(publicHeaders)/React-runtimeexecutor",
  "\\(publicHeaders)/RCT-Folly",
  "\\(publicHeaders)/ReactNativeDependencies",
  "\\(publicHeaders)/glog",
  "\\(publicHeaders)/DoubleConversion",
  "\\(publicHeaders)/fmt",
  "\\(publicHeaders)/fast_float",
  "\\(reactNative)/ReactCommon",
  "\\(reactNative)/ReactCommon/jsi",
  "\\(reactNative)/ReactCommon/runtimeexecutor",
  "\\(reactNative)/ReactCommon/callinvoker",
  "\\(podsRoot)/RCT-Folly",
  "\\(podsRoot)/fmt/include",
  "\\(podsRoot)/glog/src",
  "\\(podsRoot)/DoubleConversion"
]

let generatedModuleMap = "\\(packageDir)/.generated/module.modulemap"
let apiNotesPath = "\\(packageDir)/APINotes"

let cxxIncludeFlags = headerSearchPaths.map({ "-I\\($0)" })
let swiftIncludeFlags = headerSearchPaths.flatMap({ ["-Xcc", "-I\\($0)"] })

let testFrameworks = resolveTestFrameworks()

let package = Package(
  name: "ExpoModulesJSI",
  platforms: [
    .iOS("16.4"),
    .tvOS("16.4"),
    .macOS("13.4")
  ],
  products: [
    .library(
      name: "ExpoModulesJSI",
      type: .dynamic,
      targets: ["ExpoModulesJSI"]
    )
  ],
  dependencies: [],
  targets: [
    // Swift target (public)
    .target(
      name: "ExpoModulesJSI",
      dependencies: [
        "ExpoModulesJSI-Cxx"
      ],
      swiftSettings: [
        .interoperabilityMode(.Cxx),

        // Enable some upcoming features that improve ergonomics and reduce executor hoppings
        .enableUpcomingFeature("NonisolatedNonsendingByDefault"),
        .enableUpcomingFeature("InferIsolatedConformances"),

        .unsafeFlags([
          "-enable-library-evolution",
          "-emit-module-interface",
          "-no-verify-emitted-module-interface",
          "-Xfrontend",
          "-clang-header-expose-decls=has-expose-attr",

          "-Xcc", "-fmodule-map-file=\\(generatedModuleMap)",
          "-Xcc", "-iapinotes-modules",
          "-Xcc", apiNotesPath
        ]),

        .unsafeFlags(swiftIncludeFlags)
      ],
      linkerSettings: [
        .unsafeFlags([
          "-Xlinker", "-undefined", "-Xlinker", "dynamic_lookup"
        ])
      ]
    ),

    // C++ target (internal)
    .target(
      name: "ExpoModulesJSI-Cxx",
      dependencies: [],
      cxxSettings: [
        .headerSearchPath("include/Public"),
        .unsafeFlags(cxxIncludeFlags)
      ]
    ),

    // Tests
    .testTarget(
      name: "Tests",
      dependencies: testFrameworks.dependencies,
      path: "Tests"
    ),

    // Benchmarks
    .testTarget(
      name: "Benchmarks",
      dependencies: testFrameworks.dependencies,
      path: "Benchmarks"
    )
  ] + testFrameworks.binaryTargets,
  swiftLanguageModes: [.v6],
  cxxLanguageStandard: .cxx20
)

func resolvePodsRoot() -> String {
  let env = ProcessInfo.processInfo.environment
  if let explicit = env["PODS_ROOT"] {
    return explicit
  }
  let repoRoot =
    env["EXPO_ROOT_DIR"]
    ?? URL(fileURLWithPath: packageDir)
    .deletingLastPathComponent()
    .deletingLastPathComponent()
    .deletingLastPathComponent()
    .path
  return "\\(repoRoot)/apps/bare-expo/ios/Pods"
}

func resolveTestFrameworks() -> (binaryTargets: [Target], dependencies: [Target.Dependency]) {
  let names = ["React", "hermesvm", "ReactNativeDependencies"]
  let available = names.filter({
    FileManager.default.fileExists(atPath: "\\(packageDir)/.test-frameworks/\\($0).xcframework")
  })
  let binaryTargets: [Target] = available.map({
    .binaryTarget(name: $0, path: ".test-frameworks/\\($0).xcframework")
  })
  let dependencies: [Target.Dependency] =
    ["ExpoModulesJSI"]
    + available.map({ .target(name: $0) })
  return (binaryTargets, dependencies)
}
`
  fs.writeFileSync(jsiPackagePath, content, 'utf8')
  console.log('[patch-swift-packages] Successfully wrote Swift 6.0 ExpoModulesJSI Package.swift')
}

const macrosPackagePath = path.join(process.cwd(), 'node_modules', '@expo', 'expo-modules-macros-plugin', 'apple', 'Package.swift')
if (fs.existsSync(macrosPackagePath)) {
  let macrosContent = fs.readFileSync(macrosPackagePath, 'utf8')
  macrosContent = macrosContent.replace(/swift-tools-version:\s*6\.[1-9]/g, 'swift-tools-version: 6.0')
  fs.writeFileSync(macrosPackagePath, macrosContent, 'utf8')
  console.log('[patch-swift-packages] Successfully patched expo-modules-macros-plugin Package.swift')
}

const schedulerHeader = path.join(process.cwd(), 'node_modules', 'expo-modules-jsi', 'apple', 'Sources', 'ExpoModulesJSI-Cxx', 'include', 'RuntimeScheduler.h')
if (fs.existsSync(schedulerHeader)) {
  let headerContent = fs.readFileSync(schedulerHeader, 'utf8')
  headerContent = headerContent.replace(/SWIFT_RETURNS_RETAINED\s+RuntimeScheduler/g, 'RuntimeScheduler')
  fs.writeFileSync(schedulerHeader, headerContent, 'utf8')
  console.log('[patch-swift-packages] Cleaned constructor annotations in RuntimeScheduler.h')
}

const closureHeader = path.join(process.cwd(), 'node_modules', 'expo-modules-jsi', 'apple', 'Sources', 'ExpoModulesJSI-Cxx', 'include', 'HostFunctionClosure.h')
if (fs.existsSync(closureHeader)) {
  let headerContent = fs.readFileSync(closureHeader, 'utf8')
  headerContent = headerContent.replace(
    /using Closure = void\(Context context, const facebook::jsi::Value \*\w+ thisValue, const facebook::jsi::Value \*\w+ args, size_t count, facebook::jsi::Value \*\w+ result\);/g,
    'using Closure = void (*)(Context context, const facebook::jsi::Value *_Nonnull thisValue, const facebook::jsi::Value *_Nonnull args, size_t count, facebook::jsi::Value *_Nonnull result);'
  )
  headerContent = headerContent.replace('Closure *_Nonnull _closure;', 'Closure _closure;')
  fs.writeFileSync(closureHeader, headerContent, 'utf8')
  console.log('[patch-swift-packages] Cleaned HostFunctionClosure.h for Swift 6.0 interop')
}

const buildXcframeworkScript = path.join(process.cwd(), 'node_modules', 'expo-modules-jsi', 'apple', 'scripts', 'build-xcframework.sh')
if (fs.existsSync(buildXcframeworkScript)) {
  let scriptContent = fs.readFileSync(buildXcframeworkScript, 'utf8')
  if (scriptContent.includes('-disableAutomaticPackageResolution')) {
    scriptContent = scriptContent.replace(/-disableAutomaticPackageResolution\s*\\/g, '')
    fs.writeFileSync(buildXcframeworkScript, scriptContent, 'utf8')
    console.log('[patch-swift-packages] Successfully removed -disableAutomaticPackageResolution from build-xcframework.sh')
  }
}

// Patch all Swift source files in ExpoModulesJSI for Swift 6.0
const jsiSourcesDir = path.join(process.cwd(), 'node_modules', 'expo-modules-jsi', 'apple', 'Sources', 'ExpoModulesJSI')
function patchSwiftSources(dir) {
  if (!fs.existsSync(dir)) return
  const files = fs.readdirSync(dir, { withFileTypes: true })
  for (const file of files) {
    const fullPath = path.join(dir, file.name)
    if (file.isDirectory()) {
      patchSwiftSources(fullPath)
    } else if (file.name.endsWith('.swift')) {
      let code = fs.readFileSync(fullPath, 'utf8')
      const original = code
      // 1. weak let -> weak var
      code = code.replace(/weak\s+let\s+/g, 'weak var ')
      // 2. Trailing commas before closing paren in types / calls
      code = code.replace(/consuming JavaScriptValuesBuffer,\s*\)/g, 'consuming JavaScriptValuesBuffer\n    )')
      code = code.replace(/vector\.push_back\(consuming:\s*propNameId\)/g, 'vector.push_back(propNameId)')
      // 3. Task+Immediate fallback
      if (file.name === 'Task+Immediate.swift') {
        code = `// polyfill for Swift 6.0
extension Task where Failure == any Error {
  @discardableResult
  public static func immediate_polyfill(
    name: String? = nil,
    priority: TaskPriority? = nil,
    @_inheritActorContext @_implicitSelfCapture operation: sending @escaping @isolated(any) () async throws -> Success
  ) -> Task<Success, any Error> {
    return Task(priority: priority ?? .high, operation: operation)
  }
}
`
      }
      // 4. JavaScriptError CppError extension
      if (file.name === 'JavaScriptError.swift') {
        code = code.replace('public var message: String {', 'var message: String {')
      }
      // 5. JavaScriptActor runIsolated
      if (file.name === 'JavaScriptActor.swift') {
        code = code.replace(/@JavaScriptActor\s+@usableFromInline\s+internal static func runIsolated/g, '@usableFromInline\n  internal static func runIsolated')
      }

      if (code !== original) {
        fs.writeFileSync(fullPath, code, 'utf8')
        console.log(`[patch-swift-packages] Patched Swift source: ${file.name}`)
      }
    }
  }
}
patchSwiftSources(jsiSourcesDir)





