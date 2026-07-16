#!/usr/bin/env python3
"""Generate ANON_KEY / SERVICE_ROLE_KEY for a self-hosted Supabase .env.

Usage:
    python3 generate-jwt-keys.py <JWT_SECRET>

No dependencies beyond the Python standard library.
"""
import base64
import hashlib
import hmac
import json
import sys
import time


def b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


def make_jwt(secret: str, role: str, valid_years: int = 10) -> str:
    header = {"alg": "HS256", "typ": "JWT"}
    now = int(time.time())
    payload = {
        "role": role,
        "iss": "supabase",
        "iat": now,
        "exp": now + valid_years * 365 * 24 * 60 * 60,
    }
    signing_input = (
        b64url(json.dumps(header, separators=(",", ":")).encode())
        + "."
        + b64url(json.dumps(payload, separators=(",", ":")).encode())
    )
    signature = hmac.new(
        secret.encode(), signing_input.encode(), hashlib.sha256
    ).digest()
    return signing_input + "." + b64url(signature)


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python3 generate-jwt-keys.py <JWT_SECRET>", file=sys.stderr)
        sys.exit(1)

    secret = sys.argv[1]
    print(f"ANON_KEY={make_jwt(secret, 'anon')}")
    print(f"SERVICE_ROLE_KEY={make_jwt(secret, 'service_role')}")
