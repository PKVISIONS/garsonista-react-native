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

  private fun renderTextBitmap(text: String): Bitmap {
    val width = 384
    val scale = reactApplicationContext.resources.displayMetrics.density
    val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
      color = Color.BLACK
      textSize = 18f * scale
      typeface = android.graphics.Typeface.create(android.graphics.Typeface.SANS_SERIF, android.graphics.Typeface.NORMAL)
    }
    val metrics = paint.fontMetrics
    val lineHeight = (metrics.bottom - metrics.top + 10f).toInt().coerceAtLeast(28)
    val lines = text.replace("\r\n", "\n").replace('\r', '\n').split('\n')
    val height = (lines.size * lineHeight + 40).coerceAtLeast(120)
    val bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
    val canvas = Canvas(bitmap)
    canvas.drawColor(Color.WHITE)

    var y = 28f - metrics.top
    for (line in lines) {
      canvas.drawText(line, 16f, y, paint)
      y += lineHeight
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
