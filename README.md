# DoJaGa Wallet / DoJaGa Voting

> Full project overview: **[docs/PROJECT.md](docs/PROJECT.md)** — a contributor-focused tour of the repo layout, how the frontend, backend, and contracts connect, and the main features and routes.

Sepolia-first web app for **wallet-based voting**: a React frontend talks to Ethereum Sepolia (via ethers), optional Firebase Auth, and an Express backend for **private invite registration** and on-chain voter authorization. Final votes are submitted on-chain; the backend does not define official vote totals.

The Hardhat workspace under `contracts/` deploys the `VotingFactory` contract used by the UI.

---

## Prerequisites

- **Node.js** (use a current LTS release).
- **npm** (comes with Node).
- Wallets and RPC access appropriate for **Sepolia** when exercising on-chain flows.

---

## Quick start (full stack, local)

**1. Install dependencies** (root, backend, and contracts each have their own `package.json`):

```bash
npm install
npm --prefix backend install
npm --prefix contracts install
```

**2. Environment files**

- Copy `.env.example` → `.env` in the **project root** (frontend, Vite, Hardhat deploy, shared fallbacks).
- Copy `backend/.env.example` → `backend/.env` for the API.

**3. Run two terminals** from the repository root:

| Terminal | Command | Purpose |
|----------|---------|---------|
| 1 | `npm run backend:dev` | Express API on **port 8081** (default). |
| 2 | `npm run dev` | Vite frontend (default **5173**). |

**4. Verify the backend**

```bash
curl -sS http://127.0.0.1:8081/health
```

**5. Open the app** at the URL Vite prints (typically `http://localhost:5173`).

### Vite `/api` proxy (development)

In dev, Vite proxies **`/api/*`** to **`http://127.0.0.1:8081`**, so the browser can call the backend **same-origin** without CORS to another port. Leave **`VITE_PRIVATE_VOTING_API_URL` unset** in `.env` for that behavior (the example file documents this). Set it only when the API lives on another origin (for example production), and use a value that includes the `/api` prefix as required by the app.

---

## Environment variables (overview)

### Root `.env` (frontend + deploy)

| Area | Variables (representative) | Notes |
|------|----------------------------|--------|
| Firebase (client) | `VITE_FIREBASE_*` | Required for signup/login flows that use Firebase. |
| Sepolia | `VITE_SEPOLIA_RPC_URL`, `VITE_SEPOLIA_VOTING_CONTRACT_ADDRESS`, `VITE_SEPOLIA_BLOCK_EXPLORER_BASE_URL` | RPC must accept **HTTP POST** with JSON-RPC; avoid URLs that return HTML. If you set a **custom** RPC (for example 1rpc.io) and hit **usage limits**, the UI automatically **falls back** to a public Sepolia endpoint for read-only calls (`ethers.FallbackProvider`). For reliable throughput, use Infura, Alchemy, or a paid RPC plan. |
| Amoy (optional) | `VITE_AMOY_*` | Present for optional Polygon Amoy configuration. |
| Legacy | `VITE_VOTING_CONTRACT_ADDRESS`, `VITE_BLOCK_EXPLORER_BASE_URL` | Fallbacks for older code paths; align with your deployed network if used. |
| Private voting API | `VITE_PRIVATE_VOTING_API_URL` | Omit in local dev for same-origin `/api` via Vite proxy. |
| Etherscan (optional) | `VITE_ETHERSCAN_API_KEY`, per-network overrides | Improves the in-app wallet activity rail; optional. |
| Deploy | `DEPLOYER_PRIVATE_KEY` | Used by Hardhat when deploying from this repo (`contracts` reads `../.env`). |

See `.env.example` for the full list and comments.

### `backend/.env`

Private voting API: Sepolia RPC, relayer key, CORS-related `BACKEND_ALLOWED_ORIGINS`, Firebase Admin fields for Firestore. The backend may fall back to `VITE_SEPOLIA_RPC_URL` or `DEPLOYER_PRIVATE_KEY` from the root `.env` when backend-specific keys are absent (non-overriding load). Details and a column reference table: **[backend/README.md](backend/README.md)**.

