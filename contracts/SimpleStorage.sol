// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * SimpleStorage — Contract dùng để test Phase 3 Docker Sandbox.
 * Không có constructor args, không có payable function → dễ test nhất.
 */
contract SimpleStorage {
    uint256 private _value;
    address public owner;

    event ValueChanged(address indexed setter, uint256 newValue);

    constructor() {
        owner = msg.sender;
        _value = 0;
    }

    function set(uint256 newValue) public {
        _value = newValue;
        emit ValueChanged(msg.sender, newValue);
    }

    function get() public view returns (uint256) {
        return _value;
    }

    function getOwner() public view returns (address) {
        return owner;
    }
}
