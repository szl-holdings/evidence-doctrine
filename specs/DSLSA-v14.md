# Decision-SLSA v1.4

Status: **PUBLIC DRAFT / NOT A CERTIFICATION**

Decision-SLSA (D-SLSA) is a cumulative maturity model for the evidence attached
to a governed decision. It borrows SLSA's evidence-oriented, levelled structure
but evaluates a different object: the decision record rather than a software
build. SLSA v1.2 is the upstream supply-chain reference:
<https://slsa.dev/spec/v1.2/>.

This draft does not alter, extend, or claim conformance with the SLSA
specification. “Decision-SLSA” and D1–D4 are local draft terms.

## 1. Evaluation object

An evaluation applies to one immutable decision evidence bundle. The bundle must
identify its subject and evaluation time. Claims about an organization, product,
or historic run cannot be inferred from one bundle.

The reference evaluators bind that identity to the evaluated states with
`bundle_sha256`. Its input is UTF-8 JSON with keys sorted lexicographically and
no insignificant whitespace:
`{"evaluated_at":<timestamp>,"evidence":<state-map>,"subject":<subject>}`.
The digest field itself is excluded from those canonical bytes. A mismatched
digest or an impossible calendar timestamp fails before a level is awarded.

Each requirement has one of three states:

- `VERIFIED`: the evaluator checked the referenced evidence.
- `UNVERIFIED`: a claim or reference exists but the evaluator did not verify it.
- `ABSENT`: no evidence was supplied.

Only `VERIFIED` satisfies a requirement.

## 2. Cumulative levels

### D1 — recorded decision

The bundle identifies:

1. the inputs used by the decision;
2. the policy applied to those inputs; and
3. the decision output.

Identifiers must be sufficient to distinguish versions. A narrative summary
without input, policy, and output identifiers is D0.

### D2 — signed and tamper-evident

D1 is satisfied, and:

1. the signature over the decision bundle is verified against an identified
   trust anchor; and
2. tamper evidence covering the decision bundle is verified.

An unsigned record, placeholder signature, self-asserted “signed” label, or
unverified envelope does not satisfy D2.

### D3 — independently logged and replayable

D2 is satisfied, and:

1. inclusion in a third-party transparency log is verified;
2. a replay from the identified inputs and policy produces a byte-identical
   canonical decision output; and
3. an offline verifier can validate the bundle without the originating service.

An internal append-only ledger is useful evidence but does not satisfy the
third-party-log requirement by itself. A semantically similar replay is not
byte-identical replay.

### D4 — attested and machine-checked

D3 is satisfied, and:

1. hardware-attested execution is verified against an allowlisted measurement,
   freshness policy, and workload binding;
2. the applied decision policy has a formal specification; and
3. at least one policy denial relevant to the evaluated surface is
   machine-checked.

Readable hardware metadata, simulated quotes, sample measurements, and
unverified attestation documents do not satisfy D4.

## 3. Monotonicity and fail-closed grading

Levels cannot be skipped. The evaluator stops at the first level containing an
`UNVERIFIED` or `ABSENT` requirement. Later evidence remains visible but cannot
raise the grade.

The grade describes the supplied bundle at evaluation time. It is not a
certification, warranty, compliance designation, or product-wide claim.

## 4. Lambda case study

Lambda uniqueness is represented as:

```json
{
  "claim": "CONJECTURE_1",
  "state": "OPEN",
  "display": "GRAY",
  "machine_checked": false
}
```

It must never be rendered green or described as closed. Theorem U is conditional
on its declared premises and does not convert Conjecture 1 into a theorem.

## 5. Interoperability

A portable D-SLSA evaluation should serialize:

- the bundle identifier and canonicalization method;
- every requirement state;
- the evidence URI and digest for each `VERIFIED` state;
- evaluator identity and evaluation time;
- the achieved level and first blocking requirements; and
- limitations, including unavailable external systems.

The reference implementations in this package grade explicit states only. They
do not fetch evidence, validate signatures, query a transparency log, replay a
model, or verify a hardware quote. Those verifiers must run before a caller sets
the corresponding state to `VERIFIED`.

## 6. Publication boundary

The reference source is public at
<https://github.com/szl-holdings/evidence-doctrine>. No D-SLSA DOI has been
minted. The previously proposed concept DOI `10.5281/zenodo.19944926` resolves
to the Ouroboros Thesis v21 record `10.5281/zenodo.20490218`, not this
specification. D-SLSA requires a new Zenodo deposition and concept DOI; the
unrelated Ouroboros DOI must not be repurposed.

Publication of source does not establish adoption, independent validation, or
any D-SLSA level for an evaluated decision bundle.
