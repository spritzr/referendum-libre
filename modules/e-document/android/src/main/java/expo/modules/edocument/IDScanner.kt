package expo.modules.edocument

import android.app.Activity
import android.app.PendingIntent
import android.content.Intent
import android.content.pm.ApplicationInfo
import android.nfc.NfcAdapter
import android.nfc.Tag
import android.nfc.tech.IsoDep
import android.os.Build
import android.os.Bundle
import android.util.Base64
import com.google.gson.Gson
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import net.sf.scuba.smartcards.CardService
import org.bouncycastle.asn1.cms.SignedData
import org.jmrtd.BACKey
import org.jmrtd.PACEKeySpec
import org.jmrtd.PassportService
import org.jmrtd.lds.CardAccessFile
import org.jmrtd.lds.PACEInfo
import org.jmrtd.lds.SODFile
import org.jmrtd.lds.icao.DG11File
import org.jmrtd.lds.icao.DG1File

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

@OptIn(ExperimentalStdlibApi::class)
fun SODFile.readASN1Data(): String {
  val a = SODFile::class.java.getDeclaredField("signedData");
  a.isAccessible = true

  val v: SignedData = a.get(this) as SignedData

  val encapsulatedContent =
    v.encapContentInfo.content.toASN1Primitive().encoded!!.toHexString()

  val target = "30"
  val startIndex = encapsulatedContent.indexOf(target)
  return encapsulatedContent.substring(startIndex)
}

private fun cropByteArray(inputByteArray: ByteArray, endNumber: Int): ByteArray {
  val endIndex = if (endNumber > inputByteArray.size) inputByteArray.size else endNumber
  return inputByteArray.copyOfRange(0, endIndex)
}

private fun ByteArray?.toB64(): String? = this?.let { Base64.encodeToString(it, Base64.DEFAULT) }

// ---------------------------------------------------------------------------
// Data types
// ---------------------------------------------------------------------------

data class NFCDocumentModel(
  val dg1: ByteArray? = null,
  val dg11: ByteArray? = null,
  val dg15: ByteArray? = null,
  val sod: ByteArray? = null,
  val aaSignature: ByteArray? = null,
)

data class EDocument(
  var sod: String? = null,
  var dg1: String? = null, // should be encoded base64 string
  var dg11: String? = null, // should be encoded base64 string
  var dg15: String? = null, // should be encoded base64 string — always null on Android, no Active Authentication support
  var aaSignature: String? = null, // should be encoded base64 string — always null on Android, no Active Authentication support
) {
  companion object {
    fun fromNfcDocumentModel(nfcDocumentModel: NFCDocumentModel): EDocument {
      return EDocument(
        dg1 = nfcDocumentModel.dg1.toB64(),
        dg11 = nfcDocumentModel.dg11.toB64(),
        dg15 = nfcDocumentModel.dg15.toB64(),
        sod = nfcDocumentModel.sod.toB64(),
        aaSignature = nfcDocumentModel.aaSignature.toB64(),
      )
    }
  }
}

// ---------------------------------------------------------------------------
// DocumentScanner — PACE/BAC authentication + data group reads
// ---------------------------------------------------------------------------

