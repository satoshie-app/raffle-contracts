// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

interface SatoshieRaffleInterface {
    event ProceedsWithdrawn(address indexed receiver, uint256 amount);
    event ContractInitialized();

    event TicketPurchased(
        address indexed buyer,
        uint16 numberOfTickets,
        uint256[] userTicketIds
    );

    event TotalFundraiseGoalReached(uint256 currentContractBalance);
    event RaffleEnabled(bool enabled);
    event RandomnessRequested(uint256 requestId);
    event WinnerSelected(uint256 winningTicketId);
    event DebugRandomResult(uint256 randomResult, uint256 ticketsMintedLength);

    // Event to log the prize claim
    event PrizeClaimed(address indexed winner, uint256 amount);
    event PlatformFeeClaimed(uint256 amount);

    // Event to log the refund claim

    event RefundsActivated();
    event RefundClaimed(address indexed claimant, uint256 numberOfTickets);
    error InvalidProof();
    error RefundsNotActive();
    error RefundAlreadyClaimed();
    error WithdrawalFailed();
    error RefundTransferFailed();
    error InsufficientContractBalance();

    error InvalidAddress(address account);
    error AccessDenied();
    error InvalidTicketAmount();

    error ExceedsTicketsAvailable();
    error WinningTicketAlreadySet();
    error NoTicketsMinted();
    error RaffleDisabled();
    error LessThanMinimumTicketPrice();

    // Revert errors for prize claim
    error PrizeAlreadyClaimed();
    error NoWinningTicketYet();
    error NotTicketOwner();
    error PrizeTransferFailed();
}
