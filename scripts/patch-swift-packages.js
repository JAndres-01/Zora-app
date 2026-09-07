const fs = require('fs')
const path = require('path')

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

// 2. expo-modules-macros-plugin Package.swift
const macrosPackagePath = path.join(process.cwd(), 'node_modules', '@expo', 'expo-modules-macros-plugin', 'apple', 'Package.swift')
if (fs.existsSync(macrosPackagePath)) {
  let macrosContent = fs.readFileSync(macrosPackagePath, 'utf8')
  macrosContent = macrosContent.replace(/swift-tools-version:\s*6\.[1-9]/g, 'swift-tools-version: 6.0')
  fs.writeFileSync(macrosPackagePath, macrosContent, 'utf8')
  console.log('[patch-swift-packages] Successfully patched expo-modules-macros-plugin Package.swift')
}

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
  if (!headerContent.includes('RuntimeScheduler *create(')) {
    const factoryMethods = `
  static inline RuntimeScheduler *create(void *scheduler, ScheduleFn fn) noexcept SWIFT_RETURNS_RETAINED {
    return new RuntimeScheduler(scheduler, fn);
  }

  static inline RuntimeScheduler *create() noexcept SWIFT_RETURNS_RETAINED {
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

  if (!headerContent.includes('HostFunctionClosure *create(')) {
    const factoryMethod = `
  static inline HostFunctionClosure *create(Context context, Closure closure, Deallocator deallocator) noexcept {
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


// 6. build-xcframework.sh
const buildXcframeworkScript = path.join(process.cwd(), 'node_modules', 'expo-modules-jsi', 'apple', 'scripts', 'build-xcframework.sh')
if (fs.existsSync(buildXcframeworkScript)) {
  let scriptContent = fs.readFileSync(buildXcframeworkScript, 'utf8')
  scriptContent = scriptContent.replace(/^\s*-disableAutomaticPackageResolution\s*\\?\r?\n/gm, '')
  scriptContent = scriptContent.replace(/^\s*-quiet\s*\\?\r?\n/gm, '')
  scriptContent = scriptContent.replace(/-disableAutomaticPackageResolution\s*\\?/g, '')
  scriptContent = scriptContent.replace(/-quiet\s*\\?/g, '')
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

        // Swift 6 data race prevention: convert raw pointers to UInt bitPattern before assumeIsolated
        if (code.includes('let this = UnsafeMutablePointer(mutating: thisPtr).move()')) {
          code = code.replace(
            /nonisolated\(unsafe\)\s+let\s+thisPtr\s*=\s*thisPtr[\s\S]*?\(context:\s*HostFunctionContext,\s*runtime\)\s*in[\s\S]*?resultPtr\.pointee\s*=\s*JavaScriptActor\.assumeIsolated\s*\{[\s\S]*?return\s+forwardingSwiftErrorsToJS\(runtime:\s*runtime\)\s*\{[\s\S]*?let\s+this\s*=\s*UnsafeMutablePointer\(mutating:\s*thisPtr\)\.move\(\)[\s\S]*?let\s+arguments\s*=\s*JavaScriptValuesBuffer\(runtime,\s*start:\s*argumentsPtr,\s*count:\s*argumentsCount\)[\s\S]*?let\s+thisValue\s*=\s*JavaScriptValue\(runtime,\s*this\)[\s\S]*?return\s+try\s+context\.call\(thisValue,\s*consume\s+arguments\)\.asJSIValue\(\)[\s\S]*?\}\s*\}\s*\}/,
            `let thisAddr = UInt(bitPattern: thisPtr)
    let argsAddr = UInt(bitPattern: argumentsPtr)
    nonisolated(unsafe) let resultPtr = resultPtr

    // See \`withGuaranteedContext\` for why neither the context nor the runtime is retained here, and
    // why the result is written to the caller's slot instead of being returned.
    withGuaranteedContext(context) { (context: HostFunctionContext, runtime) in
      resultPtr.pointee = JavaScriptActor.assumeIsolated {
        return forwardingSwiftErrorsToJS(runtime: runtime) {
          let thisPtr = UnsafePointer<facebook.jsi.Value>(bitPattern: thisAddr)!
          let argumentsPtr = UnsafePointer<facebook.jsi.Value>(bitPattern: argsAddr)
          let this = UnsafeMutablePointer(mutating: thisPtr).move()
          let arguments = JavaScriptValuesBuffer(runtime, start: argumentsPtr, count: argumentsCount)
          let thisValue = JavaScriptValue(runtime, this)
          return try context.call(thisValue, consume arguments).asJSIValue()
        }
      }
    }`
          )
        }

        if (code.includes('let thisValue = JavaScriptUnownedValue(runtime.pointee, thisPtr)')) {
          code = code.replace(
            /nonisolated\(unsafe\)\s+let\s+thisPtr\s*=\s*thisPtr[\s\S]*?\(context:\s*UnownedThisHostFunctionContext,\s*runtime\)\s*in[\s\S]*?resultPtr\.pointee\s*=\s*JavaScriptActor\.assumeIsolated\s*\{[\s\S]*?return\s+forwardingSwiftErrorsToJS\(runtime:\s*runtime\)\s*\{[\s\S]*?let\s+arguments\s*=\s*JavaScriptValuesBuffer\(runtime,\s*start:\s*argumentsPtr,\s*count:\s*argumentsCount\)[\s\S]*?let\s+thisValue\s*=\s*JavaScriptUnownedValue\(runtime\.pointee,\s*thisPtr\)[\s\S]*?return\s+try\s+context\.call\(thisValue,\s*consume\s+arguments\)\.asJSIValue\(\)[\s\S]*?\}\s*\}\s*\}/,
            `let thisAddr = UInt(bitPattern: thisPtr)
    let argsAddr = UInt(bitPattern: argumentsPtr)
    nonisolated(unsafe) let resultPtr = resultPtr

    // See \`withGuaranteedContext\` for why neither the context nor the runtime is retained here, and
    // why the result is written to the caller's slot instead of being returned.
    withGuaranteedContext(context) { (context: UnownedThisHostFunctionContext, runtime) in
      resultPtr.pointee = JavaScriptActor.assumeIsolated {
        return forwardingSwiftErrorsToJS(runtime: runtime) {
          let thisPtr = UnsafePointer<facebook.jsi.Value>(bitPattern: thisAddr)!
          let argumentsPtr = UnsafePointer<facebook.jsi.Value>(bitPattern: argsAddr)
          let arguments = JavaScriptValuesBuffer(runtime, start: argumentsPtr, count: argumentsCount)
          let thisValue = JavaScriptUnownedValue(runtime.pointee, thisPtr)
          return try context.call(thisValue, consume arguments).asJSIValue()
        }
      }
    }`
          )
        }
      }

      // E. JavaScriptActor.swift - preserve @JavaScriptActor on runIsolated
      if (file.name === 'JavaScriptActor.swift') {
        if (!code.includes('@JavaScriptActor\n  @usableFromInline\n  internal static func runIsolated')) {
          code = code.replace(
            /@usableFromInline\s+internal static func runIsolated/g,
            '@JavaScriptActor\n  @usableFromInline\n  internal static func runIsolated'
          )
        }
      }

      // F. JavaScriptError.swift - remove public from CppError extension
      if (file.name === 'JavaScriptError.swift') {
        code = code.replace('public var message: String {', 'var message: String {')
      }

      if (code !== original) {
        fs.writeFileSync(fullPath, code, 'utf8')
        console.log(`[patch-swift-packages] Patched Swift source: ${file.name}`)
      }
    }
  }
}
patchSwiftSources(jsiSourcesDir)

// 8. Patch Podfile to ensure expo-symbols is excluded if Podfile exists
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
    fs.writeFileSync(podfilePath, podfile, 'utf8')
    console.log('[patch-swift-packages] Successfully ensured expo-symbols is excluded from Podfile')
  }
}

console.log('[patch-swift-packages] All Swift and C++ compatibility patches applied successfully.')
