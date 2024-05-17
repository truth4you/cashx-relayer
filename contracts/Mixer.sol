// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IUniswapV2Router02} from "@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol";
import {IJoeRouter02} from "@traderjoe-xyz/core/contracts/traderjoe/interfaces/IJoeRouter02.sol";
// import {IUniversalRouter} from "@uniswap/universal-router/contracts/interfaces/IUniversalRouter.sol";
// import {IVerifier} from "./Verifier.sol";
import {IRouterClient} from "@chainlink/contracts-ccip/src/v0.8/ccip/interfaces/IRouterClient.sol";
import {Client} from "@chainlink/contracts-ccip/src/v0.8/ccip/libraries/Client.sol";
import "hardhat/console.sol";

interface IBridgeRouter {
    function ccipFee(uint64, address, uint256, address, bytes memory) external view returns (uint256);
    function ccipSend(uint64, address, uint256, address, bytes memory) external returns (bytes32);
    function manualReceive(bytes32) external;
}

enum STATE {
    NONE, ALLOWED, DENIED
}

struct Amount {
    address token;
    uint256 amount;
}

struct Config {
    address token;
    uint256[] denominators;
    uint32[] feeRates;
}

struct BridgeOption {
    uint64 chainSelector; 
    address receiver;
    address[] path;
}

