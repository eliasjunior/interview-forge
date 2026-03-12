# TLS and mTLS

## Summary
TLS (Transport Layer Security) provides one-way authentication: the client verifies the server's identity using an X.509 certificate. mTLS (mutual TLS) extends this to two-way authentication: the server also verifies the client's certificate. Keystore holds your identity (private key + certificate chain, used when presenting who you are); Truststore holds trust anchors (CA certificates, used to validate the other party). The TLS handshake proves private key ownership via a cryptographic signature over the handshake transcript — no private key is ever transmitted across the wire. PKIX chain validation checks the signature chain from leaf certificate up to a trusted root CA. In Java, SSLContext wires together KeyManagerFactory (identity) and TrustManagerFactory (trust); Spring Boot exposes this via server.ssl.* properties.

## Questions
1. What is the difference between TLS and mTLS, and in what scenarios would you use mTLS over standard TLS?
2. What is the difference between a Keystore and a Truststore? Which components in a typical mTLS setup need each one?
3. Walk me through the mTLS handshake step by step. How does the server verify the client without the client ever transmitting its private key?
4. What is an X.509 certificate and what information does it contain? What does PKIX chain validation verify?
5. How would you configure mTLS in a Spring Boot application, and how would you debug a certificate handshake failure in production?

## Evaluation Criteria
- Question 1: Must clearly distinguish TLS (one-way: client verifies server) from mTLS (two-way: both parties authenticate). Must give concrete use cases for mTLS: service-to-service communication, B2B APIs, zero-trust networks, internal microservices. Weak: says "mutual authentication" without explaining when or why to use it over plain TLS.
- Question 2: Must clearly distinguish: Keystore = identity (private key + certificate chain, used when presenting identity), Truststore = trust anchors (CA certificates, used to validate the other party). Must correctly map: HTTPS server always needs Keystore + Truststore only if mTLS; normal HTTPS client needs only Truststore; mTLS client needs both. Weak: confuses the two concepts or cannot map which component needs what.
- Question 3: Must describe the flow: TCP connection → ServerHello + server certificate chain → client validates server chain against its truststore → server sends CertificateRequest (mTLS) → client sends its certificate + CertificateVerify (client signs the handshake transcript with its private key) → server verifies the signature using the public key in the client certificate (proves key ownership) + validates the PKIX chain against its truststore. Key point: the private key never leaves the client; proof is via asymmetric signature.
- Question 4: Must say X.509 is the standard certificate format used in TLS. Must mention key fields: Subject (identity), Public Key, Issuer (CA), Validity dates, Signature. Bonus: Extended Key Usage (EKU) — ServerAuth for server certs, ClientAuth for client certs. PKIX chain validation: verifies the signature chain from the leaf certificate through intermediate CAs up to a trusted root CA in the truststore; also checks expiration, key usage, and revocation. "PKIX path building failed" means no path to a trusted root could be constructed.
- Question 5: Must mention Spring Boot config: server.ssl.key-store, server.ssl.trust-store, server.ssl.client-auth=need. Java internals: SSLContext.init(keyManagers, trustManagers, secureRandom), KeyManagerFactory, TrustManagerFactory. Debug commands: curl -v --cert client.crt --key client.key https://host, openssl s_client -connect host:443 -showcerts. JVM debug flag: -Djavax.net.debug=ssl,handshake. Must map common errors: "unable to get local issuer certificate" = missing intermediate CA on client side, "alert unknown_ca" = server does not trust client's CA, "PKIX path building failed" = chain cannot build to trusted root.

## Concepts
- core concepts: tls, mtls, mutual-authentication, x509, certificate, public-key, private-key, keystore, truststore, ca, root-ca, intermediate-ca, pkix, handshake, certificate-chain
- practical usage: sslcontext, keymanagerfactory, trustmanagerfactory, x509trustmanager, server-ssl-key-store, server-ssl-trust-store, client-auth, curl, openssl, javax-net-debug, eku, clientauth, serverauth
- tradeoffs: tls-vs-mtls, security-vs-complexity, certificate-management-overhead, revocation-check-cost, mutual-vs-token-based-auth
- best practices: separate-keystore-truststore, verify-eku, check-full-chain, monitor-cert-expiry, debug-with-openssl-before-jvm, never-transmit-private-key
