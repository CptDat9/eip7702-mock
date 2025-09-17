// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;
contract MulticallHelper {
    uint256 public nonce;
    
    struct Call {
        address to;
        uint256 value;
        bytes data;
    }
    
    event BatchExecuted(uint256 indexed nonce, Call[] calls);
    event CallExecuted(
        address indexed caller,
        address indexed to,
        uint256 value,
        bytes data
    );

    function execute(Call[] calldata calls) external payable {
        // require(msg.sender == address(this), "Invalid authority");
        _executeBatch(calls);
    }

    function _executeBatch(Call[] calldata calls) internal {
        uint256 currentNonce = nonce;
        nonce++;

        for (uint256 i = 0; i < calls.length; i++) {
            _executeCall(calls[i]);
        }

        emit BatchExecuted(currentNonce, calls);
    }

    function _executeCall(Call calldata callItem) internal {
        (bool success, bytes memory returnData) = callItem.to.call{value: callItem.value}(
            callItem.data
        );
        require(success, _getRevertMsg(returnData));
        emit CallExecuted(
            msg.sender,
            callItem.to,
            callItem.value,
            callItem.data
        );
    }
    function _getRevertMsg(bytes memory returnData) internal pure returns (string memory ){
        if(returnData.length < 68) return "Call data reverted";
        assembly {
            returnData := add(returnData, 0x04)
        }
        return abi.decode(returnData, (string));
    }
    receive() external payable {}
}
