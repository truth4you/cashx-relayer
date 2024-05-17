// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IUniswapV2Router02} from "@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol";
import {IJoeRouter02} from "@traderjoe-xyz/core/contracts/traderjoe/interfaces/IJoeRouter02.sol";
// import {IUniversalRouter} from "@uniswap/universal-router/contracts/interfaces/IUniversalRouter.sol";
// import {IVerifier} from "./Verifier.sol";
import "hardhat/console.sol";

// enum SWAP_ROUTER_VERSION {
//     UNISWAP_V2, TRADERJOE, UNIVERSAL
// }

// struct SwapRouter {
//     address router;
//     SWAP_ROUTER_VERSION version;
// }

// library SwapLibrary {
//     error UnsupportedSwapRouter(SWAP_ROUTER_VERSION);

//     function _WETH(SwapRouter storage swapRouter) private view returns (address) {
//         if(swapRouter.version == SWAP_ROUTER_VERSION.UNISWAP_V2) {
//             return IUniswapV2Router02(swapRouter.router).WETH();
//         } else if(swapRouter.version == SWAP_ROUTER_VERSION.TRADERJOE) {
//             return IJoeRouter02(swapRouter.router).WAVAX();
//         }
//         revert UnsupportedSwapRouter(swapRouter.version);
//     }

//     function getAmountOut(SwapRouter storage swapRouter, address[] memory path, uint256 amountIn) internal view returns (uint256) {
//         if(swapRouter.version == SWAP_ROUTER_VERSION.UNISWAP_V2) {
//             uint256[] memory amounts = IUniswapV2Router02(swapRouter.router).getAmountsOut(amountIn, path);
//             return amounts[1];
//         } else if(swapRouter.version == SWAP_ROUTER_VERSION.TRADERJOE) {
//             uint256[] memory amounts = IJoeRouter02(swapRouter.router).getAmountsOut(amountIn, path);
//             return amounts[1];
//         }
//         return 0;
//     }

//     function swap(SwapRouter storage swapRouter, address[] memory path, uint256 amount, address receiver) internal {
//         IERC20(token).approve(swapRouter.router, amount);
//         if(swapRouter.version == SWAP_ROUTER_VERSION.UNISWAP_V2) {
//             IUniswapV2Router02(swapRouter.router).swapExactTokensForETHSupportingFeeOnTransferTokens(
//                 amount, 0, path, receiver, block.timestamp
//             );
//         } else if(swapRouter.version == SWAP_ROUTER_VERSION.TRADERJOE) {
//             IJoeRouter02(swapRouter.router).swapExactTokensForAVAXSupportingFeeOnTransferTokens(
//                 amount, 0, path, receiver, block.timestamp
//             );
//         } else {
//         }
//     }
// }
enum DEPOSITABLE {
    NONE, ALLOWED, DENIED
}

