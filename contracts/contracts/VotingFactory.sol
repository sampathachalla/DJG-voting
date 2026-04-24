// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract VotingFactory {
    enum EventMode {
        SingleBallot,
        MultiElection,
        ProposalBased
    }

    struct ProposalInput {
        string title;
        string description;
        string[] options;
    }

    struct EventData {
        uint256 id;
        string title;
        string description;
        EventMode mode;
        address creator;
        uint256 startTime;
        uint256 endTime;
        bool isActive;
        bool isPublic;
        uint256 proposalCount;
        uint256 allowedVoterCount;
    }

    struct ProposalData {
        uint256 id;
        uint256 eventId;
        string title;
        string description;
        string[] options;
        uint256[] voteCounts;
        bool exists;
    }

    address public owner;
    address public treasury;
    uint256 public eventCreationFeeWei;
    uint256 public eventCount;

    mapping(uint256 => EventData) private eventsById;
    mapping(uint256 => mapping(uint256 => ProposalData)) private proposalsByEvent;
    mapping(uint256 => mapping(uint256 => mapping(address => uint256))) private voteSelections;
    mapping(uint256 => mapping(address => bool)) private allowedVotersByEvent;
    mapping(uint256 => address[]) private allowedVoterAddressesByEvent;
    mapping(uint256 => uint256[]) private proposalIdsByEvent;
    mapping(uint256 => uint256) private totalVotesByEvent;

    event EventCreated(uint256 indexed eventId, address indexed creator, uint8 mode);
    event EventDeleted(uint256 indexed eventId, address indexed actor);
    event VoteCast(uint256 indexed eventId, uint256 indexed proposalId, address indexed voter, uint8 optionIndex);
    event VoterAuthorized(uint256 indexed eventId, address indexed voter, address indexed actor);
    event EventCreationFeeUpdated(uint256 feeWei);
    event TreasuryUpdated(address treasuryAddress);

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }

    constructor(address treasuryAddress, uint256 creationFeeWei) {
        owner = msg.sender;
        // Default the treasury to the owner wallet unless a separate payout address is provided.
        treasury = treasuryAddress == address(0) ? msg.sender : treasuryAddress;
        eventCreationFeeWei = creationFeeWei;
    }

    function setTreasury(address newTreasury) external onlyOwner {
        require(newTreasury != address(0), "Treasury required");
        treasury = newTreasury;
        emit TreasuryUpdated(newTreasury);
    }

    function setEventCreationFee(uint256 newFeeWei) external onlyOwner {
        eventCreationFeeWei = newFeeWei;
        emit EventCreationFeeUpdated(newFeeWei);
    }

    function createEvent(
        ProposalInput[] calldata proposals,
        string calldata title,
        string calldata description,
        uint8 mode,
        uint256 startTime,
        uint256 endTime,
        bool isPublic,
        address[] calldata allowedVoters
    ) external payable returns (uint256) {
        require(msg.value == eventCreationFeeWei, "Wrong creation fee");
        require(proposals.length > 0, "At least one proposal required");
        require(startTime < endTime, "Invalid event window");
        require(mode <= uint8(EventMode.ProposalBased), "Invalid mode");
        // Restricted events may either use an on-chain allowlist or an off-chain invite flow.
        // When no allowlisted wallets are provided, the frontend/backend can manage private eligibility separately.

        eventCount += 1;
        uint256 newEventId = eventCount;

        eventsById[newEventId] = EventData({
            id: newEventId,
            title: title,
            description: description,
            mode: EventMode(mode),
            creator: msg.sender,
            startTime: startTime,
            endTime: endTime,
            isActive: true,
            isPublic: isPublic,
            proposalCount: proposals.length,
            allowedVoterCount: 0
        });

        if (!isPublic) {
            for (uint256 index = 0; index < allowedVoters.length; index++) {
                address voterAddress = allowedVoters[index];
                require(voterAddress != address(0), "Invalid voter");

                if (!allowedVotersByEvent[newEventId][voterAddress]) {
                    allowedVotersByEvent[newEventId][voterAddress] = true;
                    allowedVoterAddressesByEvent[newEventId].push(voterAddress);
                }
            }

            eventsById[newEventId].allowedVoterCount = allowedVoterAddressesByEvent[newEventId].length;
        }

        for (uint256 index = 0; index < proposals.length; index++) {
            ProposalInput calldata proposal = proposals[index];
            require(bytes(proposal.title).length > 0, "Proposal title required");
            // Every proposal must offer at least two choices so the vote is meaningful.
            require(proposal.options.length >= 2, "Need at least two options");

            uint256 proposalId = index + 1;
            ProposalData storage stored = proposalsByEvent[newEventId][proposalId];
            stored.id = proposalId;
            stored.eventId = newEventId;
            stored.title = proposal.title;
            stored.description = proposal.description;
            stored.exists = true;

            for (uint256 optionIndex = 0; optionIndex < proposal.options.length; optionIndex++) {
                require(bytes(proposal.options[optionIndex]).length > 0, "Empty option");
                stored.options.push(proposal.options[optionIndex]);
                stored.voteCounts.push(0);
            }

            proposalIdsByEvent[newEventId].push(proposalId);
        }

        if (msg.value > 0) {
            // Forward any creation fee immediately so the contract does not accumulate treasury funds.
            (bool ok, ) = payable(treasury).call{value: msg.value}("");
            require(ok, "Treasury transfer failed");
        }

        emit EventCreated(newEventId, msg.sender, mode);
        return newEventId;
    }

    function deleteEvent(uint256 eventId) external {
        EventData storage eventData = eventsById[eventId];
        require(eventData.id != 0, "Event not found");
        require(eventData.isActive, "Event already inactive");
        // Allow the creator to cancel the event until the first vote is cast.
        require(totalVotesByEvent[eventId] == 0, "Votes already recorded");
        require(msg.sender == eventData.creator || msg.sender == owner, "Not allowed");

        eventData.isActive = false;

        emit EventDeleted(eventId, msg.sender);
    }

    function authorizeVoter(uint256 eventId, address voter) external {
        EventData storage eventData = eventsById[eventId];
        require(eventData.id != 0, "Event not found");
        require(!eventData.isPublic, "Event is public");
        require(voter != address(0), "Invalid voter");
        require(msg.sender == eventData.creator || msg.sender == owner, "Not allowed");

        if (!allowedVotersByEvent[eventId][voter]) {
            allowedVotersByEvent[eventId][voter] = true;
            allowedVoterAddressesByEvent[eventId].push(voter);
            eventData.allowedVoterCount = allowedVoterAddressesByEvent[eventId].length;
        }

        emit VoterAuthorized(eventId, voter, msg.sender);
    }

    function castVote(uint256 eventId, uint256 proposalId, uint8 optionIndex) external {
        EventData storage eventData = eventsById[eventId];
        require(eventData.id != 0, "Event not found");
        require(eventData.isActive, "Event inactive");
        require(block.timestamp >= eventData.startTime, "Voting not started");
        require(block.timestamp <= eventData.endTime, "Voting ended");
        require(eventData.isPublic || allowedVotersByEvent[eventId][msg.sender], "Not allowed to vote");

        ProposalData storage proposal = proposalsByEvent[eventId][proposalId];
        require(proposal.exists, "Proposal not found");
        require(optionIndex < proposal.options.length, "Invalid option");
        // A value of zero means "not voted yet"; stored selections are offset by one.
        require(voteSelections[eventId][proposalId][msg.sender] == 0, "Already voted");

        proposal.voteCounts[optionIndex] += 1;
        totalVotesByEvent[eventId] += 1;
        voteSelections[eventId][proposalId][msg.sender] = optionIndex + 1;

        emit VoteCast(eventId, proposalId, msg.sender, optionIndex);
    }

    function getEvent(uint256 eventId) external view returns (EventData memory) {
        require(eventsById[eventId].id != 0, "Event not found");
        return eventsById[eventId];
    }

    function getEvents() external view returns (EventData[] memory) {
        EventData[] memory result = new EventData[](eventCount);

        for (uint256 index = 0; index < eventCount; index++) {
            result[index] = eventsById[index + 1];
        }

        return result;
    }

    function getEventProposals(uint256 eventId) external view returns (ProposalData[] memory) {
        uint256[] storage proposalIds = proposalIdsByEvent[eventId];
        ProposalData[] memory result = new ProposalData[](proposalIds.length);

        for (uint256 index = 0; index < proposalIds.length; index++) {
            result[index] = proposalsByEvent[eventId][proposalIds[index]];
        }

        return result;
    }

    function getVoteRecord(uint256 eventId, uint256 proposalId, address voter) external view returns (bool hasVoted, uint8 optionIndex) {
        uint256 selection = voteSelections[eventId][proposalId][voter];

        if (selection == 0) {
            return (false, 0);
        }

        return (true, uint8(selection - 1));
    }

    function canVoteInEvent(uint256 eventId, address voter) external view returns (bool) {
        EventData storage eventData = eventsById[eventId];
        require(eventData.id != 0, "Event not found");

        return eventData.isPublic || allowedVotersByEvent[eventId][voter];
    }

    function getAllowedVoters(uint256 eventId) external view returns (address[] memory) {
        return allowedVoterAddressesByEvent[eventId];
    }

    function getEventVoteCount(uint256 eventId) external view returns (uint256) {
        return totalVotesByEvent[eventId];
    }
}
