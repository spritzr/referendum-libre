import { create } from 'zustand';
import {
  prepareErrorReport,
  sendErrorReport,
  isExpectedError,
  ReportContext,
  PreparedReport,
} from '@/utils/error-reporter';

interface ErrorReportState {
  pendingReport: PreparedReport | null;
  _inFlight: boolean;
  /** Prepare and stash the report (writes the temp file). Returns the
   * prepared report so callers can immediately send it without waiting for
   * the `pendingReport` state update. */
  reportError: (err: unknown, context?: ReportContext) => Promise<PreparedReport | null>;
  sendPending: () => Promise<void>;
  clearReport: () => void;
  isExpected: (err: unknown) => boolean;
}

export const useErrorReportStore = create<ErrorReportState>((set, get) => ({
  pendingReport: null,
  _inFlight: false,
  reportError: async (err, context) => {
    // Log the error so it ends up in the snapshot itself.
    console.error('[error-report]', err);
    if (get()._inFlight) return null;
    set({ _inFlight: true });
    try {
      const report = await prepareErrorReport(err, context);
      set({ pendingReport: report });
      return report;
    } catch (e) {
      // Reporting must never crash the app.
      console.warn('[error-report] failed to prepare report', e);
      return null;
    } finally {
      set({ _inFlight: false });
    }
  },
  sendPending: async () => {
    const { pendingReport } = get();
    if (!pendingReport) return;
    try {
      await sendErrorReport(pendingReport.uri);
    } catch (e) {
      console.warn('[error-report] send failed', e);
    }
  },
  clearReport: () => set({ pendingReport: null }),
  isExpected: isExpectedError,
}));