library Verifier {
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

contract AnonMixer {
    using Verifier for bytes;

    address public token;

    uint256[] private denominators;
    mapping(uint256 => DEPOSITABLE) private depositables;
    mapping(uint256 => uint32) private feeRates;
    
    mapping(bytes32 => uint256) private deposited;
    mapping(bytes32 => uint256) private withdrawn;

	address public owner;

    IUniswapV2Router02 private swapRouter;
    address public feeReceiver;
    address[] private feePath;
    uint256 public feeETH;
    uint32 public feeRate = 200;
    bool public feeInAmount = false;
    
    uint256 private thresholdFee = 0.01 ether;
	uint256 private _debtFee;
    bool private _entered;
            
    event Deposit(uint256);
    event Withdrawal(uint256);
    event Swap(address indexed, uint256, uint256);

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
        address _token,
        address _swapRouter,
        uint256[] memory _denominators,
        uint32[] memory _feeRates,
        address[] memory _feePath,
		address _feeReceiver,
        uint256 _feeETH
    ) {
		owner = msg.sender;
        token = _token;
        require(_swapRouter != address(0), "Invalid router");
        swapRouter = IUniswapV2Router02(_swapRouter);
        if(_token != address(0)) {
            feePath.push(_token);
            for(uint i = 0;i<_feePath.length;i++) {
                feePath.push(_feePath[i]);
            }
            feePath.push(swapRouter.WETH());
        }
        feeReceiver = _feeReceiver;
        feeETH = _feeETH;
        setDenominators(_denominators, _feeRates);
    }

    function balanceOf(bytes calldata _sig) public view returns (uint256) {
        bytes32 _hashDeposited = _sig.deposited();
        require(deposited[_hashDeposited] > 0, "Invalid commitment");

        bytes32 _hashWithdrawn = _sig.withdrawn();
        return deposited[_hashDeposited] - withdrawn[_hashWithdrawn];
    }

    function deposit(bytes calldata _sig, uint256 _amount) external payable nonReentrant {
        bytes32 _hash = _sig.deposited();
        require(deposited[_hash] == 0, "The commitment has been duplicated");

        uint256 _denominator = depositables[0]==DEPOSITABLE.ALLOWED ? 0 : _amount;
        require(depositables[_denominator]==DEPOSITABLE.ALLOWED, "Unsupported depositables amount");
        
        uint256 _fee = feeRates[_denominator] * _amount / 10000;
        if (token == address(0)) {
            uint256 _amountNeed = _amount + feeETH + (feeInAmount ? 0 : _fee);
            require(
                msg.value >= _amountNeed,
                "Insufficient ETH"
            );
            if(msg.value > _amountNeed) {
                (bool success,) = payable(msg.sender).call{value: msg.value - _amountNeed}("");
                require(success, "Refunding ETH failed");
            }
            _debtFee += _fee + feeETH;
        } else {
            if(feeETH > 0) 
                require(
                    msg.value >= feeETH,
                    "Insufficient platform fee"
                );
            if(msg.value > feeETH) {
                (bool success,) = payable(msg.sender).call{value: msg.value - feeETH}("");
                require(success, "Refunding ETH failed");
            }
            IERC20(token).transferFrom(msg.sender, address(this), _amount + (feeInAmount ? 0 : _fee));
            _debtFee += _fee;
        }
        deposited[_hash] = _amount - (feeInAmount ? _fee : 0);

        sendFee();

        emit Deposit(_amount);
    }

    function withdraw(
        bytes calldata _sig,
        uint256 _amount,
        address payable _recipient
    ) external nonReentrant {
        bytes32 _hashDeposited = _sig.deposited();
        require(deposited[_hashDeposited] > 0, "Invalid commitment");

        bytes32 _hashWithdrawn = _sig.withdrawn();
        uint256 _withdrawable = deposited[_hashDeposited] - withdrawn[_hashWithdrawn];

        uint256 _withdrawals = _amount > 0 ? _amount : _withdrawable;
        require(_withdrawable >= _withdrawals, "Insufficient withdrawable tokens");

        withdrawn[_hashWithdrawn] += _withdrawals;
        if (token == address(0)) {
            (bool success, ) = _recipient.call{value: _withdrawals}("");
            require(success, "Withdrawing ETH failed");
        } else {
            IERC20(token).transfer(_recipient, _withdrawals);
        }
        
        emit Withdrawal(_withdrawals);
    }

    function claimFee(address _to) public {
        if(_debtFee > 0) {
			if (token == address(0)) {
				(bool success, ) = payable(_to).call{value: _debtFee}("");
				require(success, "Claiming fee failed");
			} else {
				IERC20(token).transfer(_to, _debtFee);
			}
			_debtFee = 0;
		}
    }

    function sendFee() internal {
        if(feeReceiver==address(0))
            return;

        uint256 _feeTotal = 0;
        if(token == address(0)) {
            _feeTotal = _debtFee;
            _debtFee = 0;
        } else {
            uint256[] memory _amounts = swapRouter.getAmountsOut(_debtFee, feePath);
            if(_amounts[_amounts.length - 1] >= thresholdFee) {
                IERC20(token).approve(address(swapRouter), _debtFee);
                swapRouter.swapExactTokensForETHSupportingFeeOnTransferTokens(_debtFee, 0, feePath, address(this), block.timestamp + 30);
                _debtFee = 0;
            }
            _feeTotal = address(this).balance;
        }
        if(_feeTotal > 0) {
            (bool success, ) = payable(feeReceiver).call{value: _feeTotal}("");
            require(success, "Sending fee failed");
        }
    }

	function swap(
		bytes calldata _sig,
        uint256 _amount,
        address _recipient, 
		address[] calldata _path,
		uint32 _slippage
	) public {
        bytes32 _hashDeposited = _sig.deposited();
        require(deposited[_hashDeposited] > 0, "Invalid commitment");

        bytes32 _hashWithdrawn = _sig.withdrawn();
        uint256 _withdrawable = deposited[_hashDeposited] - withdrawn[_hashWithdrawn];

        uint256 _withdrawals = _amount > 0 ? _amount : _withdrawable;
        require(_withdrawable >= _withdrawals, "Insufficient withdrawable tokens");

        withdrawn[_hashWithdrawn] += _withdrawals;

        require(_path[0] == token || token == address(0) && _path[0] == swapRouter.WETH(), "Invalid input token");

        address _tokenOut = _path[_path.length - 1];
		require(token != _tokenOut, "Invalid output token");

        uint256[] memory _amounts = swapRouter.getAmountsOut(_withdrawals, _path);
        uint256 _amountMinOut = _amounts[_path.length - 1] * (10000 - _slippage) / 10000;
        uint256 _amountOut = 0;
        address _receiver = _recipient;
		if(token == address(0)) {
            _amountOut = IERC20(_tokenOut).balanceOf(_receiver);
			swapRouter.swapExactETHForTokensSupportingFeeOnTransferTokens{value: _withdrawals}(_amountMinOut, _path, _receiver, block.timestamp + 30);
            _amountOut = IERC20(_tokenOut).balanceOf(_receiver) - _amountOut;
		} else if(_tokenOut == swapRouter.WETH()) {
            _amountOut = _receiver.balance;
			IERC20(token).approve(address(swapRouter), _withdrawals);
			swapRouter.swapExactTokensForETHSupportingFeeOnTransferTokens(_withdrawals, _amountMinOut, _path, _receiver, block.timestamp + 30);
            _amountOut = _receiver.balance - _amountOut;
		} else {
            _amountOut = IERC20(_tokenOut).balanceOf(_receiver);
			IERC20(token).approve(address(swapRouter), _withdrawals);
			swapRouter.swapExactTokensForTokensSupportingFeeOnTransferTokens(_withdrawals, _amountMinOut, _path, _receiver, block.timestamp + 30);
            _amountOut = IERC20(_tokenOut).balanceOf(_receiver) - _amountOut;
		}

        emit Swap(_tokenOut, _withdrawals, _amountOut);
	}

    function setDenominators(uint256[] memory _denominators, uint32[] memory _feeRates) public onlyOwner {
        if(_denominators.length > 0) {
            for(uint256 i = 0;i<_denominators.length;i++) {
                uint256 _denominator = _denominators[i];
                if(depositables[_denominator] == DEPOSITABLE.NONE)
                    denominators.push(_denominator);
                depositables[_denominator] = DEPOSITABLE.ALLOWED;
                if(_feeRates.length > i)
                    feeRates[_denominator] = _feeRates[i];
            }
        }
    }

    function removeDenominators(uint256[] memory _denominators) public onlyOwner {
        if(_denominators.length > 0) {
            for(uint256 i = 0;i<_denominators.length;i++) {
                uint256 _denominator = _denominators[i];
                if(depositables[_denominator] == DEPOSITABLE.ALLOWED)
                    depositables[_denominator] = DEPOSITABLE.DENIED;
            }
        }
    }

    function setSwapRouter(address _swapRouter) public onlyOwner {
        require(_swapRouter != address(0), "Invalid router");
        swapRouter = IUniswapV2Router02(_swapRouter);
        if(token != address(0)) {
            feePath[feePath.length - 1] = swapRouter.WETH();
        }
    }
    
    function setFeeInAmount(bool _feeInAmount) public onlyOwner {
        feeInAmount = _feeInAmount;
    }
    
    function setFeeReceiver(address _feeReceiver) public onlyOwner {
        feeReceiver = _feeReceiver;
    }
    
    function setFeeETH(uint256 _feeETH) public onlyOwner {
        feeETH = _feeETH;
    }
    
    function setThresholdFee(uint256 _thresholdFee) public onlyOwner {
        thresholdFee = _thresholdFee;
    }
    
    function setFeeDefaultRate(uint32 _feeDefaultRate) public onlyOwner {
        feeRate = _feeDefaultRate;
    }
    
    function transferOwnership(address _owner) public onlyOwner {
        owner = _owner;
    }

    function getConfig() public view returns (
        bool, uint256[] memory, uint32[] memory, uint256
    ) {
        uint _count = 0;
        if(depositables[0]==DEPOSITABLE.ALLOWED) {
            _count = 1;
        } else {
            for(uint i = 0;i<denominators.length;i++) {
                uint256 _denomiator = denominators[i];
                if(depositables[_denomiator]==DEPOSITABLE.ALLOWED)
                    _count ++;
            }
        }
        if(_count==0)
            revert("Mixer has not been initialized");
        uint256[] memory _denomiators = new uint256[](_count);
        uint32[] memory _feeRates = new uint32[](_count);
        if(depositables[0]==DEPOSITABLE.ALLOWED) {
            _denomiators[0] = 0;
            _feeRates[0] = feeRates[0];
        } else {
            uint _index = 0;
            for(uint i = 0;i<denominators.length;i++) {
                uint256 _denomiator = denominators[i];
                if(depositables[_denomiator]==DEPOSITABLE.ALLOWED) {
                    _denomiators[_index] = _denomiator;
                    _feeRates[_index] = feeRates[_denomiator];
                    _index++;
                }
            }
        }
        return (
            feeInAmount, _denomiators, _feeRates, feeETH
        );
    }
}
