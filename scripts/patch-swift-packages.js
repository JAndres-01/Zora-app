const fs = require('fs')
const path = require('path')

// 0. expo-notifications: remove iOS 26 API (isRepeatedDay) that fails on Swift 6.1.x runners
const dateComponentsSerializerPath = path.join(process.cwd(), 'node_modules', 'expo-notifications', 'ios', 'ExpoNotifications', 'Notifications', 'DateComponentsSerializer.swift')
if (fs.existsSync(dateComponentsSerializerPath)) {
  let content = fs.readFileSync(dateComponentsSerializerPath, 'utf8')
  const orig = content
  // Remove isRepeatedDay block which uses iOS 26+ SDK not available in Swift 6.1.x
  content = content.replace(/\s*if #available\(iOS 26\.0,\s*\*\)\s*\{[^}]*\}/g, '')
  if (content !== orig) {
    fs.writeFileSync(dateComponentsSerializerPath, content, 'utf8')
    console.log('[patch-swift-packages] Removed iOS 26 isRepeatedDay block from DateComponentsSerializer.swift')
  }
}

// 1. ExpoModulesJSI Package.swift
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

// 2. expo-modules-macros-plugin Package.swift
const macrosPackagePath = path.join(process.cwd(), 'node_modules', '@expo', 'expo-modules-macros-plugin', 'apple', 'Package.swift')
if (fs.existsSync(macrosPackagePath)) {
  let macrosContent = fs.readFileSync(macrosPackagePath, 'utf8')
  macrosContent = macrosContent.replace(/swift-tools-version:\s*6\.\d+/g, 'swift-tools-version: 6.0')
  macrosContent = macrosContent.replace(/602\.0\.0(-latest)?/g, '600.0.1')
  fs.writeFileSync(macrosPackagePath, macrosContent, 'utf8')
  console.log('[patch-swift-packages] Successfully patched expo-modules-macros-plugin Package.swift')
}

// 2.5. Walk and sanitize all Package.swift manifests for Swift 6.0 compatibility
function walkPackageSwift(dir) {
  if (!fs.existsSync(dir)) return
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name !== '.git' && entry.name !== '.DerivedData' && entry.name !== '.build') {
        walkPackageSwift(full)
      }
    } else if (entry.name === 'Package.swift') {
      let content = fs.readFileSync(full, 'utf8')
      let orig = content
      content = content.replace(/swift-tools-version:\s*6\.\d+(\.\d+)?/gi, 'swift-tools-version: 6.0')
      content = content.replace(/602\.0\.0(-latest)?/gi, '600.0.1')
      let prev
      do {
        prev = content
        content = content.replace(/,(\s*[\)\]])/g, '$1')
      } while (content !== prev)
      if (content !== orig) {
        fs.writeFileSync(full, content, 'utf8')
        console.log(`[patch-swift-packages] Sanitized Package.swift: ${full}`)
      }
    }
  }
}
walkPackageSwift(path.join(process.cwd(), 'node_modules'))
walkPackageSwift(path.join(process.cwd(), 'ios'))

// 3. RuntimeScheduler.h
const schedulerHeader = path.join(process.cwd(), 'node_modules', 'expo-modules-jsi', 'apple', 'Sources', 'ExpoModulesJSI-Cxx', 'include', 'RuntimeScheduler.h')
if (fs.existsSync(schedulerHeader)) {
  let headerContent = fs.readFileSync(schedulerHeader, 'utf8')
  
  // Define SWIFT_RETURNS_RETAINED attribute if not present
  if (!headerContent.includes('#define SWIFT_RETURNS_RETAINED')) {
    headerContent = headerContent.replace(
      '#include <swift/bridging>',
      '#include <swift/bridging>\n\n#ifndef SWIFT_RETURNS_RETAINED\n#define SWIFT_RETURNS_RETAINED __attribute__((swift_attr("returns_retained")))\n#endif'
    )
  } else {
    headerContent = headerContent.replace(
      /#define SWIFT_RETURNS_RETAINED\s*$/m,
      '#define SWIFT_RETURNS_RETAINED __attribute__((swift_attr("returns_retained")))'
    )
  }

  // Remove SWIFT_RETURNS_RETAINED from constructor declarations
  headerContent = headerContent.replace(/SWIFT_RETURNS_RETAINED\s+RuntimeScheduler/g, 'RuntimeScheduler')

  // Add static factory methods if not already added
  if (!headerContent.includes('RuntimeScheduler *_Nonnull create(')) {
    const factoryMethods = `
  static inline RuntimeScheduler *_Nonnull create(void *scheduler, ScheduleFn fn) noexcept SWIFT_RETURNS_RETAINED {
    return new RuntimeScheduler(scheduler, fn);
  }

  static inline RuntimeScheduler *_Nonnull create() noexcept SWIFT_RETURNS_RETAINED {
    return new RuntimeScheduler();
  }
`
    headerContent = headerContent.replace('RuntimeScheduler(void *scheduler, ScheduleFn fn)', factoryMethods + '\n  RuntimeScheduler(void *scheduler, ScheduleFn fn)')
  }

  fs.writeFileSync(schedulerHeader, headerContent, 'utf8')
  console.log('[patch-swift-packages] Successfully patched RuntimeScheduler.h with factory methods')
}

