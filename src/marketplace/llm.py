import anthropic

from .encryption import decrypt_api_key


def _platform_api_key() -> str | None:
    """Return the platform Anthropic API key if configured."""
    from .config import get_settings
    key = get_settings().anthropic_api_2
    return key if key else None


def has_platform_key() -> bool:
    return bool(_platform_api_key())


def call_agent_platform(
    system_prompt: str,
    messages: list[dict],
    model: str = "claude-haiku-4-5-20251001",
    temperature: float = 0.7,
    max_tokens: int = 1024,
) -> dict:
    """Call the LLM using the platform-level API key (no creator key needed)."""
    api_key = _platform_api_key()
    if not api_key:
        raise RuntimeError("Platform API key not configured")
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
    return {"content": content, "tokens_used": tokens_used, "model": model}


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
