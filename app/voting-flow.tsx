import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, Animated, TouchableOpacity, Platform } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Stack, useRouter, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors, useTheme } from '@/constants/theme';
import { Svg, Path } from 'react-native-svg';
import type { Rarime, RarimePassport, FreedomTool, ProposalInfo } from '@rarimo/rarime-rn-sdk';
import {
  getRarimeConfig,
  getFreedomToolConfig,
  getDefaultProposalId,
  withRetry,
  formatRpcError,
} from '@/constants/rarimo/config';
import { useNetworkStore } from '@/store/useNetworkStore';
import { assertOnChainConstants } from '@/utils/rarimo/register-via-noir';
import { getOrCreatePrivateKey } from '@/utils/rarimo/identity';
import { findCachedProposal } from '@/utils/proposal-cache';
import { isPassportVotingTarget } from '@/utils/voteResults';
import { useTranslation } from 'react-i18next';
import type { EDocument } from '@/utils/e-document/e-document';

// Import all steps
import StepIntroConsent from '@/components/voting-modal/StepIntroConsent';
import StepEligibilityCheck from '@/components/voting-modal/StepEligibilityCheck';
import StepAnonymousVoteExplainer from '@/components/voting-modal/StepAnonymousVoteExplainer';
import StepIntroVideo from '@/components/voting-modal/StepIntroVideo';
import StepDocumentScanStart from '@/components/voting-modal/StepDocumentScanStart';
import StepMRZScan from '@/components/voting-modal/StepMRZScan';
import StepNFCRead from '@/components/voting-modal/StepNFCRead';
import StepBlockchainVerify from '@/components/voting-modal/StepBlockchainVerify';
import StepReadyToVote from '@/components/voting-modal/StepReadyToVote';
import StepVoteChoiceError from '@/components/voting-modal/StepVoteChoiceError';
import StepVoteChoice from '@/components/voting-modal/StepVoteChoice';
import StepVoteConfirm from '@/components/voting-modal/StepVoteConfirm';
import StepProofSubmission from '@/components/voting-modal/StepProofSubmission';
import StepVoteSuccess from '@/components/voting-modal/StepVoteSuccess';
import StepVoteError from '@/components/voting-modal/StepVoteError';
import ManualMRZInput from '@/components/voting-modal/ManualMRZInput';
import { createModalStyles } from '@/components/voting-modal/styles';
import { useModalVideoPlayers } from '@/hooks/useModalVideoPlayers';
import { markVoteJustCast } from '@/utils/post-vote-refresh';
import { FlowStep, type FlowStepValue } from '@/constants/voting-flow-steps';
import { STEP_VIDEOS } from '@/constants/videos';
import { VideoView } from 'expo-video';
import { Portal, PortalProvider } from 'react-native-teleport';
import { stepVideoHostName } from '@/components/voting-modal/stepVideoHostName';


