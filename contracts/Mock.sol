// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;
contract MockTest {
    
    uint256 public value; //default: 0
    struct Call {
        address to;
        uint256 value;
        bytes data;
    }

    function setValue(uint256 _value) external {
        value = _value;
    }
    function getValue() external view returns (uint256) {
        return value;
    }
    function increaseValue(uint256 _value) external returns (uint256) {
        value += _value;
        return value;
    }
    function excuteCall(Call[] calldata calls) external {
        for(uint256 i = 0; i < calls.length; i++){
            (bool success, ) = calls[i].to.call{value: calls[i].value}(calls[i].data);
            require(success, "Multicall failed");
        }
    }
}