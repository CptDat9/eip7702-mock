// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;
interface IVault {
    function deposit(
        uint256 assets,
        address receiver
    ) external returns (uint256);
}
interface IERC20 {
    function transferFrom(
        address from,
        address to,
        uint256 amount
    ) external returns (bool);
    function approve(address spender, uint256 amount) external returns (bool);   
}
contract VaultHelper {
    function depositERC20(
        address token,
        address vault, 
        uint256 amount,
        address receiver
    ) external {
        require(IERC20(token).transferFrom(msg.sender, address(this), amount), "Transfer token failed");
        require(IERC20(token).approve(vault, amount), "Approve token failed");
        IVault(vault).deposit(amount, receiver);
    }
}