import { useState } from "react";
import { BrowserProvider, Contract, parseEther } from "ethers";
import { CONTRACT_ADDRESS, CONTRACT_ABI } from "./contractConfig";
import "./App.css";

// Illustrative demo rate only, BOT Chain's token does not yet have a reliable public price feed.
const BOT_TO_NAIRA_RATE = 50000;

function App() {
  // Holds the connected wallet's address once the user connects, empty string means not connected yet.
  const [account, setAccount] = useState("");

  // Form fields for creating a new goal.
  const [label, setLabel] = useState("");
  const [targetAmount, setTargetAmount] = useState("");
  const [deadline, setDeadline] = useState("");
  const [payoutAddress, setPayoutAddress] = useState("");

  // Form field for contributing to a goal. Hardcoded to goal 0 for now, the first goal created during testing.
  const [contributionAmount, setContributionAmount] = useState("");

  // Opens MetaMask and asks the user to connect their wallet to this site.
  async function connectWallet() {
    if (!window.ethereum) {
      alert("MetaMask is not installed. Please install it to use SchoolSave.");
      return;
    }

    const provider = new BrowserProvider(window.ethereum);
    const accounts = await provider.send("eth_requestAccounts", []);
    setAccount(accounts[0]);
  }

  // Gets a contract instance connected to the user's wallet, so transactions are signed by them.
  async function getContract() {
    const provider = new BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();
    return new Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
  }

  // Sends the create goal form to the contract.
  async function handleCreateGoal(event) {
    event.preventDefault();

    if (!account) {
      alert("Connect your wallet first.");
      return;
    }

    const contract = await getContract();

    // The contract expects the deadline as a unix timestamp, the form gives us a date string.
    const deadlineTimestamp = Math.floor(new Date(deadline).getTime() / 1000);

    const tx = await contract.createGoal(
      payoutAddress,
      parseEther(targetAmount),
      deadlineTimestamp,
      label
    );
    await tx.wait();

    alert("Goal created successfully.");
    setLabel("");
    setTargetAmount("");
    setDeadline("");
    setPayoutAddress("");
  }

  // Sends a contribution toward goal 0, the value is attached to the transaction itself, not passed as a parameter.
  async function handleContribute(event) {
    event.preventDefault();

    if (!account) {
      alert("Connect your wallet first.");
      return;
    }

    const contract = await getContract();

    const tx = await contract.contribute(0, { value: parseEther(contributionAmount) });
    await tx.wait();

    alert("Contribution successful.");
    setContributionAmount("");
  }

  return (
    <div className="app">
      <h1>SchoolSave</h1>
      <p>Save toward school fees, a little at a time, locked until you're ready.</p>

      {account ? (
        <p>Connected: {account}</p>
      ) : (
        <button onClick={connectWallet}>Connect Wallet</button>
      )}

      <h2>Create a Goal</h2>
      <form onSubmit={handleCreateGoal}>
        <input
          type="text"
          placeholder="Label, e.g. Nathaniel, Term 1 fees"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          required
        />
        <input
          type="text"
          placeholder="Target Amount (in BOT)"
          value={targetAmount}
          onChange={(e) => setTargetAmount(e.target.value)}
          required
        />
        {targetAmount && !isNaN(targetAmount) && (
          <p className="conversion-note">
            ≈ ₦{(Number(targetAmount) * BOT_TO_NAIRA_RATE).toLocaleString()} (illustrative rate, not live pricing)
          </p>
        )}
        <input
          type="date"
          value={deadline}
          onChange={(e) => setDeadline(e.target.value)}
          required
        />
        <input
          type="text"
          placeholder="Payout Address"
          value={payoutAddress}
          onChange={(e) => setPayoutAddress(e.target.value)}
          required
        />
        <button type="submit">Create Goal</button>
      </form>

      <h2>Contribute to Goal 0</h2>
      <form onSubmit={handleContribute}>
        <input
          type="text"
          placeholder="Amount (in BOT)"
          value={contributionAmount}
          onChange={(e) => setContributionAmount(e.target.value)}
          required
        />
        <button type="submit">Contribute</button>
      </form>
    </div>
  );
}

export default App;