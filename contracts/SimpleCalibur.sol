// // SPDX-License-Identifier: MIT
// pragma solidity ^0.8.24;

// import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
// import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Permit.sol";

// interface IVault {
//     function deposit(uint256 assets, address receiver) external returns (uint256 shares);
// }

// contract SimpleCalibur {
//     /// @notice Deposit vào Vault mà không cần approve trước, dùng EIP-2612 permit
//     function depositWithPermit(
//         address token,
//         address vault,
//         uint256 amount,
//         uint256 deadline,
//         uint8 v,
//         bytes32 r,
//         bytes32 s
//     ) external {
//         IERC20Permit(token).permit(
//             msg.sender,       // chủ sở hữu
//             address(this),    // spender (contract này)
//             amount,           // số tiền
//             deadline,         // hạn chót chữ ký
//             v, r, s           // chữ ký
//         );
//         IERC20(token).transferFrom(msg.sender, address(this), amount);

//         IERC20(token).approve(vault, amount);

//         IVault(vault).deposit(amount, msg.sender);
//     }
// }
