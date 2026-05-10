# DoJaGa private voting backend

Express API for **private invite registration** on top of the on-chain voting model: organizers mint invite tokens, voters register with a token and signature, the service authorizes the wallet on the Sepolia contract, and the voter submits votes from their own wallet. Vote totals remain on-chain; this service is not the source of truth for results.

For how the full app fits together (frontend, contracts, deploy), see the [root README](../README.md).

## What it does

- Create invite batches for restricted Sepolia events (organizer-signed).
- Register a wallet with an invite token (wallet-signed); authorize that wallet on-chain via a relayer key.
- Expose private-event summary and results endpoints backed by chain state.

Firestore collections (when Firebase Admin is configured): `privateVotingEvents`, `privateVotingInvites`, `privateVotingRegistrations`. Without those credentials, storage falls back to a JSON file under `backend/.demo-private-voting-store.json`.

## Prerequisites

- **Node.js** (current LTS is a safe choice).
- A **Sepolia JSON-RPC** endpoint that accepts **HTTP `POST`** with a JSON-RPC body at the URL you configure. Generic web pages or endpoints that return HTML for `POST` will break ethers; use a real provider (PublicNode, Infura, Alchemy, etc.). The example files include a public default; replace it if your environment blocks or rate-limits it.
- **Firebase Admin** credentials if you use Firestore-backed storage (recommended for anything beyond local dev).

## Quick start (backend only)

From the **repository root** (recommended, matches root `package.json` scripts):

```bash
npm install
npm --prefix backend install
cp backend/.env.example backend/.env
# Edit backend/.env — see table below.
npm run backend:dev
```

Or from `backend/`:

```bash
npm install
cp .env.example .env
npm run dev
```

The server listens on **port `8081`** by default (`http://localhost:8081`).

### Health check

```bash
curl -sS http://127.0.0.1:8081/health
```

You should get a successful HTTP response from the running process.

## Environment variables

Copy `backend/.env.example` to `backend/.env`. The app also loads the **repository root** `.env` afterward with `override: false`, so missing keys in `backend/.env` can be filled from the root file (for example a shared RPC URL).

| Variable | Required | Description |
|----------|----------|-------------|
| `PORT` | No | HTTP port; default `8081`. |
| `BACKEND_ALLOWED_ORIGINS` | No | Comma-separated extra origins for CORS. Localhost / `127.0.0.1` on any port is allowed for development regardless. |
| `SEPOLIA_RPC_URL` | Yes* | Sepolia JSON-RPC URL (`POST`). If unset, the backend may use `VITE_SEPOLIA_RPC_URL` from the root `.env` when present. |
| `BACKEND_RELAYER_PRIVATE_KEY` | Yes* | Private key of the wallet that submits on-chain `authorizeVoter` (often the contract owner). If unset, `DEPLOYER_PRIVATE_KEY` from root `.env` may be used when present. |
| `FIREBASE_PROJECT_ID` | For Firestore | Firebase project ID. |
| `FIREBASE_CLIENT_EMAIL` | For Firestore | Service account email. |
| `FIREBASE_PRIVATE_KEY` | For Firestore | Service account private key (PEM), with `\n` for newlines inside the string as in the example. |

\*Required for flows that touch Sepolia or Firestore; local smoke tests of `/health` may still run with minimal config depending on code paths.

## API overview

- `GET /health` — liveness.
- `POST /api/private-events/invites` — create invite batch (organizer signs the message below).
- `POST /api/private-events/register` — register wallet with invite (wallet signs the message below); triggers on-chain authorization.
- `GET /api/private-events/:eventId` — summary (query: `contractAddress`).
- `GET /api/private-events/:eventId/results` — results (query: `contractAddress`).

Request bodies include `eventId`, `contractAddress`, signatures, and fields such as `organizerWallet`, `inviteCount`, `expiresAt`, `inviteToken`, and `walletAddress` as enforced in `backend/src/routes/privateVoting.ts`.

### Signed message formats

Organizers sign **create-invites** (exact newlines):

```text
DoJaGa private voting
Action: create-invites
Event: <eventId>
Contract: <contractAddress>
Organizer: <organizerWallet>
Invite count: <inviteCount>
Expires at: <expiresAt | none>
```

Wallets sign **register-wallet**:

```text
DoJaGa private voting
Action: register-wallet
Event: <eventId>
Contract: <contractAddress>
Wallet: <walletAddress>
Invite token: <inviteToken>
```

## Troubleshooting

- **Port `8081` already in use.** Set `PORT` in `backend/.env` to another port and point the Vite dev proxy at that port (see root `vite.config.ts`), or stop the other process using `8081`.
- **Frontend shows `ECONNREFUSED` or network errors calling `/api/...` in dev.** The Vite dev server proxies `/api` to `http://127.0.0.1:8081`. If the backend is not running, the proxy target refuses the connection. Start the backend (`npm run backend:dev` from the repo root) and retry.
- **RPC errors or timeouts.** Confirm `SEPOLIA_RPC_URL` (or fallback `VITE_SEPOLIA_RPC_URL`) is a valid JSON-RPC endpoint and that your key has quota if using a paid provider.
- **On-chain authorization fails.** Ensure `BACKEND_RELAYER_PRIVATE_KEY` (or fallback relayer key) is funded on Sepolia and is allowed by the contract to authorize voters.

## Cloud Run notes

The included `Dockerfile` supports container deployment: honor `PORT`, keep secrets out of the image, tighten `BACKEND_ALLOWED_ORIGINS` to production origins, and consider Secret Manager, structured logging, rate limits, and stronger auth on organizer-only endpoints before production use.
