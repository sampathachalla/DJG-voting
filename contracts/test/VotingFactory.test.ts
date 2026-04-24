import { expect } from "chai";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { ethers } from "hardhat";

describe("VotingFactory", () => {
  async function deployFixture() {
    const [owner, creator, voter] = await ethers.getSigners();
    const factory = await ethers.getContractFactory("VotingFactory");
    const contract = await factory.deploy(owner.address, 0);
    await contract.waitForDeployment();
    return { contract, owner, creator, voter };
  }

  it("allows any wallet to create an event", async () => {
    const { contract, creator } = await deployFixture();

    const startTime = (await time.latest()) + 10;
    const endTime = startTime + 3600;

    await expect(
      contract.connect(creator).createEvent(
        [{ title: "Main proposal", description: "Choose", options: ["Yes", "No"] }],
        "Budget vote",
        "Approve budget",
        0,
        startTime,
        endTime,
        true,
        []
      )
    ).to.emit(contract, "EventCreated");

    const events = await contract.getEvents();
    expect(events).to.have.length(1);
    expect(events[0].title).to.equal("Budget vote");
  });

  it("rejects an invalid event window", async () => {
    const { contract, creator } = await deployFixture();
    const startTime = (await time.latest()) + 10;
    const endTime = startTime;

    await expect(
      contract.connect(creator).createEvent(
        [{ title: "Main proposal", description: "Choose", options: ["Yes", "No"] }],
        "Budget vote",
        "Approve budget",
        0,
        startTime,
        endTime,
        true,
        []
      )
    ).to.be.revertedWith("Invalid event window");
  });

  it("stores public vote choices and blocks double voting", async () => {
    const { contract, creator, voter } = await deployFixture();

    const startTime = (await time.latest()) + 5;
    const endTime = startTime + 3600;

    await contract.connect(creator).createEvent(
      [{ title: "Main proposal", description: "Choose", options: ["Yes", "No"] }],
      "Budget vote",
      "Approve budget",
      0,
      startTime,
      endTime,
      true,
      []
    );

    await time.increaseTo(startTime + 1);
    await contract.connect(voter).castVote(1, 1, 1);

    const proposals = await contract.getEventProposals(1);
    expect(proposals[0].voteCounts[1]).to.equal(1n);

    const record = await contract.getVoteRecord(1, 1, voter.address);
    expect(record.hasVoted).to.equal(true);
    expect(record.optionIndex).to.equal(1);

    await expect(contract.connect(voter).castVote(1, 1, 0)).to.be.revertedWith("Already voted");
  });

  it("lets the creator cancel an event before any vote is cast", async () => {
    const { contract, creator } = await deployFixture();

    const startTime = (await time.latest()) + 100;
    const endTime = startTime + 3600;

    await contract.connect(creator).createEvent(
      [{ title: "Main proposal", description: "Choose", options: ["Yes", "No"] }],
      "Budget vote",
      "Approve budget",
      0,
      startTime,
      endTime,
      true,
      []
    );

    await expect(contract.connect(creator).deleteEvent(1)).to.emit(contract, "EventDeleted");

    const events = await contract.getEvents();
    expect(events[0].isActive).to.equal(false);
  });

  it("rejects delete requests from other wallets", async () => {
    const { contract, creator, voter } = await deployFixture();

    const startTime = (await time.latest()) + 100;
    const endTime = startTime + 3600;

    await contract.connect(creator).createEvent(
      [{ title: "Main proposal", description: "Choose", options: ["Yes", "No"] }],
      "Budget vote",
      "Approve budget",
      0,
      startTime,
      endTime,
      true,
      []
    );

    await expect(contract.connect(voter).deleteEvent(1)).to.be.revertedWith("Not allowed");
  });

  it("does not allow cancelling an event after a vote has been cast", async () => {
    const { contract, creator, voter } = await deployFixture();

    const startTime = (await time.latest()) + 5;
    const endTime = startTime + 3600;

    await contract.connect(creator).createEvent(
      [{ title: "Main proposal", description: "Choose", options: ["Yes", "No"] }],
      "Budget vote",
      "Approve budget",
      0,
      startTime,
      endTime,
      true,
      []
    );

    await time.increaseTo(startTime + 1);
    await contract.connect(voter).castVote(1, 1, 0);

    await expect(contract.connect(creator).deleteEvent(1)).to.be.revertedWith("Votes already recorded");
  });

  it("enforces event timing", async () => {
    const { contract, creator, voter } = await deployFixture();

    const startTime = (await time.latest()) + 100;
    const endTime = startTime + 100;

    await contract.connect(creator).createEvent(
      [{ title: "Main proposal", description: "Choose", options: ["Yes", "No"] }],
      "Timing vote",
      "Timed vote",
      0,
      startTime,
      endTime,
      true,
      []
    );

    await expect(contract.connect(voter).castVote(1, 1, 0)).to.be.revertedWith("Voting not started");

    await time.increaseTo(endTime + 1);
    await expect(contract.connect(voter).castVote(1, 1, 0)).to.be.revertedWith("Voting ended");
  });

  it("updates fee when owner changes it", async () => {
    const { contract, owner } = await deployFixture();
    await contract.connect(owner).setEventCreationFee(ethers.parseEther("0.5"));
    expect(await contract.eventCreationFeeWei()).to.equal(ethers.parseEther("0.5"));
  });

  it("creates a restricted event and only allows listed wallets to vote", async () => {
    const { contract, creator, voter, owner } = await deployFixture();

    const startTime = (await time.latest()) + 5;
    const endTime = startTime + 3600;

    await contract.connect(creator).createEvent(
      [{ title: "Restricted proposal", description: "Choose", options: ["Yes", "No"] }],
      "Restricted vote",
      "Allowlisted voters only",
      0,
      startTime,
      endTime,
      false,
      [voter.address]
    );

    const eventData = await contract["getEvent(uint256)"](1);
    expect(eventData.isPublic).to.equal(false);
    expect(eventData.allowedVoterCount).to.equal(1n);
    expect(await contract.canVoteInEvent(1, voter.address)).to.equal(true);
    expect(await contract.canVoteInEvent(1, owner.address)).to.equal(false);

    await time.increaseTo(startTime + 1);
    await contract.connect(voter).castVote(1, 1, 0);
    await expect(contract.connect(owner).castVote(1, 1, 1)).to.be.revertedWith("Not allowed to vote");
  });

  it("allows a restricted event to be created without on-chain allowlisted wallets", async () => {
    const { contract, creator } = await deployFixture();
    const startTime = (await time.latest()) + 10;
    const endTime = startTime + 3600;

    await expect(
      contract.connect(creator).createEvent(
        [{ title: "Restricted proposal", description: "Choose", options: ["Yes", "No"] }],
        "Restricted vote",
        "Backend invite flow",
        0,
        startTime,
        endTime,
        false,
        []
      )
    ).to.emit(contract, "EventCreated");

    const eventData = await contract["getEvent(uint256)"](1);
    expect(eventData.isPublic).to.equal(false);
    expect(eventData.allowedVoterCount).to.equal(0n);
  });

  it("lets the owner authorize a voter later for invite-token private events", async () => {
    const { contract, creator, voter, owner } = await deployFixture();
    const startTime = (await time.latest()) + 10;
    const endTime = startTime + 3600;

    await contract.connect(creator).createEvent(
      [{ title: "Private proposal", description: "Choose", options: ["Yes", "No"] }],
      "Invite flow vote",
      "Backend-assisted private vote",
      0,
      startTime,
      endTime,
      false,
      []
    );

    await time.increaseTo(startTime + 1);
    await expect(contract.connect(voter).castVote(1, 1, 0)).to.be.revertedWith("Not allowed to vote");

    await expect(contract.connect(owner).authorizeVoter(1, voter.address))
      .to.emit(contract, "VoterAuthorized")
      .withArgs(1, voter.address, owner.address);

    const eventData = await contract["getEvent(uint256)"](1);
    expect(eventData.allowedVoterCount).to.equal(1n);
    expect(await contract.canVoteInEvent(1, voter.address)).to.equal(true);

    await expect(contract.connect(voter).castVote(1, 1, 1)).to.emit(contract, "VoteCast");
  });

  it("allows the event creator to authorize a voter later", async () => {
    const { contract, creator, voter } = await deployFixture();
    const startTime = (await time.latest()) + 10;
    const endTime = startTime + 3600;

    await contract.connect(creator).createEvent(
      [{ title: "Private proposal", description: "Choose", options: ["Yes", "No"] }],
      "Creator-managed private vote",
      "Creator can authorize voters too",
      0,
      startTime,
      endTime,
      false,
      []
    );

    await expect(contract.connect(creator).authorizeVoter(1, voter.address))
      .to.emit(contract, "VoterAuthorized")
      .withArgs(1, voter.address, creator.address);
  });

  it("rejects voter authorization from unrelated wallets", async () => {
    const { contract, creator, voter } = await deployFixture();
    const startTime = (await time.latest()) + 10;
    const endTime = startTime + 3600;

    await contract.connect(creator).createEvent(
      [{ title: "Private proposal", description: "Choose", options: ["Yes", "No"] }],
      "Unauthorized authorizer vote",
      "Only creator or owner can authorize",
      0,
      startTime,
      endTime,
      false,
      []
    );

    await expect(contract.connect(voter).authorizeVoter(1, voter.address)).to.be.revertedWith("Not allowed");
  });
});
