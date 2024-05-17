// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./Uniswap/IUniswapV2Router02.sol";

contract Distributor {
    uint8 constant TARGET_COMMUNITY = 1;
    uint8 constant TARGET_DEV = 2;

    uint32 public ratioCommunity = 6000;
    uint32 public ratioDev = 2000;
    uint32 public ratioRevenue = 2000;

    uint256 public balanceCommunity;
    uint256 public balanceDev;
    uint256 public balanceRevenue;

    address public owner;
    address public signer;
    IUniswapV2Router02 router;
    address public token;

    mapping(address => uint256) public lastClaimed;
    mapping(address => uint256) public userClaimed;
    uint256 public totalClaimed;
    uint256 public totalRewarded;

    receive() external payable {
        balanceCommunity += msg.value * ratioCommunity / 10_000;
        balanceRevenue += msg.value * ratioRevenue / 10_000;
        uint256 _rewarded = msg.value - (msg.value * (10_000 - ratioDev) / 10_000);
        balanceDev += _rewarded;
        totalRewarded += _rewarded;
    }

    constructor(address _router, address _token) {
        owner = msg.sender;
        router = IUniswapV2Router02(_router);
        token = _token;
    }

    modifier onlyOwner() {
		require(owner==msg.sender, "Only owner can call");
		_;
	}

    event Claim(address indexed, uint256);
    event Distribute(address indexed, uint256);

    function setRatio(uint32 _ratioCommunity, uint32 _ratioDev, uint32 _ratioRevenue) public onlyOwner {
        require(_ratioCommunity + _ratioDev + _ratioRevenue == 10_000, "Total ration should be 100%");
        ratioCommunity = _ratioCommunity;
        ratioDev = _ratioDev;
        ratioRevenue = _ratioRevenue;
    }

    function setSigner(address _signer) public onlyOwner {
        require(_signer!=address(0), "Invalid signer address");
        signer = _signer;
    }

    function setRouter(address _router) public onlyOwner {
        require(_router!=address(0), "Invalid router address");
        router = IUniswapV2Router02(_router);
    }

    function setToken(address _token) public onlyOwner {
        token = _token;
    }

    function claim(uint32 _percent, bytes memory _sig, bool _compound) public {
        bytes32 r;
		bytes32 s;
		uint8 v;
		assembly {
			r := mload(add(_sig, 32))
			s := mload(add(_sig, 64))
			v := byte(0, mload(add(_sig, 96)))
		}
		bytes32 payloadHash = keccak256(abi.encode(_percent, msg.sender));
		bytes32 messageHash = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", payloadHash));
		address _signer = ecrecover(messageHash, v, r, s);
        require(signer==_signer, "Invalid claim request");
        uint256 _amount = balanceRevenue * _percent / 10_000_000;
        balanceRevenue -= _amount;
        if(_compound) {
            require(address(router)!=address(0), "Compound: Invalid router address");
            require(token!=address(0), "Compound: Invalid token address");
            address[] memory _path = new address[](2);
            _path[0] = router.WETH();
            _path[1] = token;
            router.swapExactETHForTokensSupportingFeeOnTransferTokens{value: _amount}(0, _path, msg.sender, block.timestamp + 30);
        } else {
            (bool _success, ) = payable(msg.sender).call{value: _amount}("");
            require(_success, "Claim failed");
        }
        lastClaimed[msg.sender] = block.number;
        userClaimed[msg.sender] += _amount;
        totalClaimed += _amount;
        emit Claim(msg.sender, _amount);
    }

    function distribute(uint256 _amount, address _recipient, uint8 _target) public onlyOwner {
        if(_target == TARGET_COMMUNITY) {
            require(_amount <= balanceCommunity, "Insufficient balance");
            balanceCommunity -= _amount;
        } else if(_target == TARGET_DEV) {
            require(_amount <= balanceDev, "Insufficient balance");
            balanceDev -= _amount;
        } else {
            revert("Unsupported target");
        }
        (bool _success, ) = payable(_recipient).call{value: _amount}("");
        require(_success, "Distribution failed");
        emit Distribute(msg.sender, _amount);
    }
}