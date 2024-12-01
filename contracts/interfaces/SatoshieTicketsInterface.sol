// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

interface SatoshieTicketsInterface {
    error NonExistentToken(uint256 tokenId);

    function raffleContract() external view returns (address);

    function setRaffleContract(address _raffleContract) external;

    function mint(address to, uint256 tokenId) external;

    function ownerOf(uint256 tokenId) external view returns (address);

    function tokenURI(uint256 tokenId) external view returns (string memory);
}
