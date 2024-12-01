import MerkleTree from "./merkle-tree";
import { ethers } from "ethers";

export default class ClaimsTree {
  private readonly tree: MerkleTree;
  constructor(allocations: { account: string; numberOfTickets: Number }[]) {
    this.tree = new MerkleTree(
      allocations.map(({ account, numberOfTickets }, index) => {
        return ClaimsTree.toNode(index, account, numberOfTickets);
      })
    );
  }

  public static verifyProof(
    index: number | BigInt,
    account: string,
    numberOfTickets: Number,
    proof: Buffer[],
    root: Buffer
  ): boolean {
    let pair = ClaimsTree.toNode(index, account, numberOfTickets);
    for (const item of proof) {
      pair = MerkleTree.combinedHash(pair, item);
    }

    return pair.equals(root);
  }

  // keccak256(abi.encode(index, account, amount))
  public static toNode(
    index: number | BigInt,
    account: string,
    numberOfTickets: Number
  ): Buffer {
    return Buffer.from(
      ethers
        .solidityPackedKeccak256(
          ["uint256", "address", "uint256"],
          [index, account, numberOfTickets]
        )
        .substr(2),
      "hex"
    );
  }

  public getHexRoot(): string {
    return this.tree.getHexRoot();
  }

  // returns the hex bytes32 values of the proof
  public getProof(
    index: number | BigInt,
    account: string,
    numberOfTickets: Number
  ): string[] {
    return this.tree.getHexProof(
      ClaimsTree.toNode(index, account, numberOfTickets)
    );
  }
}
