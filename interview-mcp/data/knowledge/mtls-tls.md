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

## Warm-up Quests

### Level 0

1. What is the main difference between TLS and mTLS?
A) TLS encrypts traffic, but mTLS does not
B) TLS authenticates only the server, while mTLS authenticates both client and server
C) TLS uses certificates, but mTLS uses passwords
D) mTLS works only inside Kubernetes
Answer: B

2. What does a Keystore primarily hold?
A) Trusted CA certificates only
B) DNS records for service discovery
C) Private key plus certificate chain for your own identity
D) Revoked certificate serial numbers
Answer: C

3. What does a Truststore primarily hold?
A) Your application's private key
B) Trusted CA certificates used to validate peers
C) Session tickets for TLS resumption
D) Load balancer routing rules
Answer: B

4. During mTLS, how does the server verify the client owns the private key?
A) The client uploads the private key in encrypted form
B) The client signs part of the handshake and the server verifies it with the public key in the certificate
C) The client sends the keystore password over the wire
D) The server checks only the certificate subject name
Answer: B

5. What does "PKIX path building failed" most commonly mean?
A) The TLS version is too new
B) The server rejected the HTTP method
C) A valid certificate chain to a trusted root could not be built
D) The private key algorithm is always unsupported by Java
Answer: C

6. Why does certificate expiry break a TLS connection?
A) Expired certificates disable TCP keepalive
B) Certificate validity dates are part of trust validation
C) Expired certificates cannot be decrypted
D) Expiry matters only for browsers, not backend services
Answer: B

7. What is TLS session resumption primarily for?
A) Replacing certificate validation permanently
B) Avoiding the cost of a full handshake on reconnect
C) Rotating certificates automatically
D) Disabling forward secrecy
Answer: B

8. What is certificate pinning?
A) Storing certificates only in a Java keystore
B) Forcing the server to use one cipher suite
C) Rejecting certificates unless they match a preconfigured expected cert or public key
D) Copying a CA certificate into every pod image
Answer: C

9. You want revocation checking without making every client call the CA during the handshake. Which mechanism solves that?
A) The client sends its certificate twice for reliability
B) The server includes a cached signed revocation status response in the handshake
C) The CA embeds the private key into the certificate chain
D) A Kubernetes feature for mounting certificates
Answer: B

10. What is the main advantage of TLS 1.3 over TLS 1.2?
A) It removes the need for certificates
B) It only works with mTLS
C) It simplifies the handshake and removes many weak legacy options
D) It disables session resumption
Answer: C

### Level 1

1. Which statements about TLS and mTLS are correct?
A) TLS provides encryption in transit
B) mTLS adds client certificate authentication
C) mTLS is common for service-to-service trust inside zero-trust environments
D) Plain TLS still requires the client to validate the server certificate
Answer: A,B,C,D

2. Which statements about Keystore and Truststore are correct?
A) A keystore is about your presented identity
B) A truststore is about who you trust
C) An mTLS client typically needs both
D) In Java, a truststore does not contain your private key used for client authentication
Answer: A,B,C,D

3. Which statements about X.509 validation are correct?
A) The certificate chain must lead to a trusted root or intermediate policy accepted by the truststore
B) Expiration dates matter during validation
C) Key usage / extended key usage can matter
D) Hostname matching alone is not enough if chain trust fails
Answer: A,B,C,D

4. Which statements about the TLS handshake are correct?
A) The private key should never cross the network
B) Certificate-based authentication proves key ownership via signature
C) ClientHello and ServerHello participate in negotiation
D) mTLS means the client skips validating the server
Answer: A,B,C

5. Which statements about certificate rotation are correct?
A) Overlapping validity windows reduce operational risk
B) Pinning the leaf certificate can make rotation brittle
C) Clients may need updated trust material before the new cert is served
D) Rotation always requires dropping all existing connections immediately
Answer: A,B,C

6. Which statements about TLS session resumption are correct?
A) It reduces CPU and handshake latency on reconnect
B) TLS 1.3 can support 0-RTT resumption with replay caveats
C) It can still coexist with normal certificate-based trust establishment
D) Session tickets allow the server to avoid storing per-session state centrally
Answer: A,B,C,D

7. Which statements about revocation are correct?
A) CRLs can become large and stale between updates
B) OCSP adds a live status lookup unless stapled
C) OCSP stapling reduces separate revocation lookups from clients
D) Revocation makes certificate expiry irrelevant
Answer: A,B,C

8. Which statements about TLS termination are correct?
A) Edge termination decrypts at the load balancer
B) End-to-end or re-encrypted TLS is usually stronger for zero-trust service communication
C) Edge termination alone means traffic inside the cluster may be plain HTTP
D) TLS passthrough limits L7 inspection because the backend keeps the encrypted session
Answer: A,B,C,D

9. Which statements about debugging TLS failures are correct?
A) `openssl s_client` is useful before debugging Java-specific config
B) `-Djavax.net.debug=ssl,handshake` can show JVM handshake details
C) `curl -v` with client certs can help isolate mTLS issues
D) TLS failures should always be debugged by changing cipher suites first
Answer: A,B,C

