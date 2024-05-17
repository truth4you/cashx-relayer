// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./Uniswap/IUniswapV2Router02.sol";
// import {IVerifier} from "./Verifier.sol";
import "hardhat/console.sol";

contract CashX {
    uint256 public denomination;

    mapping(bytes32 => bool) public locked;

	address public owner;
    address public token;
    address public distributor;
    IUniswapV2Router02 router;
    bool private _entered;

    mapping(uint32 => uint32) public deposits;
    mapping(uint32 => uint32) public withdraws;
    mapping(uint32 => uint32) public swaps;

    uint32 public constant TIME_HISTORY_SIZE = 10;

	uint256 public debtFee;
    uint256 public amountFee;
    bool public useFixedFee = true;
    uint256 private thresholdFee = 0.01 ether;
    address[] private pathFee;
            
    event Deposit(uint256);
    event Withdrawal(address indexed, uint256);
    event Swap(address indexed, uint256);

    receive() external payable {}

    modifier nonReentrant() {
        require(!_entered, "ReentrancyGuard: reentrant call");
        _entered = true;
        _;
        _entered = false;
    }

	modifier onlyOwner() {
		require(owner==msg.sender, "Only owner can call");
		_;
	}

    constructor(
        address _router,
		address _distributor,
        address _token,
        uint256 _denomination,
        uint256 _amountFee,
        bool _useFixedFee
    ) {
        require(_denomination > 0, "denomination should be greater than 0");
        require(_distributor!=address(0), "distributor should not be null");
		require(_router != address(0), "Invalid router");
		router = IUniswapV2Router02(_router);
        if(_token!=address(0)) {
            pathFee.push(_token);
            pathFee.push(router.WETH());
        }
        distributor = _distributor;
        token = _token;
        denomination = _denomination;
        amountFee = _amountFee;
        useFixedFee = _useFixedFee;
		owner = msg.sender;
    }

    function sig2hash(bytes memory _sig) internal pure returns (bytes32) {
        bytes32 r;
		bytes32 s;
		uint8 v;
		assembly {
			r := mload(add(_sig, 32))
			s := mload(add(_sig, 64))
			v := byte(0, mload(add(_sig, 96)))
		}
		bytes32 payloadHash = keccak256(abi.encode(msg.sig, "cashx-verifier"));
		bytes32 messageHash = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", payloadHash));
		return keccak256(abi.encode(ecrecover(messageHash, v, r, s)));
    }

    function deposit(bytes calldata _sig) external payable nonReentrant {
        bytes32 _hash = sig2hash(_sig);
        require(!locked[_hash], "The commitment has been submitted");

        if (token == address(0))
            require(
                msg.value == denomination,
                "Please send `mixDenomination` ETH along with transaction"
            );
        else {
            require(
                msg.value == 0,
                "ETH value is supposed to be 0 for ERC20 instance"
            );
            IERC20(token).transferFrom(msg.sender, address(this), denomination);
        }
        deposits[(deposits[0] % TIME_HISTORY_SIZE) + 1] = uint32(
            block.timestamp
        );
        deposits[0]++;
        locked[_hash] = true;

        emit Deposit(block.timestamp);
    }

    function withdraw(
        bytes calldata _sig,
        address payable _recipient
    ) external payable nonReentrant {
        bytes32 _hash = sig2hash(_sig);
        require(locked[_hash], "The commitment has not been locked");
        uint256 fee = useFixedFee
            ? amountFee
            : (denomination * amountFee) / 10000;
        if (token == address(0)) {
            // require(msg.value == 0, "Message value is supposed to be zero for ETH instance");
            (bool success, ) = _recipient.call{value: denomination - fee}("");
            require(success, "payment to _recipient did not go thru");
        } else {
            IERC20(token).transfer(_recipient, denomination - fee);
        }
        if (msg.value > 0) {
            (bool success, ) = _recipient.call{value: msg.value}("");
            require(success, "payment to _relayer did not go thru");
        }
        withdraws[(withdraws[0] % TIME_HISTORY_SIZE) + 1] = uint32(
            block.timestamp
        );
        debtFee += fee;
        collectFee();
        withdraws[0]++;
        locked[_hash] = false;
        emit Withdrawal(_recipient, block.timestamp);
    }

    function claimFee(address _to) public onlyOwner {
        if(debtFee > 0) {
			if (token == address(0)) {
				(bool success, ) = _to.call{value: debtFee}("");
				require(success, "Claim fee failed");
			} else {
				IERC20(token).transfer(_to, debtFee);
			}
			debtFee = 0;
		}
    }

    function collectFee() internal {
        uint256 feeETH = 0;
        if(token == address(0)) 
            feeETH = debtFee;
        else {
            uint256[] memory amounts = router.getAmountsOut(debtFee, pathFee);
            if(amounts[amounts.length - 1] >= thresholdFee) {
                IERC20(token).approve(address(router), debtFee);
                router.swapExactTokensForETHSupportingFeeOnTransferTokens(debtFee, 0, pathFee, address(this), block.timestamp + 30);
                feeETH = address(this).balance;
            }
        }
        if(feeETH >= thresholdFee) {
            (bool success, ) = payable(distributor).call{value: feeETH}("");
            require(success, "Collect fee failed");
            debtFee = 0;
        }
    }

	function swap(
		bytes calldata _sig,
        address payable _recipient, 
		address[] calldata _path,
		uint32 _slippage
	) public {
		require(_path[0] == token || token == address(0) && _path[0] == router.WETH(), "Invalid input token");
		require(token != _path[_path.length - 1], "Invalid output token");
		bytes32 _hash = sig2hash(_sig);
        require(locked[_hash], "The commitment has not been locked");
        uint256 fee = useFixedFee
            ? amountFee
            : (denomination * amountFee) / 10000;
		uint256 amountIn = denomination - fee;
		// bool success = true;
		if(token == address(0)) {
			// (success,) = _router.call{value: amountIn}(
			// 	abi.encodeWithSignature("swapExactETHForTokensSupportingFeeOnTransferTokens(uint256,address[],address,uint256)", 0, _path, _recipient, block.timestamp + 30)
			// );
			router.swapExactETHForTokensSupportingFeeOnTransferTokens{value: amountIn}(0, _path, _recipient, block.timestamp + 30);
		} else if(_path[_path.length - 1] == router.WETH()) {
			IERC20(token).approve(address(router), amountIn);
		// 	(success,) = _router.call(
		// 		abi.encodeWithSignature("swapExactTokensForETHSupportingFeeOnTransferTokens(uint,uint,address[],address,uint)", amountIn, 0, _path, _recipient, block.timestamp + 30)
		// 	);
			router.swapExactTokensForETHSupportingFeeOnTransferTokens(amountIn, 0, _path, _recipient, block.timestamp + 30);
		} else {
			IERC20(token).approve(address(router), amountIn);
			// (success,) = _router.call(
			// 	abi.encodeWithSignature("swapExactTokensForTokensSupportingFeeOnTransferTokens(uint256,uint256,address[],address,uint256)", amountIn, 0, _path, _recipient, block.timestamp + 30)
			// );
			router.swapExactTokensForTokensSupportingFeeOnTransferTokens(amountIn, 0, _path, _recipient, block.timestamp + 30);
		}
		// require(success, "Swap failed");
		swaps[(swaps[0] % TIME_HISTORY_SIZE) + 1] = uint32(
            block.timestamp
        );
		debtFee += fee;
        collectFee();
        swaps[0]++;
        locked[_hash] = false;
        emit Swap(_recipient, block.timestamp);
	}

	function setFee(bool _useFixedFee, uint256 _amountFee) public onlyOwner {
		useFixedFee = _useFixedFee;
		amountFee = _amountFee;
	}
}
