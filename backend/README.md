# DoJaGa Private Voting Backend

This backend adds a **Sepolia-focused private invited voting flow** on top of the existing on-chain event model.

## What it handles

- organizer creates invite tokens for a restricted Sepolia event
- invited wallet registers with:
  - invite token
  - wallet ownership signature
- backend authorizes the registered wallet on the Sepolia contract
- the registered wallet then casts its own vote directly on-chain

This gives you:

- one wallet per invite
- one on-chain voter authorization per registered wallet
- all final vote counts sourced from Sepolia

## Firestore collections

- `privateVotingEvents`
- `privateVotingInvites`
- `privateVotingRegistrations`

## Environment

Copy `backend/.env.example` into `backend/.env` and fill in:

- `SEPOLIA_RPC_URL`
- `BACKEND_RELAYER_PRIVATE_KEY` (use the contract owner key, or another key that the contract owner is allowed to authorize voters with)
- Firebase Admin credentials
- allowed frontend origins

## Local run

```bash
cd backend
npm install
npm run dev
```

The service starts on:

```text
http://localhost:8080
```

## Endpoints

### Health

```http
GET /health
```

### Create invite batch

```http
POST /api/private-events/invites
```

Body:

```json
{
  "eventId": 4,
  "contractAddress": "0x...",
  "organizerWallet": "0x...",
  "inviteCount": 25,
  "expiresAt": "2026-05-01T00:00:00.000Z",
  "signature": "0x..."
}
```

The organizer signs this message format:

```text
DoJaGa private voting
Action: create-invites
Event: <eventId>
Contract: <contractAddress>
Organizer: <organizerWallet>
Invite count: <inviteCount>
Expires at: <expiresAt | none>
```

### Register wallet with invite token

```http
POST /api/private-events/register
```

Body:

```json
{
  "eventId": 4,
  "contractAddress": "0x...",
  "walletAddress": "0x...",
  "inviteToken": "opaque_token_here",
  "signature": "0x..."
}
```

The wallet signs:

```text
DoJaGa private voting
Action: register-wallet
Event: <eventId>
Contract: <contractAddress>
Wallet: <walletAddress>
Invite token: <inviteToken>
```

Response includes:

- `eventKey`
- `voteToken`

### Get private event summary

```http
GET /api/private-events/:eventId?contractAddress=0x...
```

### Get private event results

```http
GET /api/private-events/:eventId/results?contractAddress=0x...
```

## Cloud Run readiness

This service is prepared for Cloud Run:

- container-friendly `Dockerfile`
- `PORT` support
- stateless HTTP service
- Firebase Admin credentials from env or service account

Before deployment, I recommend:

1. move secrets to Secret Manager
2. tighten CORS to your deployed frontend origin
3. add authentication on organizer-only endpoints
4. add structured logging and rate limits
