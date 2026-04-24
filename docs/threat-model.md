# Threat Model — Zap

> **Author:** Agam Singh Saluja  
> **Project:** Zap — Anonymous, Ephemeral File Transfer  
> **Scope:** Systematic analysis of adversarial threats, attack vectors, mitigations, and residual risks

---

## Table of Contents

1. [Threat Modelling Methodology](#1-threat-modelling-methodology)
2. [Trust Boundaries](#2-trust-boundaries)
3. [Threat Catalogue](#3-threat-catalogue)
   - [T1 — Passive Network Eavesdropping](#t1--passive-network-eavesdropping)
   - [T2 — Active Man-in-the-Middle (MITM)](#t2--active-man-in-the-middle-mitm)
   - [T3 — Server-Side Data Exposure](#t3--server-side-data-exposure)
   - [T4 — Room Code Enumeration](#t4--room-code-enumeration)
   - [T5 — Storage Exhaustion (DoS)](#t5--storage-exhaustion-dos)
   - [T6 — Relay Abuse (Bandwidth Exhaustion)](#t6--relay-abuse-bandwidth-exhaustion)
   - [T7 — Ciphertext Tampering](#t7--ciphertext-tampering)
   - [T8 — Stale Data Exposure](#t8--stale-data-exposure)
   - [T9 — Malicious File Distribution](#t9--malicious-file-distribution)
   - [T10 — Signaling Injection / Session Hijacking](#t10--signaling-injection--session-hijacking)
   - [T11 — Operator-Level Key Compromise](#t11--operator-level-key-compromise)
   - [T12 — Side-Channel IP Exposure (P2P)](#t12--side-channel-ip-exposure-p2p)
4. [STRIDE Summary Matrix](#4-stride-summary-matrix)
5. [Out-of-Scope Threats](#5-out-of-scope-threats)
6. [Residual Risk Summary](#6-residual-risk-summary)

---

## 1. Threat Modelling Methodology

This document applies the **STRIDE** framework (Spoofing, Tampering, Repudiation, Information Disclosure, Denial of Service, Elevation of Privilege) to Zap's attack surface. Each threat is assessed across three dimensions:

- **Likelihood**: How probable is this attack given Zap's deployment context?
- **Impact**: What is the consequence if the attack succeeds?
- **Mitigation**: What controls currently reduce the risk?

**Assets under protection:**
1. File content (plaintext)
2. Sender/receiver identity and IP
3. Platform availability
4. Room code confidentiality

**Adversary model**: Threats are assessed against three adversary classes:
- **A1 — Passive network observer**: Reads traffic in transit (ISP, Wi-Fi intercept)
- **A2 — Active network attacker**: Can intercept and modify traffic in transit (MITM)
- **A3 — Compromised server**: Full read access to Worker code, KV, and R2
- **A4 — Malicious peer**: The other participant in a transfer session
- **A5 — External attacker**: No privileged access; operates from the public internet

---

## 2. Trust Boundaries

```
┌─────────────────────────────────────────────────────────────────┐
│  TRUSTED                                                        │
│                                                                 │
│  ┌───────────────────────────────┐                              │
│  │  Sender Browser               │  Crypto operations run here  │
│  │  (Web Crypto API, script.js)  │  Key never leaves browser    │
│  └───────────────────────────────┘                              │
└──────────────────────┬──────────────────────────────────────────┘
                       │ TLS boundary
┌──────────────────────▼──────────────────────────────────────────┐
│  SEMI-TRUSTED                                                   │
│                                                                 │
│  Cloudflare Worker + ZapHub DO                                  │
│  (trusted for availability and routing; NOT trusted with keys   │
│   in the target architecture; currently serves the AES key)     │
│                                                                 │
│  Cloudflare R2 + KV                                             │
│  (trusted for storage integrity; sees only ciphertext)          │
└──────────────────────┬──────────────────────────────────────────┘
                       │ TLS boundary
┌──────────────────────▼──────────────────────────────────────────┐
│  UNTRUSTED                                                      │
│                                                                 │
│  Public Internet / Network Path                                 │
│  Receiver Browser (for P2P — adversarial peer scenario)         │
│  External attackers                                             │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. Threat Catalogue

---

### T1 — Passive Network Eavesdropping

**Category**: Information Disclosure  
**Adversary**: A1

**Description**: A passive observer (ISP, shared Wi-Fi, network tap) attempts to read file content or metadata as it traverses the network.

**Attack scenario**:
```
Sender ──── plaintext ────► [Observer] ──── plaintext ────► Cloudflare
```

**Mitigation**:
- All client ↔ Worker communication is over **TLS 1.3** (enforced by Cloudflare edge)
- P2P DataChannel uses mandatory **DTLS 1.2+** (browser-enforced; cannot be disabled)
- Cloud Hold: even if TLS were stripped, the attacker receives **AES-256-GCM ciphertext** — unintelligible without the key

**Residual risk**: Negligible. TLS + application-layer encryption provide two independent barriers.

**Likelihood**: Low | **Impact**: High | **Overall**: Low

---

### T2 — Active Man-in-the-Middle (MITM)

**Category**: Tampering, Information Disclosure  
**Adversary**: A2

**Description**: An active attacker intercepts TLS connections to inject or modify data.

**Attack scenario**:
```
Browser ──► [Attacker proxy] ──► Cloudflare
              ↑ modifies response
```

**Mitigation**:
- Cloudflare terminates TLS at the edge with valid CA-signed certificates; a MITM would require forging or compromising a CA certificate
- WebRTC DTLS uses **self-signed certificates with fingerprint verification** — the browser verifies DTLS fingerprints exchanged during SDP signaling
- GCM authentication tags detect any ciphertext modification on download

**Residual risk**: Viable only against a network-level attacker who has compromised a browser-trusted CA — effectively a nation-state-tier attack.

**Likelihood**: Very Low | **Impact**: High | **Overall**: Low

---

### T3 — Server-Side Data Exposure

**Category**: Information Disclosure  
**Adversary**: A3

**Description**: An attacker with read access to the Cloudflare environment (compromised API token, rogue insider, supply chain compromise) attempts to read uploaded files.

**Attack scenario**:
```
Attacker gains R2 read access → lists objects → downloads ciphertext
```

**Mitigation**:
- R2 stores only **AES-256-GCM ciphertext**; without the key, stored data is computationally inaccessible
- The AES key is derived from `ENCRYPTION_PASSWORD` and not stored in R2 or KV
- Cron-based deletion limits the window during which any given file is accessible

**Residual risk**: An attacker who also compromises the `ENCRYPTION_PASSWORD` Worker environment variable can derive the key and decrypt all stored files. This is the **primary residual risk** of the current key distribution model (see `security.md §7.1`).

**Likelihood**: Low | **Impact**: Critical | **Overall**: Medium

---

### T4 — Room Code Enumeration

**Category**: Information Disclosure  
**Adversary**: A5

**Description**: An attacker systematically guesses room codes to access rooms created by others.

**Attack scenario**:
```
for code in all_possible_codes:
    GET /api/room/<code>
    if response.status == 200: access room
```

**Mitigation**:
- Code space: 6-character alphanumeric → **36⁶ ≈ 2.18 billion** possible codes
- Rate limiting: **100 requests per 15-minute window per IP**; at this rate, exhausting the space would take ~4.7 million hours per IP
- Max rooms per IP (`MAX_ROOMS_PER_IP = 10`) limits scan utility even if codes are discovered

**Residual risk**: Low. Distributed enumeration across many IPs is theoretically possible but impractical at the scale of a single deployment's room count.

**Likelihood**: Low | **Impact**: Medium | **Overall**: Low

---

### T5 — Storage Exhaustion (DoS)

**Category**: Denial of Service  
**Adversary**: A5

**Description**: An attacker creates many rooms and uploads large files to exhaust R2 storage or KV capacity, rendering the service unavailable.

**Attack scenario**:
```
repeat:
    POST /api/room/create
    POST /api/room/upload  (2 GB file, max size)
```

**Mitigation**:
- Global R2 cap: `MAX_R2_STORAGE_GB = 8` — uploads beyond the cap are rejected by the Worker
- Per-IP room limit: `MAX_ROOMS_PER_IP = 10`
- Max file size: `MAX_R2_FILE_SIZE_GB = 2`
- Max files per room: `MAX_ROOM_FILES = 10`
- Rate limiting: 100 requests per 15 minutes per IP
- Cron cleanup prevents accumulation of expired-but-undeleted files

**Residual risk**: A distributed attack across many IPs could potentially saturate the 8 GB global cap. The cap can be lowered via `wrangler.toml` for constrained deployments.

**Likelihood**: Medium | **Impact**: Medium | **Overall**: Medium

---

### T6 — Relay Abuse (Bandwidth Exhaustion)

**Category**: Denial of Service  
**Adversary**: A5

**Description**: An attacker deliberately uses the server relay path (instead of direct P2P) for large transfers to exhaust DO egress bandwidth.

**Attack scenario**:
```
Connect to ZapHub → force ICE failure → relay large file through DO
```

**Mitigation**:
- `MAX_CONCURRENT_RELAYS = 3` caps simultaneous relay sessions
- Rate limiting at the Worker level restricts new WebSocket connections per IP
- Relay is triggered only when direct ICE fails — it cannot be directly requested by clients

**Residual risk**: Moderate. ICE failure conditions are partially attacker-controllable (e.g., by not responding to ICE candidates). Finer-grained relay bandwidth accounting is not currently implemented.

**Likelihood**: Medium | **Impact**: Medium | **Overall**: Medium

---

### T7 — Ciphertext Tampering

**Category**: Tampering  
**Adversary**: A3, A4

**Description**: An attacker with R2 write access (or a MITM on the download path) modifies encrypted chunks to corrupt the downloaded file or inject malicious content.

**Attack scenario**:
```
Attacker modifies bytes in R2 object → Receiver downloads → decrypts
```

**Mitigation**:
- AES-GCM is an **authenticated encryption** scheme; any modification to the ciphertext or IV causes `crypto.subtle.decrypt()` to throw a `DOMException`
- Each 5 MB chunk carries an independent **128-bit GCM authentication tag**; tampering with any chunk is detected before any plaintext is produced

**Residual risk**: Negligible for integrity. A successful tampering attack requires breaking AES-GCM authentication, which is computationally infeasible.

**Likelihood**: Low | **Impact**: High | **Overall**: Low

---

### T8 — Stale Data Exposure

**Category**: Information Disclosure  
**Adversary**: A5

**Description**: A file is accessed after its intended expiry — either because the cron job hasn't yet run, or because R2 objects were not properly cleaned up.

**Attack scenario**:
```
Room expires at T=0
Attacker queries at T=+5min (before next cron)
→ KV returns expired metadata → Worker serves file
```

**Mitigation**:
- Worker checks `expiresAt` on **every request** — expired rooms are rejected at the API layer, even if KV entry and R2 objects still physically exist
- Cron runs every 10 minutes to clean orphaned objects
- KV TTLs are set at write time as a secondary deletion mechanism

**Residual risk**: Zero for access (Worker rejects requests for expired rooms). Physical R2 object residency may extend up to 10 minutes beyond expiry, but is inaccessible via the API.

**Likelihood**: Low | **Impact**: Low | **Overall**: Very Low

---

### T9 — Malicious File Distribution

**Category**: Repudiation, Elevation of Privilege  
**Adversary**: A4

**Description**: A bad actor uses Zap's Cloud Hold to distribute malware, CSAM, or other illegal content, leveraging client-side encryption to evade content moderation.

**Attack scenario**:
```
Attacker uploads malware encrypted with AES-GCM
→ Worker cannot scan content (ciphertext only)
→ Link shared with victim
```

**Mitigation**:
- Ephemerality limits distribution window (max 24 hours)
- No indexing, no search, no public listing of rooms
- Rate limits constrain upload volume
- **No server-side content scanning is possible** given the encryption model — this is an inherent trade-off

**Residual risk**: Moderate. Client-side encryption is in fundamental tension with content moderation. This trade-off is accepted in the current design. Operator-level DMCA/abuse response requires manual room deletion via the admin API.

**Likelihood**: Medium | **Impact**: High | **Overall**: Medium (accepted trade-off)

---

### T10 — Signaling Injection / Session Hijacking

**Category**: Spoofing, Elevation of Privilege  
**Adversary**: A5

**Description**: An attacker injects a crafted SDP offer or ICE candidate into a P2P session to redirect the DataChannel to an attacker-controlled endpoint.

**Attack scenario**:
```
Attacker learns room code → connects to ZapHub → injects malicious SDP
```

**Mitigation**:
- ZapHub allows only one peer per role (Sender / Receiver) per room; a third connection is rejected or replaces the idle peer
- WebRTC DTLS fingerprint verification is enforced by the browser — a hijacked ICE path that does not present the expected DTLS fingerprint is rejected
- TLS on the WebSocket channel prevents injection from outside the connection

**Residual risk**: If an attacker arrives before the legitimate receiver, they could establish the P2P session. There is no secondary authentication of peers beyond room code knowledge. This is consistent with the anonymity model.

**Likelihood**: Low | **Impact**: High | **Overall**: Low-Medium

---

### T11 — Operator-Level Key Compromise

**Category**: Information Disclosure  
**Adversary**: A3

**Description**: The `ENCRYPTION_PASSWORD` variable in `wrangler.toml` or the Cloudflare dashboard is leaked, allowing decryption of all Cloud Hold files.

**Attack scenario**:
```
Attacker reads ENCRYPTION_PASSWORD from leaked wrangler.toml
→ Derives AES key via the same derivation function as the Worker
→ Downloads ciphertext from R2 → decrypts
```

**Mitigation**:
- `wrangler.toml` is listed in `.gitignore` — the file is never committed to the repository
- Cloudflare dashboard secrets are access-controlled by account credentials
- TTL-based deletion means historical ciphertext is unavailable after expiry

**Residual risk**: **High** if `ENCRYPTION_PASSWORD` is leaked. The entire Cloud Hold encryption model depends on this secret remaining confidential. This motivates the roadmap item to move to client-side key generation (see `security.md §8`).

**Likelihood**: Low (good practice) | **Impact**: Critical | **Overall**: Medium

---

### T12 — Side-Channel IP Exposure (P2P)

**Category**: Information Disclosure  
**Adversary**: A4

**Description**: In P2P mode, the receiver's browser discovers the sender's IP address via ICE candidates, which may de-anonymise the sender.

**Attack scenario**:
```
Receiver examines RTCPeerConnection ICE candidates
→ Extracts sender's local or reflexive (public) IP address
```

**Mitigation**:
- Cloudflare TURN credential support: when configured, traffic routes through Cloudflare TURN, masking both peers' IPs from each other
- Without TURN, both peers' public IPs are mutually visible — this is inherent to the WebRTC protocol

**Residual risk**: Without TURN, peer IPs are visible to each other. Users with strong anonymity requirements should be warned that P2P mode without TURN reveals IP addresses to peers.

**Likelihood**: High (without TURN) | **Impact**: Medium | **Overall**: Medium

---

## 4. STRIDE Summary Matrix

| Threat | S | T | R | I | D | E | Likelihood | Impact | Mitigation Strength |
|---|---|---|---|---|---|---|---|---|---|
| T1 — Eavesdropping | | | | ✓ | | | Low | High | Strong |
| T2 — MITM | | ✓ | | ✓ | | | Very Low | High | Strong |
| T3 — Server Exposure | | | | ✓ | | | Low | Critical | Moderate |
| T4 — Room Enumeration | | | | ✓ | | | Low | Medium | Strong |
| T5 — Storage DoS | | | | | ✓ | | Medium | Medium | Moderate |
| T6 — Relay Abuse | | | | | ✓ | | Medium | Medium | Moderate |
| T7 — Ciphertext Tamper | | ✓ | | | | | Low | High | Strong |
| T8 — Stale Data | | | | ✓ | | | Low | Low | Strong |
| T9 — Malware Distribution | | | ✓ | | | ✓ | Medium | High | Weak (accepted) |
| T10 — Signaling Injection | ✓ | | | | | ✓ | Low | High | Moderate |
| T11 — Key Compromise | | | | ✓ | | | Low | Critical | Moderate |
| T12 — IP Exposure (P2P) | | | | ✓ | | | High | Medium | Conditional |

*S=Spoofing, T=Tampering, R=Repudiation, I=Information Disclosure, D=Denial of Service, E=Elevation of Privilege*

---

## 5. Out-of-Scope Threats

The following threats are explicitly outside Zap's security model and are not mitigated by the platform:

| Threat | Reason Out of Scope |
|---|---|
| **Endpoint compromise** (malware on sender/receiver device) | Cannot protect files after they reach the OS filesystem |
| **Receiver-side data leakage** | Once decrypted and downloaded, files are outside platform control |
| **Cloudflare platform compromise** | Zap trusts the Cloudflare infrastructure; platform-level attacks are out of scope |
| **Social engineering** | Sharing room codes with unintended parties is a user-layer concern |
| **Legal / DMCA enforcement** | An operational policy concern, not a technical one |

---

## 6. Residual Risk Summary

After applying all current mitigations, the following risks remain elevated and should be prioritised:

| Risk | Current Status | Recommended Action |
|---|---|---|
| **Operator key compromise** (T11) | `ENCRYPTION_PASSWORD` is the single point of cryptographic failure | Migrate to client-side key generation; never transmit key via `/api/encryption-key` |
| **P2P IP exposure** (T12) | Peer IPs are mutually visible without TURN | Mandate TURN configuration in production; document risk for self-hosters |
| **Malware distribution** (T9) | No content scanning possible with E2EE | Accept as trade-off; implement abuse reporting email in README |
| **Distributed DoS on storage** (T5) | Global 8 GB cap is a blunt instrument | Implement per-room storage quotas and Cloudflare WAF rate rules |

---

*This threat model was developed by Agam Singh Saluja as part of the Zap project security architecture work. It should be revisited whenever the encryption model, key management approach, or infrastructure configuration changes materially.*