// 4. HostFunctionClosure.h
const closureHeader = path.join(process.cwd(), 'node_modules', 'expo-modules-jsi', 'apple', 'Sources', 'ExpoModulesJSI-Cxx', 'include', 'HostFunctionClosure.h')
if (fs.existsSync(closureHeader)) {
  let headerContent = fs.readFileSync(closureHeader, 'utf8')

  // Remove any previous SWIFT_RETURNS_RETAINED on create
  headerContent = headerContent.replace(/\s*SWIFT_RETURNS_RETAINED\s*\{/g, ' {')

  if (!headerContent.includes('HostFunctionClosure *_Nonnull create(')) {
    const factoryMethod = `
  static inline HostFunctionClosure *_Nonnull create(Context context, Closure closure, Deallocator deallocator) noexcept {
    return new HostFunctionClosure(context, closure, deallocator);
  }
`
    headerContent = headerContent.replace('virtual ~HostFunctionClosure()', factoryMethod + '\n  virtual ~HostFunctionClosure()')
  }

  fs.writeFileSync(closureHeader, headerContent, 'utf8')
  console.log('[patch-swift-packages] Successfully patched HostFunctionClosure.h with factory method')
}

// 5. HostObjectCallbacks.h
const hostObjectCallbacksHeader = path.join(process.cwd(), 'node_modules', 'expo-modules-jsi', 'apple', 'Sources', 'ExpoModulesJSI-Cxx', 'include', 'HostObjectCallbacks.h')
if (fs.existsSync(hostObjectCallbacksHeader)) {
  let headerContent = fs.readFileSync(hostObjectCallbacksHeader, 'utf8')
  if (!headerContent.includes('addPropNameId(')) {
    const helperMethod = `
  static inline void addPropNameId(PropNameIds &vector, facebook::jsi::IRuntime &rt, const char *_Nonnull name) {
    vector.push_back(facebook::jsi::PropNameID::forUtf8(rt, name));
  }
`
    headerContent = headerContent.replace('using PropNameIds = std::vector<facebook::jsi::PropNameID>;', 'using PropNameIds = std::vector<facebook::jsi::PropNameID>;\n' + helperMethod)
    fs.writeFileSync(hostObjectCallbacksHeader, headerContent, 'utf8')
    console.log('[patch-swift-packages] Successfully added addPropNameId to HostObjectCallbacks.h')
  }
}

// 5.5. Clean and patch .swiftinterface files in Pods and node_modules
function cleanAndPatchSwiftinterfaces(dir) {
  if (!fs.existsSync(dir)) return
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      cleanAndPatchSwiftinterfaces(fullPath)
    } else if (entry.name.endsWith('.private.swiftinterface') || entry.name.endsWith('.package.swiftinterface')) {
      try {
        fs.unlinkSync(fullPath)
        console.log(`[patch-swift-packages] Deleted private/package interface: ${entry.name}`)
      } catch (e) {}
    } else if (entry.name.endsWith('.swiftinterface')) {
      let content = fs.readFileSync(fullPath, 'utf8')
      const orig = content
      // Remove actor attribute from protocol conformances (e.g. extension UIKit.UIView : @_Concurrency.MainActor AnyArgument)
      content = content.replace(/:\s*@_Concurrency\.MainActor\s+/g, ': ')
      content = content.replace(/:\s*@MainActor\s+/g, ': ')
      if (content !== orig) {
        fs.writeFileSync(fullPath, content, 'utf8')
        console.log(`[patch-swift-packages] Patched swiftinterface: ${entry.name}`)
      }
    }
  }
}

