const crypto = require('crypto');

function base64urlFromBuffer(buffer) {
  return buffer
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function base64urlToBuffer(input) {
  const padded = input.replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(padded, 'base64');
}

// Verifies an HS256 JWT and returns its payload, or null if the
// signature is invalid, the token is malformed, or it has expired.
function verifyJwt(token, secret) {
  if (typeof token !== 'string') {
    return null;
  }

  const parts = token.split('.');
  if (parts.length !== 3) {
    return null;
  }

  const [headerPart, payloadPart, signaturePart] = parts;
  const signingInput = `${headerPart}.${payloadPart}`;
  const expectedSignature = base64urlFromBuffer(
    crypto.createHmac('sha256', secret).update(signingInput).digest()
  );

  const provided = Buffer.from(signaturePart);
  const expected = Buffer.from(expectedSignature);
  if (
    provided.length !== expected.length ||
    !crypto.timingSafeEqual(provided, expected)
  ) {
    return null;
  }

  let payload;
  try {
    payload = JSON.parse(base64urlToBuffer(payloadPart).toString('utf8'));
  } catch {
    return null;
  }

  if (typeof payload.exp === 'number' && Date.now() / 1000 > payload.exp) {
    return null;
  }

  return payload;
}

module.exports = { verifyJwt };
