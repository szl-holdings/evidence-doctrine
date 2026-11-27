<!-- szl:header v1 -->
<!-- Native identity: szl-brand@4309f6fce89179331b0b3ed8c99494e76c5be256; Orbit v2 icon. -->
<p>
  <a href="https://github.com/szl-holdings">
    <img src="https://raw.githubusercontent.com/szl-holdings/szl-brand/4309f6fce89179331b0b3ed8c99494e76c5be256/kit/logos/orbit-v2/suite/szl-icon-32.svg" alt="SZL Holdings — Orbit v2" width="32" height="32" />
  </a>
</p>

**Control before action. Evidence after.**

[Product](https://a-11-oy.com) · [Proof](https://a11oy.net) · [GitHub organization](https://github.com/szl-holdings)
<!-- /szl:header -->

# Governed Agent — Nine-Organ Self-Assessment Checklist (v0.1)

Map any agent stack — vendor, internal, or procurement target — to the nine organs. An organ counts as **governed** only if all three hold:

1. a **named owner** (who is accountable for this organ),
2. a **receipt boundary** (a signed, replayable record at every transition), and
3. a **failure mode test** (a test that proves the organ fails closed).

Anything less is capability, not governance. Score honestly: **x/9 organs governed**.

| # | Organ | The questions to ask | Ungoverned answer to watch for |
| --- | --- | --- | --- |
| 1 | SENSE | Can a caller supply a URL or document at runtime? Is every source bound, named, and digest-pinned? | "We sanitize inputs" without source binding |
| 2 | NORMALIZE | What happens to a missing, malformed, or out-of-range value? Is UNAVAILABLE a first-class output? | Silent defaults and coerced zero-values |
| 3 | CONTEXT | Which memories conditioned this answer? Is every memory write AND recall receipted? Can you replay what the agent remembered at decision time? | "Our vector DB has audit logging" (logs ≠ proof) |
| 4 | FORMULA | Is the scoring/aggregation formula versioned and committed? Can you diff two decisions under different formulas? | "The prompt is in the repo" (a prompt is not a formula) |
| 5 | POLICY | Is the gate deny-by-default with committed rules? Are hard denies absolute — can approval never lift them? | A guardrail that runs alongside the pipeline, not across it |
| 6 | DECIDE | Does the agent abstain on insufficient evidence? Is the aggregation checkable against its own axioms? | Confidence without a trace of why |
| 7 | VERIFY | Must evidence exist before review? Are REVIEW / ABSTAIN the only escalations? | Post-hoc evaluation of vibes |
| 8 | REMEMBER | Can the agent rewrite its own memory silently? Is every learned fact review-gated at an exact source revision (Learning Receipt)? | "It learns from experience" with no review boundary |
| 9 | RECEIPT | Can a third party replay a full decision chain offline, with signatures, after your systems are gone? | Dashboards that assert but cannot prove |

## Reading your score

- **9/9** — you are the organism. This is the a11oy claim; verify it with receipts, not assertions.
- **5–8** — you have capability with gaps; the missing organs are your procurement roadmap and your audit findings.
- **0–4** — you have an ungoverned agent; the accuracy argument is over and the auditability argument has already started without you.

## Tie-in

- Organ 8 is the [Memory Covenant](https://github.com/szl-holdings/szl-frontier) (spec v0.4-draft in PR).
- Organ 9 is [governed-receipt-spec](https://github.com/szl-holdings/governed-receipt-spec) (DSSE envelopes, offline verifier).
- Certification path: Decision-SLSA v1.4 maturity mapping with expiry — claim a level only with receipts.

---

*Doctrine v11 · Control before action. Evidence after. Λ = Conjecture 1 (never a closed theorem).*
