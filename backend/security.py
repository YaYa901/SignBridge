"""Salted PBKDF2 password hashes. Sessions use random opaque HttpOnly cookies."""
from __future__ import annotations
import base64
import hashlib
import hmac
import secrets

DEFAULT_ITERATIONS=600_000

def hash_password(password: str,iterations: int=DEFAULT_ITERATIONS) -> str:
    salt=secrets.token_bytes(16)
    digest=hashlib.pbkdf2_hmac('sha256',password.encode('utf-8'),salt,iterations)
    return '$'.join(['pbkdf2_sha256',str(iterations),base64.b64encode(salt).decode('ascii'),base64.b64encode(digest).decode('ascii')])

def verify_password(password: str,stored: str) -> bool:
    try:
        scheme,iterations,salt,digest=stored.split('$')
        rounds=int(iterations)
        if scheme!='pbkdf2_sha256' or not 1<=rounds<=10_000_000:return False
        actual=hashlib.pbkdf2_hmac('sha256',password.encode('utf-8'),base64.b64decode(salt,validate=True),rounds)
        return hmac.compare_digest(actual,base64.b64decode(digest,validate=True))
    except (ValueError,TypeError):return False

DUMMY_HASH=hash_password('not-a-real-password',10_000)

def fingerprint(password_hash: str) -> str:
    return hashlib.sha256(password_hash.encode('utf-8')).hexdigest()
