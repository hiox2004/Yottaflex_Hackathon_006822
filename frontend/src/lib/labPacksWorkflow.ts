// Test Lab workflow pack: 18 import-ready cases that give a believable, varied workload for the reviewer workflow.
// Rule in force: log 0.30, review 0.60, priority 0.85; adjusted = raw - quoted - template; flag when raw >= 0.60.
// Each `expect` was computed with the backend rule (integrity.rules.triage), not guessed.
import type { LabCase } from '../api/lab';

export const workflowPacks: { id: string; title: string; description: string; cases: LabCase[] }[] = [
  {
    id: 'workflow-demo',
    title: 'Workflow demo (import me)',
    description:
      'Import into the workflow: 18 realistic cases. 4 priority reviews, 6 reviews (2 with citation-only evidence), 3 quote dismissals, 2 template dismissals, 2 not flagged, 1 exactly at the review gate.',
    cases: [
      {
        id: 'W-001',
        title: 'Two near-identical lab reports, priority review',
        scores: { raw: 0.97, quoted: 0.04, template: 0.02 },
        evidence: [
          { kind: 'matched_passage', description: 'Results paragraph matches a classmate report word for word across six sentences.' },
          { kind: 'source_reference', description: 'Both reports cite the same unpublished lab handout with identical figure numbering.' },
          { kind: 'learner_statement', description: 'The learner says the group shared one draft file and each member edited a copy.' },
        ],
        expect: { is_flag: true, opens_case: true, band: 'priority_review' },
      },
      {
        id: 'W-002',
        title: 'Essay copied from a shared online article, priority review',
        scores: { raw: 0.93, quoted: 0.03, template: 0.01 },
        evidence: [
          { kind: 'matched_passage', description: 'Introduction and conclusion reproduce a public article paragraph with only synonyms changed.' },
          { kind: 'source_reference', description: 'The article is listed in the bibliography but no quotation marks or page numbers are used.' },
          { kind: 'learner_statement', description: 'The learner says the article was used for background and was not meant to be copied.' },
        ],
        expect: { is_flag: true, opens_case: true, band: 'priority_review' },
      },
      {
        id: 'W-003',
        title: 'Problem set answers matched to a solutions site, priority review',
        scores: { raw: 0.99, quoted: 0.05, template: 0.0 },
        evidence: [
          { kind: 'matched_passage', description: 'Worked solutions to problems 4 to 9 match an online solutions page line by line.' },
          { kind: 'source_reference', description: 'The solutions page carries the same typo in the final answer of problem 6.' },
          { kind: 'learner_statement', description: 'The learner says they checked their answers against the site after finishing the set.' },
        ],
        expect: { is_flag: true, opens_case: true, band: 'priority_review' },
      },
      {
        id: 'W-004',
        title: 'Literature review nearly verbatim from a journal, priority review',
        scores: { raw: 0.88, quoted: 0.02, template: 0.0 },
        evidence: [
          { kind: 'matched_passage', description: 'Three consecutive paragraphs in the review match a 2019 journal article almost word for word.' },
          { kind: 'source_reference', description: 'The journal article is cited once at the start of the section and not again.' },
          { kind: 'learner_statement', description: 'The learner says the paragraphs were drafted from notes and the source was not checked again.' },
        ],
        expect: { is_flag: true, opens_case: true, band: 'priority_review' },
      },
      {
        id: 'W-005',
        title: 'Reflective essay with a matched passage, reviewed',
        scores: { raw: 0.78, quoted: 0.05, template: 0.03 },
        evidence: [
          { kind: 'matched_passage', description: 'A paragraph on memory and learning matches a published blog post with minor reordering.' },
          { kind: 'source_reference', description: 'The blog post is not in the reference list although the essay names its author.' },
          { kind: 'learner_statement', description: 'The learner says the paragraph was a note they meant to rewrite before submitting.' },
        ],
        expect: { is_flag: true, opens_case: true, band: 'review' },
      },
      {
        id: 'W-006',
        title: 'Project proposal with a sourced paragraph, reviewed',
        scores: { raw: 0.82, quoted: 0.04, template: 0.0 },
        evidence: [
          { kind: 'matched_passage', description: 'The background paragraph repeats a government report summary sentence for sentence.' },
          { kind: 'source_reference', description: 'The government report appears in the reference list but is not marked as a direct copy.' },
        ],
        expect: { is_flag: true, opens_case: true, band: 'review' },
      },
      {
        id: 'W-007',
        title: 'Quoted poem overlap with only citations on file, reviewed',
        scores: { raw: 0.79, quoted: 0.15, template: 0.02 },
        evidence: [
          { kind: 'quote_citation', description: 'The poem stanzas are set in quotation marks and attributed to the poet with a line number.' },
          { kind: 'quote_citation', description: 'A second block of lines from the same poem is cited with a page reference.' },
          { kind: 'template_match', description: 'The opening sentence matches the standard essay opener used in the course guide.' },
        ],
        expect: { is_flag: true, opens_case: true, band: 'review' },
      },
      {
        id: 'W-008',
        title: 'Lab write-up overlap with only shared template text, reviewed',
        scores: { raw: 0.76, quoted: 0.02, template: 0.1 },
        evidence: [
          { kind: 'template_match', description: 'The safety and apparatus sections match the lab template that every section of the course received.' },
        ],
        expect: { is_flag: true, opens_case: true, band: 'review' },
      },
      {
        id: 'W-009',
        title: 'Group report section with a matched passage, reviewed',
        scores: { raw: 0.9, quoted: 0.1, template: 0.08 },
        evidence: [
          { kind: 'matched_passage', description: 'The discussion section reuses a paragraph from a previous cohort report on the same experiment.' },
          { kind: 'quote_citation', description: 'The learner quotes the textbook definition of the method in quotation marks with a page number.' },
          { kind: 'learner_statement', description: 'The learner says the previous report was shared in the module forum as an example.' },
        ],
        expect: { is_flag: true, opens_case: true, band: 'review' },
      },
      {
        id: 'W-010',
        title: 'Short answer close to a forum post, reviewed',
        scores: { raw: 0.67, quoted: 0.03, template: 0.0 },
        evidence: [
          { kind: 'source_reference', description: 'The answer follows the structure of a forum post that is linked in the learner\'s own notes.' },
          { kind: 'learner_statement', description: 'The learner says they read the forum post before writing and did not think it needed a citation.' },
        ],
        expect: { is_flag: true, opens_case: true, band: 'review' },
      },
      {
        id: 'W-011',
        title: 'Essay with a long cited quotation, dismissed',
        scores: { raw: 0.88, quoted: 0.35, template: 0.05 },
        evidence: [
          { kind: 'quote_citation', description: 'A 250-word passage from a policy paper is quoted in full and attributed with a page number.' },
        ],
        expect: { is_flag: true, opens_case: false, band: 'log_only', dismissal_reason: 'quote_only' },
      },
      {
        id: 'W-012',
        title: 'Literature review quoting a published abstract, dismissed',
        scores: { raw: 0.95, quoted: 0.4, template: 0.1 },
        evidence: [
          { kind: 'quote_citation', description: 'The whole abstract of a cited study is reproduced in a block quotation with its reference.' },
        ],
        expect: { is_flag: true, opens_case: false, band: 'log_only', dismissal_reason: 'quote_only' },
      },
      {
        id: 'W-013',
        title: 'Essay quoting a poem at length, dismissed',
        scores: { raw: 0.72, quoted: 0.3, template: 0.06 },
        evidence: [
          { kind: 'quote_citation', description: 'Several stanzas of a poem are quoted and each block is attributed in the text.' },
        ],
        expect: { is_flag: true, opens_case: false, band: 'log_only', dismissal_reason: 'quote_only' },
      },
      {
        id: 'W-014',
        title: 'Lab method section copied from the course template, dismissed',
        scores: { raw: 0.81, quoted: 0.03, template: 0.25 },
        evidence: [
          { kind: 'template_match', description: 'The method section matches the course lab template word for word apart from the reagent names.' },
        ],
        expect: { is_flag: true, opens_case: false, band: 'log_only', dismissal_reason: 'template_match' },
      },
      {
        id: 'W-015',
        title: 'Cover-page wording shared across the cohort, dismissed',
        scores: { raw: 0.7, quoted: 0.02, template: 0.15 },
        evidence: [
          { kind: 'template_match', description: 'The declaration and cover-page wording is identical to the cohort submission template.' },
        ],
        expect: { is_flag: true, opens_case: false, band: 'log_only', dismissal_reason: 'template_match' },
      },
      {
        id: 'W-016',
        title: 'Common phrasing with a textbook, not flagged',
        scores: { raw: 0.45, quoted: 0.0, template: 0.0 },
        expect: { is_flag: false, opens_case: false, band: 'log_only' },
      },
      {
        id: 'W-017',
        title: 'Low overlap with a textbook, not flagged',
        scores: { raw: 0.28, quoted: 0.0, template: 0.0 },
        expect: { is_flag: false, opens_case: false, band: 'no_action' },
      },
      {
        id: 'W-018',
        title: 'Adjusted score lands exactly on the review gate, reviewed',
        scores: { raw: 0.8, quoted: 0.15, template: 0.05 },
        evidence: [
          { kind: 'matched_passage', description: 'Two paragraphs of the conclusion match an online study guide closely after exclusions.' },
          { kind: 'source_reference', description: 'The study guide is not cited anywhere in the submission.' },
        ],
        expect: { is_flag: true, opens_case: true, band: 'review' },
      },
    ],
  },
];
