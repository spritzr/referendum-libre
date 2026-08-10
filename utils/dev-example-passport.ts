// Dev-mode fixture loader. Reads example-passport.json from the repo root
// (gitignored — see .gitignore) and exposes two shapes:
//
//   loadDevExampleMrz()           → Step 5 "skip OCR" button
//   loadDevExamplePassportData()  → Step 6 "skip NFC" button (returns the
//                                   same PassportData the eDocument module
//                                   would produce on a successful scan —
//                                   personDetails is derived from dg1 the
//                                   same way scanDocument() does)
//
// The require() is wrapped in try/catch so a missing fixture (clean CI
// checkout) returns null and the gated UI hides itself — mirrors the
// lazyUnzip pattern in modules/witnesscalculator/index.ts.

import { EDocument } from '@/utils/e-document/e-document';

// Same JSON shape app/export-passport.tsx writes — kept loose because we
// read it forgivingly.
interface ExamplePassportFile {
  docCode?: string;
  personDetails?: {
    documentNumber?: string | null;
    birthDate?: string | null;
    expiryDate?: string | null;
  };
  dgHex?: {
    dg1?: string | null;
    dg11?: string | null;
    dg12?: string | null;
    dg14?: string | null;
    dg15?: string | null;
    sod?: string | null;
    aaSignature?: string | null;
  };
}

function loadRaw(): ExamplePassportFile | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports, import/no-unresolved
    return require('@/example-passport.json') as ExamplePassportFile;
  } catch {
    return null;
  }
}

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.replace(/[^0-9a-fA-F]/g, '');
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < clean.length; i += 2) {
    out[i / 2] = parseInt(clean.substring(i, i + 2), 16);
  }
  return out;
}

export function loadDevExampleMrz(): {
  documentNumber: string;
  birthDate: string;
  expiryDate: string;
} | null {
  const ep = loadRaw();
  const pd = ep?.personDetails;
  if (!pd?.documentNumber || !pd?.birthDate || !pd?.expiryDate) return null;
  return {
    documentNumber: String(pd.documentNumber),
    birthDate: String(pd.birthDate),
    expiryDate: String(pd.expiryDate),
  };
}

export function loadDevExamplePassportData(): EDocument | null {
  const ep = loadRaw();
  const hex = ep?.dgHex;
  // dg1 + sod are the minimum needed for Step 7's verify + Step 11's vote
  // calldata. Bail if either is missing.
  if (!hex?.dg1 || !hex?.sod) return null;
  const bytes = (field: string | null | undefined) => field ? hexToBytes(field) : undefined;

  return new EDocument({
    docCode: ep?.docCode ?? 'P',
    dg1Bytes: bytes(hex.dg1)!,
    sodBytes: bytes(hex.sod)!,
    dg11Bytes: bytes(hex.dg11),
    dg12Bytes: bytes(hex.dg12),
    dg14Bytes: bytes(hex.dg14),
    dg15Bytes: bytes(hex.dg15),
    aaSignature: bytes(hex.aaSignature),
  });
}