class DocumentScanner(
  private val isoDep: IsoDep,
  private val documentNumber: String,
  private val dateOfBirth: String,
  private val dateOfExpiry: String,
  private val can: String?,
) {
  val bacKey = BACKey(documentNumber, dateOfBirth, dateOfExpiry)

  /**
   * Authenticates the card: CAN first if one was supplied (needed for French
   * CNIe, which reject the MRZ key), falling back to PACE with the MRZ key,
   * then to BAC/direct access if PACE isn't supported at all.
   */
  private fun authenticate(service: PassportService, onDebugLog: (String) -> Unit) {
    var paceSucceeded = false

    if (!can.isNullOrEmpty()) {
      try {
        onDebugLog("=== PACE Authentication Starting (CAN) ===")
        val canBytes = can.toByteArray(Charsets.US_ASCII)

        onDebugLog("Reading EF_CARD_ACCESS...")
        val cardAccessFile = CardAccessFile(service.getInputStream(PassportService.EF_CARD_ACCESS))
        val securityInfoCollection = cardAccessFile.securityInfos
        onDebugLog("Found ${securityInfoCollection.size} security infos")

        val paceKey = PACEKeySpec(canBytes, 0x02.toByte())
        onDebugLog("PACE Key Type: CAN (0x02)")

        for (securityInfo in securityInfoCollection.toList()) {
          if (securityInfo is PACEInfo) {
            onDebugLog("PACE OID: ${securityInfo.objectIdentifier}")
            onDebugLog("PACE paramId: ${securityInfo.parameterId}")
            onDebugLog("Starting PACE handshake...")
            service.doPACE(
              paceKey,
              securityInfo.objectIdentifier,
              PACEInfo.toParameterSpec(securityInfo.parameterId),
              null
            )
            paceSucceeded = true
            onDebugLog("=== PACE SUCCEEDED (CAN) ===")
          }
        }
      } catch (e: Exception) {
        onDebugLog("[ERROR] PACE with CAN failed: ${e.message}")
        e.printStackTrace()
        // Falls through to the MRZ-key branch below.
      }
    }

    if (!paceSucceeded) {
      try {
        onDebugLog("=== PACE Authentication Starting (MRZ) ===")
        val cardAccessFile = CardAccessFile(service.getInputStream(PassportService.EF_CARD_ACCESS))
        val paceInfo = cardAccessFile.securityInfos.filterIsInstance<PACEInfo>().first()
        val paceKey = PACEKeySpec.createMRZKey(bacKey)
        onDebugLog("PACE OID: ${paceInfo.objectIdentifier}")
        onDebugLog("PACE paramId: ${paceInfo.parameterId}")
        service.doPACE(paceKey, paceInfo.objectIdentifier, PACEInfo.toParameterSpec(paceInfo.parameterId), null)
        paceSucceeded = true
        onDebugLog("=== PACE SUCCEEDED (MRZ) ===")
      } catch (e: Exception) {
        onDebugLog("PACE with MRZ key failed: ${e.message}")
      }
    }

    service.sendSelectApplet(paceSucceeded)
    if (!paceSucceeded) {
      onDebugLog("=== Trying without PACE (BAC fallback) ===")
      try {
        service.getInputStream(PassportService.EF_COM).read()
        onDebugLog("Direct access OK (no auth required)")
      } catch (e: Exception) {
        onDebugLog("Direct access failed, trying BAC...")
        try {
          service.doBAC(bacKey)
          onDebugLog("BAC succeeded")
        } catch (bacError: Exception) {
          throw IllegalStateException(
            "Authentication failed. Try providing the CAN (6 digits) from the back of the card. " +
              "Original error: ${bacError.message}",
            bacError
          )
        }
      }
    }
  }

  fun scan(
    onAuthenticatingWithPassport: () -> Unit = {},
    onReadingDataGroupProgress: () -> Unit = {},
    onSuccessfulRead: () -> Unit = {},
    onDebugLog: (String) -> Unit = {},
  ): NFCDocumentModel {
    onAuthenticatingWithPassport()
    onDebugLog("=== Starting scan ===")

    val rawCardService = CardService.getInstance(isoDep)
    rawCardService.open()
    val cardService = LoggingCardService(rawCardService, onDebugLog)

    val service = PassportService(
      cardService,
      PassportService.NORMAL_MAX_TRANCEIVE_LENGTH,
      PassportService.DEFAULT_MAX_BLOCKSIZE,
      true,
      false
    )
    service.open()

    authenticate(service, onDebugLog)

    onReadingDataGroupProgress()
    // -- DG1 -- //
    onDebugLog("Reading DG1...")
    val dg1File = try {
      val result = DG1File(service.getInputStream(PassportService.EF_DG1))
      onDebugLog("DG1 read OK")
      result
    } catch(e: Exception) {
      onDebugLog("[ERROR] DG1 failed: ${e.message}")
      null
    }

    // -- SOD -- //
    onDebugLog("Reading SOD...")
    val sodIn1 = service.getInputStream(PassportService.EF_SOD)
    val byteArray = ByteArray(1024 * 1024)
    val byteLen = sodIn1.read(byteArray)
    val sod = cropByteArray(byteArray, byteLen)
    val sodFile = SODFile(service.getInputStream(PassportService.EF_SOD))
    onDebugLog("SOD read OK (${byteLen} bytes)")

    // -- DG11 -- //
    onDebugLog("Reading DG11 (additional personal details)...")
    val dg11File = try {
      val dg11In = service.getInputStream(PassportService.EF_DG11)
      val result = DG11File(dg11In)
      onDebugLog("DG11 read OK")
      result
    } catch (e: Exception) {
      onDebugLog("DG11 not available: ${e.message}")
      null
    }

    // DG15 / Active Authentication: unsupported on Android. French CNIe use
    // Chip Authentication via PACE-CAM instead; passports fall back to no-AA.

    onDebugLog("Scan complete!")
    onSuccessfulRead()
    return NFCDocumentModel(
      dg1 = dg1File?.encoded,
      dg11 = dg11File?.encoded,
      sod = sodFile.encoded,
    )
  }
}

