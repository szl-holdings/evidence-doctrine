// SPDX-License-Identifier: Apache-2.0

import assert from 'node:assert/strict';
import test from 'node:test';
import {
  assertLambdaCaseStudy,
  computeDecisionBundleSha256,
  type DecisionEvidence,
  type DecisionEvidenceBundle,
  evaluateTheoremU,
  gradeDecision,
  LEVEL_REQUIREMENTS,
} from './index.ts';

const BUNDLE_IDENTITY = {
  subject: 'decision:fixture:001',
  evaluated_at: '2026-07-26T07:00:00Z',
};

function bundle(
  evidence: DecisionEvidence,
  identity: Partial<DecisionEvidenceBundle['identity']> = {},
): DecisionEvidenceBundle {
  const baseIdentity = { ...BUNDLE_IDENTITY, ...identity };
  return {
    identity: {
      ...baseIdentity,
      bundle_sha256:
        identity.bundle_sha256 ??
        computeDecisionBundleSha256(baseIdentity.subject, baseIdentity.evaluated_at, evidence),
    },
    evidence,
  };
}

function verifiedThrough(level: 'D1' | 'D2' | 'D3' | 'D4'): DecisionEvidence {
  const evidence: DecisionEvidence = {};
  for (const current of ['D1', 'D2', 'D3', 'D4'] as const) {
    for (const requirement of LEVEL_REQUIREMENTS[current]) {
      evidence[requirement] = 'VERIFIED';
    }
    if (current === level) break;
  }
  return evidence;
}

test('D0 when a D1 record is incomplete', () => {
  const result = gradeDecision(
    bundle({
      inputs_recorded: 'VERIFIED',
      policy_recorded: 'UNVERIFIED',
      output_recorded: 'VERIFIED',
    }),
  );
  assert.equal(result.achieved_level, 'D0');
  assert.deepEqual(result.blocking_requirements, ['policy_recorded']);
  assert.equal(result.bundle_subject, BUNDLE_IDENTITY.subject);
  assert.equal(
    result.bundle_sha256,
    'b495d3bb901fc6bdc4ea3b7ad9c32932fcc220ee02de8dd2e192c4ab15a765ee',
  );
  assert.equal(result.evaluated_at, BUNDLE_IDENTITY.evaluated_at);
});

test('D1 records inputs, policy, and output', () => {
  assert.equal(gradeDecision(bundle(verifiedThrough('D1'))).achieved_level, 'D1');
});

test('later evidence cannot skip an unverified D2 requirement', () => {
  const evidence = verifiedThrough('D4');
  evidence.signature_verified = 'UNVERIFIED';
  assert.equal(gradeDecision(bundle(evidence)).achieved_level, 'D1');
});

test('D4 requires every cumulative requirement', () => {
  const result = gradeDecision(bundle(verifiedThrough('D4')));
  assert.equal(result.achieved_level, 'D4');
  assert.equal(result.unverified_requirements.length, 0);
  assert.equal(result.absent_requirements.length, 0);
});

test('truthy values are rejected instead of being treated as evidence', () => {
  assert.throws(
    () => gradeDecision(bundle({ inputs_recorded: true as never })),
    /must be VERIFIED, UNVERIFIED, or ABSENT/,
  );
  assert.throws(
    () => gradeDecision(bundle({ inputs_recorded: null as never })),
    /must be VERIFIED, UNVERIFIED, or ABSENT/,
  );
});

test('bundle identity is required and validated before grading', () => {
  assert.throws(
    () => gradeDecision({ evidence: verifiedThrough('D1') } as never),
    /decision bundle must contain exactly/,
  );
  assert.throws(
    () =>
      gradeDecision(
        bundle(verifiedThrough('D1'), {
          bundle_sha256: 'NOT-A-DIGEST',
        }),
      ),
    /lowercase sha256 digest/,
  );
  assert.throws(
    () =>
      gradeDecision(
        bundle(verifiedThrough('D1'), {
          evaluated_at: '2026-07-26T07:00:00',
        }),
      ),
    /timezone-qualified timestamp/,
  );
});

test('unbound bundle and identity claims fail closed', () => {
  const valid = bundle(verifiedThrough('D1'));
  assert.throws(
    () => gradeDecision({ ...valid, certification: 'D4' } as never),
    /decision bundle must contain exactly/,
  );
  assert.throws(
    () =>
      gradeDecision({
        ...valid,
        identity: {
          ...valid.identity,
          certified: true,
        },
      } as never),
    /decision bundle identity must contain exactly/,
  );
});

