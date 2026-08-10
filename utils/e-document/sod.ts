import { SOD } from '@li0ard/tsemrtd'
import { LDSObject } from '@li0ard/tsemrtd/dist/asn1/sod'
import {
  CertificateSet,
  ContentInfo,
  id_signedData,
  SignedData,
  SignerInfos,
} from '@peculiar/asn1-cms'
import { AsnConvert, AsnSerializer } from '@peculiar/asn1-schema'
import { Certificate } from '@peculiar/asn1-x509'
import { fromBER, Set } from 'asn1js'
import { Buffer } from 'buffer'

import { ExtendedCertificate } from './extended-cert'
import { extractRawPubKey } from './helpers/misc'

// TODO: maybe move remove
export const ECDSA_ALGO_PREFIX = '1.2.840.10045'

export class Sod {
  private sodBytes: Uint8Array
  private certSet: CertificateSet

  public ldsObject: LDSObject
  signatures: SignerInfos

  constructor(readonly sod: Uint8Array) {
    this.sodBytes = sod

    const { certificates, ldsObject, signatures } = SOD.load(Buffer.from(sod))

    this.ldsObject = ldsObject
    this.certSet = certificates
    this.signatures = signatures
  }

  get valueBlockBytes(): Uint8Array {
    const { result } = fromBER(this.sodBytes)

    return new Uint8Array(result.valueBlock.toBER())
  }

  get slaveCertificate(): ExtendedCertificate {
    if (!this.certSet[0].certificate) {
      throw new TypeError('No certificate found in SOD')
    }

    return new ExtendedCertificate(this.certSet[0].certificate)
  }

  static getSlaveCertIcaoMemberKey(masterCert: Certificate): Uint8Array {
    return extractRawPubKey(masterCert)
  }

  /** Works */
  get encapsulatedContent(): Uint8Array {
    const contentInfo = AsnConvert.parse(this.valueBlockBytes, ContentInfo)

    if (contentInfo.contentType !== id_signedData) {
      throw new TypeError(
        `Invalid ContentType: Expected ${id_signedData} (SignedData), but got ${contentInfo.contentType}`,
      )
    }

    const signedData = AsnConvert.parse(contentInfo.content, SignedData)

    return new Uint8Array(signedData.encapContentInfo.eContent?.single?.buffer || [])
  }

  get signedData(): SignedData {
    const contentInfo = AsnConvert.parse(this.valueBlockBytes, ContentInfo)

    if (contentInfo.contentType !== id_signedData) {
      throw new TypeError(
        `Invalid ContentType: Expected ${id_signedData} (SignedData), but got ${contentInfo.contentType}`,
      )
    }

    const signedData = AsnConvert.parse(contentInfo.content, SignedData)

    if (!signedData.signerInfos || signedData.signerInfos.length === 0) {
      throw new TypeError('No signerInfos found in SignedData')
    }

    return signedData
  }

  /** Works */
  get signedAttributes(): Uint8Array {
    const signerInfo = this.signedData.signerInfos[0]

    if (!signerInfo.signedAttrs?.length) {
      throw new TypeError('No signed attributes found in SignerInfo')
    }

    /* ----- The usual ICAO case: sign over the SET of attributes ----------- */
    // Convert signed attributes to a SET structure using AsnConvert
    const attrsSet = new Set({
      value: signerInfo.signedAttrs.map(a => AsnSerializer.toASN(a)), // ⇐ ASN.1 objects
    })

    return new Uint8Array(attrsSet.toBER(false)) // DER-encoded
  }

  /** TODO: mb remove */
  get signature(): Uint8Array {
    const signerInfo = this.signedData.signerInfos[0]

    if (!signerInfo.signature) {
      throw new TypeError('No signature found in SignerInfo')
    }
    return new Uint8Array(signerInfo.signature.buffer)
  }

}
