package com.garsonistakiosk

import android.annotation.SuppressLint
import android.util.Log
import com.dantsu.escposprinter.EscPosPrinter
import com.dantsu.escposprinter.connection.DeviceConnection
import com.dantsu.escposprinter.connection.bluetooth.BluetoothPrintersConnections
import com.dantsu.escposprinter.connection.usb.UsbPrintersConnections
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class ThermalPrintingModule(reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {
  companion object {
    private const val TAG = "ThermalPrinting"
  }

  override fun getName(): String = "ThermalPrinting"

  @SuppressLint("MissingPermission")
  @ReactMethod
  fun printTextToThermal(text: String, promise: Promise) {
    try {
      Log.d(TAG, "printTextToThermal called. textLength=${text.length}")
      val connection = resolveConnection()
      if (connection == null) {
        Log.e(TAG, "No thermal printer connection found (USB/Bluetooth)")
        promise.reject("E_PRINTER_NOT_FOUND", "No thermal printer connection found (USB/Bluetooth).")
        return
      }

      Log.d(TAG, "Connection resolved: ${connection.javaClass.simpleName}")
      val printer = EscPosPrinter(
        connection,
        203,
        48f,
        32
      )

      printer.printFormattedTextAndCut(text)
      Log.d(TAG, "printFormattedTextAndCut completed")
      connection.disconnect()
      promise.resolve(null)
    } catch (error: Exception) {
      Log.e(TAG, "Printing failed: ${error.message}", error)
      promise.reject("E_PRINTER_PRINT", error.message, error)
    }
  }

  private fun resolveConnection(): DeviceConnection? {
    val usbConnection = UsbPrintersConnections.selectFirstConnected(reactApplicationContext)
    if (usbConnection != null) {
      Log.d(TAG, "Using USB printer connection")
      return usbConnection
    }

    val bluetoothConnection = BluetoothPrintersConnections.selectFirstPaired()
    if (bluetoothConnection != null) {
      Log.d(TAG, "Using Bluetooth paired printer connection")
    } else {
      Log.d(TAG, "No Bluetooth paired printer connection found")
    }
    return bluetoothConnection
  }
}
