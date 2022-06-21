// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./MerkleTreeWithHistory.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IVerifier {
  function verifyProof(bytes memory _proof, uint256[6] memory _input) external returns (bool);
}

contract CashX is MerkleTreeWithHistory {
  IVerifier public immutable verifier;
  uint256 public denomination;

  mapping(bytes32 => bool) public nullifierHashes;
  // we store all commitments just to prevent accidental deposits with the same commitment
  mapping(bytes32 => bool) public deposited;
  bytes32[] private commitments;
  address public token;
  bool private _entered;

  mapping(uint32 => uint32) public deposits;
  mapping(uint32 => uint32) public withdraws;
  uint32 public constant TIME_HISTORY_SIZE = 10;

  event Deposit(bytes32 indexed commitment, uint32 indexed leafIndex, uint256 timestamp);
  event Withdrawal(address to, bytes32 nullifierHash, address indexed relayer, uint256 fee);

  modifier nonReentrant() {
    require(!_entered, "ReentrancyGuard: reentrant call");
    _entered = true;
    _;
    _entered = false;
  }

  constructor(
    IVerifier _verifier,
    IHasher _hasher,
    uint256 _denomination,
    uint32 _merkleTreeHeight,
    address _token
  ) MerkleTreeWithHistory(_merkleTreeHeight, _hasher) {
    require(_denomination > 0, "denomination should be greater than 0");
    verifier = _verifier;
    denomination = _denomination;
    token = _token;
  }

  function leaves() public view returns(bytes32[] memory) {
    return commitments;
  } 

  function deposit(bytes32 _commitment) external payable nonReentrant {
    require(!deposited[_commitment], "The commitment has been submitted");

    uint32 insertedIndex = _insert(_commitment);
    deposited[_commitment] = true;
    commitments.push(_commitment);
    _processDeposit();

    emit Deposit(_commitment, insertedIndex, block.timestamp);
  }

  function _processDeposit() internal {
    if(token==address(0))
      require(msg.value == denomination, "Please send `mixDenomination` ETH along with transaction");
    else {
      require(msg.value == 0, "ETH value is supposed to be 0 for ERC20 instance");
      IERC20(token).transferFrom(msg.sender, address(this), denomination);
    }
    deposits[0] = deposits[0]<TIME_HISTORY_SIZE ? deposits[0]+1 : 1;
    deposits[deposits[0]] = uint32(block.timestamp);
  }

  function toUint256(address a) public pure returns (uint256 b) {
    assembly {
      // let m := mload(0x40)
      a := and(a, 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF)
      // mstore(add(m, 20), xor(0x140000000000000000000000000000000000000000, a))
      // mstore(0x40, add(m, 52))
      b := a
   }
  }

  function withdraw(
    bytes calldata _proof,
    bytes32 _root,
    bytes32 _nullifierHash,
    address payable _recipient,
    address payable _relayer,
    uint256 _fee,
    uint256 _refund
  ) external payable nonReentrant {
    require(_fee <= denomination, "Fee exceeds transfer value");
    require(!nullifierHashes[_nullifierHash], "The note has been already spent");
    require(isKnownRoot(_root), "Cannot find your merkle root"); // Make sure to use a recent one
    require(
      verifier.verifyProof(
        _proof,
        [uint256(_root), uint256(_nullifierHash), toUint256(_recipient), toUint256(_relayer), _fee, _refund]
      ),
      "Invalid withdraw proof"
    );

    nullifierHashes[_nullifierHash] = true;
    _processWithdraw(_recipient, _relayer, _fee, _refund);
    emit Withdrawal(_recipient, _nullifierHash, _relayer, _fee);
  }

  function _processWithdraw(
    address payable _recipient,
    address payable _relayer,
    uint256 _fee,
    uint256 _refund
  ) internal {
    if(token==address(0)) {
      require(msg.value == 0, "Message value is supposed to be zero for ETH instance");
      require(_refund == 0, "Refund value is supposed to be zero for ETH instance");
      (bool success, ) = _recipient.call{ value: denomination - _fee }("");
      require(success, "payment to _recipient did not go thru");
      if (_fee > 0) {
        (success, ) = _relayer.call{ value: _fee }("");
        require(success, "payment to _relayer did not go thru");
      }
    } else {
      require(msg.value == _refund, "Incorrect refund amount received by the contract");
      IERC20(token).transfer(_recipient, denomination - _fee);
      if (_fee > 0) IERC20(token).transfer(_relayer, _fee);
      if (_refund > 0) {
        (bool success, ) = _recipient.call{ value: _refund }("");
        if (!success)
          _relayer.transfer(_refund);
      }
    }
    withdraws[0] = withdraws[0]<TIME_HISTORY_SIZE ? withdraws[0]+1 : 1;
    withdraws[withdraws[0]] = uint32(block.timestamp);
  }

  function isSpent(bytes32 _nullifierHash) public view returns (bool) {
    return nullifierHashes[_nullifierHash];
  }

  function isSpentArray(bytes32[] calldata _nullifierHashes) external view returns (bool[] memory spent) {
    spent = new bool[](_nullifierHashes.length);
    for (uint256 i = 0; i < _nullifierHashes.length; i++) {
      if (isSpent(_nullifierHashes[i])) {
        spent[i] = true;
      }
    }
  }
}
