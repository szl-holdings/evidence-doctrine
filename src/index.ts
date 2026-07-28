// SPDX-License-Identifier: Apache-2.0

import { createHash } from 'node:crypto';

export const EVIDENCE_STATES = ['VERIFIED', 'UNVERIFIED', 'ABSENT'] as const;
export type EvidenceState = (typeof EVIDENCE_STATES)[number];

export const DSLSA_LEVELS = ['D0', 'D1', 'D2', 'D3', 'D4'] as const;
export type DSeLevel = (typeof DSLSA_LEVELS)[number];

export const LEVEL_REQUIREMENTS = {
  D1: ['inputs_recorded', 'policy_recorded', 'output_recorded'],
  D2: ['signature_verified', 'tamper_evidence_verified'],
  D3: [
    'third_party_transparency_log_verified',
    'byte_identical_replay_verified',
    'offline_verification_verified',
  ],
  D4: [
    'hardware_attested_execution_verified',
    'formally_specified_policy_verified',
    'machine_checked_denial_verified',
  ],
} as const;

export type Requirement = (typeof LEVEL_REQUIREMENTS)[keyof typeof LEVEL_REQUIREMENTS][number];
export type DecisionEvidence = Partial<Record<Requirement, EvidenceState>>;
const REQUIREMENT_NAMES = new Set<string>(Object.values(LEVEL_REQUIREMENTS).flat());

export interface DecisionBundleIdentity {
  subject: string;
  bundle_sha256: string;
  evaluated_at: string;
}

export interface DecisionEvidenceBundle {
  identity: DecisionBundleIdentity;
  evidence: DecisionEvidence;
}

export interface GradeResult {
  bundle_subject: string;
  bundle_sha256: string;
  evaluated_at: string;
  achieved_level: DSeLevel;
  evaluation_state: 'EVALUATED_FROM_SUPPLIED_EVIDENCE';
  satisfied_requirements: Requirement[];
  blocking_requirements: Requirement[];
  unverified_requirements: Requirement[];
  absent_requirements: Requirement[];
  note: string;
}

const TIMESTAMP_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(Z|[+-]\d{2}:\d{2})$/;
const BOUNDARY_WHITESPACE = new Set([
  0x0009, 0x000a, 0x000b, 0x000c, 0x000d, 0x001c, 0x001d, 0x001e, 0x001f, 0x0020, 0x0085, 0x00a0,
  0x1680, 0x2000, 0x2001, 0x2002, 0x2003, 0x2004, 0x2005, 0x2006, 0x2007, 0x2008, 0x2009, 0x200a,
  0x2028, 0x2029, 0x202f, 0x205f, 0x3000, 0xfeff,
]);

function validateEvidenceState(requirement: Requirement, state: unknown): EvidenceState {
  if (!EVIDENCE_STATES.includes(state as EvidenceState)) {
    throw new TypeError(
      `${requirement} must be VERIFIED, UNVERIFIED, or ABSENT; received ${String(state)}`,
    );
  }
  return state as EvidenceState;
}

function assertCanonicalSubject(subject: unknown): asserts subject is string {
  if (typeof subject !== 'string' || subject.length === 0) {
    throw new TypeError('identity.subject must be a non-empty canonical string');
  }
  if (
    BOUNDARY_WHITESPACE.has(subject.charCodeAt(0)) ||
    BOUNDARY_WHITESPACE.has(subject.charCodeAt(subject.length - 1))
  ) {
    throw new TypeError('identity.subject must not have leading or trailing boundary whitespace');
  }
  for (let index = 0; index < subject.length; index += 1) {
    const codeUnit = subject.charCodeAt(index);
    if (codeUnit >= 0xd800 && codeUnit <= 0xdbff) {
      const nextCodeUnit = subject.charCodeAt(index + 1);
      if (index + 1 >= subject.length || nextCodeUnit < 0xdc00 || nextCodeUnit > 0xdfff) {
        throw new TypeError('identity.subject must not contain unpaired UTF-16 surrogates');
      }
      index += 1;
    } else if (codeUnit >= 0xdc00 && codeUnit <= 0xdfff) {
      throw new TypeError('identity.subject must not contain unpaired UTF-16 surrogates');
    }
  }
}

