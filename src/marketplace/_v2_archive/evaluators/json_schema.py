import json

import jsonschema

from .base import BaseEvaluator, EvaluationResult


class JsonSchemaEvaluator(BaseEvaluator):
    """Validate a JSON artifact against a JSON Schema in acceptance_criteria."""

    def evaluate(self, artifacts, acceptance_criteria) -> EvaluationResult:
        schema = acceptance_criteria.get("schema")
        if not schema:
            return EvaluationResult(
                result="fail", score=0.0,
                rationale="No 'schema' key in acceptance criteria",
            )

        json_artifacts = [a for a in artifacts if a.kind == "json"]
        if not json_artifacts:
            return EvaluationResult(
                result="fail", score=0.0,
                rationale="No JSON artifacts submitted",
            )

        for artifact in json_artifacts:
            try:
                data = json.loads(artifact.content_or_url)
                jsonschema.validate(data, schema)
                return EvaluationResult(
                    result="pass", score=1.0,
                    rationale="JSON artifact validates against schema",
                )
            except json.JSONDecodeError as exc:
                return EvaluationResult(
                    result="fail", score=0.0,
                    rationale=f"Invalid JSON: {exc}",
                )
            except jsonschema.ValidationError as exc:
                return EvaluationResult(
                    result="fail", score=0.0,
                    rationale=f"Schema validation failed: {exc.message}",
                )

        return EvaluationResult(
            result="fail", score=0.0,
            rationale="No valid JSON artifact found",
        )
