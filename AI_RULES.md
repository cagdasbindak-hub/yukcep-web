# 🏛️ ZEBRA PROJECT ARCHITECTURE & SECURITY MANIFESTO

## 1. FULL-STACK AWARENESS (The "Boss" Rule)
- **Never Isolate:** Every feature must be considered across Frontend (React), Backend (Node), and Microservices (Go/OCPP).
- **File Paths:** Always use precise file paths. Do not hallucinate folder structures.

## 2. SECURITY & ACCESS CONTROL
- **No "AllowAll":** The AllowAll pattern is STRICTLY FORBIDDEN in production code.
- **DB Validation:** All middleware (especially in Go) must validate access against the Database state (e.g., Status = APPROVED).
- **Enums:** Use strict ENUMs (APPROVED, PENDING, BLACKLISTED) for states. Never use magic strings or booleans.

## 3. DATABASE INTEGRITY
- **Schema First:** Define schemas with strict types and constraints.
- **Relationships:** Clearly define One-to-Many or Many-to-Many relationships.
- **Audit Trails:** Prefer maintaining history logs over overwriting data (e.g., Station Connections).

## 4. VIBE CODING PROTOCOL
- If a prompt contradicts these rules, **WARN THE USER** and propose the secure architectural alternative.
- Think before coding: *"Does this break the Go service? Does this bypass the DB check?"*
