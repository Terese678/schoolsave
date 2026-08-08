import { useState, useEffect } from "react";
import { BrowserProvider, JsonRpcProvider, Contract, parseEther, formatEther } from "ethers";
import { CONTRACT_ADDRESS, CONTRACT_ABI } from "./contractConfig";
import { getPaceMessage } from "./agent";
import "./App.css";

// Illustrative BOT to Naira conversion.
// Not a live price feed, its just gives users a rough sense of scale.
const BOT_TO_NAIRA_RATE = 50000;

// Formats a BOT amount (string or number) as an illustrative Naira estimate,
// e.g. "0.01" -> "≈ ₦500". Used next to every BOT figure shown to the user.
function toNaira(botAmount) {
  const value = Number(botAmount) * BOT_TO_NAIRA_RATE;
  return `≈ ₦${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

// Different contracts name their "already paid out" flag differently.
// Try the common ones in order and use whichever one actually exists on
// the returned struct, instead of hardcoding a single guess.
function extractReleasedFlag(goalData) {
  if (!goalData) return false;
  const candidateKeys = ["released", "isReleased", "paid", "isPaid", "withdrawn"];
  for (const key of candidateKeys) {
    if (goalData[key] !== undefined) {
      return Boolean(goalData[key]);
    }
  }
  return false;
}

function App() {
  const [account, setAccount] = useState("");
  const [label, setLabel] = useState("");
  const [targetAmount, setTargetAmount] = useState("");
  const [deadline, setDeadline] = useState("");
  const [payoutAddress, setPayoutAddress] = useState("");
  const [contributionAmount, setContributionAmount] = useState("");
  const [progress, setProgress] = useState(null);
  const [nudgeMessage, setNudgeMessage] = useState("");

  // Which side of the app is showing. "track" = My Goals, Progress, Why
  // SchoolSave. "manage" = Create a Goal, Contribute. Purely a display
  // toggle — every section still exists in the DOM tree, nothing about
  // state or the contract calls changes based on this.
  const [activeTab, setActiveTab] = useState("track");

  // Tracks the goal we're currently reading/writing. Starts null (no goal yet),
  // becomes a real on-chain goal ID once a goal is created, found on load, or
  // picked from the My Goals list.
  const [currentGoalId, setCurrentGoalId] = useState(null);

  // Whether the currently selected goal has already been released. Read
  // alongside progress so the Release button can disable itself correctly
  // instead of relying only on saved/target math.
  const [currentGoalReleased, setCurrentGoalReleased] = useState(false);

  // Every goal that exists on-chain (id 0 .. nextGoalId - 1), used to render
  // the My Goals list so past goals aren't just invisible once you move on.
  const [allGoals, setAllGoals] = useState([]);
  const [goalsLoading, setGoalsLoading] = useState(true);

  // Prompts MetaMask connection and stores the connected wallet address.
  async function connectWallet() {
    if (!window.ethereum) {
      alert("MetaMask is not installed. Please install it to use SchoolSave.");
      return;
    }
    const provider = new BrowserProvider(window.ethereum);
    const accounts = await provider.send("eth_requestAccounts", []);
    setAccount(accounts[0]);
  }

  // Returns a contract instance signed by the connected wallet,
  // used for any write operation (create goal, contribute, release).
  async function getContract() {
    const provider = new BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();
    return new Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
  }

  // On first load, figure out which goal to show. nextGoalId is the ID that
  // WILL be assigned to the next created goal, so the most recently created
  // goal (if any exist) is nextGoalId - 1. If nextGoalId is 0, no goal exists yet.
  async function detectLatestGoalId() {
    const provider = new JsonRpcProvider("https://rpc.bohr.life");
    const contract = new Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);
    const nextId = await contract.nextGoalId();
    if (nextId > 0n) {
      setCurrentGoalId(nextId - 1n);
    }
  }

  // Reads goal progress directly from chain via a read-only RPC provider
  // (no wallet needed), then asks the pacing agent for a nudge message
  // based on how saving is tracking against the deadline. Also checks the
  // goal's released flag so the Release button can reflect it accurately.
  async function loadProgress(goalId) {
    if (goalId === null || goalId === undefined) return;

    const provider = new JsonRpcProvider("https://rpc.bohr.life");
    const contract = new Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);
    const result = await contract.getProgress(goalId);
    const progressData = {
      saved: formatEther(result.saved),
      target: formatEther(result.target),
      remainingAmount: formatEther(result.remainingAmount),
      secondsRemaining: Number(result.secondsRemaining),
    };
    setProgress(progressData);

    try {
      const goalData = await contract.goals(goalId);
      setCurrentGoalReleased(extractReleasedFlag(goalData));
    } catch {
      // goals(id) may not exist or may not expose a released-style field —
      // fall back to "not released" rather than breaking the page.
      setCurrentGoalReleased(false);
    }

    if (Number(progressData.target) > 0) {
      const message = await getPaceMessage({
        savedBOT: Number(progressData.saved),
        targetBOT: Number(progressData.target),
        secondsRemaining: progressData.secondsRemaining,
        label: "your school fees goal",
      });
      setNudgeMessage(message);
    }
  }

  // Pulls every goal that exists on-chain, from id 0 up to nextGoalId - 1,
  // so the My Goals list can show the full history, not just the latest one.
  async function fetchAllGoals() {
    setGoalsLoading(true);
    const provider = new JsonRpcProvider("https://rpc.bohr.life");
    const contract = new Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);
    const nextId = await contract.nextGoalId();

    const goalsList = [];
    for (let i = 0n; i < nextId; i++) {
      try {
        const result = await contract.getProgress(i);
        let goalLabel = `Goal ${i}`;
        let released = false;
        try {
          const goalData = await contract.goals(i);
          if (goalData && goalData.label) {
            goalLabel = goalData.label;
          }
          released = extractReleasedFlag(goalData);
        } catch {
          // goals(id) may not exist, or may not expose a label/released field
          // on this ABI — that's fine, we keep the generic fallbacks.
        }

        const saved = formatEther(result.saved);
        const target = formatEther(result.target);
        const remainingAmount = formatEther(result.remainingAmount);
        const secondsRemaining = Number(result.secondsRemaining);
        const isComplete = Number(remainingAmount) <= 0;
        const isExpired = secondsRemaining <= 0;

        goalsList.push({
          id: i,
          label: goalLabel,
          saved,
          target,
          remainingAmount,
          secondsRemaining,
          released,
          percent:
            Number(target) > 0
              ? Math.min(100, Math.round((Number(saved) / Number(target)) * 100))
              : 0,
          // Released takes priority over complete/expired — once funds are
          // out, that's the goal's final state regardless of the numbers.
          status: released
            ? "released"
            : isComplete
            ? "complete"
            : isExpired
            ? "expired"
            : "active",
        });
      } catch (err) {
        console.error(`Couldn't load goal ${i}`, err);
      }
    }

    // Newest first, so the goal you're most likely working on is up front.
    setAllGoals(goalsList.reverse());
    setGoalsLoading(false);
  }

  // On mount, find the latest goal (if one exists) and pull the full goal
  // history for the My Goals list.
  useEffect(() => {
    detectLatestGoalId();
    fetchAllGoals();
  }, []);

  // Whenever currentGoalId changes (detected on load, set after creating a
  // goal, or picked from My Goals), refresh the Progress card to match it.
  useEffect(() => {
    loadProgress(currentGoalId);
  }, [currentGoalId]);

  // Creates a new goal on-chain and captures the real goal ID the contract
  // assigned to it, by decoding the GoalCreated event from the tx receipt.
  async function handleCreateGoal(event) {
    event.preventDefault();
    if (!account) {
      alert("Connect your wallet first.");
      return;
    }
    const contract = await getContract();
    const deadlineTimestamp = Math.floor(new Date(deadline).getTime() / 1000);
    const tx = await contract.createGoal(payoutAddress, parseEther(targetAmount), deadlineTimestamp, label);
    const receipt = await tx.wait();

    // Find the GoalCreated log among the receipt's logs and decode it to pull out goalId.
    let newGoalId = null;
    for (const log of receipt.logs) {
      try {
        const parsedLog = contract.interface.parseLog(log);
        if (parsedLog && parsedLog.name === "GoalCreated") {
          newGoalId = parsedLog.args.goalId;
          break;
        }
      } catch {
        // Not every log in the receipt belongs to this contract's ABI (e.g. token
        // transfer logs from gas), so a failed parse here is expected and safely skipped.
      }
    }

    alert("Goal created successfully.");
    setLabel("");
    setTargetAmount("");
    setDeadline("");
    setPayoutAddress("");

    if (newGoalId !== null) {
      setCurrentGoalId(newGoalId);
    }
    fetchAllGoals();

    // Jump the user over to Track so they immediately see the goal they
    // just created land in My Goals / Progress.
    setActiveTab("track");
  }

  // Sends BOT to the current goal as a contribution.
  async function handleContribute(event) {
    event.preventDefault();
    if (!account) {
      alert("Connect your wallet first.");
      return;
    }
    if (currentGoalId === null) {
      alert("Create a goal first.");
      return;
    }
    const contract = await getContract();
    const tx = await contract.contribute(currentGoalId, { value: parseEther(contributionAmount) });
    await tx.wait();
    alert("Contribution successful.");
    setContributionAmount("");
    loadProgress(currentGoalId);
    fetchAllGoals();
  }

  // Releases saved funds to the payout address once the current goal is
  // releasable. Wrapped in try/catch so an already-released goal (e.g. from
  // a double click, or state that hadn't refreshed yet) shows a clean
  // message instead of an uncaught console error.
  async function handleRelease() {
    if (!account) {
      alert("Connect your wallet first.");
      return;
    }
    if (currentGoalId === null) {
      alert("Create a goal first.");
      return;
    }
    try {
      const contract = await getContract();
      const tx = await contract.release(currentGoalId);
      await tx.wait();
      alert("Goal released successfully.");
    } catch (err) {
      const reason = err?.revert?.args?.[0] || err?.reason;
      if (reason) {
        alert(`Couldn't release: ${reason}`);
      } else {
        alert("Couldn't release funds. See console for details.");
        console.error(err);
      }
    }
    loadProgress(currentGoalId);
    fetchAllGoals();
  }

  // Formats raw seconds-remaining into a human-readable "X day(s), Y hour(s)" string.
  function formatTimeRemaining(seconds) {
    if (seconds <= 0) return "Deadline has passed";
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    return `${days} day(s), ${hours} hour(s) remaining`;
  }

  // Funds can be released once the deadline has passed OR the target has been
  // fully saved — and only if the goal hasn't already been released.
  const isReleasable =
    !currentGoalReleased &&
    progress &&
    (progress.secondsRemaining <= 0 || Number(progress.remainingAmount) <= 0);

  return (
    <div className="page">
      {/* Fixed full-page dawn gradient background, purely decorative. */}
      <div className="horizon" aria-hidden="true"></div>

      <header className="hero">
        <h1>SchoolSave</h1>
        <p className="tagline">Save toward school fees, a little at a time, locked until you're ready.</p>

        {account ? (
          <p className="wallet-status">Connected · {account.slice(0, 6)}...{account.slice(-4)}</p>
        ) : (
          <button className="btn-primary" onClick={connectWallet}>Connect Wallet</button>
        )}
      </header>

      <div className="wave-divider" aria-hidden="true"></div>

      {/* Tab switcher: Track (status/history) vs Manage (create/contribute).
          Everything below still exists in the DOM at once — this just
          controls which panel is visible, so no state or contract logic
          changes based on the active tab. */}
      <div className="tab-nav" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "track"}
          className={"tab-button" + (activeTab === "track" ? " tab-button-active" : "")}
          onClick={() => setActiveTab("track")}
        >
          Track
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "manage"}
          className={"tab-button" + (activeTab === "manage" ? " tab-button-active" : "")}
          onClick={() => setActiveTab("manage")}
        >
          Manage
        </button>
      </div>

      <main className="content">
        {/* ---------------- TRACK ---------------- */}
        <div className={"tab-panel" + (activeTab === "track" ? "" : " tab-panel-hidden")}>
          {/* My Goals: every goal ever created on-chain, as a scrollable row of
              "notebook" cards. Clicking one makes it the active goal everywhere
              else on the page (Contribute, Progress, Release). */}
          <section className="card goals-list-card">
            <h2>My Goals</h2>
            {goalsLoading ? (
              <p>Loading your goals...</p>
            ) : allGoals.length === 0 ? (
              <p>No goals yet — create your first one in Manage.</p>
            ) : (
              <div className="goals-row">
                {allGoals.map((goal) => (
                  <button
                    key={goal.id.toString()}
                    type="button"
                    className={
                      "goal-chip" +
                      (goal.id === currentGoalId ? " goal-chip-selected" : "") +
                      (goal.status === "complete" ? " goal-chip-complete" : "") +
                      (goal.status === "expired" ? " goal-chip-expired" : "") +
                      (goal.status === "released" ? " goal-chip-released" : "")
                    }
                    onClick={() => setCurrentGoalId(goal.id)}
                  >
                    <span className="goal-chip-tab">#{goal.id.toString()}</span>
                    <span className="goal-chip-label">{goal.label}</span>
                    <div className="goal-chip-bar">
                      <div
                        className="goal-chip-bar-fill"
                        style={{ width: `${goal.percent}%` }}
                      ></div>
                    </div>
                    <span className="goal-chip-meta">
                      {goal.saved} / {goal.target} BOT
                    </span>
                    <span className="goal-chip-status">
                      {goal.status === "released"
                        ? "Released"
                        : goal.status === "complete"
                        ? "Fully saved"
                        : goal.status === "expired"
                        ? "Deadline passed"
                        : "Active"}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </section>

          {/* Progress: read-only view of saved/target/remaining (each with its
              illustrative Naira estimate), time left, an AI-generated pacing
              nudge, and the release action — reflecting whether the goal has
              already been released. */}
          <section className="card progress-card">
            <h2>Progress</h2>
            {progress ? (
              <div className="progress-body">
                <div className="progress-stats">
                  <div className="stat">
                    <span className="stat-label">Saved</span>
                    <span className="stat-value">{progress.saved} BOT</span>
                    <span className="stat-naira">{toNaira(progress.saved)}</span>
                  </div>
                  <div className="stat">
                    <span className="stat-label">Target</span>
                    <span className="stat-value">{progress.target} BOT</span>
                    <span className="stat-naira">{toNaira(progress.target)}</span>
                  </div>
                  <div className="stat">
                    <span className="stat-label">Remaining</span>
                    <span className="stat-value">{progress.remainingAmount} BOT</span>
                    <span className="stat-naira">{toNaira(progress.remainingAmount)}</span>
                  </div>
                </div>
                <p className="time-remaining">{formatTimeRemaining(progress.secondsRemaining)}</p>
                {nudgeMessage && <p className="nudge-message">{nudgeMessage}</p>}
                <button className="btn-secondary" onClick={handleRelease} disabled={!isReleasable}>
                  {currentGoalReleased
                    ? "Already released"
                    : isReleasable
                    ? "Release Funds"
                    : "Not yet releasable"}
                </button>
              </div>
            ) : (
              <p>{currentGoalId === null ? "Create a goal in Manage to get started." : "Loading progress..."}</p>
            )}
          </section>

          {/* Why SchoolSave: personal story section, sibling to progress-card
              (not nested inside it) so it renders as its own card. */}
          <section className="card why-section">
            <h2>Why SchoolSave</h2>
            <p>
              <em>Save fees, save the child.</em><br /><br />
              Growing up, my father didn't have much. But one thing he never missed
              was saving for our school fees. Now, older, I understand just how much
              that mattered — how much education can shape a child's whole life.
              SchoolSave exists so more families can keep that promise, a little at a time.
            </p>
            <p className="why-signature">— why this exists</p>
          </section>
        </div>

        {/* ---------------- MANAGE ---------------- */}
        <div className={"tab-panel" + (activeTab === "manage" ? "" : " tab-panel-hidden")}>
          {/* Create a Goal: writes a new savings goal to the contract. */}
          <section className="card">
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
                  {toNaira(targetAmount)} (illustrative rate, not live pricing)
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
              <button type="submit" className="btn-primary">Create Goal</button>
            </form>
          </section>

          {/* Contribute: adds BOT to the currently tracked goal. */}
          <section className="card">
            <h2>
              {currentGoalId !== null ? `Contribute to Goal ${currentGoalId}` : "Contribute"}
            </h2>
            <form onSubmit={handleContribute}>
              <input
                type="text"
                placeholder="Amount (in BOT)"
                value={contributionAmount}
                onChange={(e) => setContributionAmount(e.target.value)}
                required
              />
              {contributionAmount && !isNaN(contributionAmount) && (
                <p className="conversion-note">
                  {toNaira(contributionAmount)} (illustrative rate, not live pricing)
                </p>
              )}
              <button type="submit" className="btn-primary" disabled={currentGoalId === null}>
                Contribute
              </button>
            </form>
          </section>
        </div>
      </main>
    </div>
  );
}

export default App;