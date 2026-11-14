// Example packs for the Test Lab: named sets of test cases a reviewer can load, append or run in one click.
// The 'Everything' pack is generated: every distinct case from the other packs (first occurrence of an id wins).
import type { LabCase } from '../api/lab';
import { triagePacks } from './labPacksTriage';
import { exceptionPacks } from './labPacksExceptions';
import { workflowPacks } from './labPacksWorkflow';
import { LOAD_EXAMPLE_CASES } from './labPrompt';

export interface LabPack {
  id: string;
  title: string;
  description: string;
  cases: LabCase[];
}

const starterPack: LabPack = {
  id: 'starter',
  title: 'Starter mix',
  description: 'One case per scenario type with correct expectations. A good first run.',
  cases: LOAD_EXAMPLE_CASES,
};

const sourcePacks: LabPack[] = [starterPack, ...triagePacks, ...exceptionPacks, ...workflowPacks];

const seenIds = new Set<string>();
const everythingCases = sourcePacks.flatMap((pack) => pack.cases).filter((c) => {
  if (seenIds.has(c.id)) return false;
  seenIds.add(c.id);
  return true;
});

const everythingPack: LabPack = {
  id: 'everything',
  title: 'Everything',
  description: `All ${everythingCases.length} distinct cases from every pack, in one run.`,
  cases: everythingCases,
};

export const allPacks: LabPack[] = [...sourcePacks, everythingPack];