// 5.6. Patch replace-xcframework.js to sanitize swiftinterfaces automatically whenever XCFrameworks are extracted
const replaceXcframeworkPath = path.join(process.cwd(), 'node_modules', 'expo-modules-autolinking', 'scripts', 'ios', 'replace-xcframework.js')
if (fs.existsSync(replaceXcframeworkPath)) {
  let rContent = fs.readFileSync(replaceXcframeworkPath, 'utf8')
  if (!rContent.includes('function patchSwiftinterfacesInDir(')) {
    const helperFunc = `
function patchSwiftinterfacesInDir(dir) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      patchSwiftinterfacesInDir(fullPath);
    } else if (entry.name.endsWith('.private.swiftinterface') || entry.name.endsWith('.package.swiftinterface')) {
      try {
        fs.unlinkSync(fullPath);
        console.log(\`\${LOG_PREFIX} Deleted private interface: \${entry.name}\`);
      } catch (e) {}
    } else if (entry.name.endsWith('.swiftinterface')) {
      let c = fs.readFileSync(fullPath, 'utf8');
      const o = c;
      c = c.replace(/:\\s*@_Concurrency\\.MainActor\\s+/g, ': ');
      c = c.replace(/:\\s*@MainActor\\s+/g, ': ');
      if (c !== o) {
        fs.writeFileSync(fullPath, c, 'utf8');
        console.log(\`\${LOG_PREFIX} Patched swiftinterface: \${entry.name}\`);
      }
    }
  }
}
`
    rContent = rContent.replace("const LOG_PREFIX = '[Expo XCFramework]';", "const LOG_PREFIX = '[Expo XCFramework]';\n" + helperFunc)
    rContent = rContent.replace("fs.writeFileSync(lastConfigFile, configLower);", "fs.writeFileSync(lastConfigFile, configLower);\n  patchSwiftinterfacesInDir(xcframeworksDir);")
    rContent = rContent.replace("if (lastConfig === configLower) {", "if (lastConfig === configLower) {\n    patchSwiftinterfacesInDir(xcframeworksDir);")
    fs.writeFileSync(replaceXcframeworkPath, rContent, 'utf8')
    console.log('[patch-swift-packages] Successfully patched replace-xcframework.js with auto swiftinterface sanitization')
  }
}

// 5.7. Patch prebuilt xcframework tarballs in node_modules and ios/Pods
function patchTarball(tarballPath) {
  const tmpDir = path.join(process.cwd(), 'tmp_tar_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6))
  try {
    fs.mkdirSync(tmpDir, { recursive: true })
    const { execSync } = require('child_process')
    execSync(`tar -xzf "${tarballPath}" -C "${tmpDir}"`)
    let patchedAny = false
    function walk(dir) {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name)
        if (entry.isDirectory()) {
          walk(full)
        } else if (entry.name.endsWith('.private.swiftinterface') || entry.name.endsWith('.package.swiftinterface')) {
          try {
            fs.unlinkSync(full)
            patchedAny = true
          } catch (e) {}
        } else if (entry.name.endsWith('.swiftinterface')) {
          let c = fs.readFileSync(full, 'utf8')
          const orig = c
          c = c.replace(/:\s*@_Concurrency\.MainActor\s+/g, ': ')
          c = c.replace(/:\s*@MainActor\s+/g, ': ')
          if (c !== orig) {
            fs.writeFileSync(full, c, 'utf8')
            patchedAny = true
          }
        }
      }
    }
    walk(tmpDir)
    if (patchedAny) {
      const topItems = fs.readdirSync(tmpDir).join(' ')
      execSync(`tar -czf "${tarballPath}" -C "${tmpDir}" ${topItems}`)
      console.log(`[patch-swift-packages] Patched and repacked tarball: ${path.basename(tarballPath)}`)
    }
  } catch (e) {
    console.warn(`[patch-swift-packages] Warning: Could not patch tarball ${tarballPath}: ${e.message}`)
  } finally {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true })
    } catch (e) {}
  }
}

