import { ProjPointType } from '@noble/curves/abstract/weierstrass'
import { ECParameters } from '@peculiar/asn1-ecc'
import { id_pkcs_1, RSAPublicKey } from '@peculiar/asn1-rsa'
import { AsnConvert } from '@peculiar/asn1-schema'
import { Certificate, SubjectPublicKeyInfo } from '@peculiar/asn1-x509'
import { toBeArray } from 'ethers'
import forge from 'node-forge'

import { ECDSA_ALGO_PREFIX } from '../sod'
import { getPublicKeyFromEcParameters } from './crypto'

/**
 * Decrypts the AA signature using RSA public key and returns the inferred hash algorithm.
 * @param aaPubKey - RSAPublicKey object with modulus and publicExponent.
 * @param aaSignature - Signature to be decrypted (Uint8Array or Buffer).
 * @returns Hash algorithm name string (e.g., 'SHA256') or throws if invalid.
 */
export function figureOutRSAAAHashAlgorithm(
  aaPubKey: RSAPublicKey,
  aaSignature: Uint8Array,
): string | null {
  // Convert RSA modulus and exponent to BigIntegers
  const modulusHex = Buffer.from(aaPubKey.modulus).toString('hex')
  const exponentHex = Buffer.from(aaPubKey.publicExponent).toString('hex')

  const n = new forge.jsbn.BigInteger(modulusHex, 16)
  const e = new forge.jsbn.BigInteger(exponentHex, 16)

  // Convert signature to BigInteger
  const sigBigInt = new forge.jsbn.BigInteger(Buffer.from(aaSignature).toString('hex'), 16)

  // Decrypt: m = sig^e mod n
  let decryptedBytes = Buffer.from(sigBigInt.modPow(e, n).toByteArray())

  // Remove leading 0x00 if present
  if (decryptedBytes[0] === 0x00) {
    decryptedBytes = decryptedBytes.subarray(1)
  }

  if (decryptedBytes.length < 2) {
    return null
  }

  // Get trailing flag byte
  let flagByte = decryptedBytes[decryptedBytes.length - 1]
  if (flagByte === 0xcc) {
    flagByte = decryptedBytes[decryptedBytes.length - 2]
  }

  switch (flagByte) {
    case 0x33:
    case 0xbc:
      return 'SHA1'
    case 0x34:
      return 'SHA256'
    case 0x35:
      return 'SHA512'
    case 0x36:
      return 'SHA384'
    case 0x38:
      return 'SHA224'
    default:
      return 'SHA256' // fallback/default
  }
}

export function extractPubKey(spki: SubjectPublicKeyInfo): RSAPublicKey | ProjPointType<bigint> {
  const certPubKeyAlgo = spki.algorithm.algorithm

  if (certPubKeyAlgo.includes(id_pkcs_1)) {
    return AsnConvert.parse(spki.subjectPublicKey, RSAPublicKey)
  }

  if (certPubKeyAlgo.includes(ECDSA_ALGO_PREFIX)) {
    if (!spki.algorithm.parameters) throw new TypeError('ECDSA public key does not have parameters')

    const ecParameters = AsnConvert.parse(spki.algorithm.parameters, ECParameters)

    const [publicKey] = getPublicKeyFromEcParameters(
      ecParameters,
      new Uint8Array(spki.subjectPublicKey),
    )

    return publicKey
  }

  throw new TypeError(`Unsupported public key algorithm: ${certPubKeyAlgo}`)
}

export function extractRawPubKey(certificate: Certificate): Uint8Array {
  const pubKey = extractPubKey(certificate.tbsCertificate.subjectPublicKeyInfo)

  if (pubKey instanceof RSAPublicKey) {
    const certPubKey = new Uint8Array(pubKey.modulus)

    return certPubKey[0] === 0x00 ? certPubKey.slice(1) : certPubKey
  }

  // ECDSA public key is a point on the curve. Use the affine `.x` / `.y`
  // getters — `.px` / `.py` are deprecated projective aliases that, on
  // Hermes, return the unreduced projective representation (different bytes
  // from the cert's affine coordinates).
  const certPubKey = new Uint8Array([...toBeArray(pubKey.x), ...toBeArray(pubKey.y)])

  return certPubKey[0] === 0x00 ? certPubKey.slice(1) : certPubKey
}
