import { expect } from "chai";
import { Contracts, User } from "./evm";
import { ethers } from "hardhat";
import { TransactionResponse } from "ethers";
import { TransactionReceipt } from "ethers";
const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");

export let winningIndices: number[] = []; // global variable to store winning indices for review after tests

// console.log = function () {};

export enum GameState {
  DISABLED,
  OPEN,
  CALCULATING_WINNER, // last ticket sold awaiting vrf callback
  WINNER_SELECTED, // Winner has been selected - successful conclusion
  PRIZE_CLAIMED, // Prize has been claimed by the winner - successful conclusion
  ADMIN_CANCELLED,
  REFUNDS_ACTIVATED,
}

/**
 *
 * @param admin
 * @param contracts
 * @returns subscription Id but also in args is the subscription owner if required
 */
export const setupVrfSubscription = async (
  admin: User,
  contracts: Contracts
) => {
  const adminCaller = admin.SatoshieRaffle;

  const txn = await contracts.VRFCoordinatorV2_5Mock.createSubscription(); // who should call this?
  await txn.wait(1);
  const filter = contracts.VRFCoordinatorV2_5Mock.filters.SubscriptionCreated();
  const events = await contracts.VRFCoordinatorV2_5Mock.queryFilter(filter, -1);
  const args = events[0].args;

  await contracts.VRFCoordinatorV2_5Mock.fundSubscription(
    args.subId,
    ethers.parseEther("2")
  );
  await contracts.VRFCoordinatorV2_5Mock.addConsumer(
    args.subId,
    contracts.SatoshieRaffle.target
  );
  await adminCaller.setSubscriptionId(args.subId);

  const subIdRaffleContract = await adminCaller.getSubscriptionId();

  const getSub = await contracts.VRFCoordinatorV2_5Mock.getSubscription(
    subIdRaffleContract
  );

  expect(
    await contracts.VRFCoordinatorV2_5Mock.consumerIsAdded(
      subIdRaffleContract,
      contracts.SatoshieRaffle.target
    )
  ).to.equal(true);

  expect(await contracts.SatoshieRaffle.getCoordinatorAddress()).to.equal(
    contracts.VRFCoordinatorV2_5Mock.target
  );

  return args.subId; // args also returns the subscription owner
};

export const checkIfWinnerSelected = async (
  contracts: Contracts
): Promise<boolean> => {
  const filter = contracts.SatoshieRaffle.filters.WinnerSelected();
  const events = await contracts.SatoshieRaffle.queryFilter(
    filter,
    0,
    "latest"
  );

  return events.length > 0;
};

/**
 * Various checks to verify the winning logic when it is triggered
 * @param contracts
 * @param requestId
 * @param activeSubId
 */
export const winningLogic = async (
  contracts: Contracts,
  requestId: number,
  activeSubId: bigint
) => {
  const platformFee = await contracts.SatoshieRaffle.platformFee();
  const prizeAmount = await contracts.SatoshieRaffle.prizeAmount();
  const goal = platformFee + prizeAmount;
  if (
    (await ethers.provider.getBalance(contracts.SatoshieRaffle.target)) < goal
  ) {
    throw new Error("Raffle goal not reached, increase the ticket price");
  }

  expect(await contracts.SatoshieRaffle.gameState()).to.equal(
    GameState.CALCULATING_WINNER
  );

  const ticketsMinted = await contracts.SatoshieRaffle.getTicketsMinted();
  console.log("Tickets minted:", ticketsMinted.length);
  console.log("Tickets:", ticketsMinted);

  await expect(
    contracts.VRFCoordinatorV2_5Mock.fulfillRandomWords(
      requestId,
      contracts.SatoshieRaffle.target
    )
  )
    .to.emit(contracts.VRFCoordinatorV2_5Mock, "RandomWordsFulfilled")
    .withArgs(requestId, 1n, activeSubId, anyValue, false, true, false) //         requestId: number; outputSeed: number; subId: number; payment: number; nativePayment: boolean; success: boolean; onlyPremium: boolean;
    .and.to.emit(contracts.SatoshieRaffle, "WinnerSelected");

  // Verify the winning ticket was set
  const winningTicket = await contracts.SatoshieRaffle.winningTicketId();

  const ticketImg = await contracts.SatoshieTickets.tokenURI(winningTicket);
  console.log("Ticket image:", ticketImg);

  const index = ticketsMinted.indexOf(winningTicket);

  console.info("Winning ticket:", winningTicket);
  console.info("Index @ winning ticket:", index);
  console.info(
    "Winning ticket owner:",
    await contracts.SatoshieRaffle.winningTicketOwner()
  );
  winningIndices.push(index);
  expect(winningTicket).to.not.equal(0);

  expect(await contracts.SatoshieRaffle.gameState()).to.equal(
    GameState.WINNER_SELECTED
  );

  expect(await contracts.SatoshieRaffle.winningTicketOwner()).to.not.equal(
    ethers.ZeroAddress
  );

  const filter2 = contracts.SatoshieRaffle.filters.WinnerSelected();
  const events2 = await contracts.SatoshieRaffle.queryFilter(filter2, -1);
  const args2 = events2[0].args;
  console.log("WinnerSelected  => ", args2);
};

/**
 * Open the raffle and ensure that the game state is OPEN
 * @param admin
 * @param contracts
 */
export const openRaffle = async (admin: User, contracts: Contracts) => {
  await admin.SatoshieRaffle.setEnabled(true);
  expect(await contracts.SatoshieRaffle.gameState()).to.equal(GameState.OPEN);
};

/**
 * Helper to get the events from the transaction
 * @param txn
 */
export const getEvents = async (txn: TransactionResponse) => {
  const receipt: TransactionReceipt | null = await txn.wait();
  if (receipt) {
    // console.log("result transaction => ", receipt);
    receipt.logs.forEach((log) => {
      console.log("logs transaction => ", log);
    });
    console.log("logs transaction counter => ", receipt.logs.length);
    console.log("sended to => ", receipt.to);
  } else {
    throw new Error("cant get the transaction receipt");
  }
};
