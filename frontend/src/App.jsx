import { useState } from "react";
import { BrowserProvider } from "ethers";
import "./App.css";

function App() {
  // Holds the connected wallet's address once the user connects, empty string means not connected yet.
  const [account, setAccount] = useState("");

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

  return (
    <div className="app">
      <h1>SchoolSave</h1>
      <p>Save toward school fees, a little at a time, locked until you're ready.</p>

      {account ? (
        <p>Connected: {account}</p>
      ) : (
        <button onClick={connectWallet}>Connect Wallet</button>
      )}
    </div>
  );
}

export default App;