// ---------------------------------------------------------------------------
// EDocumentModule — Expo bridge: NFC session lifecycle + JS-facing API
// ---------------------------------------------------------------------------

enum class DocumentScanEvents(val value: String) {
  SCAN_STARTED("SCAN_STARTED"),

  REQUEST_PRESENT_PASSPORT("REQUEST_PRESENT_PASSPORT"),
  AUTHENTICATING_WITH_PASSPORT("AUTHENTICATING_WITH_PASSPORT"),
  READING_DATA_GROUP_PROGRESS("READING_DATA_GROUP_PROGRESS"),
  SUCCESSFUL_READ("SUCCESSFUL_READ"),
  SCAN_ERROR("SCAN_ERROR"),
  DEBUG_LOG("DEBUG_LOG"),

  SCAN_STOPPED("SCAN_STOPPED"),
}

class EDocumentModule : Module() {
  private var nfcAdapter: NfcAdapter? = null

  private var scanPromise: Promise? = null
  private var readerCallback: NfcAdapter.ReaderCallback? = null

  private var documentNumber: String? = null
  private var dateOfBirth: String? = null
  private var dateOfExpiry: String? = null
  private var can: String? = null

  override fun definition() = ModuleDefinition {
    Events(
      DocumentScanEvents.SCAN_STARTED.value,
      DocumentScanEvents.REQUEST_PRESENT_PASSPORT.value,
      DocumentScanEvents.AUTHENTICATING_WITH_PASSPORT.value,
      DocumentScanEvents.READING_DATA_GROUP_PROGRESS.value,
      DocumentScanEvents.SUCCESSFUL_READ.value,
      DocumentScanEvents.SCAN_ERROR.value,
      DocumentScanEvents.DEBUG_LOG.value,
      DocumentScanEvents.SCAN_STOPPED.value,
    )

    Name("EDocument")

    AsyncFunction("scanDocument") {
      _docType: String,
      canParam: String,
      documentNumberParam: String,
      dateOfBirthParam: String,
      dateOfExpiryParam: String,
      promise: Promise
      ->

      val activity = appContext.currentActivity ?: run {
        throw IllegalStateException("No current activity found")
      }

      nfcAdapter = NfcAdapter.getDefaultAdapter(activity)

      if (nfcAdapter == null || !nfcAdapter!!.isEnabled) {
        throw IllegalStateException("NFC is not available or not enabled")
      }

      // If a previous scan is still live, tear it down before starting a new one.
      disableNfcReaderMode(activity)

      documentNumber = documentNumberParam
      dateOfBirth = dateOfBirthParam
      dateOfExpiry = dateOfExpiryParam
      can = canParam.ifEmpty { null }
      scanPromise = promise

      enableNfcReaderMode(activity)
    }

    OnDestroy {
      appContext.currentActivity?.let { disableNfcReaderMode(it) }
    }
  }

  private fun enableNfcReaderMode(activity: Activity) {
    // Reader mode (CoreNFC-equivalent on Android): the callback fires on a
    // dedicated background thread with exclusive IsoDep access, bypassing
    // Android's intent system and main thread entirely. This is what apps
    // that successfully read French CNIe cards on Android use.
    val callback = NfcAdapter.ReaderCallback { tag ->
      scan(tag)
    }
    readerCallback = callback

    val flags =
      NfcAdapter.FLAG_READER_NFC_A or
      NfcAdapter.FLAG_READER_NFC_B or
      NfcAdapter.FLAG_READER_SKIP_NDEF_CHECK

    // Default presence-check delay is aggressive (~125ms) and drops sessions
    // on slight card motion. 2s keeps the session alive through the full PACE
    // + DG read flow.
    val options = Bundle().apply {
      putInt(NfcAdapter.EXTRA_READER_PRESENCE_CHECK_DELAY, 2000)
    }

    nfcAdapter?.enableReaderMode(activity, callback, flags, options)
    sendEvent(DocumentScanEvents.REQUEST_PRESENT_PASSPORT.value)
  }

