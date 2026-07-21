import type { FreedomTool } from '@rarimo/rarime-rn-sdk';

export type ProposalInfo = Awaited<ReturnType<FreedomTool['getProposalInfo']>>;
