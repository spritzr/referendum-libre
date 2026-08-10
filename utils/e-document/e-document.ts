import type { PersonDetails } from '@/modules/e-document'

import { computePersonDetails } from './person-details'
import { Sod } from './sod'

export type { PersonDetails }

export enum DocType {
  ID = 'ID',
  PASSPORT = 'PASSPORT',
}

export class EDocument {
  docCode: string
  personDetails: PersonDetails
  sodBytes: Uint8Array
  dg1Bytes: Uint8Array
  dg11Bytes?: Uint8Array
  dg12Bytes?: Uint8Array
  dg14Bytes?: Uint8Array
  dg15Bytes?: Uint8Array
  aaSignature?: Uint8Array

  constructor(params: {
    docCode: string
    sodBytes: Uint8Array
    dg1Bytes: Uint8Array
    dg11Bytes?: Uint8Array
    dg12Bytes?: Uint8Array
    dg14Bytes?: Uint8Array
    dg15Bytes?: Uint8Array
    aaSignature?: Uint8Array
  }) {
    this.docCode = params.docCode
    this.personDetails = computePersonDetails(params.dg1Bytes)
    this.sodBytes = params.sodBytes
    this.dg1Bytes = params.dg1Bytes
    this.dg11Bytes = params.dg11Bytes
    this.dg12Bytes = params.dg12Bytes
    this.dg14Bytes = params.dg14Bytes
    this.dg15Bytes = params.dg15Bytes
    this.aaSignature = params.aaSignature
  }

  get sod(): Sod {
    return new Sod(this.sodBytes)
  }

  get docType(): 'ID' | 'PASSPORT' {
    if (this.docCode.includes('I')) {
      return DocType.ID
    }

    if (this.docCode.includes('P')) {
      return DocType.PASSPORT
    }

    throw new TypeError('Unsupported document type')
  }
}