function findAndPatchTarballs(dir) {
  if (!fs.existsSync(dir)) return
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name !== '.git' && entry.name !== '.expo') {
        findAndPatchTarballs(fullPath)
      }
    } else if (entry.name.endsWith('.tar.gz')) {
      patchTarball(fullPath)
    }
  }
}

findAndPatchTarballs(path.join(process.cwd(), 'node_modules', 'expo-modules-core'))
findAndPatchTarballs(path.join(process.cwd(), 'node_modules', 'expo-file-system'))
findAndPatchTarballs(path.join(process.cwd(), 'node_modules', 'expo-font'))
findAndPatchTarballs(path.join(process.cwd(), 'ios', 'Pods'))
cleanAndPatchSwiftinterfaces(path.join(process.cwd(), 'ios', 'Pods'))
cleanAndPatchSwiftinterfaces(path.join(process.cwd(), 'node_modules', 'expo-modules-core'))


// 5.8. Patch JSIUtils.h to ensure count == 0 always passes nullptr to Hermes
const jsiUtilsPaths = [
  path.join(process.cwd(), 'node_modules', 'expo-modules-jsi', 'apple', 'Sources', 'ExpoModulesJSI-Cxx', 'include', 'JSIUtils.h'),
  path.join(process.cwd(), 'node_modules', 'expo-modules-core', 'node_modules', 'expo-modules-jsi', 'apple', 'Sources', 'ExpoModulesJSI-Cxx', 'include', 'JSIUtils.h'),
  path.join(process.cwd(), 'node_modules', 'expo-modules-core', 'common', 'cpp', 'JSI', 'JSIUtils.h'),
]
for (const p of jsiUtilsPaths) {
  if (fs.existsSync(p)) {
    let content = fs.readFileSync(p, 'utf8')
    content = content.replace(
      /return function\.call\(runtime,\s*args,\s*count\);/g,
      'return function.call(runtime, count == 0 ? nullptr : args, count);'
    )
    content = content.replace(
      /return function\.callWithThis\(runtime,\s*jsThis,\s*args,\s*count\);/g,
      'return function.callWithThis(runtime, jsThis, count == 0 ? nullptr : args, count);'
    )
    content = content.replace(
      /return function\.callAsConstructor\(runtime,\s*args,\s*count\);/g,
      'return function.callAsConstructor(runtime, count == 0 ? nullptr : args, count);'
    )
    fs.writeFileSync(p, content, 'utf8')
    console.log(`[patch-swift-packages] Successfully patched JSIUtils.h at: ${p}`)
  }
}

// 6. build-xcframework.sh
const buildXcframeworkScript = path.join(process.cwd(), 'node_modules', 'expo-modules-jsi', 'apple', 'scripts', 'build-xcframework.sh')
if (fs.existsSync(buildXcframeworkScript)) {
  let scriptContent = fs.readFileSync(buildXcframeworkScript, 'utf8')
  scriptContent = scriptContent.replace(/^\s*-disableAutomaticPackageResolution\s*\\?\r?\n/gm, '')
  scriptContent = scriptContent.replace(/^\s*-quiet\s*\\?\r?\n/gm, '')
  scriptContent = scriptContent.replace(/-disableAutomaticPackageResolution\s*\\?/g, '')
  scriptContent = scriptContent.replace(/-quiet\s*\\?/g, '')
  if (!scriptContent.includes('OTHER_SWIFTFLAGS=')) {
    scriptContent = scriptContent.replace(
      'CLANG_COVERAGE_MAPPING=NO \\',
      'CLANG_COVERAGE_MAPPING=NO \\\n    OTHER_SWIFTFLAGS="-enable-experimental-feature NonescapableTypes -enable-experimental-feature IsolatedAny -enable-upcoming-feature NonisolatedNonsendingByDefault -enable-upcoming-feature InferIsolatedConformances" \\'
    )
  }
  // Clean up any empty lines between backslash continuations so bash commands are not prematurely terminated
  scriptContent = scriptContent.replace(/\\\r?\n(\s*\r?\n)+/g, '\\\n')
  fs.writeFileSync(buildXcframeworkScript, scriptContent, 'utf8')
  console.log('[patch-swift-packages] Successfully patched build-xcframework.sh')
}