After changing contract addresses or ABI, update frontend and backend configuration consistently.

---

## Useful scripts (root `package.json`)

| Script | Description |
|--------|-------------|
| `npm run dev` | Vite dev server. |
| `npm run build` | Typecheck and production build of the frontend. |
| `npm run preview` | Preview the production build. |
| `npm run backend:dev` | Backend in watch mode. |
| `npm run backend:build` | Compile backend TypeScript. |
| `npm run backend:start` | Run compiled backend (`node dist/index.js`). |
| `npm run contracts:compile` | Hardhat compile. |
| `npm run contracts:test` | Hardhat tests. |
| `npm run contracts:deploy:sepolia` | Deploy to Sepolia (expects root `.env` with `DEPLOYER_PRIVATE_KEY` and RPC; Hardhat uses `VITE_SEPOLIA_RPC_URL` with a documented default in `hardhat.config.ts`). |
| `npm run contracts:deploy:amoy` | Deploy to Amoy. |

---

## Project layout

```text
src/           React app (auth, wallet context, events UI, services)
backend/       Express API for private invites and on-chain authorization
contracts/     Hardhat: VotingFactory.sol, deploy scripts, tests
```

---

## Architecture (short)

- **Frontend** (`src/`): wallet connection (including MetaMask and Coinbase Wallet SDK paths), Firebase auth, event creation and voting UI, calls to Sepolia and to `/api` for private flows.
- **Contracts** (`contracts/contracts/VotingFactory.sol`): creates events, public and restricted voting, invite-style private flows with later on-chain authorization, one vote per wallet per proposal, optional fees/treasury (see contract source for exact behavior).
- **Backend** (`backend/`): invite issuance, registration, relayer-driven `authorizeVoter`, summaries/results from chain. **Deep backend setup, env table, and troubleshooting:** [backend/README.md](backend/README.md).

---

## Main user flows

- **Public event:** Connect a wallet, create or open an event, vote on-chain on Sepolia.
- **Restricted allowlist:** Organizer supplies allowed addresses; only those wallets can vote on-chain.
- **Private invite:** Organizer creates invite tokens via the backend; a voter registers with a token; the backend authorizes the wallet on-chain; the voter casts the vote from that wallet.

---

## Deploying the contract to Sepolia

Ensure root `.env` includes a funded testnet `DEPLOYER_PRIVATE_KEY` and a working `VITE_SEPOLIA_RPC_URL` (or rely on the Hardhat default documented in `contracts/hardhat.config.ts`). Then:

```bash
npm run contracts:deploy:sepolia
```

Update `VITE_SEPOLIA_VOTING_CONTRACT_ADDRESS` (and any legacy `VITE_VOTING_CONTRACT_ADDRESS` you use) plus backend relayer permissions as needed, then restart frontend and backend.

---

## Ballot privacy (on-chain)

This project uses a **storage-and-logs** privacy posture, not full cryptographic anonymity:

- Contract storage records **whether** a wallet voted, not which option it chose in a way organizers can read from a simple `getVoteRecord`-style API.
- `VoteCast` logs are shaped so indexers cannot recover the choice from logs alone.
- **Aggregate vote counts** remain public on-chain.
- **Limitation:** Transaction calldata and `msg.sender` are public; a block explorer can still link a wallet to a choice for a given transaction. Stronger anonymity would require additional cryptography or relay patterns.

---

## Known gaps

- Full live Sepolia end-to-end QA depends on your deployment and funded keys.
- Wallet import/recovery flows may be incomplete.
- Organizer authentication on invite endpoints can be hardened.
- Frontend bundle size could be improved (for example code splitting).

---

## Repo checks

The tree has been exercised with `npm run build`, `npm run backend:build`, and `npm run contracts:test` at various points; rerun after your own changes.