  private fun disableNfcReaderMode(activity: Activity) {
    if (readerCallback != null) {
      try {
        nfcAdapter?.disableReaderMode(activity)
      } catch (_: Exception) {
        // disableReaderMode can throw if the activity is already torn down; ignore.
      }
      readerCallback = null
      sendEvent(DocumentScanEvents.SCAN_STOPPED.value)

      // Reclaim NFC dispatch for our activity. Without this, Android resumes
      // its default intent dispatch — if the user's card is still near the
      // phone (very common right after a successful scan), other installed
      // NFC apps (Satodime, Yubico, wallets…) win the chooser dialog.
      // Routing stray tag events back into our own activity silently drops
      // them because we do not handle the NFC intent.
      try {
        val intent = Intent(activity, activity.javaClass).apply {
          addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP)
        }
        val piFlags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S)
          PendingIntent.FLAG_MUTABLE
        else
          0
        val pi = PendingIntent.getActivity(activity, 0, intent, piFlags)
        nfcAdapter?.enableForegroundDispatch(activity, pi, null, null)
      } catch (_: Exception) {
        // Activity may be in a weird state — non-fatal.
      }
    }
  }

  private fun scan(tag: Tag) {
    sendEvent(DocumentScanEvents.SCAN_STARTED.value)

    val promise = scanPromise ?: return
    val docNumber = documentNumber
    val dob = dateOfBirth
    val doe = dateOfExpiry
    val activity = appContext.currentActivity

    if (docNumber == null || dob == null || doe == null) {
      scanPromise = null
      promise.reject(CodedException("scan", "Scan parameters missing", null))
      activity?.let { disableNfcReaderMode(it) }
      return
    }

    val isoDep = IsoDep.get(tag)
    if (isoDep == null) {
      scanPromise = null
      promise.reject(CodedException("scan", "Tag does not support IsoDep", null))
      activity?.let { disableNfcReaderMode(it) }
      return
    }

    // Give the card enough time for PACE's crypto round-trips.
    isoDep.timeout = 10_000

    val docScanner = DocumentScanner(isoDep, docNumber, dob, doe, can)

    // DEBUG_LOG forwards raw scan diagnostics (incl. full APDU TX/RX
    // transcripts via LoggingCardService) to JS, where they can reach the
    // in-memory log buffer and a user-mailed error report. Only emit on
    // debuggable builds — never in a release / Play Store build (DPIA R5).
    val debugLoggingEnabled = activity != null &&
      (activity.applicationInfo.flags and ApplicationInfo.FLAG_DEBUGGABLE) != 0

    try {
      val nfcDocument = docScanner.scan(
        onAuthenticatingWithPassport = { sendEvent(DocumentScanEvents.AUTHENTICATING_WITH_PASSPORT.value) },
        onReadingDataGroupProgress = { sendEvent(DocumentScanEvents.READING_DATA_GROUP_PROGRESS.value) },
        onSuccessfulRead = { sendEvent(DocumentScanEvents.SUCCESSFUL_READ.value) },
        onDebugLog = { message ->
          if (debugLoggingEnabled) {
            sendEvent(DocumentScanEvents.DEBUG_LOG.value, mapOf("message" to message))
          }
        },
      )

      val eDocument = EDocument.fromNfcDocumentModel(nfcDocument)
      val eDocumentJson = Gson().toJson(eDocument)
      scanPromise = null
      promise.resolve(eDocumentJson)
    } catch (e: Exception) {
      scanPromise = null
      sendEvent(DocumentScanEvents.SCAN_ERROR.value)
      promise.reject(CodedException("scan", e.message, e))
    } finally {
      activity?.let { disableNfcReaderMode(it) }
    }
  }
}