function isStrictTimestamp(value: string): boolean {
  const match = TIMESTAMP_PATTERN.exec(value);
  if (!match) return false;
  const [, yearText, monthText, dayText, hourText, minuteText, secondText, zone] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const second = Number(secondText);
  if (year < 1 || month < 1 || month > 12 || hour > 23 || minute > 59 || second > 59) {
    return false;
  }
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (day < 1 || day > daysInMonth[month - 1]) return false;
  if (zone !== 'Z') {
    const zoneHours = Number(zone.slice(1, 3));
    const zoneMinutes = Number(zone.slice(4, 6));
    if (zoneHours > 23 || zoneMinutes > 59) return false;
  }
  return true;
}

export function computeDecisionBundleSha256(
  subject: string,
  evaluatedAt: string,
  evidence: DecisionEvidence,
): string {
  assertCanonicalSubject(subject);
  const orderedEvidence = Object.fromEntries(
    Object.entries(evidence).sort(([left], [right]) => left.localeCompare(right)),
  );
  const canonicalBundle = JSON.stringify({
    evaluated_at: evaluatedAt,
    evidence: orderedEvidence,
    subject,
  });
  return createHash('sha256').update(canonicalBundle, 'utf8').digest('hex');
}

function validateBundle(bundle: DecisionEvidenceBundle): DecisionEvidenceBundle {
  if (typeof bundle !== 'object' || bundle === null || Array.isArray(bundle)) {
    throw new TypeError('decision bundle must be an object');
  }
  const { identity, evidence } = bundle;
  if (typeof identity !== 'object' || identity === null || Array.isArray(identity)) {
    throw new TypeError('decision bundle identity must be an object');
  }
  const identitySnapshot: DecisionBundleIdentity = {
    subject: identity.subject,
    bundle_sha256: identity.bundle_sha256,
    evaluated_at: identity.evaluated_at,
  };
  assertCanonicalSubject(identitySnapshot.subject);
  if (
    typeof identitySnapshot.bundle_sha256 !== 'string' ||
    !/^[0-9a-f]{64}$/.test(identitySnapshot.bundle_sha256)
  ) {
    throw new TypeError('identity.bundle_sha256 must be a lowercase sha256 digest');
  }
  if (
    typeof identitySnapshot.evaluated_at !== 'string' ||
    !isStrictTimestamp(identitySnapshot.evaluated_at)
  ) {
    throw new TypeError('identity.evaluated_at must be a timezone-qualified timestamp');
  }
  if (typeof evidence !== 'object' || evidence === null || Array.isArray(evidence)) {
    throw new TypeError('decision bundle evidence must be an object');
  }
  const evidenceSnapshot = Object.fromEntries(Object.entries(evidence)) as DecisionEvidence;
  const unknownRequirement = Object.keys(evidenceSnapshot).find(
    (name) => !REQUIREMENT_NAMES.has(name),
  );
  if (unknownRequirement) {
    throw new TypeError(`unknown evidence requirement: ${unknownRequirement}`);
  }
  const expectedDigest = computeDecisionBundleSha256(
    identitySnapshot.subject,
    identitySnapshot.evaluated_at,
    evidenceSnapshot,
  );
  if (identitySnapshot.bundle_sha256 !== expectedDigest) {
    throw new TypeError(
      'identity.bundle_sha256 does not match the canonical subject, evaluated_at, and evidence bytes',
    );
  }
  return {
    identity: Object.freeze(identitySnapshot),
    evidence: Object.freeze(evidenceSnapshot),
  };
}

/**
 * Return the highest consecutively satisfied D-SLSA level.
 *
 * Every requirement at a level must be VERIFIED. UNVERIFIED and ABSENT both
 * block advancement; later-level evidence cannot skip an earlier level.
 */
