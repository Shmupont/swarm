import anthropic

from .encryption import decrypt_api_key


def call_agent(
    encrypted_api_key: str,
    system_prompt: str,
    messages: list[dict],
    model: str = "claude-sonnet-4-20250514",
    temperature: float = 0.7,
    max_tokens: int = 1024,
) -> dict:
    api_key = decrypt_api_key(encrypted_api_key)
    client = anthropic.Anthropic(api_key=api_key)

    response = client.messages.create(
        model=model,
        max_tokens=max_tokens,
        temperature=temperature,
        system=system_prompt,
        messages=messages,
    )

    content = ""
    for block in response.content:
        if block.type == "text":
            content += block.text

    tokens_used = (response.usage.input_tokens or 0) + (response.usage.output_tokens or 0)

    return {
        "content": content,
        "tokens_used": tokens_used,
        "model": model,
    }


def validate_api_key(api_key: str) -> bool:
    try:
        client = anthropic.Anthropic(api_key=api_key)
        client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=10,
            messages=[{"role": "user", "content": "Hi"}],
        )
        return True
    except anthropic.AuthenticationError:
        return False
    except Exception:
        return True
