// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/utils/Base64.sol";
import "./interfaces/SatoshieTicketsInterface.sol";

contract SatoshieTickets is ERC721, Ownable, SatoshieTicketsInterface {
    address public raffleContract;

    using Strings for string;
    using Base64 for bytes;

    constructor(
        string memory name,
        string memory symbol
    ) ERC721(name, symbol) {}

    modifier onlyRaffleContract() {
        require(msg.sender == raffleContract, "ONLY_SATOSHIE_RAFFLE_CAN_CALL");
        _;
    }

    function setRaffleContract(address _raffleContract) external onlyOwner {
        raffleContract = _raffleContract;
    }

    function mint(address to, uint256 tokenId) external onlyRaffleContract {
        _mint(to, tokenId);
    }

    function ownerOf(
        uint256 tokenId
    ) public view override(ERC721, SatoshieTicketsInterface) returns (address) {
        return super.ownerOf(tokenId);
    }

    function tokenURI(
        uint256 tokenId
    )
        public
        view
        virtual
        override(ERC721, SatoshieTicketsInterface)
        returns (string memory)
    {
        if (!_exists(tokenId)) revert NonExistentToken(tokenId);
        address ownerAddress = ownerOf(tokenId);
        string memory svg = string(
            abi.encodePacked(
                "<svg fill='none' style='background-color: #000;' id='a' xmlns='http://www.w3.org/2000/svg' width='508.38' height='472.5' xmlns:xlink='http://www.w3.org/1999/xlink' viewBox='0 0 508.38 472.5'><text transform='translate(25 315)' style='fill: #fff; font-family: Cabin; font-size: 12px; font-variation-settings: \"opsz\" 14, \"wght\" 400; isolation: isolate;'>Raffle Ticket ID: ",
                Strings.toString(tokenId),
                "</text><text transform='translate(25 350)' style='fill: #fff; font-family: Cabin; font-size: 12px; font-variation-settings: \"opsz\" 14, \"wght\" 400; isolation: isolate;'>Owner:",
                Strings.toHexString(uint160(ownerAddress)),
                "</text><text transform='translate(25 385)' style='fill: #fff; font-family: Cabin; font-size: 12px; font-variation-settings: \"opsz\" 14, \"wght\" 400; isolation: isolate;'>Owns: ",
                Strings.toString(balanceOf(ownerAddress)),
                " other tickets</text><text transform='translate(25 410)' style='fill: #fff; font-family: IBMPlexSans, sans-serif; font-size: 10px; font-variation-settings: \"opsz\" 14, \"wght\" 400; isolation: isolate;'>Copyright 2024 Satosh.ie</text><text transform='translate(25 430)' style='fill: #fff; font-family: IBMPlexSans, sans-serif; font-size: 10px; font-variation-settings: \"opsz\" 14, \"wght\" 400; isolation: isolate;'>This ticket is a valid proof of ownership of the Satoshie Raffle and can be used to claim a prize.</text><text transform='translate(25 450)' style='fill: #fff; font-family: IBMPlexSans, sans-serif; font-size: 10px; font-variation-settings: \"opsz\" 14, \"wght\" 400; isolation: isolate;'>This ticket was purchased from the Satoshie Raffle on the platform https://satosh.ie </text><path d='M219.1,159.86c-7.21,0-13.09,5.79-13.09,13.09s5.88,13,13.09,13,13.09-5.8,13.09-13-5.8-13.09-13.09-13.09Z' style='fill: #08ff00; stroke-width: 0px;' /><path d='M355.45,114.19V12.94c0-11.5-13.91-17.27-22.04-9.13l-64.89,64.89c-2.64,2.64-6.22,4.12-9.95,4.12h-78.1c-3.69,0-6.69-2.99-6.69-6.69V12.94c0-11.5-13.91-17.27-22.04-9.13l-63.7,63.7c-3.4,3.4-5.3,8-5.3,12.81v33.88h-9.5c-2.86,0-5.18,2.32-5.18,5.18v87.6c0,2.86,2.32,5.18,5.18,5.18h9.5v10.32c0,17.15,13.9,31.06,31.06,31.06h210.6c17.15,0,31.06-13.9,31.06-31.06v-10.32h9.5c2.86,0,5.18-2.32,5.18-5.18v-87.6c0-2.86-2.32-5.18-5.18-5.18h-9.5ZM334.75,216.45c0,9.04-7.33,16.37-16.37,16.37H119.81c-9.04,0-16.37-7.33-16.37-16.37v-106.57c0-9.04,7.33-16.37,16.37-16.37h198.57c9.04,0,16.37,7.33,16.37,16.37v106.57Z' style='fill: #08ff00; stroke-width: 0px;'/><rect x='144.58' y='135.97' width='31.3' height='54.41' rx='5.18' ry='5.18' style='fill: #08ff00; stroke-width: 0px;' /><rect x='262.3' y='135.97' width='31.3' height='54.41' rx='5.18' ry='5.18' style='fill: #08ff00; stroke-width: 0px;' /></svg>"
            )
        );
        string memory image = Base64.encode(bytes(svg));
        string memory json = Base64.encode(
            bytes(
                string(
                    abi.encodePacked(
                        '{"name": "Raffle Ticket ID:',
                        Strings.toString(tokenId),
                        '", "description": "Satoshie Raffle Ticket", "image": "data:image/svg+xml;base64,',
                        image,
                        '", "attributes": [{"trait_type": "Owner", "value": "',
                        Strings.toHexString(uint160(ownerAddress)),
                        '"}, {"trait_type": "Legal", "value": "Copyright 2024 Satosh.ie https://satosh.ie"}]}'
                    )
                )
            )
        );
        return string(abi.encodePacked("data:application/json;base64,", json));
    }
}
