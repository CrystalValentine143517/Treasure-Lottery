export const CONTRACT_ADDRESS = '0x8B4C4682EE9832FFeFAc0d38b2422A8Fa6a4115d' as `0x${string}`;

export const CONTRACT_ABI = [
  // === FUNCTIONS ===
  {
    type: 'function',
    name: 'answerQuestion',
    stateMutability: 'nonpayable',
    inputs: [
      { type: 'uint256', name: 'questionId' },
      { type: 'uint32', name: 'answer' },
    ],
    outputs: [{ type: 'uint256', name: 'pendingAnswerId' }],
  },
  {
    type: 'function',
    name: 'submitEncryptedAnswer',
    stateMutability: 'nonpayable',
    inputs: [
      { type: 'uint256', name: 'questionId' },
      { type: 'bytes32', name: 'encryptedAnswer' },
      { type: 'bytes', name: 'inputProof' },
    ],
    outputs: [{ type: 'uint256', name: 'pendingAnswerId' }],
  },
  {
    type: 'function',
    name: 'claimResult',
    stateMutability: 'nonpayable',
    inputs: [
      { type: 'uint256', name: 'pendingAnswerId' },
      { type: 'bool', name: 'decryptedResult' },
      { type: 'bytes', name: 'decryptionProof' },
    ],
    outputs: [],
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
    type: 'function',
    name: 'getPendingAnswer',
    stateMutability: 'view',
    inputs: [{ type: 'uint256', name: 'pendingAnswerId' }],
    outputs: [
      { type: 'address', name: 'player' },
      { type: 'uint256', name: 'questionId' },
      { type: 'bytes32', name: 'resultHandle' },
      { type: 'uint256', name: 'timestamp' },
      { type: 'bool', name: 'processed' },
    ],
  },
  {
    type: 'function',
    name: 'getPlayerLatestPending',
    stateMutability: 'view',
    inputs: [{ type: 'address', name: 'player' }],
    outputs: [
      { type: 'uint256', name: 'pendingAnswerId' },
      { type: 'bool', name: 'hasPending' },
    ],
  },
  {
    type: 'function',
    name: 'pendingAnswerCount',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256', name: '' }],
  },
  // === EVENTS ===
  {
    type: 'event',
    name: 'QuestionCreated',
    inputs: [
      { type: 'uint256', name: 'questionId', indexed: true },
      { type: 'string', name: 'questionText', indexed: false },
      { type: 'uint64', name: 'reward', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'AnswerSubmitted',
    inputs: [
      { type: 'address', name: 'player', indexed: true },
      { type: 'uint256', name: 'questionId', indexed: true },
      { type: 'uint256', name: 'pendingAnswerId', indexed: false },
      { type: 'bytes32', name: 'encryptedResultHandle', indexed: false },
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
    type: 'event',
    name: 'AnswerWrong',
    inputs: [
      { type: 'address', name: 'player', indexed: true },
      { type: 'uint256', name: 'questionId', indexed: true },
    ],
  },
  {
    type: 'event',
    name: 'DailyLimitReset',
    inputs: [
      { type: 'address', name: 'player', indexed: true },
      { type: 'uint256', name: 'newDay', indexed: false },
    ],
  },
  // === ERRORS ===
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
  {
    type: 'error',
    name: 'QuestionNotActive',
    inputs: [{ type: 'uint256', name: 'questionId' }],
  },
  {
    type: 'error',
    name: 'InvalidQuestionId',
    inputs: [],
  },
  {
    type: 'error',
    name: 'NoPendingAnswer',
    inputs: [],
  },
  {
    type: 'error',
    name: 'AnswerAlreadyProcessed',
    inputs: [],
  },
  {
    type: 'error',
    name: 'InvalidDecryptionProof',
    inputs: [],
  },
] as const;
