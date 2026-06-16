# JWT — JSON Web Token

## Summary
JWT (JSON Web Token) is a compact, URL-safe token format for transmitting claims between parties as a signed JSON object. Structure: three Base64URL-encoded parts separated by dots — `header.payload.signature`. The server validates the signature to trust the payload without storing session state (stateless auth).

Key properties:
- Self-contained: all claims are inside the token
- Stateless: server needs no session store — just validates the signature
- Not encrypted by default (JWS) — payload is only Base64 encoded, not secret
- Can be encrypted (JWE) when confidentiality of claims is required

A strong candidate understands not just what JWT is, but when stateless auth becomes a liability (revocation, token size, key rotation) and how refresh token strategies, audience validation, and signing algorithm choice shape production security.

---

## Questions

1. What is a JWT and what problem does it solve compared to traditional session-based authentication?
2. Walk me through the three parts of a JWT and what each one contains.
3. What is the difference between HS256 and RS256 signing algorithms, and when would you choose one over the other?
4. JWTs are stateless — how would you handle token revocation before expiry in a production system?
5. What are the security risks of storing JWTs in localStorage, and what is the recommended alternative?
6. What is the purpose of the `exp`, `iat`, `nbf`, `iss`, `aud`, and `sub` claims? How does a server use them during validation?
7. How do refresh tokens work alongside access tokens? Walk through the full lifecycle including token rotation and revocation.
8. What is the "none" algorithm vulnerability in JWT, and how do you prevent it?
9. A JWT is being used across multiple microservices. How do you manage signing key rotation without downtime or breaking existing tokens?
10. How would you implement role-based access control (RBAC) using JWT claims? What are the trade-offs compared to server-side permission lookups?
11. What is token introspection and when would you use it instead of self-contained JWT validation?
12. What is clock skew in JWT validation, and how do you handle it safely without opening replay attack windows?
13. How would you design a federated identity system where JWTs are issued by an external identity provider (e.g. Auth0, Keycloak) and validated by your services?
14. What attack vectors exist if a JWT's signature is verified but the `alg` header is not strictly validated on the server?
15. How does JWT work in a zero-trust architecture where every service-to-service call must be authenticated, not just the initial user request?
16. When would you choose opaque tokens over JWTs at scale, and what infrastructure trade-offs does that decision carry?

---

## Difficulty

- Question 1: foundation
- Question 2: foundation
- Question 3: foundation
- Question 4: foundation
- Question 5: foundation
- Question 6: intermediate
- Question 7: intermediate
- Question 8: intermediate
- Question 9: intermediate
- Question 10: intermediate
- Question 11: intermediate
- Question 12: intermediate
- Question 13: advanced
- Question 14: advanced
- Question 15: advanced
- Question 16: advanced

---

## Evaluation Criteria

