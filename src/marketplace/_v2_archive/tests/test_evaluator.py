"""Evaluator plugin tests."""
import json
from dataclasses import dataclass

from marketplace.evaluators import get_evaluator
from marketplace.evaluators.json_schema import JsonSchemaEvaluator


@dataclass
class FakeArtifact:
    kind: str
    content_or_url: str


def test_json_schema_pass():
    evaluator = JsonSchemaEvaluator()
    artifacts = [
        FakeArtifact(
            kind="json",
            content_or_url=json.dumps({"summary": "ok", "score": 42}),
        )
    ]
    criteria = {
        "type": "json_schema",
        "schema": {
            "type": "object",
            "properties": {
                "summary": {"type": "string"},
                "score": {"type": "number"},
            },
            "required": ["summary", "score"],
        },
    }

    result = evaluator.evaluate(artifacts, criteria)
    assert result.result == "pass"
    assert result.score == 1.0


def test_json_schema_fail_missing_field():
    evaluator = JsonSchemaEvaluator()
    artifacts = [
        FakeArtifact(
            kind="json",
            content_or_url=json.dumps({"summary": "ok"}),  # missing 'score'
        )
    ]
    criteria = {
        "type": "json_schema",
        "schema": {
            "type": "object",
            "properties": {
                "summary": {"type": "string"},
                "score": {"type": "number"},
            },
            "required": ["summary", "score"],
        },
    }

    result = evaluator.evaluate(artifacts, criteria)
    assert result.result == "fail"


def test_json_schema_fail_wrong_type():
    evaluator = JsonSchemaEvaluator()
    artifacts = [
        FakeArtifact(
            kind="json",
            content_or_url=json.dumps({"summary": 123, "score": "not a number"}),
        )
    ]
    criteria = {
        "type": "json_schema",
        "schema": {
            "type": "object",
            "properties": {
                "summary": {"type": "string"},
                "score": {"type": "number"},
            },
            "required": ["summary", "score"],
        },
    }

    result = evaluator.evaluate(artifacts, criteria)
    assert result.result == "fail"


def test_no_json_artifacts():
    evaluator = JsonSchemaEvaluator()
    artifacts = [FakeArtifact(kind="text", content_or_url="just text")]
    criteria = {"type": "json_schema", "schema": {"type": "object"}}

    result = evaluator.evaluate(artifacts, criteria)
    assert result.result == "fail"
    assert "No JSON" in result.rationale


def test_no_schema_in_criteria():
    evaluator = JsonSchemaEvaluator()
    artifacts = [FakeArtifact(kind="json", content_or_url="{}")]
    result = evaluator.evaluate(artifacts, {"type": "json_schema"})
    assert result.result == "fail"


def test_registry_lookup():
    evaluator = get_evaluator("json_schema")
    assert isinstance(evaluator, JsonSchemaEvaluator)


def test_registry_unknown():
    import pytest
    with pytest.raises(ValueError, match="Unknown evaluator"):
        get_evaluator("nonexistent")
