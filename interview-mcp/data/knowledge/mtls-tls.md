# TLS and mTLS

## Summary
TLS (Transport Layer Security) provides one-way authentication: the client verifies the server's identity using an X.509 certificate. mTLS (mutual TLS) extends this to two-way authentication: the server also verifies the client's certificate. Keystore holds your identity (private key + certificate chain, used when presenting who you are); Truststore holds trust anchors (CA certificates, used to validate the other party). The TLS handshake proves private key ownership via a cryptographic signature over the handshake transcript — no private key is ever transmitted across the wire. PKIX chain validation checks the signature chain from leaf certificate up to a trusted root CA. In Java, SSLContext wires together KeyManagerFactory (identity) and TrustManagerFactory (trust); Spring Boot exposes this via server.ssl.* properties.

A strong candidate understands not just the happy-path handshake but the failure modes: certificate expiry, CA rotation, algorithm negotiation, revocation checking, and zero-downtime certificate rotation in production.

---

## Questions

1. What is the difference between TLS and mTLS, and in what scenarios would you use mTLS over standard TLS?
2. What is the difference between a Keystore and a Truststore? Which components in a typical mTLS setup need each one?
3. Walk me through the mTLS handshake step by step. How does the server verify the client without the client ever transmitting its private key?
4. What is an X.509 certificate and what information does it contain? What does PKIX chain validation verify?
5. How would you configure mTLS in a Spring Boot application, and how would you debug a certificate handshake failure in production?
6. How does TLS session resumption work and why does it matter for performance?
7. What are cipher suites in TLS and how do the client and server negotiate which one to use?
8. How would you rotate a TLS certificate in production without downtime or breaking existing connections?
9. What is certificate pinning and when should you use it? What are its risks?
10. How does certificate revocation work? Compare CRL and OCSP, and explain OCSP stapling.
11. How would you implement mutual TLS for service-to-service communication in a Kubernetes cluster using cert-manager?
12. What happens if the system clocks on client and server are out of sync during a TLS handshake?
13. How would you design a zero-trust network where every service-to-service call requires mTLS and the certificates are automatically rotated?
14. What is TLS termination and where should it happen in a microservices architecture — at the load balancer or at the service?
15. How would you audit and enforce TLS configuration across hundreds of microservices to prevent weak cipher suites or expired certificates?
16. What is the TLS 1.3 handshake, and what are its security and performance improvements over TLS 1.2?

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

