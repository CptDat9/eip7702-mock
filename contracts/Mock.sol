// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;
contract MockTest {
    uint256 public value; //default: 0
    function setValue(uint256 _value) external {
        value = _value;
    }
    function getValue() external view returns (uint256) {
        return value;
    }
}