test('hidden, symbol-keyed, accessor, and inherited claims fail closed', () => {
  const hidden = bundle(verifiedThrough('D1')) as DecisionEvidenceBundle &
    Record<string, unknown>;
  Object.defineProperty(hidden, 'certification', {
    value: 'D4',
    enumerable: false,
  });
  assert.throws(() => gradeDecision(hidden), /decision bundle must contain exactly/);

  const symbolClaim = bundle(verifiedThrough('D1')) as DecisionEvidenceBundle &
    Record<PropertyKey, unknown>;
  Object.defineProperty(symbolClaim, Symbol('certification'), {
    value: 'D4',
    enumerable: false,
  });
  assert.throws(() => gradeDecision(symbolClaim), /only string keys/);

  const accessorIdentity = bundle(verifiedThrough('D1'));
  const digest = accessorIdentity.identity.bundle_sha256;
  Object.defineProperty(accessorIdentity.identity, 'bundle_sha256', {
    get: () => digest,
    enumerable: true,
  });
  assert.throws(
    () => gradeDecision(accessorIdentity),
    /bundle_sha256 must be an enumerable data property/,
  );

  const inherited = Object.assign(
    Object.create({ certification: 'D4' }),
    bundle(verifiedThrough('D1')),
  );
  assert.throws(() => gradeDecision(inherited), /decision bundle must be a plain object/);
});

test('bundle digest is recomputed from canonical evidence bytes', () => {
  const d1Bundle = bundle(verifiedThrough('D1'));
  const reusedDigest = d1Bundle.identity.bundle_sha256;
  d1Bundle.evidence.policy_recorded = 'UNVERIFIED';
  assert.throws(() => gradeDecision(d1Bundle), /does not match the canonical/);
  assert.throws(
    () => gradeDecision(bundle(verifiedThrough('D4'), { bundle_sha256: reusedDigest })),
    /does not match the canonical/,
  );
});

test('impossible calendar timestamps are rejected instead of normalized', () => {
  assert.throws(
    () =>
      gradeDecision(
        bundle(verifiedThrough('D1'), {
          evaluated_at: '2026-02-30T07:00:00Z',
        }),
      ),
    /timezone-qualified timestamp/,
  );
});

test('grading uses the same evidence snapshot that was hashed', () => {
  let policyReads = 0;
  const evidence: DecisionEvidence = {
    inputs_recorded: 'VERIFIED',
    get policy_recorded() {
      policyReads += 1;
      return policyReads === 1 ? 'UNVERIFIED' : 'VERIFIED';
    },
    output_recorded: 'VERIFIED',
  };
  const hashedEvidence: DecisionEvidence = {
    inputs_recorded: 'VERIFIED',
    policy_recorded: 'UNVERIFIED',
    output_recorded: 'VERIFIED',
  };
  const result = gradeDecision({
    identity: {
      ...BUNDLE_IDENTITY,
      bundle_sha256: computeDecisionBundleSha256(
        BUNDLE_IDENTITY.subject,
        BUNDLE_IDENTITY.evaluated_at,
        hashedEvidence,
      ),
    },
    evidence,
  });

  assert.equal(result.achieved_level, 'D0');
  assert.deepEqual(result.blocking_requirements, ['policy_recorded']);
  assert.equal(policyReads, 1);
});

function assertRejectedEvidence(evidence: unknown, message: RegExp): void {
  assert.throws(
    () => computeDecisionBundleSha256(
      BUNDLE_IDENTITY.subject, BUNDLE_IDENTITY.evaluated_at, evidence as DecisionEvidence,
    ),
    message,
  );
  // Do not let the digest helper reject the fixture before the grader is exercised.
  const supplied = bundle({}, { bundle_sha256: '0'.repeat(64) });
  supplied.evidence = evidence as DecisionEvidence;
  assert.throws(() => gradeDecision(supplied), message);
}

test('empty unknown keys cannot mask other unknown evidence fields', () => {
  for (const evidence of [
    { '': 'ABSENT' },
    { '': 'ABSENT', certification: 'D4' },
    { certification: 'D4', '': 'ABSENT' },
    JSON.parse('{"":"ABSENT","toJSON":"VERIFIED"}'),
  ]) {
    assertRejectedEvidence(evidence, /unknown evidence requirement/);
  }
});