export default function VotingFlowScreen() {
  const { proposalId: proposalIdParam, isPassport: isPassportParam } = useLocalSearchParams<{ proposalId?: string; isPassport?: string }>();
  const { t } = useTranslation();
  const router = useRouter();
  const colors = useColors();
  const { theme } = useTheme();
  const network = useNetworkStore((s) => s.network);
  const modalStyles = createModalStyles(colors);
  const insets = useSafeAreaInsets();

  const [currentStep, setCurrentStep] = useState<FlowStepValue>(FlowStep.IntroConsent);
  const [verificationResult, setVerificationResult] = useState<'success' | 'error' | null>(null);
  const [verificationError, setVerificationError] = useState<unknown>(null);
  const [voteSubmissionResult, setVoteSubmissionResult] = useState<'success' | 'error' | null>(null);
  const [mrzData, setMRZData] = useState<{ documentNumber: string; birthDate: string; expiryDate: string } | null>(null);
  const [nfcData, setNFCData] = useState<EDocument | null>(null);
  // Flips true ONLY after `handleNFCSuccess`'s async block has resolved the
  // per-passport BJJ key and synced it into the legacy SecureStore slot.
  // The Rarime init `useEffect` below gates on this so it never reads a
  // stale legacy key while `getOrCreateKeyForPassport` is mid-flight —
  // without this gate, `getDocumentStatus` racing the per-passport key
  // write returns the wrong profileKey and reports `REGISTERED_WITH_OTHER_PK`.
  const [passportKeyReady, setPassportKeyReady] = useState(false);
  const [isManualInputVisible, setIsManualInputVisible] = useState(false);
  // Height available for the slide area (measured from topSection). Steps 1–3
  // cap their ScrollView at this on iOS so content stays its natural size and
  // only scrolls once it overflows.
  const [slideAreaHeight, setSlideAreaHeight] = useState<number | undefined>(undefined);
  const [selectedVote, setSelectedVote] = useState<number>(0);

  // Rarime / FreedomTool state
  const [privateKey, setPrivateKey] = useState<string | null>(null);
  const [proposalInfo, setProposalInfo] = useState<ProposalInfo | null>(null);

  // The MRZ mask (Step 6) + NFC mode (Step 7) need to know whether the
  // active proposal targets passport (TD3) or ID card (TD1) BEFORE the
  // full proposalInfo lands. The home screen passes `?isPassport=0|1` in
  // the URL — that's the most reliable signal because it captures what
  // the user saw when they tapped. Fall back to proposalInfo (once
  // hydrated from cache or RPC) if the param is absent (e.g. deep link).
  const isPassportFlow = useMemo<boolean>(() => {
    if (isPassportParam === '1') return true;
    if (isPassportParam === '0') return false;
    return proposalInfo ? isPassportVotingTarget(proposalInfo) : false;
  }, [isPassportParam, proposalInfo]);
  const rarimeRef = useRef<Rarime | null>(null);
  const freedomToolRef = useRef<FreedomTool | null>(null);
  const passportRef = useRef<RarimePassport | null>(null);

  const progressOpacity1 = useRef(new Animated.Value(1)).current;
  const progressOpacity2 = useRef(new Animated.Value(0.25)).current;
  const progressOpacity3 = useRef(new Animated.Value(0.25)).current;

  const { player, handleStepChange, pauseAll } = useModalVideoPlayers();

  // If the user switches network from Settings while the voting-flow screen
  // is still mounted (rare — would require backing out to Settings and back),
  // wipe the SDK refs so the next entry into Step 8 re-creates them against
  // the new addresses. Without this we'd keep talking to testnet contracts
  // even though the user flipped to Mainnet.
  useEffect(() => {
    rarimeRef.current = null;
    freedomToolRef.current = null;
    setProposalInfo(null);
    // Force re-gating on the next NFC scan — without this, flipping
    // networks mid-flow would let the init useEffect run immediately
    // with stale `passportKeyReady=true`.
    setPassportKeyReady(false);
  }, [network]);

  // Early cache-only hydration: the heavy init effect below is deferred
  // until after Step 7 (NFC), but Step 6's MRZ reticle needs to know the
  // doc type (passport vs ID card) which is derived from the proposal's
  // `sendVoteContractAddress`. Look up the proposal from the home-screen
  // cache on mount so we can set the right mask before the user even gets
  // to Step 6. No network call, no SDK init — just a synchronous-ish
  // lookup against the cache the home tab populated. On cache miss we
  // stay null and the mask defaults to TD1 (the more common path).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const targetProposalId = proposalIdParam || getDefaultProposalId(network);
      const cached = await findCachedProposal(network, targetProposalId);
      if (cancelled) return;
      if (cached) {
        console.log(
          `[voting-flow] proposal hydrated from cache early: #${targetProposalId} sendVoteContract=${cached.sendVoteContractAddress}`,
        );
        setProposalInfo(cached);
      }
    })();
    return () => { cancelled = true; };
  }, [proposalIdParam, network]);

  // Init Rarime + FreedomTool + load proposal. Deferred until after the NFC
  // scan (Step 7) so that Rarime's native Rust/ZK warmup doesn't contend with
  // IsoDep during PACE. Step 8 reads rarimeRef.current defensively and will
  // wait for init to complete.
  useEffect(() => {
    if (currentStep < FlowStep.BlockchainVerify) return;
    // Wait for handleNFCSuccess's async block to finish writing the
    // per-passport BJJ key into the legacy SecureStore slot. Without this
    // gate, the line below that calls `getOrCreatePrivateKey()` can read
    // the *previous* scan's key (or the migration-era legacy key on a
    // clean install), construct Rarime against the wrong identity, and
    // the on-chain `activeIdentity` check then reports REGISTERED_WITH_OTHER_PK.
    if (!passportKeyReady) return;
    if (rarimeRef.current) return; // already initialised
    (async () => {
      try {
        // Catch regressions in the keccak dispatch strings used by the
        // registerViaNoir path. Cheap (~µs) and fails loud, before any
        // network calls happen. See utils/register-via-noir.ts.
        try { assertOnChainConstants(); } catch (e) { console.error('[voting-flow]', e); }

        const { Rarime: RarimeClass, FreedomTool: FT } =
          await import('@rarimo/rarime-rn-sdk');

        // The voting flow is now TD1 (French ID card) only. The TD1 light
        // + query_identity circuits are published on Rarimo's GCS bucket
        // and the SDK fetches them from there on first use — no local
        // bundle registration needed.
        //
        // The TD3 (passport) circuit JSONs are still in assets/circuits/
        // and are still used by the diagnostic / QA screens that exercise
        // passport flows out-of-band, but the production voting path
        // doesn't register them.
        //
        // Heavy register circuit — used by the Mainnet registerViaNoir
        // path (utils/register-via-noir.ts). 3 MB of Noir bytecode bundled
        // in-app so registration works offline. Same circuit name for both
        // TD1 and TD3 (the circuit doesn't care about MRZ format).
        RarimeClass.registerBundledCircuit('registerIdentity_1_256_3_5_576_248_NA', require('@/assets/circuits/registerIdentity_1_256_3_5_576_248_NA.json'));
        console.log('[FreedomTool] Heavy register circuit bundled; TD1 light + query come from CDN.');

        const storedKey = await getOrCreatePrivateKey();
        setPrivateKey(storedKey);

        // Pick the right contract / RPC bundle for the currently-active
        // network. The whole Rarime + FreedomTool pair has to share a network
        // (mixing them would point getDocumentStatus and getProposalInfo at
        // different chains and silently break vote-eligibility checks).
        console.log(`[FreedomTool] Initialising for network=${network}`);
        const rarimeCfg = getRarimeConfig(network);
        const ftCfg = getFreedomToolConfig(network);

        const rarime = new RarimeClass({
          ...rarimeCfg,
          userConfiguration: { userPrivateKey: storedKey },
        });
        rarimeRef.current = rarime;

        const ft = new FT(ftCfg);
        freedomToolRef.current = ft;

        const targetProposalId = proposalIdParam || getDefaultProposalId(network);

        // Cache-first: the home screen already fetched & cached this
        // proposal. Using it here cuts ~2–3 s off the post-NFC wait (that's
        // the getProposalInfo() roundtrip blocking Step 8 verification).
        const cached = await findCachedProposal(network, targetProposalId);
        if (cached) {
          console.log('[FreedomTool] Proposal loaded from cache:', cached.title);
          setProposalInfo(cached);
          // Refresh in the background in case votes/timestamps moved on;
          // the cache entry remains usable for the current voting flow.
          ft.getProposalInfo(targetProposalId)
            .then((fresh: ProposalInfo) => { setProposalInfo(fresh); })
            .catch((e: any) => {
              console.warn('[FreedomTool] background refresh failed:', e?.message);
            });
        } else {
          console.log('[FreedomTool] Loading proposal', targetProposalId);
          const info = await withRetry(
            () => ft.getProposalInfo(targetProposalId),
            { label: 'getProposalInfo' }
          );
          console.log('[FreedomTool] Proposal loaded:', info.title);
          setProposalInfo(info);
        }
      } catch (err) {
        console.error('[FreedomTool] Init error:', err);
      }
    })();
  }, [currentStep, proposalIdParam, network, passportKeyReady]);

  // Reset state when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      // Reset to step 1 when screen is focused
      console.log('[flow] step → 1 (focus-reset)');
      setCurrentStep(FlowStep.IntroConsent);
      setVerificationResult(null);
      setVerificationError(null);
      setVoteSubmissionResult(null);
      setVoteTxId(null);
      setMRZData(null);
      setNFCData(null);
      // Critical: clear the manual-input modal flag too. If the user backed
      // out of the flow while the modal was open, this would otherwise stay
      // `true` and keep Step 6's camera disabled on re-entry (Step 6's
      // isActive is gated on `!isManualInputVisible`).
      setIsManualInputVisible(false);
      // Re-arm the per-passport key gate so the init useEffect waits for
      // the next NFC scan + DB lookup before constructing Rarime.
      setPassportKeyReady(false);
      // Re-arm Step 8's verification-handled latch and clear the passport
      // scan from the previous attempt. Without these resets, a user who
      // exits + re-enters the flow (crash recovery, "try again",
      // backgrounding during proof generation) hits the latch at line ~464
      // and Step 8 silently no-ops; the stale passport also stays
      // observable via `passportRef.current` until the next NFC scan
      // overwrites it.
      verificationHandledRef.current = false;
      passportRef.current = null;

      // Reset animations
      progressOpacity1.setValue(1);
      progressOpacity2.setValue(0.25);
      progressOpacity3.setValue(0.25);

      return () => {
        // Cleanup when screen loses focus
        pauseAll();
      };
    }, [pauseAll, progressOpacity1, progressOpacity2, progressOpacity3])
  );

  // Keep the JS thread idle while the NFC scan runs on Step 7. Reader mode on
  // Android dispatches APDUs on a background thread, but sendEvent() bubbles
  // back to JS — heavy renders here back up the bridge and can starve the
  // IsoDep session on the very first APDU.
  useEffect(() => {
    if (Platform.OS === 'android' && currentStep === FlowStep.NFCRead) {
      pauseAll();
    }
  }, [currentStep, pauseAll]);

  // Step-transition audit trail: the #54 step-skip reports (2026-06-11/12)
  // showed users reaching the vote screens with no visible path in the logs.
  // Every transition now logs its source so the 5-min error-report tail can
  // name the jumper outright.
  const goToStep = useCallback((newStep: FlowStepValue, source: string) => {
    console.log(`[flow] step → ${newStep} (${source})`);
    setCurrentStep(newStep);
    handleStepChange(newStep);
  }, [handleStepChange]);

  const handleNext = useCallback(() => {
    const newStep = (currentStep + 1) as FlowStepValue;
    goToStep(newStep, 'next');

    // Light the Nth bar when entering step N. Bar 1 is already lit at init
    // (so step 1 → 1 bar, step 2 → 2 bars, step 3 → 3 bars). Step 4 hides the
    // nav entirely, so nothing to animate there.
    if (newStep === FlowStep.EligibilityCheck) {
      Animated.timing(progressOpacity2, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    } else if (newStep === FlowStep.AnonymousVoteExplainer) {
      Animated.timing(progressOpacity3, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    }
  }, [currentStep, goToStep, progressOpacity2, progressOpacity3]);

  const handleMRZScanned = useCallback((data: { documentNumber: string; birthDate: string; expiryDate: string }) => {
    setMRZData(data);
    handleNext();
  }, [handleNext]);

  const handleNFCSuccess = useCallback((data: EDocument) => {
    setNFCData(data);

    // Create RarimePassport from NFC data. dg1Bytes / sodBytes are already
    // Uint8Arrays (decoded in modules/e-document/index.ts) — no base64 step.
    (async () => {
      try {
        const { RarimePassport: RP } = await import('@rarimo/rarime-rn-sdk');
        const dg1 = new Uint8Array(data.dg1Bytes);
        const sod = new Uint8Array(data.sodBytes);
        passportRef.current = new RP({ dataGroup1: dg1, sod });
        console.log('[FreedomTool] RarimePassport created, dg1.length:', dg1.length);

        // Resolve (and lazily generate) the BJJ key bound to THIS passport.
        // Multiple passports on the same phone each get their own identity;
        // the same passport rescanned recovers its existing key. We also
        // mirror the result into the legacy single-key SecureStore slot so
        // every downstream call site (Rarime init, StepProofSubmission's
        // mainnet flow, diagnostic screens) keeps reading from `getOrCreatePrivateKey()`
        // unchanged. See utils/passport-key-db.ts for the DB shape and
        // utils/identity.ts::getOrCreateKeyForPassport for the migration.
        try {
          const { getOrCreateKeyForPassport } = await import('@/utils/rarimo/identity');
          // No `label` arg — the previous wiring stored the MRZ document
          // number in the on-device key DB as a display aid for backups,
          // but that's PII we don't want at rest. See
          // utils/passport-key-db.ts::PassportKeyEntry.
          const resolved = await getOrCreateKeyForPassport({ dg1, sod });
          // SECURITY: even truncated, the passport hash + key prefix
          // together act as a stable per-user fingerprint in logcat.
          // Keep the boolean flags in release (useful for triage) and
          // gate the bytes behind __DEV__.
          if (__DEV__) {
            console.log(
              `[FreedomTool][passport-key] hash=${resolved.passportHash.slice(0, 12)}… ` +
              `key=${resolved.privateKey.slice(0, 8)}… isNew=${resolved.isNew} ` +
              `migratedFromLegacy=${resolved.migratedFromLegacy}`,
            );
          } else {
            console.log(
              `[FreedomTool][passport-key] isNew=${resolved.isNew} ` +
              `migratedFromLegacy=${resolved.migratedFromLegacy}`,
            );
          }

          // Pre-warm the CSCA bootstrap cache. Reading + treap-building
          // master_000316.pem (1.8 MB, 857 certs) takes ~1.5 s on the Volla
          // Phone X23 — kicking it off right after the NFC scan finishes
          // means by the time Step 8 might call registerCscaForSlave (10 s
          // later, after status check + suite resolution), the cache is
          // hot. Fire-and-forget: errors are logged but don't block the
          // NFC flow.
          import('@/utils/rarimo/csca-bootstrap')
            .then((m) => m.ensureMastersCache())
            .then(() => console.log('[csca-bootstrap] cache pre-warmed'))
            .catch((e) => console.warn('[csca-bootstrap] pre-warm failed:', e?.message ?? e));

          // Force the SDK refs to be re-created against the (possibly new)
          // private key on the next Rarime init pass — same trick we use
          // when the user flips testnet/mainnet in Settings.
          rarimeRef.current = null;
          freedomToolRef.current = null;
          // ONLY now signal the Rarime init useEffect that it can read
          // `getOrCreatePrivateKey()` safely — the legacy slot has been
          // synced to this passport's key above.
          setPassportKeyReady(true);
        } catch (e: any) {
          console.warn('[FreedomTool][passport-key] lookup/create failed:', e?.message ?? e);
          // Fall through with whatever the legacy slot holds so the user
          // isn't stuck on Step 8 forever — the on-chain status check
          // will surface the wrong-key case explicitly with the
          // REGISTERED_WITH_OTHER_PK branch in Step 8.
          setPassportKeyReady(true);
        }
      } catch (err) {
        console.error('[FreedomTool] PASSPORT_CREATE_FAILED', err);
      }
    })();

    handleNext();
  }, [handleNext]);

  const handleGoBackToMRZScan = useCallback(() => {
    setMRZData(null);
    goToStep(FlowStep.MRZScan, 'back-to-mrz');
  }, [goToStep]);

  const handleManualFill = useCallback(() => {
    setIsManualInputVisible(true);
  }, []);

  const handleManualInputClose = useCallback(() => {
    setIsManualInputVisible(false);
  }, []);

  const handleManualInputSubmit = useCallback((data: { documentNumber: string; birthDate: string; expiryDate: string }) => {
    setIsManualInputVisible(false);
    handleMRZScanned(data);
  }, [handleMRZScanned]);

  const verificationHandledRef = useRef(false);
  const handleVerificationSuccess = useCallback(() => {
    if (verificationHandledRef.current) return;
    verificationHandledRef.current = true;
    setVerificationResult('success');
    // Move to step 9 (voting screen) after a brief delay
    setTimeout(() => goToStep(FlowStep.ReadyToVote, 'verification-success'), 1500);
  }, [goToStep]);

  const handleVerificationError = useCallback((_message?: string, fatal?: boolean, error?: unknown) => {
    // Fatal errors (e.g. "passport already registered with another key")
    // cannot be retried. Keep the user on Step 8 with its own contextual
    // error display — do NOT trigger the generic StepVoteChoiceError overlay
    // ("Une erreur est survenue") or advance to Step 9, both of which
    // would hide the specific explanation. The user closes the modal via
    // the top-right X to exit.
    if (fatal) return;
    setVerificationError(error ?? new Error(_message ?? 'Unknown verification error'));
    setVerificationResult('error');
    setTimeout(() => handleNext(), 1500);
  }, [handleNext]);

  const handleVoteSuccess = useCallback(() => {
    goToStep(FlowStep.VoteChoice, 'step9-vote-now');
  }, [goToStep]);

  const handleVoteSelect = useCallback((answerIndex: number) => {
    setSelectedVote(answerIndex);
    goToStep(FlowStep.VoteConfirm, 'vote-selected');
  }, [goToStep]);

  const handleStep9Confirm = useCallback(() => {
    goToStep(FlowStep.ProofSubmission, 'vote-confirmed');
  }, [goToStep]);

  const handleClose = useCallback(() => {
    // Dev-only stack trace: lets us see WHICH caller closed the screen
    // (StepVoteSuccess/StepVoteError auto-advance vs explicit Fermer tap vs router-back gesture).
    // Gated to release builds out of the error-report ring buffer — every
    // close path was emitting a multi-line trace that crowded out actual
    // diagnostics.
    if (__DEV__) {
      console.log('[voting-flow] handleClose called. stack:\n' + new Error().stack);
    }
    pauseAll();
    router.back();
  }, [router, pauseAll]);

  const handleStep9Cancel = useCallback(() => {
    handleClose();
  }, [handleClose]);

  // Step 8 calls this when a *fatal* verification error fires — auto-close
  // the modal after 4 s so the user doesn't get stranded on the error
  // screen. Must live BELOW `handleClose` so the `[handleClose]` dep array
  // doesn't read a TDZ binding (`const` references its own declaration
  // line, not function-scope hoisted like `var`).
  const handleFatalVerificationError = useCallback(() => {
    setTimeout(() => handleClose(), 4000);
  }, [handleClose]);

  const [voteTxId, setVoteTxId] = useState<string | null>(null);
  // false when the tx was submitted but not yet confirmed on-chain at timeout —
  // StepVoteSuccess then shows a neutral "awaiting confirmation" message instead
  // of a definitive green success. A reverted tx never reaches here (→ error).
  const [voteConfirmed, setVoteConfirmed] = useState(true);
  const handleStep11Success = useCallback((txHash: string, confirmed: boolean) => {
    setVoteTxId(txHash);
    setVoteConfirmed(confirmed);
    setVoteSubmissionResult('success');
    // Tell the home tab a vote landed so it knows to do an extra delayed
    // refresh once tx propagation completes (the immediate focus-time
    // refetch races ahead of L2 confirmation otherwise).
    markVoteJustCast();
    goToStep(FlowStep.VoteSuccess, 'vote-submitted');
  }, [goToStep]);

  const [voteErrorReason, setVoteErrorReason] = useState<string | null>(null);
  const [voteError, setVoteError] = useState<unknown>(null);
  const handleStep11Error = useCallback((reason?: string, error?: unknown) => {
    setVoteErrorReason(reason || null);
    setVoteError(error ?? new Error(reason ?? 'Unknown vote error'));
    setVoteSubmissionResult('error');
    goToStep(FlowStep.VoteError, 'vote-error');
  }, [goToStep]);

  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <PortalProvider>
    <View
      style={[
        styles.container,
        // Clear the system-nav strip so the bottom row (progress bars + arrow
        // on steps 1–3, full-width pill on steps 4+) doesn't sit flush against
        // the bottom of the screen. Needed on both platforms:
        //   • iOS: home-indicator strip on Face-ID devices.
        //   • Android: targetSdkVersion 35 forces edge-to-edge regardless of
        //     `edgeToEdgeEnabled: false`, so the 3-button nav bar and gesture
        //     pill now overlay app content instead of carving out space.
        //     insets.bottom is the height the system reserves (≈48dp on
        //     3-button, ≈24dp on 2-button, ≈16dp on full-gesture, 0 on devices
        //     with hardware nav).
        { paddingBottom: insets.bottom },
      ]}
    >
      <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />

      {/* iOS modal sheet: native header bar with Fermer in headerRight.
          Android skips this override entirely — keeps the headerless card
          presentation defined in app/_layout.tsx. Mirrors the pattern from
          the old app/voting-screen.tsx (commit 3a0e3c1). */}
      {Platform.OS === 'ios' && (
        <Stack.Screen
          options={{
            title: currentStep < FlowStep.IntroVideo ? t('voting.title') : '',
            headerRight: () => (
              <TouchableOpacity
                onPress={handleClose}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                accessibilityRole="button"
                accessibilityLabel={t('common.close')}
              >
                <Text allowFontScaling={false} style={{ fontSize: 17, color: colors.secondary }}>
                  {t('common.close')}
                </Text>
              </TouchableOpacity>
            ),
          }}
        />
      )}

      <View
        style={styles.topSection}
        onLayout={(e) => setSlideAreaHeight(e.nativeEvent.layout.height)}
      >
        {/* Safe area spacer — only Android needs this; iOS modal renders the
            native nav bar above the screen content area so insets.top is
            already 0 below the header. */}
        {Platform.OS !== 'ios' && (
          <View style={{ height: insets.top, backgroundColor: colors.cardBackground }} />
        )}

        {/* Title Section — Android only. On iOS the native modal header
            already shows the title in its centre. Hidden for Step 4+. */}
        {Platform.OS !== 'ios' && currentStep < FlowStep.IntroVideo && (
          <View style={modalStyles.titleSection}>
            <Text style={modalStyles.title}>{t('voting.title')}</Text>
          </View>
        )}

        {/* Step content — exactly one step mounted at a time. */}
        <View
          style={[
            // Steps 1–3 use a tinted backdrop on Android (colors.background =
            // #EDEFF9). On iOS we keep the entire modal sheet white
            // (cardBackground) so the bottom-sheet feels like one continuous
            // surface instead of a tinted band.
            currentStep < FlowStep.IntroVideo && {
              backgroundColor: Platform.OS === 'ios' ? colors.cardBackground : colors.background,
            },
            // Step 4 (intro video) only: height-bound to the sheet (not the
            // taller Step 6 camera mounted further down the flow) so the
            // intro video's "Passer" button stays on-screen. Steps 1–3 and
            // 5+ keep content-sized layout.
            currentStep === FlowStep.IntroVideo && { flex: 1 },
          ]}
        >
          {/* Single teleported VideoView — moves to whichever step's
              <PortalHost> is currently mounted instead of being unmounted
              and recreated on every step change (see expo/expo#38426 for
              why rebinding a persistent player to a brand-new VideoView can
              silently fail to display on Android). Falls back to rendering
              inertly here when no step claims the host name (e.g. the intro
              consent/eligibility/etc. video steps are mid-transition or a
              non-video step like StepMRZScan is active). */}
          <Portal hostName={stepVideoHostName(currentStep)}>
            <VideoView
              player={player}
              contentFit={STEP_VIDEOS[currentStep]?.contentFit ?? 'contain'}
              nativeControls={false}
              surfaceType="textureView"
              // iOS Live Text was disabled on 3 of the 8 video-bearing steps
              // before teleport unified them onto one VideoView; off
              // everywhere now rather than re-introducing whatever issue
              // that was working around per-step.
              allowsVideoFrameAnalysis={false}
              style={{ width: '100%', height: '100%' }}
            />
          </Portal>
          {verificationResult === 'error' ? (
            <StepVoteChoiceError
              onGoHome={handleClose}
              isPassportFlow={isPassportFlow}
              error={verificationError}
            />
          ) : currentStep === FlowStep.IntroConsent ? (
            <StepIntroConsent slideAreaHeight={slideAreaHeight} isPassportFlow={isPassportFlow} />
          ) : currentStep === FlowStep.EligibilityCheck ? (
            <StepEligibilityCheck slideAreaHeight={slideAreaHeight} isPassportFlow={isPassportFlow} />
          ) : currentStep === FlowStep.AnonymousVoteExplainer ? (
            <StepAnonymousVoteExplainer slideAreaHeight={slideAreaHeight} />
          ) : currentStep === FlowStep.IntroVideo ? (
            <StepIntroVideo onSkip={handleNext} />
          ) : currentStep === FlowStep.DocumentScanStart ? (
            <StepDocumentScanStart onStartAnalysis={handleNext} isPassportFlow={isPassportFlow} />
          ) : currentStep === FlowStep.MRZScan ? (
            <StepMRZScan
              // Kill the camera while the manual-entry modal is open so
              // the preview doesn't sit on top of the keyboard.
              isActive={!isManualInputVisible}
              onMRZScanned={handleMRZScanned}
              onManualFill={handleManualFill}
              isPassportFlow={isPassportFlow}
              // Gate MRZ-extracted nationality against the proposal's
              // citizenship whitelist (empty / undefined → open to all
              // countries).
              allowedCitizenships={proposalInfo?.criteria.citizenshipWhitelist}
            />
          ) : currentStep === FlowStep.NFCRead ? (
            <StepNFCRead
              mrzData={mrzData}
              onNFCSuccess={handleNFCSuccess}
              onGoBack={handleGoBackToMRZScan}
              isPassportFlow={isPassportFlow}
            />
          ) : currentStep === FlowStep.BlockchainVerify ? (
            <StepBlockchainVerify
              isActive
              nfcData={nfcData}
              onSuccess={handleVerificationSuccess}
              onError={handleVerificationError}
              onFatalError={handleFatalVerificationError}
              rarime={rarimeRef.current ?? undefined}
              passport={passportRef.current ?? undefined}
              freedomTool={freedomToolRef.current ?? undefined}
              network={network}
            />
          ) : currentStep === FlowStep.ReadyToVote ? (
            <StepReadyToVote
              verificationResult={verificationResult}
              voteSubmissionResult={voteSubmissionResult}
              onVoteSuccess={handleVoteSuccess}
              onClose={handleClose}
            />
          ) : currentStep === FlowStep.VoteChoice ? (
            <StepVoteChoice
              onVoteSelect={handleVoteSelect}
              onCancel={handleStep9Cancel}
              proposalInfo={proposalInfo ?? undefined}
            />
          ) : currentStep === FlowStep.VoteConfirm ? (
            <StepVoteConfirm
              selectedVote={selectedVote}
              proposalInfo={proposalInfo ?? undefined}
              onCancel={handleStep9Cancel}
              onConfirm={handleStep9Confirm}
            />
          ) : currentStep === FlowStep.ProofSubmission ? (
            <StepProofSubmission
              isActive
              onSuccess={handleStep11Success}
              onError={handleStep11Error}
              freedomTool={freedomToolRef.current ?? undefined}
              rarime={rarimeRef.current ?? undefined}
              passport={passportRef.current ?? undefined}
              proposalInfo={proposalInfo ?? undefined}
              answerIndex={selectedVote}
              network={network}
            />
          ) : currentStep === FlowStep.VoteSuccess ? (
            <StepVoteSuccess
              voteIdentifier={voteTxId ?? undefined}
              confirmed={voteConfirmed}
              onViewResults={handleClose}
            />
          ) : currentStep === FlowStep.VoteError ? (
            <StepVoteError
              onGoHome={handleClose}
              errorReason={voteErrorReason}
              error={voteError}
            />
          ) : null}
        </View>
      </View>

      <View
        style={[
          styles.bottomSection,
          // Match the sliding container's per-platform backdrop for steps 1–3
          // so the seam between slide area and nav row stays invisible. iOS:
          // white (continuous modal sheet). Android: tinted (unchanged).
          currentStep < FlowStep.IntroVideo && {
            backgroundColor: Platform.OS === 'ios' ? colors.cardBackground : colors.background,
          },
        ]}
      >
        {/* Progress and Navigation */}
        {currentStep < FlowStep.IntroVideo && (
          <View style={styles.navigationSection}>
            <View style={styles.progressSection}>
              <Animated.View style={[styles.progressBar, { opacity: progressOpacity1, backgroundColor: colors.secondary }]} />
              <Animated.View style={[styles.progressBar, { opacity: progressOpacity2, backgroundColor: colors.secondary }]} />
              <Animated.View style={[styles.progressBar, { opacity: progressOpacity3, backgroundColor: colors.secondary }]} />
            </View>
            <TouchableOpacity
              style={styles.arrowButton}
              onPress={handleNext}
              activeOpacity={0.7}
            >
              <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
                <Path
                  d="M9 18l6-6-6-6"
                  stroke="white"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </Svg>
            </TouchableOpacity>
          </View>
        )}
      </View>

      <ManualMRZInput
        isVisible={isManualInputVisible}
        onClose={handleManualInputClose}
        onSubmit={handleManualInputSubmit}
      />
    </View>
    </PortalProvider>
  );
}

