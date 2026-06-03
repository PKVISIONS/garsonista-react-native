package com.garsonistakiosk

import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.hardware.usb.UsbDevice
import android.hardware.usb.UsbManager
import android.os.Build
import android.util.Log
import com.dantsu.escposprinter.connection.usb.UsbConnection
import com.dantsu.escposprinter.connection.usb.UsbConnections
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.bridge.WritableArray
import com.facebook.react.bridge.WritableMap

class ThermalPrinterModule(private val reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  private val tag = "ThermalPrinterModule"
  private val permissionAction = "com.garsonistakiosk.USB_PRINTER_PERMISSION"

  override fun getName(): String = "ThermalPrinter"

  private fun usbConnections(): Array<UsbConnection> {
    return UsbConnections(reactContext).list ?: emptyArray()
  }

  private fun describeDevice(device: UsbDevice): String {
    return "deviceId=${device.deviceId} vendorId=${device.vendorId} productId=${device.productId} " +
      "class=${device.deviceClass} product=${device.productName ?: "unknown"} " +
      "manufacturer=${device.manufacturerName ?: "unknown"}"
  }

  private fun printerInfo(connection: UsbConnection): WritableMap {
    val device = connection.device
    return Arguments.createMap().apply {
      putInt("deviceId", device.deviceId)
      putInt("vendorId", device.vendorId)
      putInt("productId", device.productId)
      putString("productName", device.productName)
      putString("manufacturerName", device.manufacturerName)
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
        try {
          putString("serialNumber", device.serialNumber)
        } catch (_: SecurityException) {
          putString("serialNumber", null)
        }
      }
    }
  }

  private fun findConnection(deviceId: Int?): UsbConnection? {
    val connections = usbConnections()
    if (connections.isEmpty()) {
      return null
    }
    if (deviceId == null || deviceId <= 0) {
      return connections.firstOrNull()
    }
    return connections.firstOrNull { it.device.deviceId == deviceId }
  }

  private fun bytesFromArray(rawBytes: ReadableArray): ByteArray {
    val bytes = ByteArray(rawBytes.size())
    for (index in 0 until rawBytes.size()) {
      bytes[index] = rawBytes.getInt(index).toByte()
    }
    return bytes
  }

  private fun requestPermission(device: UsbDevice, promise: Promise) {
    val usbManager = reactContext.getSystemService(Context.USB_SERVICE) as? UsbManager
    if (usbManager == null) {
      promise.reject("THERMAL_USB_UNAVAILABLE", "UsbManager unavailable")
      return
    }

    val appContext = reactContext.applicationContext
    val receiver = object : BroadcastReceiver() {
      override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != permissionAction) {
          return
        }
        try {
          appContext.unregisterReceiver(this)
        } catch (_: Exception) {
          // Already unregistered.
        }
        val granted = intent.getBooleanExtra(UsbManager.EXTRA_PERMISSION_GRANTED, false)
        promise.resolve(granted)
      }
    }

    val filter = IntentFilter(permissionAction)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      appContext.registerReceiver(receiver, filter, Context.RECEIVER_NOT_EXPORTED)
    } else {
      appContext.registerReceiver(receiver, filter)
    }

    val intent = Intent(permissionAction).setPackage(appContext.packageName)
    var flags = PendingIntent.FLAG_UPDATE_CURRENT
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      flags = flags or PendingIntent.FLAG_MUTABLE
    }
    val permissionIntent = PendingIntent.getBroadcast(appContext, 0, intent, flags)
    usbManager.requestPermission(device, permissionIntent)
  }

  @ReactMethod
  fun listPrinters(promise: Promise) {
    try {
      val printers: WritableArray = Arguments.createArray()
      val connections = usbConnections()
      Log.d(tag, "USB ESC/POS list found ${connections.size} device(s)")
      for (connection in connections) {
        Log.d(tag, "USB device: ${describeDevice(connection.device)}")
        printers.pushMap(printerInfo(connection))
      }
      promise.resolve(printers)
    } catch (e: Exception) {
      promise.reject("THERMAL_LIST_FAILED", e.message, e)
    }
  }

  @ReactMethod
  fun isReady(promise: Promise) {
    val connections = usbConnections()
    Log.d(tag, "USB ESC/POS ready=${connections.isNotEmpty()} count=${connections.size}")
    promise.resolve(connections.isNotEmpty())
  }

  @ReactMethod
  fun requestUsbPermission(deviceId: Int, promise: Promise) {
    val connection = findConnection(deviceId)
    if (connection == null) {
      promise.reject("THERMAL_DEVICE_NOT_FOUND", "No DantSu USB ESC/POS printer found")
      return
    }

    val usbManager = reactContext.getSystemService(Context.USB_SERVICE) as? UsbManager
    if (usbManager == null) {
      promise.reject("THERMAL_USB_UNAVAILABLE", "UsbManager unavailable")
      return
    }
    if (usbManager.hasPermission(connection.device)) {
      promise.resolve(true)
      return
    }
    requestPermission(connection.device, promise)
  }

  @ReactMethod
  fun printRaw(rawBytes: ReadableArray, promise: Promise) {
    val connection = findConnection(null)
    if (connection == null) {
      promise.reject("THERMAL_DEVICE_NOT_FOUND", "No DantSu USB ESC/POS printer found")
      return
    }

    val usbManager = reactContext.getSystemService(Context.USB_SERVICE) as? UsbManager
    if (usbManager == null) {
      promise.reject("THERMAL_USB_UNAVAILABLE", "UsbManager unavailable")
      return
    }
    if (!usbManager.hasPermission(connection.device)) {
      promise.reject(
        "THERMAL_USB_PERMISSION_REQUIRED",
        "USB permission required for printer deviceId=${connection.device.deviceId}",
      )
      return
    }

    try {
      val bytes = bytesFromArray(rawBytes)
      Log.d(tag, "Printing ${bytes.size} raw ESC/POS bytes through DantSu USB")
      connection.connect()
      connection.write(bytes)
      connection.send()
      connection.disconnect()
      promise.resolve(true)
    } catch (e: Exception) {
      try {
        connection.disconnect()
      } catch (_: Exception) {
        // Ignore disconnect cleanup failures.
      }
      promise.reject("THERMAL_PRINT_FAILED", e.message, e)
    }
  }

  @ReactMethod
  fun printRawToDevice(rawBytes: ReadableArray, deviceId: Int, promise: Promise) {
    val connection = findConnection(deviceId)
    if (connection == null) {
      promise.reject("THERMAL_DEVICE_NOT_FOUND", "No DantSu USB ESC/POS printer found for deviceId=$deviceId")
      return
    }

    val usbManager = reactContext.getSystemService(Context.USB_SERVICE) as? UsbManager
    if (usbManager == null) {
      promise.reject("THERMAL_USB_UNAVAILABLE", "UsbManager unavailable")
      return
    }
    if (!usbManager.hasPermission(connection.device)) {
      promise.reject(
        "THERMAL_USB_PERMISSION_REQUIRED",
        "USB permission required for ${describeDevice(connection.device)}",
      )
      return
    }

    try {
      val bytes = bytesFromArray(rawBytes)
      Log.d(tag, "Printing ${bytes.size} raw ESC/POS bytes through DantSu USB ${describeDevice(connection.device)}")
      connection.connect()
      connection.write(bytes)
      connection.send()
      connection.disconnect()
      promise.resolve(true)
    } catch (e: Exception) {
      try {
        connection.disconnect()
      } catch (_: Exception) {
        // Ignore disconnect cleanup failures.
      }
      Log.e(tag, "DantSu USB print failed for deviceId=$deviceId", e)
      promise.reject("THERMAL_PRINT_FAILED", e.message, e)
    }
  }
}