test('callable toJSON cannot substitute empty hashed evidence for a D1 grade', () => {
  let calls = 0;
  const evidence = {
    '': 'ABSENT',
    ...verifiedThrough('D1'),
    toJSON() { calls += 1; return {}; },
  };
  const supplied = bundle({});
  supplied.evidence = evidence;
  assert.throws(() => gradeDecision(supplied), /unknown evidence requirement/);
  assertRejectedEvidence(evidence, /unknown evidence requirement/);
  assert.equal(calls, 0);
});

test('all evidence own keys and descriptors belong to the schema', () => {
  for (const enumerable of [true, false]) {
    const symbol = Object.defineProperty({}, Symbol('claim'), { value: 'VERIFIED', enumerable });
    assertRejectedEvidence(symbol, /only string keys/);
  }
  for (const key of ['', 'toJSON', 'certification', '__proto__']) {
    const hidden = Object.defineProperty({}, key, { value: 'VERIFIED', enumerable: false });
    assertRejectedEvidence(hidden, /unknown evidence requirement/);
  }
  const hiddenState = Object.defineProperty({}, 'inputs_recorded', {
    value: 'VERIFIED', enumerable: false,
  });
  assertRejectedEvidence(hiddenState, /must be an enumerable own property/);
});

test('the complete evidence schema is checked before any getter is read', () => {
  let reads = 0;
  for (const key of ['', 'toJSON', Symbol('claim')]) {
    const evidence = {
      get inputs_recorded() { reads += 1; return 'VERIFIED'; },
      [key]: () => ({}),
    };
    assertRejectedEvidence(evidence, /unknown evidence requirement|only string keys/);
  }
  const hidden = {
    get inputs_recorded() { reads += 1; return 'VERIFIED'; },
  };
  Object.defineProperty(hidden, 'policy_recorded', { value: 'VERIFIED', enumerable: false });
  assertRejectedEvidence(hidden, /must be an enumerable own property/);
  assert.equal(reads, 0);
});

test('digest helper snapshots legitimate getters once and rejects non-state results', () => {
  let reads = 0;
  const evidence: DecisionEvidence = {
    get inputs_recorded() { reads += 1; return 'VERIFIED' as const; },
  };
  const expected = computeDecisionBundleSha256(
    BUNDLE_IDENTITY.subject, BUNDLE_IDENTITY.evaluated_at, { inputs_recorded: 'VERIFIED' },
  );
  assert.equal(computeDecisionBundleSha256(
    BUNDLE_IDENTITY.subject, BUNDLE_IDENTITY.evaluated_at, evidence,
  ), expected);
  assert.equal(reads, 1);
  let calls = 0;
  assertRejectedEvidence({
    get inputs_recorded() { return () => { calls += 1; return 'VERIFIED'; }; },
  }, /must be VERIFIED, UNVERIFIED, or ABSENT/);
  assert.equal(calls, 0);
});

test('getter invocation preserves its receiver and ignores a shadowed call property', () => {
  let shadowCalls = 0;
  for (const shadow of [null, () => { shadowCalls += 1; return 'ABSENT'; }]) {
    const supplied = bundle({ inputs_recorded: 'VERIFIED' });
    let reads = 0;
    const getter = function (this: DecisionEvidence) {
      assert.equal(this, supplied.evidence);
      reads += 1;
      return 'VERIFIED';
    };
    Object.defineProperty(getter, 'call', { value: shadow });
    Object.defineProperty(supplied.evidence, 'inputs_recorded', { get: getter, enumerable: true });
    assert.equal(gradeDecision(supplied).satisfied_requirements[0], 'inputs_recorded');
    assert.equal(reads, 1);
    assert.equal(computeDecisionBundleSha256(
      BUNDLE_IDENTITY.subject, BUNDLE_IDENTITY.evaluated_at, supplied.evidence,
    ), supplied.identity.bundle_sha256);
    assert.equal(reads, 2);
  }
  assert.equal(shadowCalls, 0);
});

test('evidence rejects custom prototypes and non-record values', () => {
  for (const evidence of [null, undefined, [], 'VERIFIED', 1, () => ({})]) {
    assertRejectedEvidence(evidence, /evidence must be an object/);
  }
  for (const evidence of [
    Object.create({ inputs_recorded: 'VERIFIED' }),
    Object.assign(Object.create({}), verifiedThrough('D1')),
    new Date('2026-09-30T00:00:00Z'),
  ]) {
    assertRejectedEvidence(evidence, /evidence must be a plain object/);
  }
});

test('invalid states cannot run serialization or coercion hooks', () => {
  let calls = 0;
  const hook = () => { calls += 1; return 'VERIFIED'; };
  for (const state of [true, null, undefined, 1, Symbol('VERIFIED'), hook,
    { toJSON: hook, toString: hook, [Symbol.toPrimitive]: hook }]) {
    assertRejectedEvidence({ inputs_recorded: state }, /must be VERIFIED, UNVERIFIED, or ABSENT/);
  }
  assert.equal(calls, 0);
});

