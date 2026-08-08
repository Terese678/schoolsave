# SchoolSave

SchoolSave is a blockchain based savings vault for school fees. Parents and guardians can lock funds toward a goal, track their progress, and release the funds once the target is met or the deadline passes.

## AI Powered Pacing Nudges

SchoolSave uses the Backboard API to generate encouraging, personalized pacing messages on the Progress card. Every time a goal loads, the app sends the current saved amount, target amount, and time remaining to Backboard, and the API returns a short message based on how the saving is tracking. This is what powers messages like the one telling a parent they have already reached their goal with days to spare, or gently encouraging them to keep saving when a deadline is approaching.

The Backboard API key is stored as an environment variable and is never exposed in the frontend code.

## Why SchoolSave

Growing up, my father did not have much, but one thing he never missed was saving for our school fees. SchoolSave exists so more families can keep that same promise, a little at a time.

## How It Works

1. Connect your wallet
2. Create a savings goal with a label, target amount, deadline, and payout address
3. Contribute BOT toward the goal over time
4. Once the target is met or the deadline passes, release the saved funds to the payout address

## Tech Stack

- Solidity smart contract, deployed on BOT Chain Mainnet
- Hardhat for contract development and testing
- React and Vite for the frontend
- Ethers.js for wallet and contract interaction
- Backboard API for AI generated pacing messages

## Deployment

- Contract address, BOT Chain Mainnet: 0x9Be792Fc6bd54F4AeC95e53cC7BfBD328f6D8510
- Live app: https://schoolsave-six.vercel.app