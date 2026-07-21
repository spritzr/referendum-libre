const React = require('react');
const { View } = require('react-native');

const unavailable = (name) => async () => {
  throw new Error(`${name} is unavailable in Expo Go mock mode`);
};

const store = new Map();

class MMKV {
  getString(key) { return store.get(key); }
  getBoolean(key) { return store.get(key); }
  getNumber(key) { return store.get(key); }
  set(key, value) { store.set(key, value); }
  delete(key) { store.delete(key); }
  clearAll() { store.clear(); }
}

function Camera(props) {
  return React.createElement(View, props);
}

function useCameraDevice() {
  return { id: 'expo-go-mock-camera' };
}

function useCameraPermission() {
  return { hasPermission: false, requestPermission: async () => false };
}

function useFrameProcessor() {
  return undefined;
}

function runAtTargetFps(_fps, fn) {
  return typeof fn === 'function' ? fn() : undefined;
}

function useTextRecognition() {
  return { scanText: () => [] };
}

const Worklets = { createRunOnJS: (fn) => fn };

const NfcTech = {
  Ndef: 'Ndef',
  NfcA: 'NfcA',
  NfcB: 'NfcB',
  IsoDep: 'IsoDep',
  Iso15693IOS: 'Iso15693IOS',
  Iso7816IOS: 'Iso7816IOS',
};

const NativeMock = {
  start: async () => false,
  isSupported: async () => false,
  isEnabled: async () => false,
  registerTagEvent: async () => undefined,
  unregisterTagEvent: async () => undefined,
  requestTechnology: unavailable('NFC'),
  cancelTechnologyRequest: async () => undefined,
  getTag: async () => null,
  setAlertMessageIOS: async () => undefined,
  calculateWitness: unavailable('Witness calculator'),
};

const EDocumentModuleEvents = {
  ScanStarted: 'SCAN_STARTED',
  RequestPresentPassport: 'REQUEST_PRESENT_PASSPORT',
  AuthenticatingWithPassport: 'AUTHENTICATING_WITH_PASSPORT',
  ReadingDataGroupProgress: 'READING_DATA_GROUP_PROGRESS',
  ActiveAuthentication: 'ACTIVE_AUTHENTICATION',
  SuccessfulRead: 'SUCCESSFUL_READ',
  ScanError: 'SCAN_ERROR',
  DebugLog: 'DEBUG_LOG',
  ScanStopped: 'SCAN_STOPPED',
};

function EDocumentModuleListener() {
  return { remove() {} };
}

async function testNfcDetection() {
  return { tagDetected: false, tags: [], aidProbeResults: [], logs: ['Expo Go mock mode'] };
}

const DocumentStatus = {
  NotRegistered: 'NOT_REGISTERED',
  RegisteredWithThisPk: 'REGISTERED_WITH_THIS_PK',
  RegisteredWithOtherPk: 'REGISTERED_WITH_OTHER_PK',
};

class RarimePassport {
  constructor(data = {}) { Object.assign(this, data); }
  getPassportKey() { return 'expo-go-mock-passport-key'; }
  getPassportHash() { return 'expo-go-mock-passport-hash'; }
}

class Rarime {
  async getDocumentStatus() { return DocumentStatus.NotRegistered; }
  async registerIdentity() { return '0xexpo_go_mock'; }
  static getBundledCircuit() { return null; }
}

class FreedomTool {
  async getProposalInfo(id = '0') {
    return {
      id: String(id),
      title: 'Expo Go mock proposal',
      description: '',
      questions: [{ variants: ['Oui', 'Non'] }],
      criteria: { citizenshipWhitelist: [], timestampUpperbound: 0n },
      startTimestamp: 0n,
      duration: 0n,
    };
  }
  async isAlreadyVoted() { return false; }
  async verify() { return true; }
  async submitProposal() { return '0xexpo_go_mock'; }
}

const RarimeUtils = {
  generateBJJPrivateKey: () => '1'.repeat(64),
  getProfileKey: (key) => `mock-${String(key).slice(0, 8)}`,
};

function createIDCardVotingContract() {
  return {};
}

exports.__esModule = true;
exports.default = NativeMock;
exports.MMKV = MMKV;
exports.Camera = Camera;
exports.useCameraDevice = useCameraDevice;
exports.useCameraPermission = useCameraPermission;
exports.useFrameProcessor = useFrameProcessor;
exports.runAtTargetFps = runAtTargetFps;
exports.useTextRecognition = useTextRecognition;
exports.Worklets = Worklets;
exports.NfcTech = NfcTech;
exports.EDocumentModuleEvents = EDocumentModuleEvents;
exports.EDocumentModuleListener = EDocumentModuleListener;
exports.EDocumentModuleRemoveAllListeners = () => {};
exports.scanDocument = unavailable('Document scan');
exports.testNfcDetection = testNfcDetection;
exports.testPassportDetection = testNfcDetection;
exports.DocumentStatus = DocumentStatus;
exports.Rarime = Rarime;
exports.RarimePassport = RarimePassport;
exports.RarimeUtils = RarimeUtils;
exports.FreedomTool = FreedomTool;
exports.NoirCircuitParams = class NoirCircuitParams {};
exports.createIDCardVotingContract = createIDCardVotingContract;
exports.groth16ProveWithZKeyFilePath = unavailable('Rapidsnark');