- Question 1: Must clearly distinguish TLS (one-way: client verifies server) from mTLS (two-way: both parties authenticate). Must give concrete use cases for mTLS: service-to-service communication, B2B APIs, zero-trust networks, internal microservices. Weak: says "mutual authentication" without explaining when or why to use it over plain TLS.
- Question 2: Must clearly distinguish: Keystore = identity (private key + certificate chain, used when presenting identity), Truststore = trust anchors (CA certificates, used to validate the other party). Must correctly map: HTTPS server always needs Keystore + Truststore only if mTLS; normal HTTPS client needs only Truststore; mTLS client needs both. Weak: confuses the two concepts or cannot map which component needs what.
- Question 3: Must describe the flow: TCP connection → ServerHello + server certificate chain → client validates server chain against its truststore → server sends CertificateRequest (mTLS) → client sends its certificate + CertificateVerify (client signs the handshake transcript with its private key) → server verifies the signature using the public key in the client certificate (proves key ownership) + validates the PKIX chain against its truststore. Key point: the private key never leaves the client; proof is via asymmetric signature.
- Question 4: Must say X.509 is the standard certificate format used in TLS. Must mention key fields: Subject (identity), Public Key, Issuer (CA), Validity dates, Signature. Bonus: Extended Key Usage (EKU) — ServerAuth for server certs, ClientAuth for client certs. PKIX chain validation: verifies the signature chain from the leaf certificate through intermediate CAs up to a trusted root CA in the truststore; also checks expiration, key usage, and revocation. "PKIX path building failed" means no path to a trusted root could be constructed.
- Question 5: Must mention Spring Boot config: server.ssl.key-store, server.ssl.trust-store, server.ssl.client-auth=need. Java internals: SSLContext.init(keyManagers, trustManagers, secureRandom), KeyManagerFactory, TrustManagerFactory. Debug commands: curl -v --cert client.crt --key client.key https://host, openssl s_client -connect host:443 -showcerts. JVM debug flag: -Djavax.net.debug=ssl,handshake. Must map common errors: "unable to get local issuer certificate" = missing intermediate CA on client side, "alert unknown_ca" = server does not trust client's CA, "PKIX path building failed" = chain cannot build to trusted root.
- Question 6: Must explain: TLS session resumption avoids repeating the full asymmetric handshake (expensive CPU). Two mechanisms: (1) session IDs — server caches session parameters by ID, client presents ID on reconnect, server resumes without full handshake; (2) session tickets — server encrypts session state into a ticket and sends it to the client, client presents ticket on reconnect, server decrypts and resumes (stateless for server). Performance impact: a full handshake adds 1–2 RTTs and significant CPU; resumption reduces to 0 or 1 RTT. Bonus: TLS 1.3 introduces 0-RTT resumption (with replay attack caveats).
- Question 7: Must explain: a cipher suite specifies the algorithm combination for key exchange (ECDHE), authentication (RSA/ECDSA), encryption (AES-GCM), and MAC (SHA-256). Negotiation: client sends a ClientHello with a list of supported cipher suites in preference order; server picks the first suite from its own preference list that the client also supports; the chosen suite is announced in ServerHello. Must note: TLS 1.3 removed weak cipher suites (RC4, 3DES, MD5) from the negotiable set entirely. Bonus: forward secrecy — ephemeral Diffie-Hellman (ECDHE) ensures past sessions can't be decrypted even if the server's private key is later compromised.
- Question 8: Must describe: issue a new certificate before the old one expires, with overlapping validity periods. Steps: (1) add new certificate to the server's keystore (dual-cert); (2) add new CA/intermediate to truststores of all clients that need to validate the server; (3) deploy new keystore to servers, configure to prefer new cert; (4) wait for all connections using old cert to drain (graceful); (5) remove old cert from keystore. For mTLS: must also rotate client certificates. Must address: hard-coding certificate fingerprints (pinning) breaks rotation — prefer pinning the CA instead. Bonus: ACME protocol and cert-manager for automated rotation.
- Question 9: Must explain certificate pinning: the client hard-codes the expected certificate fingerprint (or public key hash) for a given server, and rejects any certificate that doesn't match even if it chains to a trusted CA. Use cases: mobile apps communicating with a known backend (protection against rogue CAs or MITM). Risks: (1) rotation risk — if the server rotates its certificate, pinned clients break until updated; (2) difficult to update in mobile apps (requires app update); (3) backup pin must be pinned alongside primary. Must recommend: pin the CA or intermediate rather than the leaf certificate to allow leaf rotation without updating pins.
- Question 10: Must explain: CRL (Certificate Revocation List) = CA publishes a signed list of revoked serial numbers; clients download the CRL and check against it. OCSP (Online Certificate Status Protocol) = client queries the CA's OCSP responder in real time for the status of a specific certificate. CRL downsides: large, must be downloaded periodically, stale between updates. OCSP downside: real-time network call adds latency; CA's OCSP responder is a single point of failure. OCSP Stapling: server pre-fetches and caches a signed OCSP response, attaches ("staples") it to the TLS handshake — client gets freshness proof without making a separate OCSP call. Must say: OCSP stapling should be the default for high-traffic servers.
- Question 11: Must describe cert-manager in Kubernetes: deploys as a controller, manages Certificate resources; uses an Issuer or ClusterIssuer (e.g. ACME for public certs, Vault or self-signed CA for internal). Workflow: (1) create a Certificate resource specifying the DNS name and Issuer; (2) cert-manager requests and stores the cert+key in a Kubernetes Secret; (3) pod mounts the Secret as a volume or environment; (4) cert-manager monitors expiry and automatically renews before expiry (configurable threshold). For mTLS: each service gets its own cert; server configures client-auth=need and trusts the cluster CA; service mesh (Istio, Linkerd) can automate this at the proxy layer (sidecar). Bonus: SPIFFE/SPIRE for workload identity in zero-trust.
- Question 12: Must explain: X.509 certificates have notBefore and notAfter validity fields. If the server clock is behind the client's, the server's certificate may appear to not yet be valid (notBefore in the future) and the client rejects it. If the server clock is ahead, a soon-to-expire cert may look expired to the client. Must mention NTP synchronization as the operational fix. Safe mitigation in code: small clock skew tolerance (typically 30–60 seconds) in validation logic. Must distinguish: clock skew is different from certificate expiry — clock skew is a time-sync issue, not a certificate lifecycle issue.
- Question 13: Must describe the zero-trust design: every workload has a unique cryptographic identity (SPIFFE SVID or cert-manager-issued cert); all service-to-service calls use mTLS; certificates are short-lived (hours, not years) and automatically rotated before expiry; a service mesh (Istio or Linkerd) handles mTLS transparently at the sidecar proxy layer so application code is unaffected. Key components: (1) certificate authority (Vault, cert-manager, SPIRE) issues short-lived certs; (2) sidecar proxies terminate and initiate mTLS; (3) authorization policy enforces which identities can call which services (not just network policy). Bonus: SPIFFE workload API allows applications to fetch their own certificates at runtime without touching the filesystem.
- Question 14: Must explain TLS termination at the load balancer (edge termination): client ↔ LB = TLS; LB ↔ backend = plain HTTP. Pro: simpler backend configuration, LB handles cert management. Con: traffic inside the cluster is unencrypted — violates zero-trust. TLS passthrough: LB forwards encrypted traffic directly to the backend, which terminates TLS. Pro: end-to-end encryption. Con: LB cannot inspect or route based on HTTP headers. mTLS end-to-end (re-encryption): LB terminates client TLS and initiates a new mTLS connection to the backend. Must argue for mTLS end-to-end in zero-trust environments and for edge termination in simpler non-sensitive setups.
- Question 15: Must propose a layered audit strategy: (1) certificate inventory — automated scanning (e.g. Qualys SSL Labs API, custom OpenSSL scanner) to discover and catalog all TLS endpoints with their expiry dates and cipher suites; (2) policy enforcement — OPA (Open Policy Agent) or a custom admission controller rejects deployments with weak cipher suites or self-signed certs not from the internal CA; (3) alerting — Prometheus + Alertmanager monitors cert expiry (alert at 30 days, 7 days, 1 day); (4) remediation — cert-manager auto-renews; manual runbook for edge cases. Must address: a central cert registry helps track all services; service mesh control plane (Istio) provides a unified view of all mTLS identities and their cert status.
- Question 16: Must explain TLS 1.3 handshake: eliminates the full 2-RTT handshake of TLS 1.2 by combining key exchange into the first flight (ClientHello includes key shares); server can respond in 1 RTT instead of 2. Security improvements: (1) removed weak algorithms (RSA key exchange, static DH, RC4, 3DES, SHA-1 for signatures); (2) mandatory forward secrecy (ECDHE only); (3) encrypted handshake earlier — even the server certificate is encrypted from the client's second flight onward; (4) 0-RTT resumption (with replay attack caveats — must not be used for non-idempotent requests). Bonus: TLS 1.3 has a smaller, simpler cipher suite list (5 suites vs. hundreds in 1.2) making configuration safer by default.

## Concepts
- core concepts: tls, mtls, mutual-authentication, x509, certificate, public-key, private-key, keystore, truststore, ca, root-ca, intermediate-ca, pkix, handshake, certificate-chain, cipher-suite, forward-secrecy
- practical usage: sslcontext, keymanagerfactory, trustmanagerfactory, x509trustmanager, server-ssl-key-store, server-ssl-trust-store, client-auth, curl, openssl, javax-net-debug, eku, clientauth, serverauth, cert-manager, spiffe, ocsp-stapling, session-resumption, session-ticket
- tradeoffs: tls-vs-mtls, security-vs-complexity, certificate-management-overhead, revocation-check-cost, mutual-vs-token-based-auth, edge-termination-vs-end-to-end, crl-vs-ocsp, pinning-leaf-vs-ca
- best practices: separate-keystore-truststore, verify-eku, check-full-chain, monitor-cert-expiry, debug-with-openssl-before-jvm, never-transmit-private-key, pin-ca-not-leaf, use-ocsp-stapling, automate-rotation-with-cert-manager, short-lived-certs-for-zero-trust
