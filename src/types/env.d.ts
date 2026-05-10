interface ImportMetaEnv {
  readonly VITE_FIREBASE_API_KEY?: string;
  readonly VITE_FIREBASE_AUTH_DOMAIN?: string;
  readonly VITE_FIREBASE_PROJECT_ID?: string;
  readonly VITE_FIREBASE_STORAGE_BUCKET?: string;
  readonly VITE_FIREBASE_MESSAGING_SENDER_ID?: string;
  readonly VITE_FIREBASE_APP_ID?: string;
  readonly VITE_DEFAULT_TESTNET?: string;
  readonly VITE_SEPOLIA_RPC_URL?: string;
  readonly VITE_SEPOLIA_VOTING_CONTRACT_ADDRESS?: string;
  readonly VITE_SEPOLIA_BLOCK_EXPLORER_BASE_URL?: string;
  readonly VITE_AMOY_RPC_URL?: string;
  readonly VITE_AMOY_VOTING_CONTRACT_ADDRESS?: string;
  readonly VITE_AMOY_BLOCK_EXPLORER_BASE_URL?: string;
  readonly VITE_VOTING_CONTRACT_ADDRESS?: string;
  readonly VITE_BLOCK_EXPLORER_BASE_URL?: string;
  readonly VITE_ETHERSCAN_API_KEY?: string;
  readonly VITE_SEPOLIA_ETHERSCAN_API_KEY?: string;
  readonly VITE_AMOY_ETHERSCAN_API_KEY?: string;
  readonly VITE_PRIVATE_VOTING_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
