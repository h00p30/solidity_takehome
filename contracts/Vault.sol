pragma solidity ^0.8.0;

// ERC20 interface
interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);

    function transferFrom(
        address from,
        address to,
        uint256 amount
    ) external returns (bool);
}

// This vault allow the owner to create and cancel timelocked grants
// recipient addresses can withdraw their tokens after a predefined timestamp
contract Vault {
    // --- Vault Data ---
    // The address of the owner
    address public owner;
    // The current grant number
    uint96 public grantCount;

    struct Grant {
        // slot 1
        // The amount of tokens for this grant
        uint256 amount; // 32 bytes
        // slot 2
        // The timestamp which unlocks the grant
        uint96 unlockTimestamp; // 12 bytes
        // The only address allowed to withdraw the grant
        address recipient; // 20 bytes
        // slot 3
        // The address of the token
        address token; // 20 bytes
        // The validity of the grant
        bool active; // 1 byte
    }

    // A mapping to track Grant structs with a number
    mapping(uint256 => Grant) public countToGrant;

    /// @notice Initializes the vault contract
    constructor() {
        // Set the state variables
        owner = msg.sender;
        grantCount = 0;
    }

    // --- Vault ---
    /// @notice Creates a Grant and add it to the mapping
    /// @param amount The amount of token for this grant
    /// @param unlockTimestamp The timestamp in seconds after which funds are unlocked
    /// @param recipient The only address allowed to withdraw the tokens
    /// @param recipient The address of the token
    function createGrant(
        uint256 amount,
        uint96 unlockTimestamp,
        address recipient,
        address token
    ) public {
        // Only the owner can create grants
        require(msg.sender == owner, "Not owner");
        require(
            recipient != address(this),
            "This contract cannot be the recipient"
        );

        // Create then load the grant in memory
        Grant memory grant = Grant(
            amount,
            unlockTimestamp,
            recipient,
            token,
            // Grant is active by default
            true
        );

        // Transfer funds from owner to this contract
        bool success = IERC20(token).transferFrom(
            msg.sender,
            address(this),
            amount
        );

        // Revert if the transfer wasn't successfull
        require(success, "Transfer failed");

        // Stores the grant in the mapping
        countToGrant[grantCount] = grant;
        // Increment the number of grantse
        grantCount += 1;
    }

    /// @notice Withdraws funds of the grant
    /// @param grantnumber The number of the grant
    function withdrawGrant(uint256 grantnumber) public {
        // Load the grant in memory
        Grant memory grant = countToGrant[grantnumber];

        // Only the recipient can withdraw
        require(msg.sender == grant.recipient, "Not recipient address");
        // Need to wait for unlock and grant must be still active
        require(
            block.timestamp > grant.unlockTimestamp && grant.active,
            "Cannot withdraw"
        );

        // Transfer funds from this contract to the recipient
        bool success = IERC20(grant.token).transfer(msg.sender, grant.amount);

        // Revert if the transfer wasn't successfull
        require(success, "Transfer failed");

        // Make grant unactive as it is now used
        grant.active = false;
        // Update the grant
        countToGrant[grantnumber] = grant;
    }

    /// @notice Cancels the grant
    /// @param grantnumber The number of the grant
    /// @dev can only be called before the unlock
    function cancelGrant(uint256 grantnumber) public {
        // Only the owner can cancel a grant
        require(msg.sender == owner, "Not owner");

        // Load the grant in memory
        Grant memory grant = countToGrant[grantnumber];

        // Can only cancel a grant before unlock
        require(
            block.timestamp <= grant.unlockTimestamp,
            "Cannot cancel after unlock"
        );

        // Transfer funds from this contract back to owner
        bool success = IERC20(grant.token).transfer(msg.sender, grant.amount);

        // Revert if the transfer wasn't successfull
        require(success, "Transfer failed");

        // Make grant unactive as it is now canceled
        grant.active = false;
        // Update the grant
        countToGrant[grantnumber] = grant;
    }
}
