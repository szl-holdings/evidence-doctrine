# SPDX-License-Identifier: Apache-2.0
"""Fail-closed Decision-SLSA reference evaluator."""

import hashlib
import json
import re
from collections.abc import Mapping
from dataclasses import asdict, dataclass
from datetime import datetime

EVIDENCE_STATES = ("VERIFIED", "UNVERIFIED", "ABSENT")
LEVEL_REQUIREMENTS = {
    "D1": ("inputs_recorded", "policy_recorded", "output_recorded"),
    "D2": ("signature_verified", "tamper_evidence_verified"),
    "D3": (
        "third_party_transparency_log_verified",
        "byte_identical_replay_verified",
        "offline_verification_verified",
    ),
    "D4": (
        "hardware_attested_execution_verified",
        "formally_specified_policy_verified",
        "machine_checked_denial_verified",
    ),
}
THEOREM_U_PREMISES = ("premise_u1", "premise_u2", "premise_u3")
REQUIREMENT_NAMES = frozenset(
    requirement
    for requirements in LEVEL_REQUIREMENTS.values()
    for requirement in requirements
)
TIMESTAMP_PATTERN = re.compile(
    r"^(\d{4})-(\d{2})-(\d{2})T"
    r"(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?"
    r"(Z|[+-]\d{2}:\d{2})$"
)
BOUNDARY_WHITESPACE = frozenset(
    {
        0x0009,
        0x000A,
        0x000B,
        0x000C,
        0x000D,
        0x001C,
        0x001D,
        0x001E,
        0x001F,
        0x0020,
        0x0085,
        0x00A0,
        0x1680,
        *range(0x2000, 0x200B),
        0x2028,
        0x2029,
        0x202F,
        0x205F,
        0x3000,
        0xFEFF,
    }
)


@dataclass(frozen=True)
class GradeResult:
    bundle_subject: str
    bundle_sha256: str
    evaluated_at: str
    achieved_level: str
    evaluation_state: str
    satisfied_requirements: tuple[str, ...]
    blocking_requirements: tuple[str, ...]
    unverified_requirements: tuple[str, ...]
    absent_requirements: tuple[str, ...]
    note: str

    def to_dict(self) -> dict:
        return asdict(self)


def _validate_state(requirement: str, state: object) -> str:
    if state not in EVIDENCE_STATES:
        raise TypeError(
            f"{requirement} must be VERIFIED, UNVERIFIED, or ABSENT; "
            f"received {state!r}"
        )
    return str(state)


def _validate_subject(subject: object) -> str:
    if not isinstance(subject, str) or not subject:
        raise TypeError("identity.subject must be a non-empty canonical string")
    if (
        ord(subject[0]) in BOUNDARY_WHITESPACE
        or ord(subject[-1]) in BOUNDARY_WHITESPACE
    ):
        raise TypeError(
            "identity.subject must not have leading or trailing "
            "boundary whitespace"
        )
    if any(0xD800 <= ord(character) <= 0xDFFF for character in subject):
        raise TypeError(
            "identity.subject must not contain unpaired UTF-16 surrogates"
        )
    return subject


def compute_decision_bundle_sha256(
    subject: str,
    evaluated_at: str,
    evidence: Mapping[str, object],
) -> str:
    subject = _validate_subject(subject)
    canonical_bundle = json.dumps(
        {
            "evaluated_at": evaluated_at,
            "evidence": dict(evidence),
            "subject": subject,
        },
        ensure_ascii=False,
        separators=(",", ":"),
        sort_keys=True,
    ).encode("utf-8")
    return hashlib.sha256(canonical_bundle).hexdigest()


def _is_strict_timestamp(value: str) -> bool:
    match = TIMESTAMP_PATTERN.fullmatch(value)
    if match is None:
        return False
    year, month, day, hour, minute, second = (
        int(part) for part in match.groups()[:6]
    )
    zone = match.group(7)
    if (
        year < 1
        or not 1 <= month <= 12
        or hour > 23
        or minute > 59
        or second > 59
    ):
        return False
    if zone != "Z":
        if int(zone[1:3]) > 23 or int(zone[4:6]) > 59:
            return False
    try:
        datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return False
    return True


