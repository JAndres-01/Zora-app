package expo.modules.rattleaudio

import android.media.AudioAttributes
import android.media.AudioFormat
import android.media.AudioTrack
import android.net.Uri
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.nio.ByteBuffer
import java.nio.ByteOrder

/**
 * Ráfaga de clics de ruleta programada en el reloj del hardware de audio.
 *
 * Igual que en iOS: JS envía la lista de offsets (ms) UNA vez y el nativo monta un
 * único buffer PCM con el clic superpuesto en cada instante. Se reproduce con un
 * AudioTrack en modo estático — el hilo JS no vuelve a intervenir por clic.
 */
class RattleAudioModule : Module() {
  // Clic decodificado: muestras PCM 16-bit mono + frecuencia del archivo
  private var clip: ShortArray? = null
  private var clipSampleRate: Int = 0
  private var track: AudioTrack? = null

  override fun definition() = ModuleDefinition {
    Name("RattleAudio")

    AsyncFunction("prepareAsync") { uri: String ->
      val wav = WavReader.read(uri, this@RattleAudioModule)
      clip = wav.samples
      clipSampleRate = wav.sampleRate
    }

    Function("playClicks") { offsetsMs: List<Int> ->
      playClicks(offsetsMs)
    }

    Function("stop") {
      stopPlayback()
    }

    Function("syncWidgetData") { _: String ->
      true
    }
  }

  private fun playClicks(offsetsMs: List<Int>): Boolean {
    val source = clip ?: return false
    val rate = clipSampleRate
    if (rate <= 0) return false
    stopPlayback()

    val lastOffsetMs = offsetsMs.maxOrNull() ?: 300
    val totalSamples = (lastOffsetMs.toLong() * rate / 1000L).toInt() + source.size + rate / 20
    if (totalSamples <= 0) return false

    val buffer = ShortArray(totalSamples)
    for (offset in offsetsMs) {
      val start = (offset.toLong() * rate / 1000L).toInt()
      if (start >= totalSamples) continue
      val copyLen = minOf(source.size, totalSamples - start)
      for (i in 0 until copyLen) {
        val sum = buffer[start + i].toInt() + source[i].toInt()
        buffer[start + i] = sum.coerceIn(Short.MIN_VALUE.toInt(), Short.MAX_VALUE.toInt()).toShort()
      }
    }

    val bytes = ByteBuffer.allocate(buffer.size * 2).order(ByteOrder.LITTLE_ENDIAN)
    for (sample in buffer) bytes.putShort(sample)

    val minBuf = AudioTrack.getMinBufferSize(rate, AudioFormat.CHANNEL_OUT_MONO, AudioFormat.ENCODING_PCM_16BIT)
    val bufferBytes = bytes.array()
    val attrs = AudioAttributes.Builder()
      .setUsage(AudioAttributes.USAGE_GAME)
      .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
      .build()
    val format = AudioFormat.Builder()
      .setEncoding(AudioFormat.ENCODING_PCM_16BIT)
      .setSampleRate(rate)
      .setChannelMask(AudioFormat.CHANNEL_OUT_MONO)
      .build()

    val track = try {
      AudioTrack.Builder()
        .setAudioAttributes(attrs)
        .setAudioFormat(format)
        .setTransferMode(AudioTrack.MODE_STATIC)
        .setBufferSizeInBytes(maxOf(bufferBytes.size, minBuf))
        .build()
    } catch (e: Exception) {
      return false
    }

    val written = track.write(bufferBytes, 0, bufferBytes.size)
    if (written < bufferBytes.size) {
      track.release()
      return false
    }
    track.play()
    this.track = track
    return true
  }

  private fun stopPlayback() {
    track?.stop()
    track?.release()
    track = null
  }
}

/** Decodificador mínimo de WAV PCM (16 bits, cualquier nº de canales → mono). */
internal object WavReader {
  data class Wav(val sampleRate: Int, val samples: ShortArray)

  fun read(uri: String, module: RattleAudioModule): Wav {
    val bytes = if (uri.startsWith("http://") || uri.startsWith("https://")) {
      java.net.URL(uri).openStream().use { it.readBytes() }
    } else if (uri.startsWith("file://")) {
      val parsed = Uri.parse(uri)
      val path = parsed.path ?: uri.removePrefix("file://")
      java.io.File(path).inputStream().use { it.readBytes() }
    } else if (uri.startsWith("content://")) {
      val ctx = module.appContext.reactContext ?: throw Exceptions.ReactContextLost()
      ctx.contentResolver.openInputStream(Uri.parse(uri))?.use { it.readBytes() }
        ?: throw IllegalArgumentException("No se pudo abrir $uri")
    } else {
      val file = java.io.File(uri)
      if (file.exists()) {
        file.inputStream().use { it.readBytes() }
      } else {
        val ctx = module.appContext.reactContext ?: throw Exceptions.ReactContextLost()
        ctx.contentResolver.openInputStream(Uri.parse(uri))?.use { it.readBytes() }
          ?: throw IllegalArgumentException("No se pudo abrir $uri")
      }
    }
    return parse(bytes)
  }

  fun parse(data: ByteArray): Wav {
    if (data.size < 44 || String(data, 0, 4, Charsets.US_ASCII) != "RIFF" ||
      String(data, 8, 4, Charsets.US_ASCII) != "WAVE"
    ) {
      throw IllegalArgumentException("No es un WAV válido")
    }

    var pos = 12
    var fmtOffset = -1
    var dataOffset = -1
    var dataSize = 0
    while (pos + 8 <= data.size) {
      val id = String(data, pos, 4, Charsets.US_ASCII)
      val size = u32(data, pos + 4)
      when (id) {
        "fmt " -> fmtOffset = pos
        "data" -> {
          dataOffset = pos + 8
          dataSize = size
        }
      }
      pos += 8 + size + (size % 2) // chunks alineados a 2 bytes
    }
    if (fmtOffset < 0 || dataOffset < 0) throw IllegalArgumentException("Faltan chunks fmt/data")

    val audioFormat = u16(data, fmtOffset + 8)
    val channels = u16(data, fmtOffset + 10)
    val sampleRate = u32(data, fmtOffset + 12)
    val bitsPerSample = u16(data, fmtOffset + 22)
    if (audioFormat != 1) throw IllegalArgumentException("Solo WAV PCM")
    if (bitsPerSample != 16) throw IllegalArgumentException("Solo WAV de 16 bits")
    if (channels < 1) throw IllegalArgumentException("WAV sin canales")

    val frameSize = channels * 2
    val frameCount = minOf(dataSize / frameSize, (data.size - dataOffset) / frameSize)
    val samples = ShortArray(frameCount)
    for (i in 0 until frameCount) {
      var sum = 0L
      for (c in 0 until channels) {
        val off = dataOffset + (i * channels + c) * 2
        sum += (data[off].toInt() and 0xFF) or (data[off + 1].toInt() shl 8)
      }
      samples[i] = (sum / channels).toShort()
    }
    return Wav(sampleRate, samples)
  }

  private fun u16(data: ByteArray, offset: Int): Int =
    (data[offset].toInt() and 0xFF) or (data[offset + 1].toInt() shl 8)

  private fun u32(data: ByteArray, offset: Int): Int =
    (data[offset].toInt() and 0xFF) or
      (data[offset + 1].toInt() and 0xFF shl 8) or
      (data[offset + 2].toInt() and 0xFF shl 16) or
      (data[offset + 3].toInt() and 0xFF shl 24)
}