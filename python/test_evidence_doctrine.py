# SPDX-License-Identifier: Apache-2.0

import unittest
from collections.abc import Mapping

from evidence_doctrine import (
    LEVEL_REQUIREMENTS,
    assert_lambda_case_study,
    compute_decision_bundle_sha256,
    evaluate_theorem_u,
    grade_decision,
)

BUNDLE_IDENTITY = {
    "subject": "decision:fixture:001",
    "evaluated_at": "2026-07-26T07:00:00Z",
}


def bundle(evidence: dict, identity: dict | None = None) -> dict:
    supplied_identity = dict(BUNDLE_IDENTITY)
    supplied_identity.update(identity or {})
    supplied_identity.setdefault(
        "bundle_sha256",
        compute_decision_bundle_sha256(
            supplied_identity["subject"],
            supplied_identity["evaluated_at"],
            evidence,
        ),
    )
    return {
        "identity": supplied_identity,
        "evidence": evidence,
    }


def verified_through(level: str) -> dict:
    evidence = {}
    for current, requirements in LEVEL_REQUIREMENTS.items():
        evidence.update({requirement: "VERIFIED" for requirement in requirements})
        if current == level:
            break
    return evidence


class StatefulEvidence(Mapping):
    def __init__(self):
        self.policy_reads = 0

    def __getitem__(self, key):
        if key == "policy_recorded":
            self.policy_reads += 1
            return (
                "UNVERIFIED" if self.policy_reads == 1 else "VERIFIED"
            )
        if key in {"inputs_recorded", "output_recorded"}:
            return "VERIFIED"
        raise KeyError(key)

    def __iter__(self):
        return iter(
            ("inputs_recorded", "policy_recorded", "output_recorded")
        )

    def __len__(self):
        return 3


