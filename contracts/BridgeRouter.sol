// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {IRouterClient} from "@chainlink/contracts-ccip/src/v0.8/ccip/interfaces/IRouterClient.sol";
import {OwnerIsCreator} from "@chainlink/contracts-ccip/src/v0.8/shared/access/OwnerIsCreator.sol";
import {Client} from "@chainlink/contracts-ccip/src/v0.8/ccip/libraries/Client.sol";
import {CCIPReceiver} from "@chainlink/contracts-ccip/src/v0.8/ccip/applications/CCIPReceiver.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "hardhat/console.sol";

interface IMixer {
    function finalize(bytes32 _messageId, uint256 _amount, address _recipient, address[] memory _path) external;
}

contract BridgeRouter is CCIPReceiver, OwnerIsCreator {
    mapping(bytes32 => bytes) private _failures;

    error CannotSendETH();
    error InsufficientETH();
    error UnsupportedChain(uint64);
    error UnsupportedToken(address);

    event Transferred(bytes32 indexed);
    event Recept(bytes32 indexed);
    event Failed(bytes32 indexed);

    constructor(address _ccipRouter) CCIPReceiver(_ccipRouter) {
    }

    receive() external payable {}

    function _buildMessage(
        uint64 _chainSelector,
        address _token,
        uint256 _amount,
        address _receiver,
        bytes memory _data
    ) private view returns (Client.EVM2AnyMessage memory) {
        if(!IRouterClient(getRouter()).isChainSupported(_chainSelector))
            revert UnsupportedChain(_chainSelector);

        address[] memory availableTokens = IRouterClient(getRouter()).getSupportedTokens(_chainSelector);
        bool found = false;
        for(uint256 i = 0; i < availableTokens.length; i++) {
            if(availableTokens[i]==_token) {
                found = true;
                break;
            }
        }
        if(!found)
            revert UnsupportedToken(_token);

        Client.EVMTokenAmount[] memory tokenAmounts = new Client.EVMTokenAmount[](1);

        tokenAmounts[0] = Client.EVMTokenAmount({
            token: _token,
            amount: _amount
        });
        
        Client.EVM2AnyMessage memory _message = Client.EVM2AnyMessage({
            receiver: abi.encode(_receiver),
            data: _data,
            tokenAmounts: tokenAmounts,
            extraArgs: Client._argsToBytes(
                Client.EVMExtraArgsV1({gasLimit: _data.length==0 ? 0 : 500_000})
            ),
            feeToken: address(0)
        });

        return _message;
    }

    function ccipFee(
        uint64 _chainSelector,
        address _token,
        uint256 _amount,
        address _receiver,
        bytes memory _data
    ) public view returns (uint256) {
        Client.EVM2AnyMessage memory _message = _buildMessage(
            _chainSelector,
            _token,
            _amount,
            _receiver,
            _data
        );
        return IRouterClient(getRouter()).getFee(_chainSelector, _message);
    }

    function ccipSend(
        uint64 _chainSelector,
        address _token,
        uint256 _amount,
        address _receiver,
        bytes memory _data
    ) public returns (bytes32) {
        Client.EVM2AnyMessage memory _message = _buildMessage(
            _chainSelector,
            _token,
            _amount,
            _receiver,
            _data
        );

        uint256 _ccipFee = IRouterClient(getRouter()).getFee(_chainSelector, _message);

        IERC20(_token).approve(getRouter(), _amount);
        bytes32 _messageId = IRouterClient(getRouter()).ccipSend{value: _ccipFee}(
            _chainSelector,
            _message
        );

        emit Transferred(_messageId);
        return _messageId;
    }

    function _ccipReceive(
        Client.Any2EVMMessage memory _message
    ) internal override {
        (address _mixer, address _receiver, address[] memory _path) = abi.decode(_message.data, (address, address, address[]));
        address _token = _message.destTokenAmounts[0].token;
        uint256 _amount = _message.destTokenAmounts[0].amount;

        if(_token==_path[0]) {
            IERC20(_token).transfer(_mixer, _amount);
            // IMixer(_mixer).finalize(_message.messageId, _amount, _receiver, _path);
            // emit Recept(_message.messageId);
            (bool _success, ) = address(_mixer).call(abi.encodeWithSignature("finalize(bytes32,uint256,address,address[])", _message.messageId, _amount, _receiver, _path));
            if(_success)
                emit Recept(_message.messageId);
            else {
                _failures[_message.messageId] = abi.encode(_mixer, _amount, _receiver, _path);
                emit Failed(_message.messageId);
            }
        } else {
            IERC20(_token).transfer(_receiver, _amount);
            emit Recept(_message.messageId);
        }
    }

    function manualReceive(bytes32 _id) public {
        require(_failures[_id].length > 0, "No history");
        (address _mixer, uint256 _amount, address _receiver, address[] memory _path) = abi.decode(_failures[_id], (address, uint256, address, address[]));
        (bool _success, ) = address(_mixer).call(abi.encodeWithSignature("finalize(bytes32,uint256,address,address[])", _id, _amount, _receiver, _path));
        if(_success) {
            _failures[_id] = bytes("");
            emit Recept(_id);
        }
    }

    function withdraw(address _token, address _recipient) public onlyOwner {
        if(_token==address(0)) {
            (bool success, ) = payable(_recipient).call{ value: address(this).balance }("");
            if(!success)
                revert CannotSendETH();
        } else {
            IERC20(_token).transfer(_recipient, IERC20(_token).balanceOf(address(this)));
        }
    }
}