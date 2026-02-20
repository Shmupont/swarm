from .base import BaseEvaluator, EvaluationResult

_registry: dict[str, type[BaseEvaluator]] = {}


def register_evaluator(name: str, cls: type[BaseEvaluator]) -> None:
    _registry[name] = cls


def get_evaluator(name: str) -> BaseEvaluator:
    cls = _registry.get(name)
    if not cls:
        raise ValueError(f"Unknown evaluator: {name}")
    return cls()


# Auto-register built-in evaluators on import
from .json_schema import JsonSchemaEvaluator  # noqa: E402

register_evaluator("json_schema", JsonSchemaEvaluator)
