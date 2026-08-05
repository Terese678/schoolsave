// Testing library that gives us expect and other assertion helpers.
import { expect } from "chai";

// Hardhat's runtime, used here to get access to ethers for deploying and interacting with contracts.
import hre from "hardhat";

describe("SchoolSaveVault", function () {
  // Deploys a fresh contract before each test, so no test can see leftover state from another test.
  async function deployFixture() {
    const { ethers } = await hre.network.getOrCreate();
    const [owner, contributor, payoutAddress, feeCollector] = await ethers.getSigners();

    const SchoolSaveVault = await ethers.getContractFactory("SchoolSaveVault");
    const vault = await SchoolSaveVault.deploy(feeCollector.address);
    await vault.waitForDeployment();

    return { vault, ethers, owner, contributor, payoutAddress, feeCollector };
  }

  it("creates a goal with the given target, deadline, and label", async function () {
    const { vault, ethers, owner, payoutAddress } = await deployFixture();
    const deadline = Math.floor(Date.now() / 1000) + 3600;

    await vault.connect(owner).createGoal(
      payoutAddress.address,
      ethers.parseEther("1"),
      deadline,
      "Nathaniel, Term 1 fees"
    );

    const goal = await vault.goals(0);
    expect(goal.owner).to.equal(owner.address);
    expect(goal.payoutAddress).to.equal(payoutAddress.address);
    expect(goal.targetAmount).to.equal(ethers.parseEther("1"));
    expect(goal.saved).to.equal(0);
    expect(goal.released).to.equal(false);
  });

  it("rejects a goal with a target amount of zero", async function () {
    const { vault, owner, payoutAddress } = await deployFixture();
    const deadline = Math.floor(Date.now() / 1000) + 3600;

    await expect(
      vault.connect(owner).createGoal(payoutAddress.address, 0, deadline, "Bad goal")
    ).to.be.revertedWith("target must be greater than zero");
  });

  it("rejects a goal with a deadline in the past", async function () {
    const { vault, ethers, owner, payoutAddress } = await deployFixture();
    const pastDeadline = Math.floor(Date.now() / 1000) - 3600;

    await expect(
      vault.connect(owner).createGoal(payoutAddress.address, ethers.parseEther("1"), pastDeadline, "Bad goal")
    ).to.be.revertedWith("deadline must be in the future");
  });

  it("increases saved amount when a contribution is made", async function () {
    const { vault, ethers, owner, contributor, payoutAddress } = await deployFixture();
    const deadline = Math.floor(Date.now() / 1000) + 3600;

    await vault.connect(owner).createGoal(payoutAddress.address, ethers.parseEther("1"), deadline, "Fees");
    await vault.connect(contributor).contribute(0, { value: ethers.parseEther("0.4") });

    const goal = await vault.goals(0);
    expect(goal.saved).to.equal(ethers.parseEther("0.4"));
  });

  it("allows more than one contributor to add to the same goal", async function () {
    const { vault, ethers, owner, contributor, payoutAddress, feeCollector } = await deployFixture();
    const deadline = Math.floor(Date.now() / 1000) + 3600;

    await vault.connect(owner).createGoal(payoutAddress.address, ethers.parseEther("1"), deadline, "Fees");
    await vault.connect(contributor).contribute(0, { value: ethers.parseEther("0.3") });
    await vault.connect(feeCollector).contribute(0, { value: ethers.parseEther("0.2") });

    const goal = await vault.goals(0);
    expect(goal.saved).to.equal(ethers.parseEther("0.5"));
  });

  it("rejects a contribution of zero value", async function () {
    const { vault, ethers, owner, contributor, payoutAddress } = await deployFixture();
    const deadline = Math.floor(Date.now() / 1000) + 3600;

    await vault.connect(owner).createGoal(payoutAddress.address, ethers.parseEther("1"), deadline, "Fees");

    await expect(
      vault.connect(contributor).contribute(0, { value: 0 })
    ).to.be.revertedWith("contribution must be greater than zero");
  });

  it("rejects release before the deadline if the target has not been met", async function () {
    const { vault, ethers, owner, contributor, payoutAddress } = await deployFixture();
    const deadline = Math.floor(Date.now() / 1000) + 3600;

    await vault.connect(owner).createGoal(payoutAddress.address, ethers.parseEther("1"), deadline, "Fees");
    await vault.connect(contributor).contribute(0, { value: ethers.parseEther("0.2") });

    await expect(vault.connect(owner).release(0)).to.be.revertedWith("goal is not yet releasable");
  });

  it("releases funds to the payout address minus the fee once the target is met", async function () {
    const { vault, ethers, owner, contributor, payoutAddress, feeCollector } = await deployFixture();
    const deadline = Math.floor(Date.now() / 1000) + 3600;

    await vault.connect(owner).createGoal(payoutAddress.address, ethers.parseEther("1"), deadline, "Fees");
    await vault.connect(contributor).contribute(0, { value: ethers.parseEther("1") });

    const payoutBefore = await ethers.provider.getBalance(payoutAddress.address);
    const feeBefore = await ethers.provider.getBalance(feeCollector.address);

    await vault.connect(owner).release(0);

    const payoutAfter = await ethers.provider.getBalance(payoutAddress.address);
    const feeAfter = await ethers.provider.getBalance(feeCollector.address);

    // 1.5 percent fee means 0.015 goes to the fee collector and 0.985 goes to the payout address.
    expect(payoutAfter - payoutBefore).to.equal(ethers.parseEther("0.985"));
    expect(feeAfter - feeBefore).to.equal(ethers.parseEther("0.015"));
  });

  it("rejects release from anyone other than the goal owner", async function () {
    const { vault, ethers, owner, contributor, payoutAddress } = await deployFixture();
    const deadline = Math.floor(Date.now() / 1000) + 3600;

    await vault.connect(owner).createGoal(payoutAddress.address, ethers.parseEther("1"), deadline, "Fees");
    await vault.connect(contributor).contribute(0, { value: ethers.parseEther("1") });

    await expect(vault.connect(contributor).release(0)).to.be.revertedWith("only owner can release");
  });

  it("rejects releasing the same goal twice", async function () {
    const { vault, ethers, owner, contributor, payoutAddress } = await deployFixture();
    const deadline = Math.floor(Date.now() / 1000) + 3600;

    await vault.connect(owner).createGoal(payoutAddress.address, ethers.parseEther("1"), deadline, "Fees");
    await vault.connect(contributor).contribute(0, { value: ethers.parseEther("1") });
    await vault.connect(owner).release(0);

    await expect(vault.connect(owner).release(0)).to.be.revertedWith("goal already released");
  });

  it("allows the owner to increase the target amount", async function () {
    const { vault, ethers, owner, payoutAddress } = await deployFixture();
    const deadline = Math.floor(Date.now() / 1000) + 3600;

    await vault.connect(owner).createGoal(payoutAddress.address, ethers.parseEther("1"), deadline, "Fees");
    await vault.connect(owner).increaseTarget(0, ethers.parseEther("1.5"));

    const goal = await vault.goals(0);
    expect(goal.targetAmount).to.equal(ethers.parseEther("1.5"));
  });

  it("rejects lowering the target amount", async function () {
    const { vault, ethers, owner, payoutAddress } = await deployFixture();
    const deadline = Math.floor(Date.now() / 1000) + 3600;

    await vault.connect(owner).createGoal(payoutAddress.address, ethers.parseEther("1"), deadline, "Fees");

    await expect(
      vault.connect(owner).increaseTarget(0, ethers.parseEther("0.5"))
    ).to.be.revertedWith("new target must be higher than the current target");
  });

  it("rejects a non owner trying to increase the target", async function () {
    const { vault, ethers, owner, contributor, payoutAddress } = await deployFixture();
    const deadline = Math.floor(Date.now() / 1000) + 3600;

    await vault.connect(owner).createGoal(payoutAddress.address, ethers.parseEther("1"), deadline, "Fees");

    await expect(
      vault.connect(contributor).increaseTarget(0, ethers.parseEther("1.5"))
    ).to.be.revertedWith("only owner can change the target");
  });

  it("allows the owner to extend the deadline", async function () {
    const { vault, ethers, owner, payoutAddress } = await deployFixture();
    const deadline = Math.floor(Date.now() / 1000) + 3600;
    const laterDeadline = deadline + 3600;

    await vault.connect(owner).createGoal(payoutAddress.address, ethers.parseEther("1"), deadline, "Fees");
    await vault.connect(owner).extendDeadline(0, laterDeadline);

    const goal = await vault.goals(0);
    expect(goal.deadline).to.equal(laterDeadline);
  });

  it("rejects pulling the deadline earlier", async function () {
    const { vault, ethers, owner, payoutAddress } = await deployFixture();
    const deadline = Math.floor(Date.now() / 1000) + 3600;
    const earlierDeadline = deadline - 60;

    await vault.connect(owner).createGoal(payoutAddress.address, ethers.parseEther("1"), deadline, "Fees");

    await expect(
      vault.connect(owner).extendDeadline(0, earlierDeadline)
    ).to.be.revertedWith("new deadline must be later than the current deadline");
  });

  it("rejects a non owner trying to extend the deadline", async function () {
    const { vault, ethers, owner, contributor, payoutAddress } = await deployFixture();
    const deadline = Math.floor(Date.now() / 1000) + 3600;

    await vault.connect(owner).createGoal(payoutAddress.address, ethers.parseEther("1"), deadline, "Fees");

    await expect(
      vault.connect(contributor).extendDeadline(0, deadline + 3600)
    ).to.be.revertedWith("only owner can change the deadline");
  });
});