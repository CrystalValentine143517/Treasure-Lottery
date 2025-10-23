# EncryptedTreasure-Dive Frontend

Privacy-preserving treasure box game powered by Zama's FHE technology.

## Features

- **Fully Homomorphic Encryption**: Random rewards generated with FHE for true privacy
- **Web3 Wallet Integration**: Connect with RainbowKit
- **Real-time Updates**: Watch contract events for instant reward reveals
- **Cooldown System**: 60-second cooldown between opens
- **Player Statistics**: Track boxes opened and total rewards

## Tech Stack

- **Vite** - Build tool
- **TypeScript** - Type safety
- **React** - UI framework
- **shadcn/ui** - Component library
- **Tailwind CSS** - Styling
- **wagmi** - Web3 React hooks
- **RainbowKit** - Wallet connection

## Development

```sh
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

## Configuration

Update contract address in `src/config/contract.ts` after deployment.

Update WalletConnect Project ID in `src/wagmi.config.ts`.
