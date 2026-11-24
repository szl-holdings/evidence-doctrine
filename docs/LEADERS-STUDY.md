# Leaders Study: evidence-doctrine

**STATUS: PROPOSE-ONLY DOCUMENT.** This file adds information only. It changes no code, spec, schema, or grading rule. All absorb candidates (A1-A4) are UNAPPROVED and each needs its own gated lap. A5 and A6 are OPEN questions; this study takes no side. Zero merges. The repo's own doctrine is unchanged and preserved verbatim, including "PUBLIC REFERENCE IMPLEMENTATION / NOT A CERTIFICATION".

## What this repo is (from its own receipts, not asserted here)

evidence-doctrine is the standalone Apache-2.0 reference package defining Decision-SLSA (D-SLSA), a fail-closed maturity model for evidence attached to governed decisions. Its README defines five cumulative levels: D0 (supplied evidence does not satisfy D1), D1 (records identify decision inputs, policy applied, and output), D2 (D1 plus verified signature and verified tamper evidence), D3 (D2 plus verified third-party transparency log, byte-identical replay, offline verification), D4 (D3 plus verified hardware-attested execution, formally specified policy, machine-checked denial). Levels are cumulative; an unverified or absent requirement stops advancement at the preceding level; a signature by itself cannot imply D2, D3, or D4. The TypeScript and Python references implement the same requirement names and monotonic grading rule, accept only explicit VERIFIED, UNVERIFIED, ABSENT states (truthy values and marketing labels rejected), recompute the canonical digest over UTF-8 JSON, and reject hidden, symbol-keyed, accessor-backed, or custom-prototype claims fail-closed. The Lambda case-study encodes Lambda uniqueness as Conjecture 1: open, gray, not machine-checked; Theorem U is conditional and does not close it. No D-SLSA DOI is authorized; the previously proposed concept DOI resolves to the Ouroboros Thesis v21 record and must not be cited as a D-SLSA deposit. This study repeats only what the repo already records.

## Domain leaders studied (2026-11-24, web-verified)

### L1. RFC 6962 - Certificate Transparency (Laurie, Langley, Kasper; IETF RFC 6962)

The leader in append-only, publicly auditable evidence structures: a Merkle tree of commitments with inclusion proofs, a signed tree head, and a gossip/consistency mechanism so that log viewers can detect split-view or backdated evidence. This is the archetypal mechanism behind what D-SLSA D3 calls "a verified third-party transparency log". Gap: D3 names the transparency-log requirement but the package's own receipts do not define the detection mechanism (inclusion proof and signed tree head verify; consistency/split-view detection beyond a single log read is not specified). Absorb candidate **A1 (UNAPPROVED): a docs-only note describing what a D3 compliant transparency witness would minimally require (append-only structure, inclusion proof, signed tree head, split-view detection), clearly marked as a study note, no spec change, no claim that D-SLSA today provides any of it.**

### L2. Sigstore Rekor - production transparency log for signed software (rekor-spec.md; docs.sigstore.dev)

The leader in operating transparency logging at ecosystem scale: Rekor is an append-only, hash-receipt-backed log that makes signed-software commitments publicly countable and independently verifiable, with monitored entries and offline-verifiable signed entry timestamps. Gap: the repo's D2 stops at verified signature plus tamper evidence and D3 requires a verified log, but no member of the estate receipts against an external log today, so "publicly countable evidence" is unproven estate-wide. Absorb candidate **A2 (UNAPPROVED): a study-only note evaluating (documentation only) what it would mean for an estate decision receipt to be externally countable, with honest UNAVAILABLE marking today; no integration, no new service, no promise.**

### L3. Reproducible Builds - increasing the integrity of software supply chains (Lamb and Zacchiro, arXiv 2104.06020)

The leader in byte-identical replay: a framework that defines reproducibility in layers (same source, same build environment, documented environment), treats every nondeterminism as a defect, and supplies tools to detect and eliminate it. D-SLSA D3's byte-identical replay requirement is exactly this program applied to decision records. Gap: the repo's grader recomputes the canonical digest and fails closed on stale or fabricated digests, but a byte-identical replay of the DECISION pipeline (not just digest recomputation of the bundle) is not receipted anywhere in this repo. Absorb candidate **A3 (UNAPPROVED): a docs-only note distinguishing digest-recomputation (present today) from full decision-pipeline replay (not receipted), with no assertion that grading implies replayability.**

### L4. TCG DICE - Device Identifier Composition Engine (TCG DICE Attestation Architecture; Hardware Requirements for a DICE Device)

The leader in cheap, hardware-rooted attestation: DICE derives a unique device secret per layer, compounds it with each boot component so that a gatekeeper can prove hardware execution identity without a full TPM; it powers real-world attestation chains. D-SLSA D4 requires verified hardware-attested execution, a formally specified policy, and a machine-checked denial. Gap: D4 is unreachable in this repo by design (nothing in it receipts against any TPM/DICE today; no TEE link), which the README does not contradict but also does not enumerate. Absorb candidate **A4 (UNAPPROVED): a study-only note that surveys what D4 would minimally require (hardware root of measurement per the DICE layering architecture, verifiable attestation evidence, and a formal policy encoding) and honestly records the estate today as UNAVAILABLE - a survey note, no hardware claim, no roadmap promise.**

## Open questions (no sides taken)

- **A5 (OPEN):** The README records that a previously proposed concept DOI resolves to the Ouroboros Thesis v21 record and must not be cited as a D-SLSA deposit, and that no D-SLSA DOI is currently authorized. Whether a future D-SLSA Zenodo deposition and new concept DOI should be pursued is owner terrain; this study only notes the current state. No recommendation is implied.
- **A6 (OPEN):** The package is mirrored inside the platform monorepo so both copies can be compared at an exact source commit. The mirror-sync governance (who verifies agreement, at what cadence, with what receipt) is an estate-level question a leaders study cannot adjudicate.

## Doctrine preservation (verbatim obligations)

PUBLIC REFERENCE IMPLEMENTATION / NOT A CERTIFICATION; levels are cumulative; an unverified or absent requirement stops advancement at the preceding level; a signature by itself cannot imply D2, D3, or D4; only explicit VERIFIED, UNVERIFIED, ABSENT states accepted; truthy values and marketing labels are not proof; grader copies validated identity into its result so a D1-or-higher label cannot detach from the exact bundle; digest recomputed over canonical UTF-8 JSON; stale, fabricated, or impossible timestamps fail closed; plain-record evidence maps only; extra, symbol-keyed, non-enumerable, accessor-backed, or custom-prototype claims fail closed; Lambda = Conjecture 1, open and gray, not machine-checked; Theorem U conditional, does not close Conjecture 1; no D-SLSA DOI authorized. This document changes none of these.

## Sources

- RFC 6962: https://datatracker.ietf.org/doc/rfc6962/
- Rekor: https://github.com/sigstore/architecture-docs/blob/main/rekor-spec.md and https://docs.sigstore.dev/logging/overview/
- Lamb and Zacchiro: https://arxiv.org/abs/2104.06020
- TCG DICE: https://trustedcomputinggroup.org/resource/dice-attestation-architecture

*Part of the estate's OUROBOROS audit program; spaces-audit slice (served-target gap-scan fresh enumeration; curation-atlas found already served by the loop-5 study, so evidence-doctrine qualified instead). Propose-only; the author lane makes no spec, DOI, or merge decision.*