- Question 1: Must mention statelessness and self-contained claims, not just "it's used for auth". Bonus: contrast with session cookies (server-side state vs client-side token), mention scalability benefit (no shared session store needed).
- Question 2: Must name all three parts (header, payload, signature), explain Base64URL encoding, and note that payload is readable but not secret. Bonus: common claims (iss, sub, exp, iat), that header contains alg and typ.
- Question 3: Must distinguish symmetric (HS256, shared secret) from asymmetric (RS256, private/public key pair). Must explain when RS256 is preferred — distributed systems, multiple services validating without sharing the secret, public key can be distributed safely. Weak: only names the algorithms without explaining the key-sharing tradeoff.
- Question 4: Must propose at least one real strategy: denylist/blocklist (Redis), short expiry + refresh tokens, token versioning (jti claim). Weak answer: "you can't revoke JWTs" without proposing a workaround. Bonus: tradeoff analysis — Redis lookup adds latency but restores revocability.
- Question 5: Must identify XSS vulnerability of localStorage. Must recommend httpOnly cookies as the secure alternative. Bonus: mention CSRF tradeoff with cookies and SameSite attribute as mitigation.
- Question 6: Must explain each claim: `exp` = expiry (Unix timestamp, reject if past), `iat` = issued-at (for age checks), `nbf` = not-before (token not valid before this time), `iss` = issuer (who created it, validate against expected issuer), `aud` = audience (intended recipients, reject if your service is not in aud), `sub` = subject (the entity the token represents). Weak: knows exp but cannot explain aud validation or nbf.
- Question 7: Must describe the full lifecycle: access token (short-lived, 5–15 min), refresh token (long-lived, days/weeks, stored securely). On expiry: client sends refresh token → server issues new access token + rotates refresh token (invalidates old one). Revocation: deny-list refresh token on logout. Weak: confuses access and refresh tokens or does not mention rotation.
- Question 8: Must identify that the "none" algorithm allows attackers to craft unsigned tokens by setting `alg: "none"` in the header — some naive implementations then skip signature verification. Prevention: server must whitelist allowed algorithms and never accept "none". Bonus: also mention algorithm confusion attacks (RS256 vs HS256 swap where server uses public key as HMAC secret).
- Question 9: Must propose a key rotation strategy: JWKS (JSON Web Key Set) endpoint where servers fetch public keys by kid (key ID); issue new tokens with new kid while honoring old kid tokens until they expire; rotate by publishing new key, letting existing tokens age out, then retiring old key. Weak: proposes invalidating all tokens during rotation (causes forced logout for all users).
- Question 10: Must describe embedding roles/permissions in JWT claims (e.g. `"roles": ["admin", "editor"]`). Trade-offs: pros = no DB lookup per request, fast; cons = stale permissions until token expires, bloated token size with many roles. Alternative: keep JWT lightweight with just sub and fetch permissions server-side for sensitive operations. Bonus: hybrid — coarse roles in JWT, fine-grained permissions via introspection.
- Question 11: Must explain token introspection (RFC 7662): client sends opaque token to auth server's introspection endpoint → server returns token metadata (active, scope, exp, sub). Use when: tokens must be revocable in real time (e.g. payment sessions), when you cannot trust the token payload alone, or when using opaque tokens. Trade-off: adds latency and auth server becomes a dependency on every request.
- Question 12: Must define clock skew as time drift between issuing server and validating server causing premature expiry or rejection. Safe mitigation: add a small tolerance (typically 30–60 seconds) to `exp` and `nbf` checks. Risk: too large a tolerance opens replay windows. Bonus: NTP synchronization as the underlying fix; `leeway` parameter in most JWT libraries.
- Question 13: Must describe OIDC (OpenID Connect) or OAuth2 flow: user authenticates with IdP → IdP issues id_token + access_token as JWTs → your services validate by fetching IdP's JWKS public keys. Must mention: validating `iss` (must match IdP's issuer URL), `aud` (must include your client_id), and verifying signature against JWKS. Bonus: caching JWKS with TTL and refresh-on-unknown-kid pattern.
- Question 14: Must identify the `alg confusion` attack: if the server accepts any algorithm claimed in the header without enforcing its own allowlist, an attacker can change alg to "none" (unsigned) or switch from RS256 to HS256 (using the public key as an HMAC secret). Prevention: server must always enforce a strict algorithm allowlist regardless of what the header claims. Weak: only describes verification without mentioning algorithm enforcement.
- Question 15: Must explain service-to-service JWT: each service issues a short-lived JWT (service account token) for downstream calls, signed with its own private key or fetched via OAuth2 client credentials flow. Downstream service validates against issuer's JWKS. Each service is both an issuer (for outbound) and a validator (for inbound). Bonus: mention SPIFFE/SPIRE for automated workload identity in zero-trust.
- Question 16: Must argue when opaque tokens win: when revocability is non-negotiable (financial, healthcare), when token payload confidentiality is required, when you need central control over session state. Infrastructure trade-off: every validation requires a network call to the auth server (or Redis) → higher latency, auth server is a critical dependency. Bonus: hybrid — opaque refresh tokens, JWT access tokens for the hot path.

## Concepts

- core concepts: jwt, token, stateless, claims, header, payload, signature, base64url, jws, jwe
- practical usage: authentication, authorization, api-security, refresh-token, access-token, rbac, jwks, kid, token-introspection, oidc, oauth2
- tradeoffs: revocation, payload-size, key-management, stateless-vs-stateful, hs256-vs-rs256, jwt-vs-opaque, clock-skew-vs-replay-window
- best practices: httponly-cookies, short-expiry, asymmetric-signing, jti-claim, https-only, algorithm-allowlist, rotate-refresh-tokens, validate-aud-and-iss

## Warm-up Quests

### Level 0 — Recognition (MCQ)
1. Which of the following is a structural part of a JWT?
   A) Header
   B) SessionID
   C) Cookie
   D) IP Address
   Answer: A

2. How many parts does a JWT have, separated by dots?
   A) 1
   B) 2
   C) 3
   D) 4
   Answer: C

3. Which algorithm type is considered safer for signing JWTs in production?
   A) HS256 (symmetric, shared secret)
   B) RS256 (asymmetric, public/private key pair)
   C) MD5 (hash only)
   D) Base64 (encoding only)
   Answer: B

4. Where should a JWT access token be stored in a browser for maximum security?
   A) localStorage
   B) sessionStorage
   C) HttpOnly cookie
   D) URL query parameter
   Answer: C

5. What does the "stateless" property of JWTs mean?
   A) The token never expires
   B) The server does not need to store session data to validate the token
   C) The token has no claims
   D) The token is encrypted
   Answer: B

### Level 1 — Fill in the Blank
1. A JWT is made up of three parts: ___, payload, and signature, joined by dots.
   Answer: header

2. JWT stands for JSON ___ Token.
   Answer: Web

3. The JWT signature is created by signing the encoded header and payload with a ___.
   Answer: secret key (or private key)

4. To prevent a stolen JWT from being used forever, JWTs should have a short ___ time.
   Answer: expiry (exp)

5. When using asymmetric signing, the token is signed with a ___ key and verified with a ___ key.
   Answer: private / public

### Level 2 — Guided Answer
1. Explain what a JWT is and why it is useful. Use this structure: [definition → structure → why stateless matters].
   Hint: Think about what problem session-based auth has at scale, and how JWTs solve it.

2. Describe the difference between HS256 and RS256. Use this structure: [how each works → when to use each → the risk of HS256].
   Hint: Consider who holds the key in each case and what happens if a service is compromised.

3. Explain how JWT revocation works and why it is hard. Use this structure: [why stateless makes revocation hard → common approaches → trade-offs of each].
   Hint: Think about token blacklists, short expiry windows, and refresh token patterns.
