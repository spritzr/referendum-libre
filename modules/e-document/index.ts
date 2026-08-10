import { requireNativeModule } from 'expo-modules-core'

// TEST: still works ? was export default requireNativeModule('EDocument')
const EDocumentModule = requireNativeModule('EDocument')

export type PersonDetails = {
  firstName: string | null
  lastName: string | null
  gender: string | null
  dateOfBirth: string | null
  documentExpiryDate: string | null
  documentNumber: string | null
  nationality: string | null
  issuingAuthority: string | null
  passportImageRaw: string | null
}

import type { EventSubscription } from 'expo-modules-core'
import { EventEmitter } from 'expo-modules-core'
import { Platform } from 'react-native'
import { Buffer } from 'buffer'
import type { EDocumentModuleEvents } from './src/enums'
import { EDocument as EDocumentModel } from '@/utils/e-document/e-document'

export async function scanDocument(
  documentType: 'P' | 'I',  // 'P' = Passport, 'I' = ID card
  can: string,
  documentNumber: string,
  dateOfBirth: string,
  dateOfExpiry: string,
): Promise<EDocumentModel> {
  try {
    const eDocumentString = await EDocumentModule.scanDocument(
      documentType,
      can, documentNumber,
      dateOfBirth, dateOfExpiry
    )

    const eDocument = JSON.parse(eDocumentString)
    const fromB64 = (field: string | undefined) => field ? Buffer.from(field, 'base64') : undefined

    if (!eDocument.sod || !eDocument.dg1) {
      throw new Error('Scan incomplet : DG1 ou SOD manquant dans la réponse native')
    }

    return new EDocumentModel({
      docCode: documentType,
      sodBytes: Buffer.from(eDocument.sod, 'base64'),
      dg1Bytes: Buffer.from(eDocument.dg1, 'base64'),
      dg11Bytes: fromB64(eDocument.dg11),
      dg12Bytes: fromB64(eDocument.dg12),
      dg14Bytes: fromB64(eDocument.dg14),
      dg15Bytes: fromB64(eDocument.dg15),
      aaSignature: fromB64(eDocument.aaSignature),
    })
  } catch (error: any) {
    let errorMessage = error.message || 'Unknown error during document scan'

    if (errorMessage.includes('6982') || errorMessage.includes('SECURITY STATUS')) {
      errorMessage =
      "Authentication error. Check CAN, date of birth, date of expiration, and document number\n" +
        "Détail: " + (error.message || 'unknown')
    } else if (errorMessage.includes('NFC')) {
      errorMessage =
        "❌ Erreur NFC\n\n" +
        "Assurez-vous que :\n" +
        "• Le NFC est activé sur votre téléphone\n" +
        "• Vous maintenez le document contre le téléphone pendant toute la lecture\n" +
        "• Le document est bien positionné sur le lecteur NFC\n\n" +
        "Détail: " + (error.message || 'unknown')
    }

    throw new Error(errorMessage)
  }
}

// --- NFC Diagnostic (iOS only) ---

export interface NfcDiagnosticTag {
  index: number
  type: string
  identifier?: string
  initialSelectedAID?: string
  historicalBytes?: string
  applicationData?: string
}

export interface NfcDiagnosticAidProbe {
  name: string
  sw: string
  success: boolean
  responseData?: string
  error?: string
}

export interface NfcDiagnosticCardAccessProbe {
  success: boolean
  step: string
  sw?: string
  dataLength?: number
  dataHex?: string
  error?: string
}

export interface NfcDiagnosticResult {
  tagDetected: boolean
  tags: NfcDiagnosticTag[]
  aidProbeResults: NfcDiagnosticAidProbe[]
  cardAccessProbe?: NfcDiagnosticCardAccessProbe
  logs: string[]
}

export async function testNfcDetection(timeoutSeconds: number = 30): Promise<NfcDiagnosticResult> {
  if (Platform.OS !== 'ios') {
    throw new Error('testNfcDetection is only available on iOS')
  }
  const resultJson = await EDocumentModule.testNfcDetection(timeoutSeconds)
  return JSON.parse(resultJson) as NfcDiagnosticResult
}

export async function testPassportDetection(timeoutSeconds: number = 30): Promise<NfcDiagnosticResult> {
  if (Platform.OS !== 'ios') {
    throw new Error('testPassportDetection is only available on iOS')
  }
  const resultJson = await EDocumentModule.testPassportDetection(timeoutSeconds)
  return JSON.parse(resultJson) as NfcDiagnosticResult
}

const EDocumentModuleEmitter = new EventEmitter(EDocumentModule)

export function EDocumentModuleListener(
  eventName: EDocumentModuleEvents,
  listener: (payload: unknown) => void,
): EventSubscription {
  // FIXME: add event types for module

  // @ts-ignore
  return EDocumentModuleEmitter.addListener(eventName, listener)
}

export function EDocumentModuleRemoveAllListeners(eventName: EDocumentModuleEvents): void {
  // FIXME: add event types for module

  // @ts-ignore
  EDocumentModuleEmitter.removeAllListeners(eventName)
}

export * from './src/enums'
