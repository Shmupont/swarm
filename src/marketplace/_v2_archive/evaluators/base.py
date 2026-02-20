from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any


@dataclass
class EvaluationResult:
    result: str  # "pass" or "fail"
    score: float | None = None
    rationale: str = ""


class BaseEvaluator(ABC):
    """Abstract interface for contract artifact evaluation."""

    @abstractmethod
    def evaluate(
        self,
        artifacts: list[Any],
        acceptance_criteria: dict,
    ) -> EvaluationResult:
        """Evaluate submitted artifacts against the acceptance criteria."""
        ...
