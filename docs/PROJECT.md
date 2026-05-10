# DoJaGa Wallet / Voting — Project Overview

This document orients new contributors. For setup and run instructions, see the root [README.md](../README.md); for backend details, see [backend/README.md](../backend/README.md).

---

## Purpose

DoJaGa is a Sepolia-first web app for **wallet-based voting**:

- A **React + Vite frontend** lets users connect an Ethereum wallet (MetaMask or Coinbase Wallet) and create, browse, and vote in events on the **Sepolia** testnet.
- A **Solidity `VotingFactory`** contract (Hardhat workspace) holds events, proposals, and on-chain vote records, and supports public, restricted-allowlist, and invite-style private events.
- An **Express backend** provides a **private voting API** for invite issuance, wallet registration with one-time tokens, and a relayer-driven on-chain `authorizeVoter` step. It does **not** define official tallies — final votes are always cast on-chain by the voter's wallet.

Optional Firebase Auth gates the in-app routes that require an account; Firebase Admin (server-side) is the optional Firestore storage backend for invite metadata.

---

## Repository layout

```text
src/                    React + Vite frontend
  main.tsx              App bootstrap; wraps <App /> in <WalletProvider>
  App.tsx               Routes (landing, /vote, /observe, /organize, auth)
  context/              Wallet context (active address, chain, provider)
  components/           Layout, ProtectedRoute, WalletRail, ParticipationPanel
  pages/Landing/        Marketing pages (Landing, Features, Security, Support)
  pages/Events/         EventsListPage, EventDetailPage, EventCreatePage
  auth/                 Firebase login / signup
  services/             Frontend service layer (see below)
  contracts/            Frontend ABI + chain config for the voting contract
  types/                Shared TS types (env, voting, firebase)

backend/                Express API (TypeScript, ESM)
  src/index.ts          Entry point (listens on PORT, default 8081)
  src/app.ts            Express app: helmet, CORS, /health, /api router
  src/config.ts         Env loading (also reads root .env as fallback)
  src/routes/           HTTP routes (privateVoting.ts)
  src/services/         privateVotingService, sepoliaContractService
  src/privateVotingStore.ts   File or Firestore store for invites/registrations
  src/utils/            crypto + EIP-191 signature helpers
  src/firebaseAdmin.ts  Optional Firebase Admin init for Firestore

contracts/              Hardhat workspace
  contracts/VotingFactory.sol   Main voting contract
  test/                          Hardhat tests
  hardhat.config.ts              Networks (Sepolia, Amoy)

docs/                   Contributor docs (this file)
```

### Key entry points

| Layer    | File                                | What it does                                   |
|----------|-------------------------------------|------------------------------------------------|
| Frontend | `src/main.tsx`                      | Mounts React, installs `WalletProvider`.       |
| Frontend | `src/App.tsx`                       | Declares all routes and route guards.          |
| Backend  | `backend/src/index.ts`              | Boots the HTTP server.                         |
| Backend  | `backend/src/app.ts`                | Wires middleware and mounts `/api`.            |
| Backend  | `backend/src/routes/privateVoting.ts` | Private-voting HTTP endpoints.               |
| Contract | `contracts/contracts/VotingFactory.sol` | Events, proposals, vote records on-chain.  |

---

## How the pieces connect

```
Browser (MetaMask / Coinbase Wallet)
      │
      │ 1. User actions in React UI
      ▼
React + Vite frontend  ──── ethers.js ────►  Sepolia RPC  ──►  VotingFactory.sol
      │
      │ 2. /api/* (same-origin in dev via Vite proxy)
      ▼
Express backend (port 8081)
      │
      ├── Firestore or local file store (invites + registrations)
      └── Sepolia RPC (read snapshots; relayer signs `authorizeVoter`)
```

Notable details:

- **Wallet** — The frontend connects via injected MetaMask or the Coinbase Wallet SDK; the active address and chain live in `WalletContext`. Final votes are signed and sent by the user's wallet directly to Sepolia.
- **Vite dev proxy** — `vite.config.ts` proxies `/api/*` to `http://127.0.0.1:8081`, so the browser talks to the backend **same-origin** with no CORS hop. In production, `VITE_PRIVATE_VOTING_API_URL` can point to a different origin.
- **Backend RPC + relayer** — `backend/src/config.ts` resolves the Sepolia RPC URL and relayer key, falling back to `VITE_SEPOLIA_RPC_URL` / `DEPLOYER_PRIVATE_KEY` from the root `.env` when backend-specific keys are absent.
- **Storage mode** — If Firebase Admin credentials are present, the backend uses Firestore; otherwise it falls back to a local file store. The mode is reported by `GET /health`.

---

## Main features (what's actually shipped)

- **Landing pages** — `/`, `/features`, `/security`, `/support`.
- **Public observation** — `/observe` and `/observe/events/:eventId` (no auth required) for browsing events and results.
- **Authenticated voter / organizer** routes (gated by `ProtectedRoute`):
  - `/vote`, `/vote/events`, `/vote/events/:eventId` — browse and vote in events.
  - `/organize/events/new` — create a new event.
  - `/organize/events/:eventId` — manage an existing event.
- **Wallet integration** — MetaMask and Coinbase Wallet SDK, with shared state via `WalletContext`.
- **On-chain voting flows** (provided by `VotingFactory.sol`):
  - **Public** events anyone can vote in.
  - **Restricted allowlist** events where the organizer authorizes specific addresses.
  - **Private invite** events where invite tokens are issued off-chain and the backend authorizes the voter's wallet on-chain after registration.
- **Wallet activity rail** — Optional Etherscan-powered panel showing recent activity for the connected wallet.

## Backend HTTP routes

Mounted under `/api` in `backend/src/app.ts`:

| Method | Path                                        | Purpose                                                  |
|--------|---------------------------------------------|----------------------------------------------------------|
| GET    | `/health`                                   | Liveness + reported storage mode.                        |
| POST   | `/api/private-events/invites`               | Organizer creates invite tokens for a private event.     |
| POST   | `/api/private-events/register`              | Voter registers a wallet using an invite token; backend relayer calls `authorizeVoter` on-chain. |
| GET    | `/api/private-events/:eventId`              | Read summary for a private event (requires `contractAddress`). |

All `POST` routes are validated with `zod` and require an EIP-191 signature from the acting wallet.

---

## Glossary

- **Event** — An on-chain ballot created via `VotingFactory`, with one or more proposals.
- **Public / Restricted / Private event** — Visibility and authorization model; private events use off-chain invite tokens plus on-chain authorization.
- **Invite token** — Opaque one-time string issued by the backend; only its hash is stored.
- **Relayer** — Backend-controlled wallet (`BACKEND_RELAYER_PRIVATE_KEY`, falling back to `DEPLOYER_PRIVATE_KEY`) that submits the on-chain `authorizeVoter` transaction so voters do not need to be allowlisted manually.
- **Storage mode** — `firestore` when Firebase Admin env vars are set, otherwise `file` (local JSON store). Surfaced by `GET /health`.

---

## Where to look next

- **Run it locally:** root [README.md](../README.md) (Quick start).
- **Backend env, troubleshooting, deployment:** [backend/README.md](../backend/README.md).
- **Contract behavior:** `contracts/contracts/VotingFactory.sol` and `contracts/test/VotingFactory.test.ts`.
- **Frontend routes:** `src/App.tsx`.
- **Wallet state:** `src/context/WalletContext.tsx`.
