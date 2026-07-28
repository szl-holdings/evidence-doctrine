# Conservative D-SLSA self-assessment

Evaluation date: 2026-07-25
Status: **repository review only; not an independent audit**

This assessment deliberately separates implemented controls from verified
evidence. It does not assign D2 or above unless all cumulative requirements have
been checked for the exact decision bundle.

## SZL surfaces

| Surface | Public/repository evidence reviewed | Conservative ceiling | Why it does not advance |
|---|---|---:|---|
| MCP governor decision records | Repository implementation is designed to record request/tool inputs, policy decision, and output verdict. | D1 candidate | No exact bundle was verified here for signature, tamper evidence, third-party log, replay, offline verification, or hardware attestation. |
| EU Article 12 decision records | Repository implementation is designed to preserve inputs, applied control, and output status. | D1 candidate | Product-wide wiring and all D2 requirements were not independently verified by this assessment. |
| Overclaim incident ledger | Repository implementation is designed to record detection and correction lifecycle evidence. | D0 for D-SLSA | It is an incident ledger, not necessarily a single decision bundle containing identified inputs, policy, and output. |
| Attested-inference draft | A separate draft branch contains a fail-closed attestation contract. | D1 candidate | Real quote verification on authorized hardware, allowlisted measurements, and the cumulative D2/D3 requirements remain unverified. |
| Evidence-doctrine package | This package defines and tests the grading rules. | D0 operationally | A grader is not itself a graded production decision bundle. |

The estate-wide confirmed ceiling from this review is therefore **D1 for
selected candidate surfaces**, not D1 for every decision and not D2.

## Public-document comparison

These entries grade only capabilities described in the linked public
documentation. They are not hands-on product tests and make no claim about
private deployments or undocumented controls.

| Organization | Public documentation reviewed | D-SLSA reading |
|---|---|---|
| Arthur | [Policies and Governance](https://docs.arthur.ai/docs/policies-governance) describes policy templates, audit trails, attestation events, and exportable compliance reports. [Traces](https://docs.arthur.ai/docs/traces-guide) describes request and span records. | D1 candidate for a suitably assembled decision bundle. The reviewed pages do not establish a verified cryptographic signature and tamper binding over that exact bundle, so D2–D4 are unverified. |
| Credo AI | [Evidence](https://www.credo.ai/glossary/evidence) describes policy-control evidence, test results, monitoring logs, documents, and attestations. [Audit Trail](https://www.credo.ai/glossary/credo-ai-audit-trail) describes governance actions, reviews, and compliance steps. | D1 candidate for a suitably assembled decision bundle. The reviewed pages do not establish all D2 requirements over that exact bundle, so D2–D4 are unverified. |
| SZL Holdings | The repository surfaces listed above and this reference implementation. | D1 candidate on selected surfaces only. D2–D4 are unverified until exact-bundle signatures, external log/replay/offline verification, and hardware/formal evidence are supplied. |

“Unverified” means the reviewed documents do not establish the D-SLSA
requirement. It does not mean the capability is absent.
