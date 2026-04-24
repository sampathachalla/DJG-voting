# DoJaGa Voting

DoJaGa Voting is a Sepolia-first blockchain voting application with:

- a React frontend for wallet-based voting flows
- a Hardhat smart contract workspace
- an Express backend for private invite registration and on-chain voter authorization

The current architecture is designed so final votes are submitted on-chain on Ethereum Sepolia. The backend helps with invite token generation and private-event registration, but it is not the source of truth for vote totals.

## Current Architecture

### Frontend

The frontend lives in `src/` and provides:

- local non-custodial wallet creation
- Firebase Authentication signup/login
- MetaMask support
- public event creation and voting
- restricted event creation
- private invite-event registration flow

For private invite events, the frontend sends the invite token to the backend, the backend authorizes that wallet on-chain, and the voter then casts the final vote directly from their wallet on Sepolia.

### Smart Contract

The Solidity contract lives in `contracts/contracts/VotingFactory.sol`.

It supports:

- creating voting events
- public voting
- restricted allowlist voting
- later voter authorization for invite-based private events
- one vote per wallet per proposal
- optional treasury and event creation fee controls

### Backend

The backend lives in `backend/` and provides:

- private invite token generation
- invite-token registration
- on-chain authorization of registered wallets for private events
- private event summary/results endpoints backed by Sepolia state

The backend requires a relayer wallet that is allowed to call `authorizeVoter` on the deployed contract. In the current setup, the simplest option is to use the contract owner key.

## Project Structure

```text
src/
  auth/                    Authentication screens
  components/              Layout and route helpers
  context/                 Wallet session state
  contracts/               Frontend ABI/config
  pages/                   Landing, dashboard, events
  services/                Wallet, contract, Firebase, backend helpers

backend/
  src/                     Express API for private-event invite flows

contracts/
  contracts/               Solidity source
  scripts/                 Hardhat deployment scripts
  test/                    Contract tests
```

## Tech Stack

- React 19
- TypeScript
- Vite
- Tailwind CSS
- Ethers v6
- Firebase Authentication
- Express
- Firebase Admin / Firestore
- Hardhat
- Ethereum Sepolia

## Environment Setup

Copy `.env.example` to `.env` in the project root.

Frontend and contract-related variables:

```bash
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_SEPOLIA_VOTING_CONTRACT_ADDRESS=
VITE_VOTING_CONTRACT_ADDRESS=
VITE_SEPOLIA_RPC_URL=
VITE_SEPOLIA_BLOCK_EXPLORER_BASE_URL=https://sepolia.etherscan.io
DEPLOYER_PRIVATE_KEY=0x...
```

Copy `backend/.env.example` to `backend/.env`.

Backend variables:

```bash
PORT=8080
BACKEND_ALLOWED_ORIGINS=http://localhost:5173
SEPOLIA_RPC_URL=https://rpc.sepolia.org
BACKEND_RELAYER_PRIVATE_KEY=0x...
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

Notes:

- `VITE_SEPOLIA_VOTING_CONTRACT_ADDRESS` should point to the deployed contract.
- `BACKEND_RELAYER_PRIVATE_KEY` should be a wallet permitted to authorize voters on the contract.
- If you redeploy the contract after ABI changes, update both frontend and backend configuration.

## Install

Install dependencies in all workspaces:

```bash
npm install
npm --prefix backend install
npm --prefix contracts install
```

## Development Commands

Run the frontend:

```bash
npm run dev
```

Run the backend:

```bash
npm run backend:dev
```

Build the frontend:

```bash
npm run build
```

Build the backend:

```bash
npm run backend:build
```

Compile contracts:

```bash
npm run contracts:compile
```

Run contract tests:

```bash
npm run contracts:test
```

## Deploy To Sepolia

Make sure the root `.env` contains:

```bash
VITE_SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/your_key
DEPLOYER_PRIVATE_KEY=0x...
```

Then deploy:

```bash
npm run contracts:deploy:sepolia
```

After deployment:

1. Confirm the deployed contract address was written into `.env`.
2. Ensure the backend relayer wallet is authorized to call `authorizeVoter`.
3. Restart the frontend and backend.

## Main User Flows

### Public Event

1. Connect a wallet.
2. Create an event on Sepolia.
3. Open the event from another wallet.
4. Cast a vote on-chain.
5. Verify the transaction on Sepolia Etherscan.

### Restricted Allowlist Event

1. Create a restricted event with explicit wallet addresses.
2. Only allowlisted wallets can vote.
3. Final votes are submitted on-chain.

### Private Invite Event

1. Create a restricted event using the invite-token mode.
2. Organizer generates invite tokens from the event page.
3. Voter connects a wallet and registers using an invite token.
4. Backend validates the invite and authorizes that wallet on-chain.
5. Voter submits the final vote directly on Sepolia from that wallet.

## Verification Status

The repo has been checked with:

- `npm run build`
- `npm run backend:build`
- `npm run contracts:test`

Live Sepolia verification still needs to be done with real deployed credentials and funded wallets.

## Known Gaps

- Full live Sepolia end-to-end QA still needs to be completed after deployment
- Wallet import/recovery flow is still incomplete
- Organizer/admin authentication on backend invite endpoints can be strengthened further
- The frontend bundle is still large and could be code-split
