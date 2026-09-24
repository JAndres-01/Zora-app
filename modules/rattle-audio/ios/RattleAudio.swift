import AVFoundation
import ExpoModulesCore
#if canImport(WidgetKit)
import WidgetKit
#endif

/// Ráfaga de clics de ruleta programada en el reloj del hardware de audio
/// y utilidades nativas compartidas con iOS WidgetKit.
public class RattleAudioModule: Module {
  private let engine = AVAudioEngine()
  private var player: AVAudioPlayerNode?
  /// Clic ya decodificado en su formato nativo (Float32, el del archivo WAV).
  private var clip: AVAudioPCMBuffer?
  private var sessionConfigured = false

  public func definition() -> ModuleDefinition {
    Name("RattleAudio")

    AsyncFunction("prepareAsync") { (uri: String) in
      try self.prepare(uri: uri)
    }

    Function("playClicks") { (offsetsMs: [Int]) -> Bool in
      self.playClicks(offsetsMs: offsetsMs)
    }

    Function("stop") {
      self.stop()
    }

    Function("syncWidgetData") { (jsonString: String) -> Bool in
      guard let userDefaults = UserDefaults(suiteName: "group.com.zora.app") else {
        return false
      }
      userDefaults.set(jsonString, forKey: "@zora_widget_dual_balance_data")
      userDefaults.synchronize()
      #if canImport(WidgetKit)
      if #available(iOS 14.0, *) {
        WidgetCenter.shared.reloadTimelines(ofKind: "DualBalanceWidget")
      }
      #endif
      return true
    }
  }

  private func prepare(uri: String) throws {
    configureSession()
    let url: URL
    if uri.hasPrefix("file://") {
      guard let parsed = URL(string: uri) else {
        throw NSError(domain: "RattleAudio", code: 1, userInfo: [NSLocalizedDescriptionKey: "URI de ruleta inválida: \(uri)"])
      }
      url = parsed
    } else if uri.hasPrefix("http://") || uri.hasPrefix("https://") {
      guard let remoteUrl = URL(string: uri) else {
        throw NSError(domain: "RattleAudio", code: 2, userInfo: [NSLocalizedDescriptionKey: "URI remota inválida: \(uri)"])
      }
      let data = try Data(contentsOf: remoteUrl)
      let tempUrl = FileManager.default.temporaryDirectory.appendingPathComponent("roulette_click_\(UUID().uuidString).wav")
      try data.write(to: tempUrl)
      url = tempUrl
    } else {
      url = URL(fileURLWithPath: uri)
    }

    let file = try AVAudioFile(forReading: url)
    let fileFormat = file.processingFormat
    let frameCount = AVAudioFrameCount(file.length)
    guard frameCount > 0,
      let fileBuffer = AVAudioPCMBuffer(pcmFormat: fileFormat, frameCapacity: frameCount)
    else {
      throw NSError(domain: "RattleAudio", code: 3, userInfo: [NSLocalizedDescriptionKey: "No se pudo leer el WAV del clic"])
    }
    try file.read(into: fileBuffer)
    clip = fileBuffer

    if player == nil {
      let player = AVAudioPlayerNode()
      engine.attach(player)
      // El engine hace la conversión de frecuencia/canales hacia el hardware solo.
      engine.connect(player, to: engine.mainMixerNode, format: fileFormat)
      engine.prepare()
      self.player = player
    }
    if !engine.isRunning {
      try engine.start()
    }
  }

  private func playClicks(offsetsMs: [Int]) -> Bool {
    if !engine.isRunning {
      try? engine.start()
    }
    guard let clip, let player, engine.isRunning else { return false }
    let clipFormat = clip.format
    let sampleRate = clipFormat.sampleRate
    guard sampleRate > 0, !offsetsMs.isEmpty else { return false }

    // Corta cualquier ráfaga previa (re-giro rápido o cierre de modal)
    player.stop()

    let lastOffsetSec = Double((offsetsMs.max() ?? 0)) / 1000.0
    let clipSec = Double(clip.frameLength) / sampleRate
    let totalFrames = AVAudioFrameCount((lastOffsetSec + clipSec + 0.05) * sampleRate)
    guard totalFrames > 0,
      let merged = AVAudioPCMBuffer(pcmFormat: clipFormat, frameCapacity: totalFrames)
    else {
      return false
    }
    merged.frameLength = totalFrames

    let srcBytesPerFrame = Int(clipFormat.streamDescription.pointee.mBytesPerFrame)
    let mergedABL = UnsafeMutableAudioBufferListPointer(merged.mutableAudioBufferList)

    // Silencio base del flujo completo
    for buffer in mergedABL {
      if let data = buffer.mData {
        memset(data, 0, Int(buffer.mDataByteSize))
      }
    }

    // Superpone una copia del clic en cada offset (mezcla PCM sin cortes con protección de saturación)
    if clipFormat.commonFormat == .pcmFormatFloat32,
       let srcFloat = clip.floatChannelData,
       let dstFloat = merged.floatChannelData {
      let channels = Int(clipFormat.channelCount)
      let srcFrames = Int(clip.frameLength)
      let dstFrames = Int(merged.frameLength)
      for offsetMs in offsetsMs {
        let startFrame = Int(Double(offsetMs) / 1000.0 * sampleRate)
        let framesToCopy = min(srcFrames, dstFrames - startFrame)
        if framesToCopy <= 0 { continue }
        for ch in 0..<channels {
          let src = srcFloat[ch]
          let dst = dstFloat[ch]
          for f in 0..<framesToCopy {
            let newVal = dst[startFrame + f] + src[f]
            dst[startFrame + f] = max(-1.0, min(1.0, newVal))
          }
        }
      }
    } else if clipFormat.commonFormat == .pcmFormatInt16,
              let srcInt16 = clip.int16ChannelData,
              let dstInt16 = merged.int16ChannelData {
      let channels = Int(clipFormat.channelCount)
      let srcFrames = Int(clip.frameLength)
      let dstFrames = Int(merged.frameLength)
      for offsetMs in offsetsMs {
        let startFrame = Int(Double(offsetMs) / 1000.0 * sampleRate)
        let framesToCopy = min(srcFrames, dstFrames - startFrame)
        if framesToCopy <= 0 { continue }
        for ch in 0..<channels {
          let src = srcInt16[ch]
          let dst = dstInt16[ch]
          for f in 0..<framesToCopy {
            let sum = Int32(dst[startFrame + f]) + Int32(src[f])
            dst[startFrame + f] = Int16(clamping: sum)
          }
        }
      }
    } else {
      let srcABL = UnsafeMutableAudioBufferListPointer(clip.mutableAudioBufferList)
      for offsetMs in offsetsMs {
        let startFrame = Int(Double(offsetMs) / 1000.0 * sampleRate)
        for i in 0..<min(mergedABL.count, srcABL.count) {
          let dstBuf = mergedABL[i]
          let srcBuf = srcABL[i]
          let byteOffset = startFrame * srcBytesPerFrame
          let copyBytes = min(
            Int(srcBuf.mDataByteSize),
            Int(dstBuf.mDataByteSize) - byteOffset
          )
          if copyBytes > 0, let src = srcBuf.mData, let dst = dstBuf.mData {
            memcpy(dst.advanced(by: byteOffset), src, copyBytes)
          }
        }
      }
    }

    player.scheduleBuffer(merged, at: nil, options: [], completionHandler: nil)
    player.play()
    return true
  }

  private func stop() {
    player?.stop()
  }

  private func configureSession() {
    guard !sessionConfigured else { return }
    let session = AVAudioSession.sharedInstance()
    do {
      try session.setCategory(.playback, mode: .default, options: [.mixWithOthers])
      try session.setActive(true, options: [])
      sessionConfigured = true
    } catch {
      // La sesión de expo-audio ya puede estar activa; el engine arranca igual.
    }
  }
}