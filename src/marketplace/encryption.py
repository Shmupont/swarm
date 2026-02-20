import base64
import hashlib

from cryptography.fernet import Fernet

_fernet_instance = None


def _get_fernet() -> Fernet:
    global _fernet_instance
    if _fernet_instance is None:
        from .config import get_settings

        settings = get_settings()
        raw_key = hashlib.sha256(settings.encryption_key.encode()).digest()
        fernet_key = base64.urlsafe_b64encode(raw_key)
        _fernet_instance = Fernet(fernet_key)
    return _fernet_instance


def encrypt_api_key(plain_key: str) -> str:
    f = _get_fernet()
    encrypted = f.encrypt(plain_key.encode())
    return encrypted.decode()


def decrypt_api_key(encrypted_key: str) -> str:
    f = _get_fernet()
    decrypted = f.decrypt(encrypted_key.encode())
    return decrypted.decode()


def mask_api_key(plain_key: str) -> str:
    if len(plain_key) <= 12:
        return "****"
    return plain_key[:12] + "****" + plain_key[-4:]
