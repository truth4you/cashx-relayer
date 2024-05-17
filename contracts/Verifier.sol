// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "hardhat/console.sol";

library Hash {
    function _hash(bytes memory _sig, string memory _salt) private pure returns (bytes32) {
        bytes32 r;
		bytes32 s;
		uint8 v;
		assembly {
			r := mload(add(_sig, 32))
			s := mload(add(_sig, 64))
			v := byte(0, mload(add(_sig, 96)))
		}
		bytes32 payloadHash = keccak256(abi.encode(msg.sig, "anon-mixer"));
		bytes32 messageHash = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", payloadHash));
		return keccak256(abi.encode(ecrecover(messageHash, v, r, s), _salt));
    }

    function deposited(bytes memory _sig) internal pure returns (bytes32) {
        return _hash(_sig, "deposited");
    }

    function withdrawn(bytes memory _sig) internal pure returns (bytes32) {
        return _hash(_sig, "withdrawn");
    }
}

contract Verifier {
    using Hash for bytes;

    fallback(bytes calldata _data) external returns (bytes memory) {
		(bytes memory _sig) = abi.decode(_data[4:], (bytes));
        return abi.encode(_sig.deposited(), _sig.withdrawn());
    }
}
