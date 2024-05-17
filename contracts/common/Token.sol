// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract Token is ERC20 {
  uint8 public _decimals;
  constructor(string memory _name, string memory _symbol, uint8 _dec) ERC20(_name, _symbol) {
    _decimals = _dec;
    _mint(msg.sender, 100000000 * (10 ** _decimals));
  }

  function decimals() public view override returns (uint8) {
    return _decimals;
  }

  event Test1();
  event Test2();

  function drip(address) public {
  }
}