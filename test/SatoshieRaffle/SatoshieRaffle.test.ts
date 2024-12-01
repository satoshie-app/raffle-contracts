import { expect } from "chai";
import { ethers } from "hardhat";
import { User } from "../_helpers/evm";
import { Contracts, RaffleData, setupIntegration } from "../_helpers/evm/index";
import {
  GameState,
  openRaffle,
  setupVrfSubscription,
  winningIndices,
  winningLogic,
} from "../_helpers/raffle";
const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");

describe("SatoshieRaffle", () => {
  let contracts: Contracts;
  let admin: User;
  let users: User[];
  let raffleData: RaffleData;

  const VRF_REQUEST_ID = 1; // Example request ID for VRF
  let TICKET_PRICE_SINGLE: bigint;

  beforeEach(async () => {
    ({ contracts, admin, users, raffleData } = await setupIntegration());
  });

  after(() => {
    console.log(`Winning indices of all tests: ${winningIndices}`);
  });

  describe("Contract Functionality", async function () {
    //
    it("VRF should be setup correctly. Consumer, funding, subscriptionId etc", async () => {
      await setupVrfSubscription(admin, contracts);
    });

    it("Raffle should initialize with correct values", async () => {
      TICKET_PRICE_SINGLE = await contracts.SatoshieRaffle.ticketPrice();
      const adminCaller = admin.SatoshieRaffle;
      const raffle = contracts.SatoshieRaffle;

      expect(await contracts.SatoshieRaffle.gameState()).to.equal(
        GameState.DISABLED
      );

      const activeSubId = await setupVrfSubscription(admin, contracts);
      await adminCaller.setSubscriptionId(activeSubId);
      const subIdOnRaffle = await adminCaller.getSubscriptionId();
      expect(activeSubId).to.equal(subIdOnRaffle);
      expect(await raffle.ticketPrice()).to.equal(raffleData.ticketPrice);
      expect(await raffle.targetGoal()).to.equal(
        raffleData.platformFee + raffleData.prizeAmount
      );
      expect(await raffle.platformFee()).to.equal(raffleData.platformFee);
      expect(await raffle.prizeAmount()).to.equal(raffleData.prizeAmount);
      expect(await raffle.endDate()).to.equal(raffleData.endDate);
      expect(await raffle.hasRole(await raffle.ADMIN_ROLE(), admin.address)).to
        .be.true;
    });

    it("If enddate is in the past, raffle should be disabled", async () => {
      await openRaffle(admin, contracts);
      await setupVrfSubscription(admin, contracts);
      const updateTime = await admin.SatoshieRaffle.updateEndDate(
        parseInt((new Date().getTime() / 1000).toFixed(0))
      );
      await updateTime.wait(1);
      await expect(
        users[88].SatoshieRaffle.participate({ value: TICKET_PRICE_SINGLE })
      ).to.revertedWithCustomError(contracts.SatoshieRaffle, "RaffleDisabled");
    });

    it("Should allow a user to buy the first tickets", async () => {
      await openRaffle(admin, contracts);
      await setupVrfSubscription(admin, contracts);
      const ticketAmount = 30;
      const ticketPriceX3 = TICKET_PRICE_SINGLE * BigInt(ticketAmount); // Buying 30 tickets
      await expect(
        users[28].SatoshieRaffle.participate({ value: ticketPriceX3 })
      )
        .to.emit(contracts.SatoshieRaffle, "TicketPurchased")
        .withArgs(users[28].address, ticketAmount, anyValue);
    });

    it("Should reject participation if less than minimum ticket price", async () => {
      await openRaffle(admin, contracts);
      await setupVrfSubscription(admin, contracts);
      const shortChangePrice = ethers.parseUnits("0.001", 18);
      await expect(
        users[28].SatoshieRaffle.participate({ value: shortChangePrice })
      ).to.be.revertedWithCustomError(
        contracts.SatoshieRaffle,
        "LessThanMinimumTicketPrice"
      );
    });

    it("Should reject participation if raffle is disabled", async () => {
      await expect(
        users[12].SatoshieRaffle.participate({ value: TICKET_PRICE_SINGLE })
      ).to.be.revertedWithCustomError(
        contracts.SatoshieRaffle,
        "RaffleDisabled"
      );
    });

    it("Should only allow admin to withdraw proceeds", async () => {
      await openRaffle(admin, contracts);
      const ticketPriceX3 = TICKET_PRICE_SINGLE * 3n;
      await users[17].SatoshieRaffle.participate({ value: ticketPriceX3 });
      await expect(
        users[17].SatoshieRaffle.withdrawProceeds()
      ).to.be.revertedWithCustomError(contracts.SatoshieRaffle, "AccessDenied");
      const balanceBefore = await ethers.provider.getBalance(admin.address);
      await expect(admin.SatoshieRaffle.withdrawProceeds())
        .to.emit(contracts.SatoshieRaffle, "ProceedsWithdrawn")
        .withArgs(admin.address, ticketPriceX3);
      const balanceAfter = await ethers.provider.getBalance(admin.address);
      expect(balanceAfter).to.be.gt(balanceBefore);
    });

    // *********** test this  ***********
    it("All tickets purchased, triggering VRF and it should select a winner when randomness is fulfilled", async () => {
      await openRaffle(admin, contracts);
      const ticketPriceX120 = TICKET_PRICE_SINGLE * 120n;
      const activeSubId = await setupVrfSubscription(admin, contracts);
      const tx = await users[4].SatoshieRaffle.participate({
        value: ticketPriceX120,
      });
      await tx.wait(1);

      await winningLogic(contracts, VRF_REQUEST_ID, activeSubId);
    });

    it("All tickets purchased, raffle is closed, no more tickets can be purchased", async () => {
      await openRaffle(admin, contracts);
      const activeSubId = await setupVrfSubscription(admin, contracts);

      const ticketPriceX90 = TICKET_PRICE_SINGLE * 90n;

      await expect(
        users[42].SatoshieRaffle.participate({
          value: ticketPriceX90,
        })
      )
        .to.emit(contracts.SatoshieRaffle, "TicketPurchased")
        .withArgs(users[42].address, anyValue, anyValue);

      await expect(
        users[13].SatoshieRaffle.participate({
          value: TICKET_PRICE_SINGLE,
        })
      )
        .to.emit(contracts.SatoshieRaffle, "TicketPurchased")
        .withArgs(users[13].address, anyValue, anyValue);

      await expect(
        users[16].SatoshieRaffle.participate({
          value: TICKET_PRICE_SINGLE * 30n,
        })
      )
        .to.emit(contracts.SatoshieRaffle, "TicketPurchased")
        .withArgs(users[16].address, anyValue, anyValue);

      await winningLogic(contracts, VRF_REQUEST_ID, activeSubId);

      await expect(
        users[20].SatoshieRaffle.participate({
          value: TICKET_PRICE_SINGLE,
        })
      ).to.be.revertedWithCustomError(
        contracts.SatoshieRaffle,
        "RaffleDisabled()"
      );
      await expect(
        users[83].SatoshieRaffle.participate({
          value: TICKET_PRICE_SINGLE,
        })
      ).to.be.revertedWithCustomError(
        contracts.SatoshieRaffle,
        "RaffleDisabled()"
      );
    });

    it("1 user can buy 4x the goal and trigger VRF", async () => {
      await openRaffle(admin, contracts);
      const activeSubId = await setupVrfSubscription(admin, contracts);

      await expect(
        users[282].SatoshieRaffle.participate({
          value: (await contracts.SatoshieRaffle.targetGoal()) * 2n,
        })
      )
        .to.emit(contracts.SatoshieRaffle, "TicketPurchased")
        .withArgs(users[282].address, anyValue, anyValue);

      await winningLogic(contracts, VRF_REQUEST_ID, activeSubId);

      await expect(
        users[27].SatoshieRaffle.participate({
          value: TICKET_PRICE_SINGLE * 200n,
        })
      ).to.be.revertedWithCustomError(
        contracts.SatoshieRaffle,
        "RaffleDisabled()"
      );

      expect(await contracts.SatoshieRaffle.gameState()).to.equal(
        GameState.WINNER_SELECTED
      );
    });
  });
});
