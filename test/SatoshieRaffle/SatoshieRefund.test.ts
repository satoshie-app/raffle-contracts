import { expect } from "chai";
import { ethers } from "hardhat";
import ClaimsTree from "../../scripts/claims-tree";
import { User } from "../_helpers/evm";
import { Contracts, RaffleData, setupIntegration } from "../_helpers/evm/index";
import {
  GameState,
  openRaffle,
  setupVrfSubscription,
  winningIndices,
} from "../_helpers/raffle";

describe("SatoshieRefund", () => {
  let contracts: Contracts;
  let admin: User;
  let users: User[];
  let raffleData: RaffleData;

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

    it("Merkle root should be set correctly", async () => {
      console.log("running refund test");
      await openRaffle(admin, contracts);
      let tree = new ClaimsTree([
        { account: users[10].address, numberOfTickets: 2 },
        { account: users[9].address, numberOfTickets: 10 },
      ]);
      console.log("tree.getHexRoot()", tree.getHexRoot());
      await expect(
        admin.SatoshieRaffle.setRefundsMerkleRoot(tree.getHexRoot())
      ).to.emit(contracts.SatoshieRaffle, "RefundsActivated");

      expect(await contracts.SatoshieRaffle.gameState()).to.equal(
        GameState.REFUNDS_ACTIVATED
      );

      expect(await admin.SatoshieRaffle.refundsMerkleRoot()).to.equal(
        tree.getHexRoot()
      );
    });

    it("Users should be able to claim refunds and refunds should fail when necessary", async () => {
      console.log("running refund test");
      await openRaffle(admin, contracts);
      const TICKET_PRICE_SINGLE = await contracts.SatoshieRaffle.ticketPrice();
      await admin.SatoshieRaffle.participate({
        // one big participation to fund the contract
        value: BigInt(TICKET_PRICE_SINGLE) * BigInt(100),
      });

      const bob = users[25];
      const alice = users[5];

      let tree = new ClaimsTree([
        { account: bob.address, numberOfTickets: 2 },
        { account: alice.address, numberOfTickets: 10 },
      ]);
      await expect(
        admin.SatoshieRaffle.setRefundsMerkleRoot(tree.getHexRoot())
      ).to.emit(contracts.SatoshieRaffle, "RefundsActivated");

      expect(await contracts.SatoshieRaffle.gameState()).to.equal(
        GameState.REFUNDS_ACTIVATED
      );

      expect(await admin.SatoshieRaffle.refundsMerkleRoot()).to.equal(
        tree.getHexRoot()
      );

      const bobsProof = tree.getProof(0, bob.address, 2);
      const bobsData = ethers.AbiCoder.defaultAbiCoder().encode(
        ["uint256", "uint256"],
        [0, 2]
      );
      const bobsBalanceBefore = await ethers.provider.getBalance(bob.address);
      const alicesBalanceBefore = await ethers.provider.getBalance(
        alice.address
      );

      const alicesProof = tree.getProof(1, alice.address, 10);
      const alicesData = ethers.AbiCoder.defaultAbiCoder().encode(
        ["uint256", "uint256"],
        [1, 10]
      );
      // falice tries to claim more than she bought
      const alicesFakeData = ethers.AbiCoder.defaultAbiCoder().encode(
        ["uint256", "uint256"],
        [1, 20]
      );

      //   random user tries to claim someone elses refund
      await expect(
        bob.SatoshieRaffle.claimRefund(users[66].address, bobsProof)
      ).to.be.revertedWithoutReason();
      // bob claims his refund
      await expect(bob.SatoshieRaffle.claimRefund(bobsData, bobsProof))
        .to.emit(contracts.SatoshieRaffle, "RefundClaimed")
        .withArgs(bob.address, 2);
      // bob tries to claim his refund again
      await expect(
        bob.SatoshieRaffle.claimRefund(bobsData, bobsProof)
      ).to.be.revertedWithCustomError(
        contracts.SatoshieRaffle,
        "RefundAlreadyClaimed"
      );

      // alice tries to claim more than she bought
      await expect(
        alice.SatoshieRaffle.claimRefund(alicesFakeData, alicesProof)
      ).to.be.revertedWithCustomError(contracts.SatoshieRaffle, "InvalidProof");
      // alice claims her refund
      await expect(alice.SatoshieRaffle.claimRefund(alicesData, alicesProof))
        .to.emit(contracts.SatoshieRaffle, "RefundClaimed")
        .withArgs(alice.address, 10);

      // alice tries to claim her refund again
      await expect(
        alice.SatoshieRaffle.claimRefund(alicesData, alicesProof)
      ).to.be.revertedWithCustomError(
        contracts.SatoshieRaffle,
        "RefundAlreadyClaimed"
      );

      // everyones balance should be higher than before sans-le gas fees;
      expect(await ethers.provider.getBalance(bob.address)).to.be.gt(
        bobsBalanceBefore
      );
      expect(await ethers.provider.getBalance(alice.address)).to.be.gt(
        alicesBalanceBefore
      );

      // after a grace period, admin should be able to withdraw proceeds
      await admin.SatoshieRaffle.withdrawProceeds();
      // contract should be empty
      expect(await ethers.provider.getBalance(contracts.SatoshieRaffle.target))
        .to.equal(0)
        .to.emit(contracts.SatoshieRaffle, "ProceedsWithdrawn");
      // raffle should be cancelled
      expect(await contracts.SatoshieRaffle.gameState()).to.equal(
        GameState.ADMIN_CANCELLED
      );
    });
  });
});
