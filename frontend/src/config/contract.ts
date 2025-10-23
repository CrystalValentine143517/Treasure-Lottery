export const CONTRACT_ADDRESS = '0x0Ea0F5f9512c05E60f41fdCF87CC0c572A1254eB' as `0x${string}`;

export const CONTRACT_ABI = [
  {
    type: 'function',
    name: 'answerQuestion',
    stateMutability: 'nonpayable',
    inputs: [
      { type: 'uint256', name: 'questionId' },
      { type: 'uint32', name: 'answer' },
    ],
    outputs: [{ type: 'bool', name: 'success' }],
  },
  {
    type: 'function',
    name: 'getPlayerProgress',
    stateMutability: 'view',
    inputs: [{ type: 'address', name: 'player' }],
    outputs: [
      { type: 'uint8', name: 'attemptsToday' },
      { type: 'uint8', name: 'remainingAttempts' },
      { type: 'uint256', name: 'totalSolved' },
      { type: 'uint64', name: 'totalRewards' },
      { type: 'uint256', name: 'timeUntilReset' },
    ],
  },
  {
    type: 'function',
    name: 'getQuestion',
    stateMutability: 'view',
    inputs: [{ type: 'uint256', name: 'questionId' }],
    outputs: [
      { type: 'string', name: 'questionText' },
      { type: 'uint64', name: 'reward' },
      { type: 'bool', name: 'isActive' },
      { type: 'bool', name: 'playerSolved' },
    ],
  },
  {
    type: 'function',
    name: 'getRandomQuestion',
    stateMutability: 'view',
    inputs: [{ type: 'address', name: 'player' }],
    outputs: [{ type: 'uint256', name: '' }],
  },
  {
    type: 'function',
    name: 'questionCount',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256', name: '' }],
  },
  {
    type: 'event',
    name: 'QuestionAttempted',
    inputs: [
      { type: 'address', name: 'player', indexed: true },
      { type: 'uint256', name: 'questionId', indexed: true },
      { type: 'bool', name: 'success', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'TreasureUnlocked',
    inputs: [
      { type: 'address', name: 'player', indexed: true },
      { type: 'uint256', name: 'questionId', indexed: true },
      { type: 'uint64', name: 'reward', indexed: false },
    ],
  },
  {
    type: 'error',
    name: 'DailyLimitReached',
    inputs: [
      { type: 'uint8', name: 'attemptsUsed' },
      { type: 'uint256', name: 'resetsIn' },
    ],
  },
  {
    type: 'error',
    name: 'AlreadySolved',
    inputs: [{ type: 'uint256', name: 'questionId' }],
  },
] as const;
