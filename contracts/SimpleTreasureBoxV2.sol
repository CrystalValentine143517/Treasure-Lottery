// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title SimpleTreasureBoxV2
/// @notice Simplified treasure box game for testing (without FHE)
contract SimpleTreasureBoxV2 {
    struct PlayerStats {
        uint256 totalBoxesOpened;
        uint64 totalRewards;
        uint64 lastReward;
        uint256 lastOpenTime;
        bool isInitialized;
    }

    mapping(address => PlayerStats) public players;
    address[] public allPlayers;
    uint256 public totalBoxesOpened;
    uint64 public totalRewardsDistributed;
    uint256 private nonce;

    uint32 public constant MIN_REWARD = 1;
    uint32 public constant MAX_REWARD = 100;
    uint256 public constant COOLDOWN_TIME = 60; // 60 seconds between opens

    event BoxOpened(address indexed player, uint256 openId);
    event RewardRevealed(address indexed player, uint64 reward, uint256 openId);

    error CooldownActive(uint256 remainingTime);

    /// @notice Open a treasure box and get random reward
    function openBox() external returns (uint256) {
        PlayerStats storage stats = players[msg.sender];

        // Check cooldown
        if (stats.lastOpenTime > 0) {
            uint256 timeSinceLastOpen = block.timestamp - stats.lastOpenTime;
            if (timeSinceLastOpen < COOLDOWN_TIME) {
                revert CooldownActive(COOLDOWN_TIME - timeSinceLastOpen);
            }
        }

        // Initialize player if first time
        if (!stats.isInitialized) {
            allPlayers.push(msg.sender);
            stats.isInitialized = true;
        }

        // Generate pseudo-random reward
        uint256 random = uint256(keccak256(abi.encodePacked(
            block.timestamp,
            block.prevrandao,
            msg.sender,
            nonce++
        )));

        uint64 reward = uint64((random % (MAX_REWARD - MIN_REWARD + 1)) + MIN_REWARD);

        // Update stats
        stats.totalBoxesOpened++;
        stats.totalRewards += reward;
        stats.lastReward = reward;
        stats.lastOpenTime = block.timestamp;

        totalBoxesOpened++;
        totalRewardsDistributed += reward;

        uint256 openId = totalBoxesOpened;

        emit BoxOpened(msg.sender, openId);
        emit RewardRevealed(msg.sender, reward, openId);

        return openId;
    }

    /// @notice Get player statistics
    function getPlayerStats(address player) external view returns (
        uint256 boxesOpened,
        uint64 totalRewards,
        uint64 lastReward,
        uint256 lastOpenTime,
        uint256 cooldownRemaining
    ) {
        PlayerStats storage stats = players[player];

        uint256 remaining = 0;
        if (stats.lastOpenTime > 0) {
            uint256 elapsed = block.timestamp - stats.lastOpenTime;
            if (elapsed < COOLDOWN_TIME) {
                remaining = COOLDOWN_TIME - elapsed;
            }
        }

        return (
            stats.totalBoxesOpened,
            stats.totalRewards,
            stats.lastReward,
            stats.lastOpenTime,
            remaining
        );
    }

    /// @notice Get top players by total rewards
    function getTopPlayers(uint256 count) external view returns (
        address[] memory topAddresses,
        uint64[] memory topRewards
    ) {
        uint256 playerCount = allPlayers.length;
        if (count > playerCount) count = playerCount;
        if (count == 0) return (new address[](0), new uint64[](0));

        // Simple bubble sort for top players
        address[] memory sortedAddresses = new address[](playerCount);
        uint64[] memory sortedRewards = new uint64[](playerCount);

        for (uint256 i = 0; i < playerCount; i++) {
            sortedAddresses[i] = allPlayers[i];
            sortedRewards[i] = players[allPlayers[i]].totalRewards;
        }

        // Bubble sort
        for (uint256 i = 0; i < playerCount; i++) {
            for (uint256 j = i + 1; j < playerCount; j++) {
                if (sortedRewards[j] > sortedRewards[i]) {
                    uint64 tempReward = sortedRewards[i];
                    sortedRewards[i] = sortedRewards[j];
                    sortedRewards[j] = tempReward;

                    address tempAddr = sortedAddresses[i];
                    sortedAddresses[i] = sortedAddresses[j];
                    sortedAddresses[j] = tempAddr;
                }
            }
        }

        // Return top N
        topAddresses = new address[](count);
        topRewards = new uint64[](count);
        for (uint256 i = 0; i < count; i++) {
            topAddresses[i] = sortedAddresses[i];
            topRewards[i] = sortedRewards[i];
        }

        return (topAddresses, topRewards);
    }

    /// @notice Get total game statistics
    function getGlobalStats() external view returns (
        uint256 totalPlayers,
        uint256 totalBoxes,
        uint64 totalRewards
    ) {
        return (
            allPlayers.length,
            totalBoxesOpened,
            totalRewardsDistributed
        );
    }

    /// @notice Check if player can open a box now
    function canOpenBox(address player) external view returns (bool, uint256 cooldownRemaining) {
        PlayerStats storage stats = players[player];

        if (stats.lastOpenTime == 0) {
            return (true, 0);
        }

        uint256 elapsed = block.timestamp - stats.lastOpenTime;
        if (elapsed >= COOLDOWN_TIME) {
            return (true, 0);
        }

        return (false, COOLDOWN_TIME - elapsed);
    }
}
