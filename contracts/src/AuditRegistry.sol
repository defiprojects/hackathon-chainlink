// SPDX-License-Identifier: MIT
pragma solidity >=0.8.25;

import { Address } from "@oz/utils/Address.sol";
import { Strings } from "@oz/utils/Strings.sol";
import { ERC721 } from "@oz/token/ERC721/ERC721.sol";
import { ERC721URIStorage } from "@oz/token/ERC721/extensions/ERC721URIStorage.sol";
import { ERC721Enumerable } from "@oz/token/ERC721/extensions/ERC721Enumerable.sol";
import { FunctionsClient } from "@chainlink/functions/v1_0_0/FunctionsClient.sol";
import { FunctionsRequest } from "@chainlink/functions/v1_0_0/libraries/FunctionsRequest.sol";

import "src/Constants.sol";
import { WrappedNative } from "src/WrappedNative.sol";

contract AuditRegistry is ERC721URIStorage, ERC721Enumerable, FunctionsClient {
    using FunctionsRequest for FunctionsRequest.Request;
    using Strings for uint256;
    using Address for address payable;

    error NotOwner();
    error PriceFetchFailed();
    error InsufficientFee();
    error InvalidArgsLength();
    error InvalidRequestId();

    event AuditRequestError(bytes32 requestId, string error);
    event AuditRequestSuccess(bytes32 requestId, bytes response);
    event RewardDeposited(uint256 tokenId, uint256 amount);

    struct RequestData {
        address owner;
        uint256 tokenId;
        uint256 auditRequestId;
    }

    // 1.337 USD per generation
    uint256 public constant generationFeeInUSD = 1.337e8;
    address public immutable auditorsVault;
    WrappedNative public immutable wrappedNative;
    mapping(bytes32 functionsRequest => RequestData data) public requests;
    mapping(uint256 tokenId => uint256 auditRequest) public auditRequests;

    constructor(
        address vault,
        WrappedNative wNative
    )
        ERC721("DeFi Builder AI", "BUILD")
        FunctionsClient(FUNCTIONS_ROUTER)
    {
        auditorsVault = vault;
        wrappedNative = wNative;
    }

    function depositReward(uint256 tokenId) external payable {
        if (msg.value == 0) revert InsufficientFee();
        if (msg.sender != _ownerOf(tokenId)) revert NotOwner();

        emit RewardDeposited(tokenId, msg.value);

        // NOTE: The reward should be distributed more securely to the auditors.
        // But for the sake of simplicity, we just send it directly to the vault.
        _sendFeeToVault(msg.value);
    }

    function requestAudit(uint256 auditRequestId)
        external
        payable
        returns (bytes32 functionsRequestId, uint256 tokenId)
    {
        uint256 price = calculateAuditPriceInNative();
        if (msg.value < price) revert InsufficientFee();

        tokenId = totalSupply() + 1;
        functionsRequestId = _sendAuditRequest(auditRequestId);
        requests[functionsRequestId] = RequestData(msg.sender, tokenId, auditRequestId);
        auditRequests[tokenId] = auditRequestId;

        _refundUser(price);
        _sendFeeToVault(price);
    }

    function fulfillRequest(bytes32 functionsRequestId, bytes memory response, bytes memory err) internal override {
        if (err.length > 0) {
            emit AuditRequestError(functionsRequestId, string(err));
            return;
        }
        RequestData storage data = requests[functionsRequestId];
        if (data.tokenId == 0) revert InvalidRequestId();

        emit AuditRequestSuccess(functionsRequestId, response);

        _setTokenURI(data.tokenId, string.concat(AUDIT_BASE_URI, data.auditRequestId.toString()));
        _safeMint(data.owner, data.tokenId);
    }

    function calculateAuditPriceInNative() public view returns (uint256) {
        (, int256 answer,, uint256 updatedAt,) = AVAX_USD_PRICE_FEED.latestRoundData();
        if (answer <= 0 || updatedAt + PRICE_FEED_HEARTBEAT < block.timestamp) revert PriceFetchFailed();
        return generationFeeInUSD * uint256(answer) * UNIT_DIFFERENCE / NATIVE_TOKEN_UNIT;
    }

    function _sendAuditRequest(uint256 auditRequestId) internal returns (bytes32 requestId) {
        FunctionsRequest.Request memory req;
        req.initializeRequestForInlineJavaScript(AUDIT_REQUEST_SOURCE_CODE);
        string[] memory args = new string[](1);
        args[0] = auditRequestId.toString();
        req.setArgs(args);
        requestId = _sendRequest(req.encodeCBOR(), SUBSCRIPTION_ID, GAS_LIMIT, DON_ID);
    }

    function _sendFeeToVault(uint256 price) internal {
        wrappedNative.deposit{ value: price }();
        wrappedNative.transfer(auditorsVault, price);
    }

    function _refundUser(uint256 neededAmount) internal {
        if (msg.value > neededAmount) {
            unchecked {
                payable(msg.sender).sendValue(msg.value - neededAmount);
            }
        }
    }

    /**
     * ---------------------------- Overrides required by solidity ----------------------------
     */
    function tokenURI(uint256 tokenId) public view override(ERC721, ERC721URIStorage) returns (string memory) {
        return super.tokenURI(tokenId);
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721URIStorage, ERC721Enumerable)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }

    function _update(
        address to,
        uint256 tokenId,
        address auth
    )
        internal
        override(ERC721, ERC721Enumerable)
        returns (address)
    {
        return super._update(to, tokenId, auth);
    }

    function _increaseBalance(address account, uint128 amount) internal override(ERC721, ERC721Enumerable) {
        super._increaseBalance(account, amount);
    }
}