type FlowColors = ReturnType<typeof useColors>;

const createStyles = (colors: FlowColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.cardBackground,
    },
    topSection: {
      // Fill all vertical space above the nav bar so the step content area
      // stays consistent across steps 1–3.
      flex: 1,
      backgroundColor: colors.cardBackground,
    },
    bottomSection: {
      // No flex: shrinks to the nav's intrinsic content height. topSection takes
      // all remaining vertical space, and nav ends up naturally pinned to the
      // screen bottom.
    },
    progressSection: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      flex: 1,
      // iOS-only: explicit breathing room between the right edge of the 3rd
      // progress bar and the next-arrow button. The navigationSection has
      // gap: 39 but some RN versions/builds don't honour it on a flex: 1
      // child + fixed sibling combo. Platform.select keeps Android
      // byte-identical (no marginRight at all).
      marginRight: Platform.select({ ios: 16 }),
    },
    progressBar: {
      flex: 1,
      height: 4,
      borderRadius: 2,
      // Translucent track over the brand-colored bottom bar; opacity is animated
      // per-segment to indicate active vs inactive steps.
      backgroundColor: colors.scanOverlayMedium,
    },
    navigationSection: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 24,
      paddingVertical: 16,
      gap: 39,
    },
    arrowButton: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: colors.secondary,
      justifyContent: 'center',
      alignItems: 'center',
    },
  });
