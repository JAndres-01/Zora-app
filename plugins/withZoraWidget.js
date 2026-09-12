const { withXcodeProject } = require('@expo/config-plugins')
const plist = require('@expo/plist')
const fs = require('fs')
const path = require('path')

const EXTENSION_NAME = 'ZoraWidgetExtension'
const APP_GROUP = 'group.com.zora.app'

/**
 * Obtiene el DEVELOPMENT_TEAM de la configuración principal de la app si existe.
 */
function getMainAppDevTeam(pbx) {
  const configs = pbx.pbxXCBuildConfigurationSection()
  for (const key in configs) {
    const config = configs[key]
    const bs = config.buildSettings
    if (!bs || !bs.PRODUCT_NAME) continue
    const productName = bs.PRODUCT_NAME.replace(/"/g, '')
    if (productName.includes('Extension') || productName.includes('Widget')) continue
    const devTeam = bs.DEVELOPMENT_TEAM?.replace(/"/g, '')
    if (devTeam) return devTeam
  }
  return null
}

/**
 * Config Plugin de Expo para compilar automáticamente el Widget de iOS (WidgetKit)
 * durante EAS Build o expo prebuild.
 */
const withZoraWidget = (config) => {
  return withXcodeProject(config, async (config) => {
    const pbxProject = config.modResults
    const platformProjectRoot = config.modRequest.platformProjectRoot
    const appIdentifier = config.ios?.bundleIdentifier || 'com.zora.app'
    const widgetBundleId = `${appIdentifier}.${EXTENSION_NAME}`
    const currentProjectVersion = config.ios?.buildNumber || '1'
    const marketingVersion = config.version || '2.0.0'

    const extensionDir = path.join(platformProjectRoot, EXTENSION_NAME)
    if (!fs.existsSync(extensionDir)) {
      fs.mkdirSync(extensionDir, { recursive: true })
    }

    // 1. Copiar archivo fuente Swift del widget
    const swiftSourcePath = path.join(__dirname, '..', 'widgets', 'ios', 'DualBalanceWidget.swift')
    const destSwiftPath = path.join(extensionDir, 'DualBalanceWidget.swift')
    if (fs.existsSync(swiftSourcePath)) {
      fs.copyFileSync(swiftSourcePath, destSwiftPath)
      console.log(`[withZoraWidget] Copiado DualBalanceWidget.swift a ${destSwiftPath}`)
    } else {
      console.warn(`[withZoraWidget] Archivo fuente no encontrado en ${swiftSourcePath}`)
    }

    // 2. Escribir Info.plist de la extensión de WidgetKit
    const infoPlistPath = path.join(extensionDir, `${EXTENSION_NAME}-Info.plist`)
    const infoPlistContent = {
      CFBundleDevelopmentRegion: '$(DEVELOPMENT_LANGUAGE)',
      CFBundleDisplayName: 'Zora Balance',
      CFBundleExecutable: '$(EXECUTABLE_NAME)',
      CFBundleIdentifier: widgetBundleId,
      CFBundleInfoDictionaryVersion: '6.0',
      CFBundleName: '$(PRODUCT_NAME)',
      CFBundlePackageType: 'XPC!',
      CFBundleShortVersionString: marketingVersion,
      CFBundleVersion: currentProjectVersion,
      NSExtension: {
        NSExtensionPointIdentifier: 'com.apple.widgetkit-extension',
      },
    }
    fs.writeFileSync(infoPlistPath, plist.default ? plist.default.build(infoPlistContent) : plist.build(infoPlistContent))

    // 3. Escribir Entitlements para el App Group
    const entitlementsPath = path.join(extensionDir, `${EXTENSION_NAME}.entitlements`)
    const entitlementsContent = {
      'com.apple.security.application-groups': [APP_GROUP],
    }
    fs.writeFileSync(entitlementsPath, plist.default ? plist.default.build(entitlementsContent) : plist.build(entitlementsContent))

    // 4. Si el target ya existe en Xcode, evitar duplicación
    if (pbxProject.pbxTargetByName(EXTENSION_NAME)) {
      console.log(`[withZoraWidget] ${EXTENSION_NAME} ya existe en el proyecto Xcode. Omitiendo creación duplicada.`)
      return config
    }

    const sourceFiles = ['DualBalanceWidget.swift']
    const configFiles = [`${EXTENSION_NAME}-Info.plist`, `${EXTENSION_NAME}.entitlements`]
    const allFiles = [...sourceFiles, ...configFiles]

    // 5. Crear PBXGroup para los archivos del widget
    const extGroup = pbxProject.addPbxGroup(allFiles, EXTENSION_NAME, EXTENSION_NAME)
    const groups = pbxProject.hash.project.objects.PBXGroup
    Object.keys(groups).forEach((key) => {
      if (
        typeof groups[key] === 'object' &&
        groups[key].name === undefined &&
        groups[key].path === undefined
      ) {
        pbxProject.addToPbxGroup(extGroup.uuid, key)
      }
    })

    // 6. Configurar objetos requeridos para evitar bugs de addTarget en pbxProject
    const projObjects = pbxProject.hash.project.objects
    projObjects.PBXTargetDependency = projObjects.PBXTargetDependency || {}
    projObjects.PBXContainerItemProxy = projObjects.PBXContainerItemProxy || {}

    // 7. Añadir Target nativo de tipo app_extension
    const target = pbxProject.addTarget(EXTENSION_NAME, 'app_extension', EXTENSION_NAME)

    // 8. Fases de compilación
    pbxProject.addBuildPhase(sourceFiles, 'PBXSourcesBuildPhase', 'Sources', target.uuid)
    pbxProject.addBuildPhase([], 'PBXFrameworksBuildPhase', 'Frameworks', target.uuid)
    pbxProject.addBuildPhase([], 'PBXResourcesBuildPhase', 'Resources', target.uuid)

    // 9. Configuración de Build Settings
    const devTeam = getMainAppDevTeam(pbxProject)
    const configurations = pbxProject.pbxXCBuildConfigurationSection()
    for (const key in configurations) {
      const buildConfig = configurations[key]
      const bs = buildConfig.buildSettings
      if (!bs) continue
      if (bs.PRODUCT_NAME === `"${EXTENSION_NAME}"`) {
        bs.CLANG_ENABLE_MODULES = 'YES'
        bs.INFOPLIST_FILE = `"${EXTENSION_NAME}/${EXTENSION_NAME}-Info.plist"`
        bs.CODE_SIGN_ENTITLEMENTS = `"${EXTENSION_NAME}/${EXTENSION_NAME}.entitlements"`
        bs.CODE_SIGN_STYLE = 'Automatic'
        bs.CURRENT_PROJECT_VERSION = `"${currentProjectVersion}"`
        bs.GENERATE_INFOPLIST_FILE = 'NO'
        bs.MARKETING_VERSION = `"${marketingVersion}"`
        bs.PRODUCT_BUNDLE_IDENTIFIER = `"${widgetBundleId}"`
        bs.SWIFT_VERSION = '5.0'
        bs.TARGETED_DEVICE_FAMILY = '"1,2"'
        bs.SKIP_INSTALL = 'YES'
        if (devTeam) {
          bs.DEVELOPMENT_TEAM = devTeam
        }
      }
    }

    if (devTeam) {
      const widgetTarget = pbxProject.pbxTargetByName(EXTENSION_NAME)
      pbxProject.addTargetAttribute('DevelopmentTeam', devTeam, widgetTarget)
    }

    console.log(`[withZoraWidget] Target ${EXTENSION_NAME} configurado con éxito en el proyecto Xcode.`)
    return config
  })
}

module.exports = withZoraWidget