test('digest helper rejects non-string timestamps without running their hooks', () => {
  let calls = 0;
  assert.throws(() => computeDecisionBundleSha256(
    BUNDLE_IDENTITY.subject,
    { toJSON() { calls += 1; return BUNDLE_IDENTITY.evaluated_at; } } as never,
    {},
  ), /timezone-qualified timestamp/);
  assert.equal(calls, 0);
});

test('plain, null-prototype, and frozen evidence preserve canonical hashes and grades', () => {
  const evidence = verifiedThrough('D1');
  const canonical = bundle(evidence);
  const expected = gradeDecision(canonical);
  const reordered = Object.fromEntries(Object.entries(evidence).reverse());
  const nullPrototype = Object.assign(Object.create(null), reordered);
  for (const candidate of [reordered, nullPrototype, Object.freeze({ ...evidence })]) {
    assert.equal(bundle(candidate).identity.bundle_sha256, canonical.identity.bundle_sha256);
    assert.deepEqual(gradeDecision(bundle(candidate)), expected);
  }
  assert.equal(gradeDecision(bundle({})).achieved_level, 'D0');
  assert.equal(gradeDecision(bundle({ inputs_recorded: 'ABSENT' })).achieved_level, 'D0');
});

test('unpaired UTF-16 surrogates are rejected before hashing or grading', () => {
  const invalidSubject = '\ud800';
  assert.throws(
    () =>
      computeDecisionBundleSha256(
        invalidSubject,
        BUNDLE_IDENTITY.evaluated_at,
        verifiedThrough('D1'),
      ),
    /unpaired UTF-16 surrogates/,
  );
  assert.throws(
    () =>
      gradeDecision({
        identity: {
          ...BUNDLE_IDENTITY,
          subject: invalidSubject,
          bundle_sha256: '0'.repeat(64),
        },
        evidence: verifiedThrough('D1'),
      }),
    /unpaired UTF-16 surrogates/,
  );
});

test('subject boundary whitespace uses the same explicit portable set', () => {
  for (const invalidSubject of ['\u0085subject', '\ufeffsubject']) {
    assert.throws(
      () =>
        computeDecisionBundleSha256(
          invalidSubject,
          BUNDLE_IDENTITY.evaluated_at,
          verifiedThrough('D1'),
        ),
      /boundary whitespace/,
    );
  }
});

test('Lambda uniqueness stays open, gray, and not machine-checked', () => {
  assert.deepEqual(
    assertLambdaCaseStudy({
      claim: 'CONJECTURE_1',
      state: 'OPEN',
      display: 'GRAY',
      machine_checked: false,
    }),
    {
      claim: 'CONJECTURE_1',
      state: 'OPEN',
      display: 'GRAY',
      machine_checked: false,
    },
  );
  assert.throws(
    () =>
      assertLambdaCaseStudy({
        claim: 'CONJECTURE_1',
        state: 'OPEN',
        display: 'GRAY',
        machine_checked: true,
      } as never),
    /not machine-checked/,
  );
  assert.throws(
    () =>
      assertLambdaCaseStudy({
        claim: 'CONJECTURE_1',
        state: 'OPEN',
        display: 'GRAY',
        machine_checked: false,
        conclusion: 'PROVED',
      }),
    /must remain CONJECTURE_1/,
  );
});

test('Theorem U reports only a conditional result', () => {
  assert.equal(
    evaluateTheoremU({
      premise_u1: 'VERIFIED',
      premise_u2: 'VERIFIED',
      premise_u3: 'VERIFIED',
    }),
    'CONDITIONALLY_SATISFIED',
  );
  assert.equal(
    evaluateTheoremU({
      premise_u1: 'VERIFIED',
      premise_u2: 'UNVERIFIED',
      premise_u3: 'VERIFIED',
    }),
    'CONDITIONAL_OPEN',
  );
  assert.equal(
    evaluateTheoremU({
      premise_u1: 'VERIFIED',
    } as never),
    'CONDITIONAL_OPEN',
  );
  assert.equal(
    evaluateTheoremU({
      premise_u1: 'VERIFIED',
      premise_u2: 'VERIFIED',
      premise_u3: 'VERIFIED',
      conclusion: 'PROVED',
    } as never),
    'CONDITIONAL_OPEN',
  );
});