// 7. Patch all Swift source files in ExpoModulesJSI
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

      // A. weak let -> nonisolated(unsafe) weak var
      code = code.replace(/weak\s+let\s+/g, 'nonisolated(unsafe) weak var ')
      // Ensure weak var runtime is marked nonisolated(unsafe) for Sendable classes
      code = code.replace(/(?<!nonisolated\(unsafe\)\s+)weak\s+var\s+runtime/g, 'nonisolated(unsafe) weak var runtime')

      // B. Trailing commas in function/closure signatures
      code = code.replace(/consuming JavaScriptValuesBuffer,\s*\)/g, 'consuming JavaScriptValuesBuffer\n    )')

      // C. Task+immediate.swift polyfill (case-insensitive check)
      if (file.name.toLowerCase() === 'task+immediate.swift') {
        code = `// swift-format-ignore-file: AlwaysUseLowerCamelCase
import Foundation

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

      // D. JavaScriptRuntime.swift constructor calls & property name push
      if (file.name === 'JavaScriptRuntime.swift') {
        // Use factory methods for RuntimeScheduler
        code = code.replace(/expo\.RuntimeScheduler\(\)/g, 'expo.RuntimeScheduler.create()')
        code = code.replace(/expo\.RuntimeScheduler\(scheduler,\s*fn\)/g, 'expo.RuntimeScheduler.create(scheduler, fn)')

        // Use factory method for HostFunctionClosure
        code = code.replace(/expo\.HostFunctionClosure\(context,\s*call,\s*deallocate\)/g, 'expo.HostFunctionClosure.create(context, call, deallocate)')

        // Safe C++ vector push via HostObjectCallbacks.addPropNameId
        const oldPushBlock = `      for propertyName in propertyNames {
        let propNameId = facebook.jsi.PropNameID.forUtf8(iRuntime, std.string(propertyName))
        vector.push_back(propNameId)
      }`
        const oldPushBlockConsuming = `      for propertyName in propertyNames {
        let propNameId = facebook.jsi.PropNameID.forUtf8(iRuntime, std.string(propertyName))
        vector.push_back(consuming: propNameId)
      }`
        const newPushBlock = `      for propertyName in propertyNames {
        propertyName.withCString { cStr in
          expo.HostObjectCallbacks.addPropNameId(&vector, iRuntime, cStr)
        }
      }`
        if (code.includes(oldPushBlock)) {
          code = code.replace(oldPushBlock, newPushBlock)
        } else if (code.includes(oldPushBlockConsuming)) {
          code = code.replace(oldPushBlockConsuming, newPushBlock)
        } else {
          // Regex fallback
          code = code.replace(
            /for\s+propertyName\s+in\s+propertyNames\s*\{[\s\S]*?vector\.push_back[\s\S]*?\}/,
            `for propertyName in propertyNames {\n        propertyName.withCString { cStr in\n          expo.HostObjectCallbacks.addPropNameId(&vector, iRuntime, cStr)\n        }\n      }`
          )
        }

        // Swift 6.2 data race prevention: convert raw pointers to UInt bitPattern before assumeIsolated
        // 1. getter in createHostObject
        code = code.replace(
          /nonisolated\(unsafe\)\s+let\s+resultPtr\s*=\s*resultPtr\s*return\s+withGuaranteedContext\(context\)\s*\{\s*\(context:\s*HostObjectContext,\s*runtime\)\s*in\s*return\s+JavaScriptActor\.assumeIsolated\s*\{\s*return\s+forwardingSwiftErrorsToJS\(runtime:\s*runtime\)\s*\{\s*try\s+context\.get\(propertyName\)\.writeJSIValue\(to:\s*resultPtr\)\s*\}\s*\}\s*\}/g,
          `let resultPtrBits = UInt(bitPattern: resultPtr)

      return withGuaranteedContext(context) { (context: HostObjectContext, runtime) in
        return JavaScriptActor.assumeIsolated {
          return forwardingSwiftErrorsToJS(runtime: runtime) {
            let resultPtr = UnsafeMutablePointer<facebook.jsi.Value>(bitPattern: resultPtrBits)!
            try context.get(propertyName).writeJSIValue(to: resultPtr)
          }
        }
      }`
        )

        // 2. createFunctionClosure (owning)
        code = code.replace(
          /nonisolated\(unsafe\)\s+let\s+thisPtr\s*=\s*thisPtr\s*nonisolated\(unsafe\)\s+let\s+argumentsPtr\s*=\s*argumentsPtr\s*nonisolated\(unsafe\)\s+let\s+resultPtr\s*=\s*resultPtr[\s\S]*?\(context:\s*HostFunctionContext,\s*runtime\)\s*in\s*return\s+JavaScriptActor\.assumeIsolated\s*\{\s*return\s+forwardingSwiftErrorsToJS\(runtime:\s*runtime\)\s*\{\s*let\s+this\s*=\s*UnsafeMutablePointer\(mutating:\s*thisPtr\)\.move\(\)\s*let\s+arguments\s*=\s*JavaScriptValuesBuffer\(runtime,\s*start:\s*argumentsPtr,\s*count:\s*argumentsCount\)\s*let\s+thisValue\s*=\s*JavaScriptValue\(runtime,\s*this\)\s*try\s+context\.call\(thisValue,\s*consume\s+arguments\)\.writeJSIValue\(to:\s*resultPtr\)\s*\}\s*\}\s*\}/g,
          `let thisPtrBits = UInt(bitPattern: thisPtr)
    let argumentsPtrBits = UInt(bitPattern: argumentsPtr)
    let resultPtrBits = UInt(bitPattern: resultPtr)

    // See \`withGuaranteedContext\` for why neither the context nor the runtime is retained here, and
    // why the result is written to the caller's slot instead of being returned.
    return withGuaranteedContext(context) { (context: HostFunctionContext, runtime) in
      return JavaScriptActor.assumeIsolated {
        return forwardingSwiftErrorsToJS(runtime: runtime) {
          let thisPtr = UnsafePointer<facebook.jsi.Value>(bitPattern: thisPtrBits)!
          let argumentsPtr = UnsafePointer<facebook.jsi.Value>(bitPattern: argumentsPtrBits)
          let resultPtr = UnsafeMutablePointer<facebook.jsi.Value>(bitPattern: resultPtrBits)!
          let this = UnsafeMutablePointer(mutating: thisPtr).move()
          let arguments = JavaScriptValuesBuffer(runtime, start: argumentsPtr, count: argumentsCount)
          let thisValue = JavaScriptValue(runtime, this)
          try context.call(thisValue, consume arguments).writeJSIValue(to: resultPtr)
        }
      }
    }`
        )

        // 3. createFunctionClosure (unowned)
        code = code.replace(
          /nonisolated\(unsafe\)\s+let\s+thisPtr\s*=\s*thisPtr\s*nonisolated\(unsafe\)\s+let\s+argumentsPtr\s*=\s*argumentsPtr\s*nonisolated\(unsafe\)\s+let\s+resultPtr\s*=\s*resultPtr[\s\S]*?\(context:\s*UnownedThisHostFunctionContext,\s*runtime\)\s*in\s*return\s+JavaScriptActor\.assumeIsolated\s*\{\s*return\s+forwardingSwiftErrorsToJS\(runtime:\s*runtime\)\s*\{\s*let\s+arguments\s*=\s*JavaScriptValuesBuffer\(runtime,\s*start:\s*argumentsPtr,\s*count:\s*argumentsCount\)\s*let\s+thisValue\s*=\s*JavaScriptUnownedValue\(runtime\.pointee,\s*thisPtr\)\s*try\s+context\.call\(thisValue,\s*consume\s+arguments\)\.writeJSIValue\(to:\s*resultPtr\)\s*\}\s*\}\s*\}/g,
          `let thisPtrBits = UInt(bitPattern: thisPtr)
    let argumentsPtrBits = UInt(bitPattern: argumentsPtr)
    let resultPtrBits = UInt(bitPattern: resultPtr)

    // See \`withGuaranteedContext\` for why neither the context nor the runtime is retained here, and
    // why the result is written to the caller's slot instead of being returned.
    return withGuaranteedContext(context) { (context: UnownedThisHostFunctionContext, runtime) in
      return JavaScriptActor.assumeIsolated {
        return forwardingSwiftErrorsToJS(runtime: runtime) {
          let thisPtr = UnsafePointer<facebook.jsi.Value>(bitPattern: thisPtrBits)!
          let argumentsPtr = UnsafePointer<facebook.jsi.Value>(bitPattern: argumentsPtrBits)
          let resultPtr = UnsafeMutablePointer<facebook.jsi.Value>(bitPattern: resultPtrBits)!
          let arguments = JavaScriptValuesBuffer(runtime, start: argumentsPtr, count: argumentsCount)
          let thisValue = JavaScriptUnownedValue(runtime.pointee, thisPtr)
          try context.call(thisValue, consume arguments).writeJSIValue(to: resultPtr)
        }
      }
    }`
        )
      }

      // F. JavaScriptError.swift - remove public from CppError extension
      if (file.name === 'JavaScriptError.swift') {
        code = code.replace('public var message: String {', 'var message: String {')
      }

      // G. JavaScriptRef.swift & JavaScriptValue.swift - remove Escapable protocol (requires experimental feature)
      if (file.name === 'JavaScriptRef.swift' || file.name === 'JavaScriptValue.swift') {
        code = code.replace(/,\s*Escapable/g, '')
      }

      // H. JavaScriptValuesBuffer.swift - guard count > 0 for baseAddress and allocate to avoid 0x1 dangling pointer
      if (file.name === 'JavaScriptValuesBuffer.swift') {
        code = code.replace(
          /internal\s+var\s+baseAddress:\s*UnsafePointer<facebook\.jsi\.Value>\?\s*\{\s*return\s+UnsafePointer\(bufferPointer\.baseAddress\)\s*\}/g,
          `internal var baseAddress: UnsafePointer<facebook.jsi.Value>? {
    guard count > 0 else { return nil }
    return UnsafePointer(bufferPointer.baseAddress)
  }`
        )
        code = code.replace(
          /public\s+var\s+rawBaseAddress:\s*UnsafeRawPointer\?\s*\{\s*return\s+start\.map\s*\{\s*UnsafeRawPointer\(\$0\)\s*\}\s*\}/g,
          `public var rawBaseAddress: UnsafeRawPointer? {
    guard count > 0 else { return nil }
    return start.map { UnsafeRawPointer($0) }
  }`
        )
        code = code.replace(
          /public static func allocate\(in runtime: JavaScriptRuntime, capacity: Int\) -> JavaScriptValuesBuffer \{\s*return JavaScriptValuesBuffer\(\s*runtime, buffer: UnsafeMutableBufferPointer<facebook\.jsi\.Value>\.allocate\(capacity: capacity\), ownsMemory: true\)\s*\}/g,
          `public static func allocate(in runtime: JavaScriptRuntime, capacity: Int) -> JavaScriptValuesBuffer {
    guard capacity > 0 else {
      return JavaScriptValuesBuffer(runtime, start: nil, count: 0)
    }
    return JavaScriptValuesBuffer(
      runtime, buffer: UnsafeMutableBufferPointer<facebook.jsi.Value>.allocate(capacity: capacity), ownsMemory: true)
  }`
        )
        code = code.replace(
          /let buffer = UnsafeMutableBufferPointer<facebook\.jsi\.Value>\.allocate\(capacity: capacity\)/g,
          `guard capacity > 0 else {
      return JavaScriptValuesBuffer(runtime, start: nil, count: 0)
    }
    let buffer = UnsafeMutableBufferPointer<facebook.jsi.Value>.allocate(capacity: capacity)`
        )
        code = code.replace(
          /self\.start = UnsafeMutableRawPointer\(buffer\.baseAddress\)/g,
          'self.start = buffer.count > 0 ? UnsafeMutableRawPointer(buffer.baseAddress) : nil'
        )
        code = code.replace(
          /self\.ownsMemory = ownsMemory/g,
          'self.ownsMemory = buffer.count > 0 && ownsMemory'
        )
      }

      // I. JavaScriptFunction.swift - pass nil baseAddress when argument count is 0 and provide 0-arg fast paths
      if (file.name === 'JavaScriptFunction.swift') {
        code = code.replace(
          /let\s+jsiResult\s*=\s*expo\.callAsConstructor\(runtime\.pointee,\s*pointee,\s*arguments\?\.baseAddress,\s*arguments\?\.count\s*\?\?\s*0\)/g,
          `let count = arguments?.count ?? 0
      let baseAddress = count > 0 ? arguments?.baseAddress : nil
      let jsiResult = expo.callAsConstructor(runtime.pointee, pointee, baseAddress, count)`
        )
        code = code.replace(
          /expo\.callFunctionWithThis\(runtime\.pointee,\s*pointee,\s*this\.pointee,\s*arguments\?\.baseAddress,\s*arguments\?\.count\s*\?\?\s*0\)/g,
          `expo.callFunctionWithThis(runtime.pointee, pointee, this.pointee, (arguments?.count ?? 0) > 0 ? arguments?.baseAddress : nil, arguments?.count ?? 0)`
        )
        code = code.replace(
          /expo\.callFunction\(runtime\.pointee,\s*pointee,\s*arguments\?\.baseAddress,\s*arguments\?\.count\s*\?\?\s*0\)/g,
          `expo.callFunction(runtime.pointee, pointee, (arguments?.count ?? 0) > 0 ? arguments?.baseAddress : nil, arguments?.count ?? 0)`
        )
      }

      if (code !== original) {
        fs.writeFileSync(fullPath, code, 'utf8')
        console.log(`[patch-swift-packages] Patched Swift source: ${file.name}`)
      }
    }
  }
}
patchSwiftSources(path.join(process.cwd(), 'node_modules', 'expo-modules-jsi', 'apple', 'Sources', 'ExpoModulesJSI'))
patchSwiftSources(path.join(process.cwd(), 'node_modules', 'expo-modules-core', 'node_modules', 'expo-modules-jsi', 'apple', 'Sources', 'ExpoModulesJSI'))
patchSwiftSources(path.join(process.cwd(), 'ios', 'Pods', 'ExpoModulesJSI'))
patchSwiftSources(path.join(process.cwd(), 'ios', 'Pods', 'ExpoModulesCore'))

// 8. Patch Podfile to ensure expo-symbols is excluded and inject Swift build settings
const podfilePath = path.join(process.cwd(), 'ios', 'Podfile')
if (fs.existsSync(podfilePath)) {
  let podfile = fs.readFileSync(podfilePath, 'utf8')
  if (!podfile.includes("exclude: ['expo-symbols']")) {
    podfile = podfile.replace(/use_expo_modules!\((.*?)\)/, (match, p1) => {
      if (p1.trim()) {
        return `use_expo_modules!(${p1}, exclude: ['expo-symbols'])`
      } else {
        return `use_expo_modules!(exclude: ['expo-symbols'])`
      }
    })
    podfile = podfile.replace(/use_expo_modules!\s*$/m, "use_expo_modules!(exclude: ['expo-symbols'])")
  }

  // Inject target build settings in post_install if not already present
  if (!podfile.includes("target.name == 'ExpoModulesJSI'")) {
    const postInstallHook = `
    installer.pods_project.targets.each do |target|
      if target.name == 'ExpoModulesJSI'
        target.build_configurations.each do |config|
          config.build_settings['OTHER_SWIFTFLAGS'] ||= '$(inherited) '
          config.build_settings['OTHER_SWIFTFLAGS'] += '-enable-experimental-feature NonescapableTypes -enable-experimental-feature IsolatedAny -enable-upcoming-feature NonisolatedNonsendingByDefault -enable-upcoming-feature InferIsolatedConformances'
          config.build_settings['CLANG_ENABLE_OBJC_WEAK'] = 'YES'
          config.build_settings['GCC_WARN_ABOUT_MISSING_PROTOTYPES'] = 'NO'
          config.build_settings['CLANG_WARN_OBJC_MISSING_PROPERTY_SYNTHESIS'] = 'NO'
        end
      end
      if target.name == 'RNSVG'
        target.build_configurations.each do |config|
          config.build_settings['GCC_WARN_ABOUT_MISSING_PROTOTYPES'] = 'NO'
          config.build_settings['CLANG_WARN_OBJC_MISSING_PROPERTY_SYNTHESIS'] = 'NO'
        end
      end
    end
`
    podfile = podfile.replace(/post_install\s+do\s+\|installer\|/, 'post_install do |installer|\n' + postInstallHook)
  }

  fs.writeFileSync(podfilePath, podfile, 'utf8')
  console.log('[patch-swift-packages] Successfully configured Podfile settings and exclusions')
}

console.log('[patch-swift-packages] All Swift and C++ compatibility patches applied successfully.')
