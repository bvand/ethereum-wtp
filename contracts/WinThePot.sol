pragma solidity ^0.4.17;

contract WinThePot {
  address public owner;

  function WinThePot() public {
    owner = msg.sender;
  }
}