class EvidenceDoctrineTests(unittest.TestCase):
    def test_d0_when_d1_is_incomplete(self):
        result = grade_decision(
            bundle({
                "inputs_recorded": "VERIFIED",
                "policy_recorded": "UNVERIFIED",
                "output_recorded": "VERIFIED",
            })
        )
        self.assertEqual(result.achieved_level, "D0")
        self.assertEqual(result.blocking_requirements, ("policy_recorded",))
        self.assertEqual(result.bundle_subject, BUNDLE_IDENTITY["subject"])
        self.assertEqual(
            result.bundle_sha256,
            "b495d3bb901fc6bdc4ea3b7ad9c32932"
            "fcc220ee02de8dd2e192c4ab15a765ee",
        )
        self.assertEqual(result.evaluated_at, BUNDLE_IDENTITY["evaluated_at"])

    def test_d1(self):
        self.assertEqual(
            grade_decision(bundle(verified_through("D1"))).achieved_level, "D1"
        )

    def test_no_level_skipping(self):
        evidence = verified_through("D4")
        evidence["tamper_evidence_verified"] = "UNVERIFIED"
        self.assertEqual(grade_decision(bundle(evidence)).achieved_level, "D1")

    def test_d4(self):
        self.assertEqual(
            grade_decision(bundle(verified_through("D4"))).achieved_level, "D4"
        )

    def test_truthy_value_is_rejected(self):
        with self.assertRaises(TypeError):
            grade_decision(bundle({"inputs_recorded": True}))

    def test_bundle_identity_is_required_and_validated(self):
        with self.assertRaisesRegex(TypeError, "identity must be a mapping"):
            grade_decision({"evidence": verified_through("D1")})
        with self.assertRaisesRegex(TypeError, "lowercase sha256 digest"):
            grade_decision(
                bundle(
                    verified_through("D1"),
                    {"bundle_sha256": "NOT-A-DIGEST"},
                )
            )
        with self.assertRaisesRegex(TypeError, "timezone-qualified timestamp"):
            grade_decision(
                bundle(
                    verified_through("D1"),
                    {"evaluated_at": "2026-07-26T07:00:00"},
                )
            )

    def test_bundle_digest_is_recomputed_from_canonical_evidence_bytes(self):
        d1_bundle = bundle(verified_through("D1"))
        reused_digest = d1_bundle["identity"]["bundle_sha256"]
        d1_bundle["evidence"]["policy_recorded"] = "UNVERIFIED"
        with self.assertRaisesRegex(TypeError, "does not match the canonical"):
            grade_decision(d1_bundle)
        with self.assertRaisesRegex(TypeError, "does not match the canonical"):
            grade_decision(
                bundle(
                    verified_through("D4"),
                    {"bundle_sha256": reused_digest},
                )
            )

    def test_impossible_calendar_timestamp_is_rejected(self):
        with self.assertRaisesRegex(
            TypeError, "timezone-qualified timestamp"
        ):
            grade_decision(
                bundle(
                    verified_through("D1"),
                    {"evaluated_at": "2026-02-30T07:00:00Z"},
                )
            )

    def test_grading_uses_the_same_evidence_snapshot_that_was_hashed(self):
        evidence = StatefulEvidence()
        hashed_evidence = {
            "inputs_recorded": "VERIFIED",
            "policy_recorded": "UNVERIFIED",
            "output_recorded": "VERIFIED",
        }
        result = grade_decision(
            {
                "identity": {
                    **BUNDLE_IDENTITY,
                    "bundle_sha256": compute_decision_bundle_sha256(
                        BUNDLE_IDENTITY["subject"],
                        BUNDLE_IDENTITY["evaluated_at"],
                        hashed_evidence,
                    ),
                },
                "evidence": evidence,
            }
        )

        self.assertEqual(result.achieved_level, "D0")
        self.assertEqual(
            result.blocking_requirements,
            ("policy_recorded",),
        )
        self.assertEqual(evidence.policy_reads, 1)

    def test_unpaired_utf16_surrogates_are_rejected_before_hashing_or_grading(
        self,
    ):
        invalid_subject = "\ud800"
        with self.assertRaisesRegex(TypeError, "unpaired UTF-16 surrogates"):
            compute_decision_bundle_sha256(
                invalid_subject,
                BUNDLE_IDENTITY["evaluated_at"],
                verified_through("D1"),
            )
        with self.assertRaisesRegex(TypeError, "unpaired UTF-16 surrogates"):
            grade_decision(
                {
                    "identity": {
                        **BUNDLE_IDENTITY,
                        "subject": invalid_subject,
                        "bundle_sha256": "0" * 64,
                    },
                    "evidence": verified_through("D1"),
                }
            )

    def test_subject_boundary_whitespace_uses_explicit_portable_set(self):
        for invalid_subject in ("\u0085subject", "\ufeffsubject"):
            with self.subTest(subject=ascii(invalid_subject)):
                with self.assertRaisesRegex(TypeError, "boundary whitespace"):
                    compute_decision_bundle_sha256(
                        invalid_subject,
                        BUNDLE_IDENTITY["evaluated_at"],
                        verified_through("D1"),
                    )

    def test_lambda_guard(self):
        honest = {
            "claim": "CONJECTURE_1",
            "state": "OPEN",
            "display": "GRAY",
            "machine_checked": False,
        }
        self.assertEqual(assert_lambda_case_study(honest), honest)
        dishonest = dict(honest, display="GREEN")
        with self.assertRaises(ValueError):
            assert_lambda_case_study(dishonest)
        contradictory = dict(honest, conclusion="PROVED")
        with self.assertRaises(ValueError):
            assert_lambda_case_study(contradictory)

    def test_theorem_u_is_conditional(self):
        self.assertEqual(
            evaluate_theorem_u(
                {
                    "premise_u1": "VERIFIED",
                    "premise_u2": "VERIFIED",
                    "premise_u3": "VERIFIED",
                }
            ),
            "CONDITIONALLY_SATISFIED",
        )
        self.assertEqual(
            evaluate_theorem_u(
                {
                    "premise_u1": "VERIFIED",
                    "premise_u2": "UNVERIFIED",
                    "premise_u3": "VERIFIED",
                }
            ),
            "CONDITIONAL_OPEN",
        )
        self.assertEqual(
            evaluate_theorem_u({"premise_u1": "VERIFIED"}),
            "CONDITIONAL_OPEN",
        )
        self.assertEqual(
            evaluate_theorem_u(
                {
                    "premise_u1": "VERIFIED",
                    "premise_u2": "VERIFIED",
                    "premise_u3": "VERIFIED",
                    "conclusion": "PROVED",
                }
            ),
            "CONDITIONAL_OPEN",
        )


if __name__ == "__main__":
    unittest.main()
