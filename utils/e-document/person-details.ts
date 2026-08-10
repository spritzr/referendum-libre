/**
 * Computes `PersonDetails` in JS from raw DG1 bytes, replacing the two
 * separate native parsers (Android jmrtd `MRZInfo`, iOS `DataGroup1` Swift
 * port) that had already drifted from each other.
 *
 * dg1Bytes is the raw ASN.1 TLV blob read off the chip:
 *   [tag 0x61][length][tag 0x5F1F][length][MRZ ASCII bytes]
 * We strip that TLV wrapper to get the MRZ bytes, decode to a string, split
 * into fixed-width lines by document type, then hand off to the `mrz`
 * package for the actual per-field ICAO parsing + checksum validation.
 */

import { parse as parseMrz } from 'mrz'

import type { PersonDetails } from '@/modules/e-document'

const DG1_MRZ_TAG = 0x5f1f

function readTag(bytes: Uint8Array, pos: number): { tag: number; next: number } {
  const first = bytes[pos]
  if ((first & 0x1f) === 0x1f) {
    let tag = first
    let next = pos + 1
    while (bytes[next] & 0x80) {
      tag = (tag << 8) | bytes[next]
      next += 1
    }
    tag = (tag << 8) | bytes[next]
    next += 1
    return { tag, next }
  }
  return { tag: first, next: pos + 1 }
}

function readLength(bytes: Uint8Array, pos: number): { length: number; next: number } {
  const first = bytes[pos]
  if ((first & 0x80) === 0) return { length: first, next: pos + 1 }
  const numBytes = first & 0x7f
  let length = 0
  for (let i = 0; i < numBytes; i++) length = (length << 8) | bytes[pos + 1 + i]
  return { length, next: pos + 1 + numBytes }
}

function extractMrzString(dg1Bytes: Uint8Array): string {
  const { next: afterOuterTag } = readTag(dg1Bytes, 0)
  const { next: afterOuterLength } = readLength(dg1Bytes, afterOuterTag)

  const { tag, next: afterTag } = readTag(dg1Bytes, afterOuterLength)
  const { length, next: afterLength } = readLength(dg1Bytes, afterTag)
  if (tag !== DG1_MRZ_TAG) {
    throw new Error(`computePersonDetails: expected DG1 tag 0x5F1F, got 0x${tag.toString(16)}`)
  }

  return Buffer.from(dg1Bytes.slice(afterLength, afterLength + length)).toString('utf-8')
}

function splitMrzLines(mrz: string): string[] {
  if (mrz.length === 90) return [mrz.slice(0, 30), mrz.slice(30, 60), mrz.slice(60, 90)] // TD1
  if (mrz.length === 72) return [mrz.slice(0, 36), mrz.slice(36, 72)] // TD2
  if (mrz.length === 88) return [mrz.slice(0, 44), mrz.slice(44, 88)] // TD3
  throw new Error(`computePersonDetails: unrecognised MRZ length ${mrz.length}`)
}

export function computePersonDetails(dg1Bytes: Uint8Array): PersonDetails {
  const mrzString = extractMrzString(dg1Bytes)
  const lines = splitMrzLines(mrzString)
  const { fields } = parseMrz(lines, { autocorrect: true })

  return {
    firstName: fields.firstName ?? null,
    lastName: fields.lastName ?? null,
    gender: fields.sex ?? null,
    dateOfBirth: fields.birthDate ?? null,
    documentExpiryDate: fields.expirationDate ?? null,
    documentNumber: fields.documentNumber ?? null,
    nationality: fields.nationality ?? null,
    issuingAuthority: fields.issuingState ?? null,
    passportImageRaw: null,
  }
}