10. Which statements about zero-trust certificate automation are correct?
A) Short-lived certificates reduce blast radius
B) Automated rotation is essential at scale
C) Service identity is stronger when bound to workload identity rather than IP address alone
D) mTLS authenticates workloads, but authorization policy is still needed
Answer: A,B,C,D

### Level 2

1. Explain the difference between a keystore and a truststore in a Spring Boot mTLS setup.
Hint: Map them to identity versus trust, then explain what the server and client each need.
Answer: A keystore holds your own identity material: private key plus certificate chain. A truststore holds CA certificates that you trust for validating the other side. In Spring Boot mTLS, the server needs a keystore to present its identity and a truststore to validate client certificates. An mTLS client also needs a keystore to present its own cert and a truststore to validate the server certificate.

2. Walk through the mTLS handshake and explain why the client does not send its private key.
Hint: Mention certificate exchange, validation, and proof of possession by signature.
Answer: The client connects and receives the server certificate chain, then validates that chain against its truststore. In mTLS, the server requests a client certificate. The client sends its certificate and proves ownership of the private key by signing handshake data; the server verifies that signature using the public key in the client certificate. The private key never leaves the client. Trust comes from both chain validation and proof that the sender controls the matching private key.

3. A Java service fails with `PKIX path building failed`. What does that usually mean, and how do you debug it?
Hint: Think about certificate chain completeness and trusted roots before changing application code.
Answer: It usually means Java could not build a valid trust chain from the peer certificate up to a trusted root in the truststore. Common causes are a missing intermediate CA, using the wrong truststore, or trusting the wrong issuing CA. First inspect the presented chain with `openssl s_client -showcerts`, then verify the truststore contents, and enable `-Djavax.net.debug=ssl,handshake` if needed to see exactly where validation fails.

4. How would you rotate an mTLS certificate in production without downtime?
Hint: Cover overlapping trust, rollout order, and draining old connections.
Answer: Issue the new certificate before the old one expires and ensure the validating side trusts the new issuing chain before the new certificate is presented. Roll out trust first when necessary, then deploy the new certificate and allow existing connections using the old certificate to drain naturally. After the fleet has converged, remove the old certificate and trust entries. In mTLS you must think about both server-side and client-side identities, not just one endpoint.

5. Compare CRL, OCSP, and OCSP stapling from an operational point of view.
Hint: Contrast freshness, latency, and dependency on external network calls.
Answer: CRLs are simple but can be large and stale between downloads. OCSP gives fresher revocation status but requires a live query to the responder, which adds latency and operational dependency. OCSP stapling improves that by letting the server attach a recent signed OCSP response during the handshake, so clients get freshness information without each client making its own network call. At scale, stapling is usually the preferred operational default when revocation checking is required.

6. Explain where TLS termination should happen in a microservices architecture and the tradeoff involved.
Hint: Compare edge termination, passthrough, and re-encryption / end-to-end mTLS.
Answer: Edge termination at the load balancer is simpler operationally because certificate management is centralized there, but traffic behind the load balancer may be unencrypted. TLS passthrough preserves end-to-end encryption but limits the load balancer's visibility into HTTP traffic. A stronger zero-trust design often terminates external TLS at the edge and then initiates a new mTLS connection to the backend, preserving identity and encryption across internal service boundaries at the cost of more certificate management complexity.

7. What changes in TLS 1.3 compared with TLS 1.2, and why do those changes matter?
Hint: Focus on round trips, removed legacy algorithms, and forward secrecy.
Answer: TLS 1.3 simplifies the handshake so that key exchange happens earlier and the connection usually completes in fewer round trips. It removes many weak or obsolete algorithms such as RSA key exchange and other legacy options, which makes secure defaults easier. It also standardizes forward secrecy through ephemeral key exchange. The practical impact is lower latency, a smaller attack surface, and fewer unsafe configuration combinations.

8. How would you design service-to-service mTLS in Kubernetes so certificates rotate automatically?
Hint: Mention an issuing authority, secret delivery, renewal, and workload identity.
Answer: Use an internal CA or a controller such as cert-manager to issue short-lived service certificates. Each workload receives its own certificate and private key through a managed secret or workload identity mechanism, and services trust the cluster CA that issued those certificates. Renewal should happen automatically before expiry, and rollout should avoid breaking live traffic. A service mesh or SPIFFE/SPIRE-style identity system can reduce application-level certificate handling and standardize authentication across the cluster.

9. Why is certificate pinning powerful but dangerous operationally?
Hint: Separate stronger trust assumptions from rotation and recovery risk.
Answer: Pinning can reduce trust in the broad public CA ecosystem by requiring a known expected certificate or public key, which is useful in tightly controlled client-to-server relationships. But it creates operational brittleness: if the pinned cert or key changes and clients are not updated in time, valid connections fail immediately. That makes emergency rotation and recovery harder. Pinning a CA or public key set rather than a single leaf certificate is usually safer than pinning one specific leaf certificate.

10. A certificate is valid on one machine but appears expired or not yet valid on another. What is happening?
Hint: Think about certificate validity windows and infrastructure time sync.
Answer: TLS validation depends on the `notBefore` and `notAfter` timestamps in the certificate. If system clocks are skewed, one machine may believe the certificate is not yet valid or already expired even though another machine accepts it. This is usually an infrastructure time-synchronization problem, not a cryptography bug. The operational fix is reliable NTP and alerting on clock drift.