def _validate_bundle(
    bundle: Mapping[str, object],
) -> tuple[Mapping[str, object], Mapping[str, object]]:
    if not isinstance(bundle, Mapping):
        raise TypeError("decision bundle must be a mapping")
    identity = bundle.get("identity")
    evidence = bundle.get("evidence")
    if not isinstance(identity, Mapping):
        raise TypeError("decision bundle identity must be a mapping")
    identity_snapshot = dict(identity)
    subject = _validate_subject(identity_snapshot.get("subject"))
    bundle_sha256 = identity_snapshot.get("bundle_sha256")
    if (
        not isinstance(bundle_sha256, str)
        or re.fullmatch(r"[0-9a-f]{64}", bundle_sha256) is None
    ):
        raise TypeError(
            "identity.bundle_sha256 must be a lowercase sha256 digest"
        )
    evaluated_at = identity_snapshot.get("evaluated_at")
    if (
        not isinstance(evaluated_at, str)
        or not _is_strict_timestamp(evaluated_at)
    ):
        raise TypeError(
            "identity.evaluated_at must be a timezone-qualified timestamp"
        )
    if not isinstance(evidence, Mapping):
        raise TypeError("decision bundle evidence must be a mapping")
    evidence_snapshot = dict(evidence)
    unknown_requirements = set(evidence_snapshot) - REQUIREMENT_NAMES
    if unknown_requirements:
        raise TypeError(
            "unknown evidence requirement: "
            + sorted(str(name) for name in unknown_requirements)[0]
        )
    expected_digest = compute_decision_bundle_sha256(
        subject, evaluated_at, evidence_snapshot
    )
    if bundle_sha256 != expected_digest:
        raise TypeError(
            "identity.bundle_sha256 does not match the canonical subject, "
            "evaluated_at, and evidence bytes"
        )
    return identity_snapshot, evidence_snapshot


def grade_decision(bundle: Mapping[str, object]) -> GradeResult:
    """Return the highest consecutively satisfied Decision-SLSA level."""
    identity, evidence = _validate_bundle(bundle)
    states = {}
    for requirements in LEVEL_REQUIREMENTS.values():
        for requirement in requirements:
            states[requirement] = _validate_state(
                requirement, evidence.get(requirement, "ABSENT")
            )

    achieved_level = "D0"
    blocking_requirements: tuple[str, ...] = ()
    for level, requirements in LEVEL_REQUIREMENTS.items():
        blocked = tuple(
            requirement
            for requirement in requirements
            if states[requirement] != "VERIFIED"
        )
        if blocked:
            blocking_requirements = blocked
            break
        achieved_level = level

    return GradeResult(
        bundle_subject=str(identity["subject"]),
        bundle_sha256=str(identity["bundle_sha256"]),
        evaluated_at=str(identity["evaluated_at"]),
        achieved_level=achieved_level,
        evaluation_state="EVALUATED_FROM_SUPPLIED_EVIDENCE",
        satisfied_requirements=tuple(
            name for name, state in states.items() if state == "VERIFIED"
        ),
        blocking_requirements=blocking_requirements,
        unverified_requirements=tuple(
            name for name, state in states.items() if state == "UNVERIFIED"
        ),
        absent_requirements=tuple(
            name for name, state in states.items() if state == "ABSENT"
        ),
        note=(
            "This result grades only the supplied evidence states. It is not a "
            "certification, publication, or independent audit."
        ),
    )


def assert_lambda_case_study(value: Mapping[str, object]) -> dict:
    """Reject a closed, green, or machine-checked Lambda uniqueness claim."""
    expected = {
        "claim": "CONJECTURE_1",
        "state": "OPEN",
        "display": "GRAY",
        "machine_checked": False,
    }
    if dict(value) != expected:
        raise ValueError(
            "Lambda uniqueness must remain CONJECTURE_1, OPEN, GRAY, "
            "and not machine-checked"
        )
    return expected


def evaluate_theorem_u(premises: Mapping[str, object]) -> str:
    """Return a conditional status without closing Lambda Conjecture 1."""
    if set(premises) != set(THEOREM_U_PREMISES):
        return "CONDITIONAL_OPEN"
    states = tuple(
        _validate_state(name, premises[name]) for name in THEOREM_U_PREMISES
    )
    if all(state == "VERIFIED" for state in states):
        return "CONDITIONALLY_SATISFIED"
    return "CONDITIONAL_OPEN"