contract Mixer {
    address public verifier;

    address[] private tokens;
    mapping(address => STATE) private tokenSupported;
    mapping(address => uint256[]) private denominators;
    mapping(address => mapping(uint256 => STATE)) private depositables;
    mapping(address => mapping(uint256 => uint32)) private feeRates;
    mapping(address => address[]) private feePath;
    
    mapping(bytes32 => Amount) private deposited;
    mapping(bytes32 => Amount) private withdrawn;

	address public owner;

    IUniswapV2Router02 private swapRouter;
    IBridgeRouter private bridgeRouter;
    address public feeReceiver;
    uint256 public feeETH;
    uint32 public feeRate = 200;
    bool public feeInAmount = false;
    
    uint256 private thresholdFee = 0.01 ether;
	mapping(address => uint256) private _debtFee;
    bool private _entered;
            
    event Deposit(address indexed, uint256);
    event Withdrawal(address indexed, uint256);
    event Swap(address indexed, address indexed, uint256, uint256);
    event BridgeStart(bytes32 indexed);
    event BridgeEnd(bytes32 indexed);

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

	modifier onlyBridge() {
		require(address(bridgeRouter)==msg.sender, "Only bridge can call");
		_;
	}

    constructor(
        address _verifier,
        address _swapRouter,
        address _bridgeRouter,
		address _feeReceiver,
        uint256 _feeETH
    ) {
		owner = msg.sender;
        verifier = _verifier;
        require(_swapRouter != address(0), "Invalid router");
        swapRouter = IUniswapV2Router02(_swapRouter);
        bridgeRouter = IBridgeRouter(_bridgeRouter);
        feeReceiver = _feeReceiver;
        feeETH = _feeETH;
    }

    function _verify() internal view returns (bytes32, bytes32) {
        (bool _success, bytes memory _data) = verifier.staticcall(msg.data);
        if(_success) {
            return abi.decode(_data, (bytes32, bytes32));
        }
        revert("Invalid commitment");
    }

    function balanceOf(bytes calldata) public view returns (address, uint256) {
        (bytes32 _hashDeposited, bytes32 _hashWithdrawn) = _verify();
        if(deposited[_hashDeposited].amount==0)
            revert("Unknown commitment");
        if(withdrawn[_hashWithdrawn].amount > 0 && deposited[_hashDeposited].token!=withdrawn[_hashWithdrawn].token)
            revert("Invalid commitment");
        return (
            deposited[_hashDeposited].token,
            deposited[_hashDeposited].amount - withdrawn[_hashWithdrawn].amount
        );
    }

    function deposit(bytes calldata, address _token, uint256 _amount) external payable nonReentrant {
        require(tokenSupported[_token]==STATE.ALLOWED, "Unsupported token");
        
        (bytes32 _hash, ) = _verify();
        require(deposited[_hash].amount == 0, "Invalid commitment");

        uint256 _denominator = depositables[_token][0]==STATE.ALLOWED ? 0 : _amount;
        require(depositables[_token][_denominator]==STATE.ALLOWED, "Unsupported depositable amount");
        
        uint256 _fee = feeRates[_token][_denominator] * _amount / 10000;
        if (_token == address(0)) {
            uint256 _amountNeed = _amount + feeETH + (feeInAmount ? 0 : _fee);
            require(
                msg.value >= _amountNeed,
                "Insufficient ETH"
            );
            if(msg.value > _amountNeed) {
                (bool success,) = payable(msg.sender).call{value: msg.value - _amountNeed}("");
                require(success, "Refunding ETH failed");
            }
            _debtFee[_token] += _fee + feeETH;
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
            IERC20(_token).transferFrom(msg.sender, address(this), _amount + (feeInAmount ? 0 : _fee));
            _debtFee[_token] += _fee;
        }
        deposited[_hash] = Amount({
            token: _token,
            amount: _amount - (feeInAmount ? _fee : 0)
        });

        sendFee(_token);

        emit Deposit(_token, _amount);
    }

    function withdraw(
        bytes calldata,
        address _token,
        uint256 _amount,
        address payable _recipient
    ) external nonReentrant {
        require(tokenSupported[_token]==STATE.ALLOWED, "Unsupported token");
        
        uint256 _withdrawals = _withdraw(_token, _amount);

        if (_token == address(0)) {
            (bool success, ) = _recipient.call{value: _withdrawals}("");
            require(success, "Withdrawing ETH failed");
        } else {
            IERC20(_token).transfer(_recipient, _withdrawals);
        }
        
        emit Withdrawal(_token, _withdrawals);
    }

	function swap(
		bytes calldata,
        uint256 _amount,
        address _recipient, 
		address[] memory _path
	) public {
        address _token = _path[0]==swapRouter.WETH() ? address(0) : _path[0];
        require(tokenSupported[_token]==STATE.ALLOWED, "Unsupported token");
        
        uint256 _withdrawals = _withdraw(_token, _amount);

        address _tokenOut = _path[_path.length - 1];
        uint256 _amountOut = 0;
        address _receiver = _recipient;
		if(_token == address(0)) {
            _amountOut = IERC20(_tokenOut).balanceOf(_receiver);
			swapRouter.swapExactETHForTokensSupportingFeeOnTransferTokens{value: _withdrawals}(0, _path, _receiver, block.timestamp);
            _amountOut = IERC20(_tokenOut).balanceOf(_receiver) - _amountOut;
		} else if(_tokenOut == swapRouter.WETH()) {
            _amountOut = _receiver.balance;
			IERC20(_token).approve(address(swapRouter), _withdrawals);
			swapRouter.swapExactTokensForETHSupportingFeeOnTransferTokens(_withdrawals, 0, _path, _receiver, block.timestamp);
            _amountOut = _receiver.balance - _amountOut;
		} else {
            _amountOut = IERC20(_tokenOut).balanceOf(_receiver);
			IERC20(_token).approve(address(swapRouter), _withdrawals);
			swapRouter.swapExactTokensForTokensSupportingFeeOnTransferTokens(_withdrawals, 0, _path, _receiver, block.timestamp);
            _amountOut = IERC20(_tokenOut).balanceOf(_receiver) - _amountOut;
		}

        emit Swap(_token, _tokenOut, _withdrawals, _amountOut);
	}  

    function _balance(address _token) internal view returns (uint256) {
        (bytes32 _hashDeposited, bytes32 _hashWithdrawn) = _verify();
        require(deposited[_hashDeposited].amount > 0 && deposited[_hashDeposited].token == _token, "Invalid commitment");

        if(withdrawn[_hashDeposited].amount > 0)
            require(withdrawn[_hashDeposited].token == _token, "Invalid commitment");

        return deposited[_hashDeposited].amount - withdrawn[_hashWithdrawn].amount;
    }

    function _withdraw(address _token, uint256 _amount) internal returns (uint256) {
        (bytes32 _hashDeposited, bytes32 _hashWithdrawn) = _verify();
        require(deposited[_hashDeposited].amount > 0 && deposited[_hashDeposited].token == _token, "Invalid commitment");

        if(withdrawn[_hashDeposited].amount > 0)
            require(withdrawn[_hashDeposited].token == _token, "Invalid commitment");

        uint256 _withdrawable = deposited[_hashDeposited].amount - withdrawn[_hashWithdrawn].amount;

        uint256 _withdrawals = _amount > 0 ? _amount : _withdrawable;
        require(_withdrawable >= _withdrawals, "Insufficient withdrawable");

        withdrawn[_hashWithdrawn] = Amount({
            token: _token,
            amount: withdrawn[_hashWithdrawn].amount + _withdrawals
        });

        return _withdrawals;
    }

    function bridge(
		bytes calldata,
        uint256 _amount,
        address _recipient,
		address[] memory _path,
        uint64 _chainSelector,
        bytes memory _data
	) public {
        address _tokenIn = _path[0]==swapRouter.WETH() ? address(0) : _path[0];
        require(tokenSupported[_tokenIn]==STATE.ALLOWED, "Unsupported token");

        address _tokenBridge = _path[_path.length - 1];
        address _receiver = _recipient;
        uint256 _withdrawals = _withdraw(_tokenIn, _amount);
        uint256 _amountSend = swapRouter.getAmountsOut(_withdrawals, _path)[_path.length - 1];
        uint256 _fee = bridgeRouter.ccipFee(_chainSelector, _tokenBridge, _amountSend, _receiver, _data);
        _amountSend = IERC20(_tokenBridge).balanceOf(address(bridgeRouter));
        if(_tokenIn == address(0)) {
            (bool _success,) = address(bridgeRouter).call{value: _fee}("");
            require(_success, "Failed to send fee");
            swapRouter.swapExactETHForTokensSupportingFeeOnTransferTokens{value: _withdrawals - _fee}(0, _path, address(bridgeRouter), block.timestamp);
        } else {
            IERC20(_tokenIn).approve(address(swapRouter), _withdrawals);
			_fee = swapRouter.swapTokensForExactETH(_fee, _withdrawals, feePath[_tokenIn], address(bridgeRouter), block.timestamp)[0];
			swapRouter.swapExactTokensForTokensSupportingFeeOnTransferTokens(_withdrawals - _fee, 0, _path, address(bridgeRouter), block.timestamp);
        }
        _amountSend = IERC20(_tokenBridge).balanceOf(address(bridgeRouter)) - _amountSend;

        bytes32 _messageId = bridgeRouter.ccipSend(_chainSelector, _tokenBridge, _amountSend, _receiver, _data);

        emit BridgeStart(_messageId);
	}

    function manualFinalize(bytes32 _messageId) public {
        bridgeRouter.manualReceive(_messageId);
    }  

    function finalize(bytes32 _messageId, uint256 _amount, address _recipient, address[] memory _path) public onlyBridge {
        address _token = _path[0];
        address _tokenOut = _path[_path.length - 1];
        IERC20(_token).approve(address(swapRouter), _amount);
        if(_tokenOut==swapRouter.WETH())
            swapRouter.swapExactTokensForETHSupportingFeeOnTransferTokens(_amount, 0, _path, _recipient, block.timestamp);
        else
            swapRouter.swapExactTokensForTokensSupportingFeeOnTransferTokens(_amount, 0, _path, _recipient, block.timestamp);
        emit BridgeEnd(_messageId);
    }

    function claimFee(address _token, address _to) public onlyOwner {
        if(_debtFee[_token] > 0) {
			if (_token == address(0)) {
				(bool success, ) = payable(_to).call{value: _debtFee[_token]}("");
				require(success, "Claiming fee failed");
			} else {
				IERC20(_token).transfer(_to, _debtFee[_token]);
			}
			_debtFee[_token] = 0;
		}
    }

    function sendFee(address _token) internal {
        if(feeReceiver==address(0))
            return;

        uint256 _feeTotal = 0;
        if(_token == address(0)) {
            _feeTotal = _debtFee[_token];
            _debtFee[_token] = 0;
        } else {
            uint256[] memory _amounts = swapRouter.getAmountsOut(_debtFee[_token], feePath[_token]);
            _feeTotal = address(this).balance;
            if(_amounts[_amounts.length - 1] >= thresholdFee) {
                IERC20(_token).approve(address(swapRouter), _debtFee[_token]);
                swapRouter.swapExactTokensForETHSupportingFeeOnTransferTokens(_debtFee[_token], 0, feePath[_token], address(this), block.timestamp);
                _debtFee[_token] = 0;
            }
            _feeTotal = address(this).balance - _feeTotal;
        }
        if(_feeTotal > 0) {
            (bool success, ) = payable(feeReceiver).call{value: _feeTotal}("");
            require(success, "Sending fee failed");
        }
    }

    function setDenominators(address _token, uint256[] memory _denominators, uint32[] memory _feeRates, address[] memory _feePath) public onlyOwner {
        if(_denominators.length > 0) {
            for(uint256 i = 0;i<_denominators.length;i++) {
                uint256 _denominator = _denominators[i];
                if(depositables[_token][_denominator] == STATE.NONE)
                    denominators[_token].push(_denominator);
                depositables[_token][_denominator] = STATE.ALLOWED;
                if(_feeRates.length > i)
                    feeRates[_token][_denominator] = _feeRates[i];
            }
        }
        if(tokenSupported[_token]==STATE.NONE)
            tokens.push(_token);
        feePath[_token] = _feePath;
        tokenSupported[_token] = STATE.ALLOWED;
    }

    function removeDenominators(address _token, uint256[] memory _denominators) public onlyOwner {
        if(_denominators.length > 0) {
            for(uint256 i = 0;i<_denominators.length;i++) {
                uint256 _denominator = _denominators[i];
                if(depositables[_token][_denominator] == STATE.ALLOWED)
                    depositables[_token][_denominator] = STATE.DENIED;
            }
            uint _count = 0;
            for(uint i = 0;i<denominators[_token].length;i++) {
                uint256 _denomiator = denominators[_token][i];
                if(depositables[_token][_denomiator]==STATE.ALLOWED)
                    _count ++;
            }
            if(_count==0)
                tokenSupported[_token] = STATE.DENIED;
        }
    }

    function enableToken(address _token, bool _enabled) public onlyOwner {
        tokenSupported[_token] = _enabled ? STATE.ALLOWED : STATE.DENIED;
    }

    function setSwapRouter(address _swapRouter) public onlyOwner {
        require(_swapRouter != address(0), "Invalid router");
        swapRouter = IUniswapV2Router02(_swapRouter);
    }
    
    function setBridgeRouter(address _bridgeRouter) public onlyOwner {
        require(_bridgeRouter != address(0), "Invalid router");
        bridgeRouter = IBridgeRouter(_bridgeRouter);
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

    function supportsInterface(bytes4) public pure returns (bool) {
        // return interfaceId == type(IAny2EVMMessageReceiver).interfaceId || interfaceId == type(IERC165).interfaceId;
        return true;
    }

    function getAllConfig() public view returns (Config[] memory, bool, uint256) {
        uint _count = 0;
        for(uint i = 0;i<tokens.length;i++) {
            address _token = tokens[i];
            if(tokenSupported[_token]==STATE.ALLOWED)
                _count ++;
        }
        if(_count==0)
            revert("Mixer has not been initialized");
        Config[] memory config = new Config[](_count);
        uint _index = 0;
        for(uint i = 0;i<tokens.length;i++) {
            address _token = tokens[i];
            if(tokenSupported[_token]==STATE.ALLOWED) {
                config[_index] = getConfig(_token);
                _index ++;
            }
        }
        return ( config, feeInAmount, feeETH );
    }

    function getConfig(address _token) public view returns (Config memory) {
        uint _count = 0;
        for(uint i = 0;i<denominators[_token].length;i++) {
            uint256 _denomiator = denominators[_token][i];
            if(depositables[_token][_denomiator]==STATE.ALLOWED)
                _count ++;
        }
        if(_count==0)
            revert("Token has not been initialized");
        uint256[] memory _denomiators = new uint256[](_count);
        uint32[] memory _feeRates = new uint32[](_count);
        uint _index = 0;
        for(uint i = 0;i<denominators[_token].length;i++) {
            uint256 _denomiator = denominators[_token][i];
            if(depositables[_token][_denomiator]==STATE.ALLOWED) {
                _denomiators[_index] = _denomiator;
                _feeRates[_index] = feeRates[_token][_denomiator];
                _index++;
            }
        }
        return Config({
            token: _token,
            denominators: _denomiators, 
            feeRates: _feeRates
        });
    }
}
