# DATABASE ARCHITECTURE (planned — Phase 6)

**Status: not yet implemented.** Phase 1 is a self-contained client. This
document records the committed design so later phases don't improvise.

## Stack

- **PostgreSQL** for persistence.
- **Prisma** as the ORM with versioned migrations.
- Access only from the **server** (Node/Colyseus process). The browser never
  talks to the database directly.

## Planned models

| Model             | Purpose / key relations                                   |
| ----------------- | --------------------------------------------------------- |
| `User`            | Auth identity; password stored as a strong hash (argon2/bcrypt) — never plaintext |
| `PlayerProfile`   | Display name, money, stats; unique per user               |
| `Character`       | Appearance/state per profile                              |
| `Inventory`       | Items owned by a profile                                  |
| `Vehicle`         | Vehicle catalog (model stats)                             |
| `VehicleOwnership`| Profile ⇄ Vehicle with provenance (earned / purchased / NFT later) |
| `Property`        | Ownable real estate in city zones                         |
| `Business`        | Player-run venues tied to properties                      |
| `Mission`         | Mission catalog (objectives, rewards)                     |
| `MissionProgress` | Per-profile mission state                                 |
| `Transaction`     | Append-only money ledger (source, sink, amount, reason)   |
| `Crew`            | Player groups                                             |
| `Friendship`      | Profile ⇄ profile graph                                   |

## Rules

1. Relational integrity: foreign keys with sensible `onDelete` behavior,
   unique constraints (one profile per user, one active spawn per character).
2. Money changes are append-only ledger rows; balances are derived/checked
   against the ledger — the client can never set a balance.
3. Mission completion, rewards, inventory and ownership are validated
   **server-side** only.
4. Migrations are versioned and reviewed; no destructive ad-hoc changes.
5. Secrets live only in `.env` on the server (see `.env.example` naming);
   they are never committed and never exposed to the client bundle.

## Multiplayer boundary (Phase 7)

Colyseus rooms will hold ephemeral state (positions, vehicle physics) while
PostgreSQL holds durable state (profiles, ownership, mission progress). The
server is authoritative for anything that affects economy or progression.
