// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract SchoolSaveVault {
    // One savings goal. Each goal is fully independent of every other goal.
    struct Goal {
        address owner;
        address payoutAddress;
        uint256 targetAmount;
        uint256 deadline;
        uint256 saved;
        bool released;
        string label;
    }

    // Goals are stored by an incrementing id, so anyone can reference a goal by number.
    uint256 public nextGoalId;
    mapping(uint256 => Goal) public goals;

    // Fee taken on release, expressed in basis points so it supports fractions of a percent. 150 equals one point five percent.
    uint256 public constant FEE_BASIS_POINTS = 150;
    address public immutable feeCollector;

    event GoalCreated(uint256 indexed goalId, address indexed owner, uint256 targetAmount, uint256 deadline, string label);
    event ContributionMade(uint256 indexed goalId, address indexed contributor, uint256 amount, uint256 newSaved);
    event TargetIncreased(uint256 indexed goalId, uint256 newTargetAmount);
    event DeadlineExtended(uint256 indexed goalId, uint256 newDeadline);
    event GoalReleased(uint256 indexed goalId, address indexed payoutAddress, uint256 amountPaid, uint256 fee);

    // The fee collector is fixed at deployment since it should not change after real funds start flowing through the contract.
    constructor(address _feeCollector) {
        feeCollector = _feeCollector;
    }

    // Creates a new goal and returns its id. The target must be positive and the deadline must be in the future, otherwise the goal makes no sense.
    function createGoal(
        address payoutAddress,
        uint256 targetAmount,
        uint256 deadline,
        string calldata label
    ) external returns (uint256 goalId) {
        require(targetAmount > 0, "target must be greater than zero");
        require(deadline > block.timestamp, "deadline must be in the future");
        require(payoutAddress != address(0), "payout address cannot be empty");

        goalId = nextGoalId;
        nextGoalId++;

        goals[goalId] = Goal({
            owner: msg.sender,
            payoutAddress: payoutAddress,
            targetAmount: targetAmount,
            deadline: deadline,
            saved: 0,
            released: false,
            label: label
        });

        emit GoalCreated(goalId, msg.sender, targetAmount, deadline, label);
    }

    // Anyone can contribute toward a goal, since family and friends should be able to help, not just the owner.
    function contribute(uint256 goalId) external payable {
        Goal storage g = goals[goalId];
        require(g.owner != address(0), "goal does not exist");
        require(!g.released, "goal already released");
        require(msg.value > 0, "contribution must be greater than zero");

        g.saved += msg.value;

        emit ContributionMade(goalId, msg.sender, msg.value, g.saved);
    }

    // Only the owner can raise the target, and it can never go up for no reason after release, since that would be meaningless.
    function increaseTarget(uint256 goalId, uint256 newTargetAmount) external {
        Goal storage g = goals[goalId];
        require(msg.sender == g.owner, "only owner can change the target");
        require(!g.released, "goal already released");
        require(newTargetAmount > g.targetAmount, "new target must be higher than the current target");

        g.targetAmount = newTargetAmount;

        emit TargetIncreased(goalId, newTargetAmount);
    }

    // Only the owner can extend the deadline further out, never pull it earlier, since contributors already planned around the original date.
    function extendDeadline(uint256 goalId, uint256 newDeadline) external {
        Goal storage g = goals[goalId];
        require(msg.sender == g.owner, "only owner can change the deadline");
        require(!g.released, "goal already released");
        require(newDeadline > g.deadline, "new deadline must be later than the current deadline");

        g.deadline = newDeadline;

        emit DeadlineExtended(goalId, newDeadline);
    }

    // Releases the full saved balance to the payout address, minus the platform fee. Only becomes possible once the deadline passes or the target is met, whichever comes first.
    function release(uint256 goalId) external {
        Goal storage g = goals[goalId];
        require(msg.sender == g.owner, "only owner can release");
        require(!g.released, "goal already released");
        require(
            block.timestamp >= g.deadline || g.saved >= g.targetAmount,
            "goal is not yet releasable"
        );
        require(g.saved > 0, "nothing has been saved yet");

        g.released = true;

        uint256 fee = (g.saved * FEE_BASIS_POINTS) / 10000;
        uint256 payout = g.saved - fee;

        (bool feeSent, ) = feeCollector.call{value: fee}("");
        require(feeSent, "fee transfer failed");

        (bool payoutSent, ) = g.payoutAddress.call{value: payout}("");
        require(payoutSent, "payout transfer failed");

        emit GoalReleased(goalId, g.payoutAddress, payout, fee);
    }

    // Read only helper the frontend and agent use to show progress and calculate the AI nudge message, without needing to read the raw struct.
    function getProgress(uint256 goalId)
        external
        view
        returns (uint256 saved, uint256 target, uint256 remainingAmount, uint256 secondsRemaining)
    {
        Goal storage g = goals[goalId];
        saved = g.saved;
        target = g.targetAmount;
        remainingAmount = g.saved >= g.targetAmount ? 0 : g.targetAmount - g.saved;
        secondsRemaining = block.timestamp >= g.deadline ? 0 : g.deadline - block.timestamp;
    }
}