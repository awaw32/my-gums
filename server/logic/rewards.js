"use strict";

const REWARDS_COOLDOWN_MS = 4 * 60 * 60 * 1000;

const REWARD_POOL = {
  gold:        { min: 50,  max: 150 },
  gems:        { min: 1,   max: 5 },
  hammers:     { min: 1,   max: 3 },
  scrolls:     { min: 1,   max: 3 },
};

function canClaimReward(playerData) {
  const last = playerData.lastGiftClaimedTimestamp || 0;
  return Date.now() - last >= REWARDS_COOLDOWN_MS;
}

function rollReward() {
  const gold   = REWARD_POOL.gold.min + Math.floor(Math.random() * (REWARD_POOL.gold.max - REWARD_POOL.gold.min + 1));
  const gems   = REWARD_POOL.gems.min + Math.floor(Math.random() * (REWARD_POOL.gems.max - REWARD_POOL.gems.min + 1));
  const hammers = REWARD_POOL.hammers.min + Math.floor(Math.random() * (REWARD_POOL.hammers.max - REWARD_POOL.hammers.min + 1));
  const scrolls = REWARD_POOL.scrolls.min + Math.floor(Math.random() * (REWARD_POOL.scrolls.max - REWARD_POOL.scrolls.min + 1));
  return { gold, gems, hammers, scrolls };
}

function claimReward(playerData) {
  if (!canClaimReward(playerData)) {
    const remaining = REWARDS_COOLDOWN_MS - (Date.now() - (playerData.lastGiftClaimedTimestamp || 0));
    return { claimed: false, remainingMs: remaining };
  }
  const reward = rollReward();
  playerData.cash      = (playerData.cash || 0) + reward.gold;
  playerData.gems      = (playerData.gems || 0) + reward.gems;
  playerData.hammers   = (playerData.hammers || 0) + reward.hammers;
  playerData.scrolls   = (playerData.scrolls || 0) + reward.scrolls;
  playerData.gold       = (playerData.gold || 0) + reward.gold;
  playerData.lastGiftClaimedTimestamp = Date.now();
  return { claimed: true, reward, remainingMs: REWARDS_COOLDOWN_MS };
}

module.exports = {
  REWARDS_COOLDOWN_MS,
  REWARD_POOL,
  canClaimReward,
  rollReward,
  claimReward,
};
