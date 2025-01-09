// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

import "./interfaces/SatoshieRaffleInterface.sol";
import "./interfaces/SatoshieTicketsInterface.sol";

import {IVRFCoordinatorV2Plus} from "@chainlink/contracts/src/v0.8/vrf/dev/interfaces/IVRFCoordinatorV2Plus.sol";
import {VRFV2PlusClient} from "@chainlink/contracts/src/v0.8/vrf/dev/libraries/VRFV2PlusClient.sol";
import {VRFConsumerBaseV2Plus} from "@chainlink/contracts/src/v0.8/vrf/dev/VRFConsumerBaseV2Plus.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract SatoshieRaffle is
    Initializable,
    AccessControlUpgradeable,
    SatoshieRaffleInterface,
    VRFConsumerBaseV2Plus,
    ReentrancyGuard
{
    using Strings for string;

    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN");

    mapping(address => uint256[]) public userTickets;
    uint256 public ticketPrice;
    uint256 public lastTicketId;
    uint256 public winningTicketId;
    uint256 public targetGoal;
    uint256[] public ticketsMinted;
    uint32 public endDate;
    uint256 public lastUpdated;

    uint256 private subscriptionId;
    bytes32 public keyHash;
    uint256 public randomResult;

    uint256 public platformFee;
    uint256 public prizeAmount;

    address public immutable satoshiesWallet; // Address to receive the platform fee

    bytes32 public refundsMerkleRoot;

    mapping(address => uint256) public refundClaimsPerAddress;

    address public winningTicketOwner;

    enum GameState {
        DISABLED,
        OPEN,
        CALCULATING_WINNER, // last ticket sold awaiting vrf callback
        WINNER_SELECTED, // Winner has been selected - successful conclusion
        PRIZE_CLAIMED, // Prize has been claimed by the winner - successful conclusion
        ADMIN_CANCELLED, // emergency state
        REFUNDS_ACTIVATED // refunds activated
    }

    GameState public gameState;

    SatoshieTicketsInterface public raffleTicket;

    modifier onlyAdmin() {
        if (!hasRole(ADMIN_ROLE, msg.sender)) revert AccessDenied();
        _;
    }

    modifier raffleIsEnabled() {
        if (gameState != GameState.OPEN) revert RaffleDisabled();
        if (block.timestamp > endDate) revert RaffleDisabled();
        _;
    }

    modifier blockPrizeReentrancy() {
        if (gameState == GameState.PRIZE_CLAIMED) revert PrizeAlreadyClaimed();
        _;
    }

    constructor(
        address admin,
        uint256 _ticketPrice,
        uint32 _endDate,
        address _raffleTicketAddress,
        address _vrfCoordinator,
        bytes32 _keyHash,
        uint256 _platformFee,
        uint256 _prizeAmount,
        address _satoshiesWallet
    ) VRFConsumerBaseV2Plus(_vrfCoordinator) {
        if (admin == address(0)) revert InvalidAddress(admin);
        _grantRole(ADMIN_ROLE, admin);
        _setRoleAdmin(ADMIN_ROLE, ADMIN_ROLE);

        ticketPrice = _ticketPrice;
        endDate = _endDate;
        raffleTicket = SatoshieTicketsInterface(_raffleTicketAddress);
        keyHash = _keyHash;
        targetGoal = _prizeAmount + _platformFee;
        platformFee = _platformFee;
        prizeAmount = _prizeAmount;
        satoshiesWallet = _satoshiesWallet;
        lastTicketId = 0;
        gameState = GameState.DISABLED;
        emit ContractInitialized();
    }

    function participate() public payable raffleIsEnabled {
        if (msg.value < ticketPrice) {
            revert LessThanMinimumTicketPrice();
        }
        uint16 numberOfTickets = uint16(msg.value / ticketPrice);
        if (numberOfTickets == 0) revert InvalidTicketAmount();
        if (winningTicketId != 0) {
            revert WinningTicketAlreadySet();
        }

        for (uint16 i = 0; i < numberOfTickets; i++) {
            uint256 tokenId = uint256(
                keccak256(
                    abi.encode(
                        lastTicketId + i,
                        block.timestamp,
                        block.number,
                        msg.sender,
                        numberOfTickets
                    )
                )
            ) % 2000000000;
            raffleTicket.mint(msg.sender, tokenId);
            userTickets[msg.sender].push(tokenId);
            ticketsMinted.push(tokenId);
            lastTicketId = tokenId;
        }

        emit TicketPurchased(
            msg.sender,
            numberOfTickets,
            userTickets[msg.sender]
        );

        if (address(this).balance >= targetGoal) {
            gameState = GameState.CALCULATING_WINNER;

            uint256 requestId = IVRFCoordinatorV2Plus(s_vrfCoordinator)
                .requestRandomWords(
                    VRFV2PlusClient.RandomWordsRequest({
                        keyHash: keyHash,
                        subId: subscriptionId,
                        requestConfirmations: 3,
                        callbackGasLimit: 300000,
                        numWords: 1,
                        extraArgs: VRFV2PlusClient._argsToBytes(
                            VRFV2PlusClient.ExtraArgsV1({nativePayment: false})
                        )
                    })
                );

            emit RandomnessRequested(requestId);
        }
    }

    function claimPrize() external blockPrizeReentrancy {
        if (winningTicketId == 0) revert NoWinningTicketYet();
        if (raffleTicket.ownerOf(winningTicketId) != msg.sender) {
            revert NotTicketOwner();
        }
        (bool success, ) = payable(msg.sender).call{value: prizeAmount}("");
        if (!success) revert PrizeTransferFailed();

        (bool transferFee, ) = payable(satoshiesWallet).call{
            value: address(this).balance
        }("");
        if (transferFee) emit PlatformFeeClaimed(platformFee);

        gameState = GameState.PRIZE_CLAIMED;

        emit PrizeClaimed(msg.sender, prizeAmount);
    }

    // /// @notice Chainlink VRF callback
    function fulfillRandomWords(
        uint256 _requestId,
        uint256[] calldata randomWords
    ) internal override {
        if (ticketsMinted.length == 0) revert NoTicketsMinted();

        uint256 entropy = uint256(
            keccak256(abi.encode(randomWords[0], blockhash(block.number - 1)))
        );
        uint256 randomIndex = entropy % ticketsMinted.length;
        winningTicketId = ticketsMinted[randomIndex];
        winningTicketOwner = raffleTicket.ownerOf(winningTicketId);
        gameState = GameState.WINNER_SELECTED;
        emit WinnerSelected(winningTicketId);
    }

    /// @notice Withdraws the sale proceeds
    function withdrawProceeds() public onlyAdmin {
        uint256 amount = address(this).balance;
        (bool sent, ) = payable(msg.sender).call{value: amount}("");
        if (!sent) revert WithdrawalFailed();
        gameState = GameState.ADMIN_CANCELLED;
        emit ProceedsWithdrawn(msg.sender, amount);
    }

    function setEnabled(bool _active) public onlyAdmin {
        gameState = _active ? GameState.OPEN : GameState.DISABLED;
        emit RaffleEnabled(_active);
    }

    function getTicketsMinted() external view returns (uint256[] memory) {
        return ticketsMinted;
    }

    function getCoordinatorAddress() external view returns (address) {
        return address(s_vrfCoordinator);
    }

    function setSubscriptionId(uint256 _subscriptionId) public onlyAdmin {
        subscriptionId = _subscriptionId;
    }

    function getSubscriptionId() public view returns (uint256) {
        return subscriptionId;
    }

    function setRefundsMerkleRoot(bytes32 _merkleRoot) public onlyAdmin {
        if (gameState != GameState.OPEN) revert RefundsNotActive();
        refundsMerkleRoot = _merkleRoot;
        gameState = GameState.REFUNDS_ACTIVATED;
        emit RefundsActivated();
    }

    function claimRefund(
        bytes calldata data,
        bytes32[] calldata merkleProof
    ) public nonReentrant {
        if (gameState != GameState.REFUNDS_ACTIVATED) revert RefundsNotActive();

        (uint256 index, uint256 numberOfTickets) = abi.decode(
            data,
            (uint256, uint256)
        );

        if (refundClaimsPerAddress[msg.sender] > 0)
            revert RefundAlreadyClaimed();

        bytes32 node = keccak256(
            abi.encodePacked(index, msg.sender, numberOfTickets)
        );
        if (!MerkleProof.verify(merkleProof, refundsMerkleRoot, node))
            revert InvalidProof();

        refundClaimsPerAddress[msg.sender] += numberOfTickets;

        uint256 refundAmount = numberOfTickets * ticketPrice;
        if (address(this).balance < refundAmount)
            revert InsufficientContractBalance();

        (bool success, ) = payable(msg.sender).call{value: refundAmount}("");
        if (!success) revert RefundTransferFailed();

        emit RefundClaimed(msg.sender, numberOfTickets);
    }

    function updateEndDate(uint32 _endDate) public onlyAdmin {
        endDate = _endDate;
    }

    function getWinningTicketOwner() external view returns (address) {
        if (winningTicketId == 0) revert NoWinningTicketYet();
        return winningTicketOwner;
    }
}