export function gradeDecision(bundle: DecisionEvidenceBundle): GradeResult {
  const { identity, evidence } = validateBundle(bundle);
  const states = new Map<Requirement, EvidenceState>();
  for (const requirements of Object.values(LEVEL_REQUIREMENTS)) {
    for (const requirement of requirements) {
      const supplied = Object.hasOwn(evidence, requirement) ? evidence[requirement] : 'ABSENT';
      states.set(requirement, validateEvidenceState(requirement, supplied));
    }
  }

  let achievedLevel: DSeLevel = 'D0';
  const blockingRequirements: Requirement[] = [];

  for (const level of ['D1', 'D2', 'D3', 'D4'] as const) {
    const requirements = LEVEL_REQUIREMENTS[level];
    const blocked = requirements.filter((requirement) => states.get(requirement) !== 'VERIFIED');
    if (blocked.length > 0) {
      blockingRequirements.push(...blocked);
      break;
    }
    achievedLevel = level;
  }

  const satisfiedRequirements: Requirement[] = [];
  const unverifiedRequirements: Requirement[] = [];
  const absentRequirements: Requirement[] = [];
  for (const [requirement, state] of states) {
    if (state === 'VERIFIED') satisfiedRequirements.push(requirement);
    if (state === 'UNVERIFIED') unverifiedRequirements.push(requirement);
    if (state === 'ABSENT') absentRequirements.push(requirement);
  }

  return {
    bundle_subject: identity.subject,
    bundle_sha256: identity.bundle_sha256,
    evaluated_at: identity.evaluated_at,
    achieved_level: achievedLevel,
    evaluation_state: 'EVALUATED_FROM_SUPPLIED_EVIDENCE',
    satisfied_requirements: satisfiedRequirements,
    blocking_requirements: blockingRequirements,
    unverified_requirements: unverifiedRequirements,
    absent_requirements: absentRequirements,
    note: 'This result grades only the supplied evidence states. It is not a certification, publication, or independent audit.',
  };
}

export interface LambdaCaseStudy {
  claim: 'CONJECTURE_1';
  state: 'OPEN';
  display: 'GRAY';
  machine_checked: false;
}

const LAMBDA_CASE_STUDY: LambdaCaseStudy = {
  claim: 'CONJECTURE_1',
  state: 'OPEN',
  display: 'GRAY',
  machine_checked: false,
};

/**
 * Guard the doctrine-bearing Lambda case study against an accidental green or
 * closed representation.
 */
export function assertLambdaCaseStudy(value: unknown): LambdaCaseStudy {
  if (
    typeof value !== 'object' ||
    value === null ||
    Object.keys(value).sort().join(',') !== Object.keys(LAMBDA_CASE_STUDY).sort().join(',') ||
    !Object.entries(LAMBDA_CASE_STUDY).every(
      ([key, expected]) => (value as Record<string, unknown>)[key] === expected,
    )
  ) {
    throw new Error(
      'Lambda uniqueness must remain CONJECTURE_1, OPEN, GRAY, and not machine-checked',
    );
  }
  return { ...LAMBDA_CASE_STUDY };
}

export interface TheoremUPremises {
  premise_u1: EvidenceState;
  premise_u2: EvidenceState;
  premise_u3: EvidenceState;
}

const THEOREM_U_PREMISES = ['premise_u1', 'premise_u2', 'premise_u3'] as const;

export function evaluateTheoremU(
  premises: unknown,
): 'CONDITIONALLY_SATISFIED' | 'CONDITIONAL_OPEN' {
  if (
    typeof premises !== 'object' ||
    premises === null ||
    Object.keys(premises).sort().join(',') !== [...THEOREM_U_PREMISES].sort().join(',')
  ) {
    return 'CONDITIONAL_OPEN';
  }
  const supplied = premises as Record<string, unknown>;
  const states = THEOREM_U_PREMISES.map((name) =>
    validateEvidenceState(name as Requirement, supplied[name]),
  );
  return states.every((state) => state === 'VERIFIED')
    ? 'CONDITIONALLY_SATISFIED'
    : 'CONDITIONAL_OPEN';
}
