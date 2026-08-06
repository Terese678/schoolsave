import { useState, useEffect } from "react";
import { BrowserProvider, JsonRpcProvider, Contract, parseEther, formatEther } from "ethers";
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

  // Holds goal 0's progress, read directly from the contract.
  const [progress, setProgress] = useState(null);

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

  // Reads goal 0's progress from the contract and stores it as plain numbers for display.
  async function loadProgress() {
    // Reads don't need a wallet signer, connecting straight to BOT Chain's RPC
    // avoids conflicts between multiple installed wallet extensions.
    const provider = new JsonRpcProvider("https://rpc.bohr.life");
    const contract = new Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);

    const result = await contract.getProgress(0);
    setProgress({
      saved: formatEther(result.saved),
      target: formatEther(result.target),
      remainingAmount: formatEther(result.remainingAmount),
      secondsRemaining: Number(result.secondsRemaining),
    });
  }

  // Loads progress once when the app first renders.
  useEffect(() => {
    loadProgress();
  }, []);

  // Sends the create goal form to the contract.
  async function handleCreateGoal(event) {
    event.preventDefault();

    if (!account) {
      alert("Connect your wallet first.");
      return;
    }

    const contract = await getContract();
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
    loadProgress();
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
    loadProgress();
  }

  // Converts a number of seconds into a simple days and hours display, easier to read than raw seconds.
  function formatTimeRemaining(seconds) {
    if (seconds <= 0) return "Deadline has passed";
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    return `${days} day(s), ${hours} hour(s) remaining`;
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

      <h2>Progress</h2>
      {progress ? (
        <div>
          <p>Saved: {progress.saved} BOT</p>
          <p>Target: {progress.target} BOT</p>
          <p>Remaining: {progress.remainingAmount} BOT</p>
          <p>{formatTimeRemaining(progress.secondsRemaining)}</p>
        </div>
      ) : (
        <p>Loading progress...</p>
      )}
    </div>
  );
}

export default App;