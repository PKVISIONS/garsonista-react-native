package com.garsonistakiosk

import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.util.Log
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.sunmi.peripheral.printer.InnerPrinterCallback
import com.sunmi.peripheral.printer.InnerPrinterManager
import com.sunmi.peripheral.printer.InnerResultCallback
import com.sunmi.peripheral.printer.SunmiPrinterService
import java.util.concurrent.atomic.AtomicBoolean
import java.nio.charset.Charset

class SunmiPrinterModule(private val reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  private val tag = "SunmiPrinterModule"
  private var printerService: SunmiPrinterService? = null
  private val binding = AtomicBoolean(false)

  private enum class LineAlign { LEFT, CENTER }
  private enum class LineSize { NORMAL, LARGE, XLARGE }

  /** Sunmi 80mm internal printer — 576 dots at 203 DPI. */
  private val bitmapWidth = 576
  private val hMargin = 10f
  private val splitGap = 8f

  private data class ParsedLine(
    val align: LineAlign,
    val bold: Boolean,
    val size: LineSize,
    val left: String,
    val right: String?,
  )

  private val callback = object : InnerPrinterCallback() {
    override fun onConnected(service: SunmiPrinterService) {
      Log.d(tag, "Sunmi printer connected")
      printerService = service
      binding.set(false)
    }

    override fun onDisconnected() {
      Log.w(tag, "Sunmi printer disconnected")
      printerService = null
      binding.set(false)
    }
  }

  override fun getName(): String = "SunmiPrinter"

  private fun ensureConnected(promise: Promise): SunmiPrinterService? {
    printerService?.let { return it }

    if (binding.compareAndSet(false, true)) {
      try {
        InnerPrinterManager.getInstance().bindService(
          reactApplicationContext.currentActivity ?: reactApplicationContext,
          callback
        )
        for (attempt in 0 until 10) {
          if (printerService != null) {
            break
          }
          Thread.sleep(100)
        }
      } catch (e: Exception) {
        binding.set(false)
        promise.reject("SUNMI_BIND_FAILED", e.message, e)
        return null
      }
    }

    return printerService
  }

  @ReactMethod
  fun isReady(promise: Promise) {
    promise.resolve(printerService != null)
  }

  @ReactMethod
  fun printRaw(rawBytes: ReadableArray, promise: Promise) {
    val service = ensureConnected(promise) ?: return
    val bytes = ByteArray(rawBytes.size())
    for (index in 0 until rawBytes.size()) {
      bytes[index] = rawBytes.getInt(index).toByte()
    }

    try {
      service.sendRAWData(bytes, object : InnerResultCallback() {
        override fun onRunResult(isSuccess: Boolean) {
          if (isSuccess) promise.resolve(true) else promise.reject("SUNMI_PRINT_FAILED", "sendRAWData returned false")
        }

        override fun onReturnString(result: String?) {
          promise.resolve(result ?: true)
        }

        override fun onRaiseException(code: Int, msg: String?) {
          promise.reject("SUNMI_PRINT_ERROR_$code", msg)
        }

        override fun onPrintResult(code: Int, msg: String?) {
          if (code == 0) {
            promise.resolve(true)
          } else {
            promise.reject("SUNMI_PRINT_ERROR_$code", msg)
          }
        }
      })
    } catch (e: Exception) {
      promise.reject("SUNMI_PRINT_EXCEPTION", e.message, e)
    }
  }

  @ReactMethod
  fun setAlignment(alignment: Int, promise: Promise) {
    val service = ensureConnected(promise) ?: return
    try {
      service.setAlignment(alignment, null)
      promise.resolve(true)
    } catch (e: Exception) {
      promise.reject("SUNMI_ALIGNMENT_EXCEPTION", e.message, e)
    }
  }

  @ReactMethod
  fun printText(text: String, promise: Promise) {
    val service = ensureConnected(promise) ?: return
    try {
      service.printerInit(null)
      service.sendRAWData(byteArrayOf(0x1B, 0x74, 17), null)
      val charset = Charset.forName("windows-1253")
      val normalized = text.replace("\r\n", "\n").replace('\r', '\n')
      normalized.split('\n').forEach { line ->
        val bytes = line.toByteArray(charset)
        service.sendRAWData(bytes + byteArrayOf(0x0A), null)
      }
      promise.resolve(true)
    } catch (e: Exception) {
      promise.reject("SUNMI_PRINT_TEXT_EXCEPTION", e.message, e)
    }
  }

  @ReactMethod
  fun printBitmapText(text: String, promise: Promise) {
    val service = ensureConnected(promise) ?: return
    try {
      service.printerInit(null)
      val bitmap = renderTextBitmap(text)
      service.printBitmap(bitmap, null)
      service.lineWrap(2, null)
      promise.resolve(true)
    } catch (e: Exception) {
      promise.reject("SUNMI_PRINT_BITMAP_EXCEPTION", e.message, e)
    }
  }

  @ReactMethod
  fun printQRCode(data: String, moduleSize: Int, errorLevel: Int, promise: Promise) {
    val service = ensureConnected(promise) ?: return
    try {
      service.printQRCode(data, moduleSize, errorLevel, object : InnerResultCallback() {
        override fun onRunResult(isSuccess: Boolean) {
          if (isSuccess) promise.resolve(true) else promise.reject("SUNMI_PRINT_QR_FAILED", "printQRCode returned false")
        }

        override fun onReturnString(result: String?) {
          promise.resolve(result ?: true)
        }

        override fun onRaiseException(code: Int, msg: String?) {
          promise.reject("SUNMI_PRINT_QR_ERROR_$code", msg)
        }

        override fun onPrintResult(code: Int, msg: String?) {
          if (code == 0) {
            promise.resolve(true)
          } else {
            promise.reject("SUNMI_PRINT_QR_ERROR_$code", msg)
          }
        }
      })
    } catch (e: Exception) {
      promise.reject("SUNMI_PRINT_QR_EXCEPTION", e.message, e)
    }
  }

  /** `{C|L}{B|.}{n|l|x}text` or `{C|L}{B|.}{n|l|x}left\tright` */
  private fun parseLine(raw: String): ParsedLine? {
    if (raw.length < 4) return null
    val alignChar = raw[0]
    if (alignChar != 'C' && alignChar != 'L') return null
    val boldChar = raw[1]
    if (boldChar != 'B' && boldChar != '.') return null
    val sizeChar = raw[2]
    if (sizeChar != 'n' && sizeChar != 'l' && sizeChar != 'x') return null

    val content = raw.substring(3)
    val tab = content.indexOf('\t')
    val left = if (tab >= 0) content.substring(0, tab) else content
    val right = if (tab >= 0) content.substring(tab + 1) else null

    return ParsedLine(
      align = if (alignChar == 'C') LineAlign.CENTER else LineAlign.LEFT,
      bold = boldChar == 'B',
      size = when (sizeChar) {
        'l' -> LineSize.LARGE
        'x' -> LineSize.XLARGE
        else -> LineSize.NORMAL
      },
      left = left,
      right = right,
    )
  }

  private fun textSizeFor(size: LineSize): Float {
    return when (size) {
      LineSize.NORMAL -> 22f
      LineSize.LARGE -> 28f
      LineSize.XLARGE -> 36f
    }
  }

  private fun fitSingleLine(paint: Paint, text: String, maxWidth: Float, baseSize: Float): String {
    var size = baseSize
    paint.textSize = size
    while (size > 14f && paint.measureText(text) > maxWidth) {
      size -= 1f
      paint.textSize = size
    }
    return text
  }

  private fun ellipsizeLeft(paint: Paint, text: String, maxWidth: Float): String {
    if (paint.measureText(text) <= maxWidth) return text
    var trimmed = text
    val ellipsis = "…"
    while (trimmed.length > 1 && paint.measureText(trimmed + ellipsis) > maxWidth) {
      trimmed = trimmed.dropLast(1)
    }
    return trimmed.trimEnd() + ellipsis
  }

  private fun isRuleLine(text: String): Boolean {
    val t = text.trim()
    return t.isNotEmpty() && t.all { it == '-' }
  }

  private fun lineHeightFor(paint: Paint): Int {
    val metrics = paint.fontMetrics
    return (metrics.bottom - metrics.top + 10f).toInt().coerceAtLeast(28)
  }

  private fun applyPaintStyle(paint: Paint, parsed: ParsedLine) {
    paint.textSize = textSizeFor(parsed.size)
    paint.typeface = android.graphics.Typeface.create(
      android.graphics.Typeface.SANS_SERIF,
      if (parsed.bold) android.graphics.Typeface.BOLD else android.graphics.Typeface.NORMAL
    )
  }

  private fun drawRule(canvas: Canvas, y: Float, width: Int) {
    val rulePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
      color = Color.BLACK
      strokeWidth = 1.5f
    }
    canvas.drawLine(hMargin, y, width - hMargin, y, rulePaint)
  }

  private fun renderTextBitmap(text: String): Bitmap {
    val width = bitmapWidth
    val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
      color = Color.BLACK
    }

    val rawLines = text.replace("\r\n", "\n").replace('\r', '\n').split('\n')
      .dropWhile { it.isBlank() }
    val parsedLines = rawLines.map { raw ->
      parseLine(raw) ?: ParsedLine(
        align = LineAlign.LEFT,
        bold = false,
        size = LineSize.NORMAL,
        left = raw,
        right = null,
      )
    }

    applyPaintStyle(paint, parsedLines.firstOrNull() ?: ParsedLine(LineAlign.LEFT, false, LineSize.NORMAL, "", null))
    val defaultHeight = lineHeightFor(paint)
    val height = (parsedLines.size * defaultHeight + 40).coerceAtLeast(120)
    val bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
    val canvas = Canvas(bitmap)
    canvas.drawColor(Color.WHITE)

    var y = 18f - paint.fontMetrics.top
    for (parsed in parsedLines) {
      if (parsed.left.isBlank() && parsed.right.isNullOrBlank()) {
        y += (defaultHeight / 3).toFloat()
        continue
      }
      applyPaintStyle(paint, parsed)
      val h = lineHeightFor(paint)
      val contentWidth = width - hMargin * 2

      if (isRuleLine(parsed.left)) {
        drawRule(canvas, y - 4f, width)
      } else if (parsed.right != null) {
        val rightWidth = paint.measureText(parsed.right)
        val maxLeft = contentWidth - rightWidth - splitGap
        val leftText = ellipsizeLeft(paint, parsed.left, maxLeft)
        canvas.drawText(leftText, hMargin, y, paint)
        canvas.drawText(parsed.right, width - hMargin - rightWidth, y, paint)
      } else if (parsed.align == LineAlign.CENTER) {
        fitSingleLine(paint, parsed.left, contentWidth, textSizeFor(parsed.size))
        val lineWidth = paint.measureText(parsed.left)
        val x = (width - lineWidth) / 2f
        canvas.drawText(parsed.left, x, y, paint)
      } else {
        val leftText = ellipsizeLeft(paint, parsed.left, contentWidth)
        canvas.drawText(leftText, hMargin, y, paint)
      }

      y += h
    }
    return bitmap
  }

  @ReactMethod
  fun cutPaper(promise: Promise) {
    val service = ensureConnected(promise) ?: return
    try {
      service.cutPaper(object : InnerResultCallback() {
        override fun onRunResult(isSuccess: Boolean) {
          if (isSuccess) promise.resolve(true) else promise.reject("SUNMI_CUT_FAILED", "cutPaper returned false")
        }

        override fun onReturnString(result: String?) {
          promise.resolve(result ?: true)
        }

        override fun onRaiseException(code: Int, msg: String?) {
          promise.reject("SUNMI_CUT_ERROR_$code", msg)
        }

        override fun onPrintResult(code: Int, msg: String?) {
          if (code == 0) {
            promise.resolve(true)
          } else {
            promise.reject("SUNMI_CUT_ERROR_$code", msg)
          }
        }
      })
    } catch (e: Exception) {
      promise.reject("SUNMI_CUT_EXCEPTION", e.message, e)
    }
  }
}
