# Evidence Doctrine

Status: **PUBLIC REFERENCE IMPLEMENTATION / NOT A CERTIFICATION**

This Apache-2.0 reference package defines Decision-SLSA (D-SLSA), a fail-closed
maturity model for evidence attached to governed decisions. It is designed to
make the difference between a recorded decision, a signed record, a replayable
record, and hardware-attested execution mechanically visible.

The standalone source is published at
<https://github.com/szl-holdings/evidence-doctrine>. The package remains mirrored
inside the SZL Holdings platform monorepo so both copies can be compared at an
exact source commit.

No D-SLSA DOI is currently authorized. The previously proposed concept DOI
`10.5281/zenodo.19944926` resolves to the Ouroboros Thesis v21 record
`10.5281/zenodo.20490218`; it is not a D-SLSA deposit and must not be cited as
one. A future D-SLSA release requires a new Zenodo deposition and a newly minted
concept DOI.

## Levels

| Level | Cumulative requirements |
|---|---|
| D0 | The supplied evidence does not satisfy D1. |
| D1 | Records identify decision inputs, the policy applied, and the output. |
| D2 | D1 plus a verified signature and verified tamper evidence. |
| D3 | D2 plus a verified third-party transparency log, byte-identical replay, and offline verification. |
| D4 | D3 plus verified hardware-attested execution, a formally specified policy, and a machine-checked denial. |

Levels are cumulative. An unverified or absent requirement stops advancement at
the preceding level. A signature by itself cannot imply D2, D3, or D4.

## Run

```text
pnpm --filter @szl-holdings/evidence-doctrine test
pnpm --filter @szl-holdings/evidence-doctrine typecheck
```

The TypeScript and Python references implement the same requirement names and
monotonic grading rule. They accept explicit `VERIFIED`, `UNVERIFIED`, and
`ABSENT` states; truthy values and marketing labels are not accepted as proof.
Every grading input is a bundle with a non-empty subject, a lowercase sha256
bundle digest, and a timezone-qualified evaluation timestamp. The grader copies
that identity into its result so a D1-or-higher label cannot become detached
from the exact evidence bundle that was evaluated. Both references recompute
the digest over the canonical UTF-8 JSON subject, timestamp, and evidence map;
a stale or fabricated digest and an impossible calendar timestamp fail closed.

## Lambda case-study boundary

The included guard encodes Lambda uniqueness as **Conjecture 1**: open, gray,
and not machine-checked. It rejects a green, proved, or machine-checked
representation. Theorem U is conditional on its declared premises and does not
close Conjecture 1.

See [the draft specification](specs/DSLSA-v14.md) and the
[conservative self-assessment](docs/SZL_SELF_ASSESSMENT.md).
