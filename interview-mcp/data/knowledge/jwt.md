# JWT — JSON Web Token

## Summary
JWT (JSON Web Token) is a compact, URL-safe token format for transmitting claims
between parties as a signed JSON object. Structure: three Base64URL-encoded parts
separated by dots — `header.payload.signature`. The server validates the signature
to trust the payload without storing session state (stateless auth).

Key properties:
- Self-contained: all claims are inside the token
- Stateless: server needs no session store — just validates the signature
- Not encrypted by default (JWS) — payload is only Base64 encoded, not secret
- Can be encrypted (JWE) when confidentiality of claims is required

## Questions
1. What is a JWT and what problem does it solve compared to traditional session-based authentication?
2. Walk me through the three parts of a JWT and what each one contains.
3. What is the difference between HS256 and RS256 signing algorithms, and when would you choose one over the other?
4. JWTs are stateless — how would you handle token revocation before expiry in a production system?
5. What are the security risks of storing JWTs in localStorage, and what is the recommended alternative?

## Evaluation Criteria
- Question 1: Must mention statelessness and self-contained claims, not just "it's used for auth". Bonus: contrast with session cookies (server-side state vs client-side token).
- Question 2: Must name all three parts (header, payload, signature), explain Base64URL encoding, and note that payload is readable but not secret. Bonus: common claims (iss, sub, exp, iat).
- Question 3: Must distinguish symmetric (HS256, shared secret) from asymmetric (RS256, private/public key pair). Must explain when RS256 is preferred — distributed systems, multiple services, public key verification. Weak answer: only names the algorithms without explaining the tradeoff.
- Question 4: Must propose at least one real strategy: denylist/blocklist (Redis), short expiry + refresh tokens, token versioning (jti claim). Weak answer: "you can't revoke JWTs" without proposing a workaround.
- Question 5: Must identify XSS vulnerability of localStorage. Must recommend httpOnly cookies as the secure alternative. Bonus: mention CSRF tradeoff with cookies and SameSite attribute as mitigation.

## Concepts
- core concepts: jwt, token, stateless, claims, header, payload, signature, base64url
- practical usage: authentication, authorization, api security, refresh token, access token
- tradeoffs: revocation, payload size, key management, stateless vs stateful, hs256 vs rs256
- best practices: httponly cookies, short expiry, asymmetric signing, jti claim, https only
