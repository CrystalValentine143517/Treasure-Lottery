import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import chestClosedOriginal from '@/assets/chest-closed.png';
import chestOpenOriginal from '@/assets/chest-open.png';
import particles from '@/assets/particles.png';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useWatchContractEvent, useReadContract, usePublicClient } from 'wagmi';
import { transactionToast, toast } from '@/lib/transactionToast';
import { CONTRACT_ADDRESS, CONTRACT_ABI } from '@/config/contract';
import { requestDecryptionWithRetry, initializeFHE, encryptAnswer, isFHEReady, waitForFHE } from '@/lib/fhe';
import { decodeEventLog } from 'viem';

interface TreasureChestProps {
  onOpen: (reward: string) => void;
}

type GamePhase = 'idle' | 'encrypting' | 'submitting' | 'confirming' | 'decrypting' | 'claiming' | 'completed';

export const TreasureChest = ({ onOpen }: TreasureChestProps) => {
  const [phase, setPhase] = useState<GamePhase>('idle');
  const [isOpened, setIsOpened] = useState(false);
  const [lastReward, setLastReward] = useState<number | null>(null);
  const [answer, setAnswer] = useState('');
  const [currentQuestionId, setCurrentQuestionId] = useState<bigint>(0n);
  const [questionText, setQuestionText] = useState('');
  const [pendingAnswerId, setPendingAnswerId] = useState<bigint | null>(null);
  const [resultHandle, setResultHandle] = useState<`0x${string}` | null>(null);
  const { address, isConnected } = useAccount();
  const pendingToastShown = useRef(false);
  const publicClient = usePublicClient();

  // Contract interactions
  const { writeContract, data: hash } = useWriteContract();
  const { writeContract: claimWrite, data: claimHash } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed, isError: isTxError, error: txError } = useWaitForTransactionReceipt({ hash });
  const { isLoading: isClaimConfirming, isSuccess: isClaimConfirmed, isError: isClaimError } = useWaitForTransactionReceipt({ hash: claimHash });

  // Read player progress
  const { data: playerProgress, refetch: refetchProgress } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
    functionName: 'getPlayerProgress',
    args: address ? [address] : undefined,
  });

  // Get random question
  const { data: randomQuestionId, refetch: refetchRandomQuestion } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
    functionName: 'getRandomQuestion',
    args: address ? [address] : undefined,
  });

  // Get current question details
  const { data: questionData } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
    functionName: 'getQuestion',
    args: [currentQuestionId],
  });

  // Watch for treasure unlocked event (from claimResult)
  useWatchContractEvent({
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
    eventName: 'TreasureUnlocked',
    onLogs(logs) {
      console.log('TreasureUnlocked event received');
      for (const log of logs) {
        if (log.args.player?.toLowerCase() === address?.toLowerCase()) {
          const reward = Number(log.args.reward);
          console.log('Treasure unlocked with reward:', reward);
          setLastReward(reward);
          setIsOpened(true);
          setPhase('completed');
          onOpen(`${reward} Coins`);

          if (claimHash) {
            transactionToast.success(claimHash, `Correct! You won ${reward} Coins!`);
          } else {
            toast.success(`Correct! You won ${reward} Coins!`);
          }

          refetchProgress();
          setAnswer('');
          pendingToastShown.current = false;
        }
      }
    },
  });

  // Watch for wrong answer event
  useWatchContractEvent({
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
    eventName: 'AnswerWrong',
    onLogs(logs) {
      for (const log of logs) {
        if (log.args.player?.toLowerCase() === address?.toLowerCase()) {
          console.log('Wrong answer detected');
          setPhase('idle');
          if (claimHash) {
            transactionToast.error(claimHash, 'Wrong answer', 'Try again with a different answer');
          } else {
            toast.error('Wrong answer', 'Try again with a different answer');
          }
          setAnswer('');
          refetchProgress();
          pendingToastShown.current = false;
        }
      }
    },
  });

  // Show pending toast when hash is received
  useEffect(() => {
    if (hash && !pendingToastShown.current && phase === 'submitting') {
      pendingToastShown.current = true;
      setPhase('confirming');
      transactionToast.pending(hash, 'Answer submitted - Encrypting comparison...');
    }
  }, [hash, phase]);

  // Handle transaction error
  useEffect(() => {
    if (isTxError && hash) {
      transactionToast.error(
        hash,
        'Transaction failed',
        txError?.message || 'The transaction was reverted'
      );
      setPhase('idle');
      setAnswer('');
      pendingToastShown.current = false;
    }
  }, [isTxError, hash, txError]);

  // Update question when randomQuestionId changes
  useEffect(() => {
    if (randomQuestionId !== undefined) {
      setCurrentQuestionId(randomQuestionId as bigint);
    }
  }, [randomQuestionId]);

  // Update question text when questionData changes
  useEffect(() => {
    if (questionData && Array.isArray(questionData)) {
      setQuestionText(questionData[0] as string);
    }
  }, [questionData]);

  // Handle transaction confirmation - start FHE decryption process
  useEffect(() => {
    if (isConfirmed && hash && phase === 'confirming') {
      console.log('Transaction confirmed, starting FHE decryption...');
      setPhase('decrypting');

      // Parse the AnswerSubmitted event from transaction receipt
      const processDecryption = async () => {
        try {
          // Get transaction receipt to extract event data
          const receipt = await publicClient?.getTransactionReceipt({ hash });
          if (!receipt) {
            throw new Error('Failed to get transaction receipt');
          }

          // Find AnswerSubmitted event
          for (const log of receipt.logs) {
            try {
              const decoded = decodeEventLog({
                abi: CONTRACT_ABI,
                data: log.data,
                topics: log.topics,
              });

              if (decoded.eventName === 'AnswerSubmitted') {
                const pendingId = decoded.args.pendingAnswerId as bigint;
                const handle = decoded.args.encryptedResultHandle as `0x${string}`;

                console.log('AnswerSubmitted event found:', {
                  pendingAnswerId: pendingId.toString(),
                  encryptedResultHandle: handle
                });

                setPendingAnswerId(pendingId);
                setResultHandle(handle);

                // Update toast
                transactionToast.success(hash, 'FHE comparison complete. Requesting decryption...');

                // Request decryption from KMS
                toast.loading('Requesting FHE decryption from KMS...');

                try {
                  await initializeFHE();
                  const { decryptedResult, decryptionProof } = await requestDecryptionWithRetry(handle, 15, 3000);

                  console.log('Decryption result:', decryptedResult);
                  toast.dismiss();

                  // Now claim the result on-chain
                  setPhase('claiming');
                  toast.loading('Claiming result on-chain...');

                  await claimWrite({
                    address: CONTRACT_ADDRESS,
                    abi: CONTRACT_ABI,
                    functionName: 'claimResult',
                    args: [pendingId, decryptedResult, decryptionProof],
                  });
                } catch (decryptError: any) {
                  console.error('Decryption failed:', decryptError);
                  toast.dismiss();
                  toast.error('FHE decryption failed', decryptError?.message || 'Please try again');
                  setPhase('idle');
                }
                return;
              }
            } catch {
              // Not the event we're looking for
            }
          }

          throw new Error('AnswerSubmitted event not found');
        } catch (error: any) {
          console.error('Error processing decryption:', error);
          toast.error('Failed to process answer', error?.message);
          setPhase('idle');
        }
      };

      processDecryption();
    }
  }, [isConfirmed, hash, phase, publicClient, claimWrite]);

  // Handle claim transaction confirmation
  useEffect(() => {
    if (isClaimConfirmed && claimHash) {
      console.log('Claim transaction confirmed');
      toast.dismiss();
      // The TreasureUnlocked or AnswerWrong event will handle the final state
    }
  }, [isClaimConfirmed, claimHash]);

  // Handle claim error
  useEffect(() => {
    if (isClaimError && claimHash) {
      toast.dismiss();
      toast.error('Claim failed', 'Invalid decryption proof or already processed');
      setPhase('idle');
    }
  }, [isClaimError, claimHash]);

  const handleSubmitAnswer = async () => {
    if (!isConnected || !address) {
      toast.error('Please connect your wallet first!');
      return;
    }

    if (!answer.trim()) {
      toast.error('Please enter an answer!');
      return;
    }

    const numAnswer = parseInt(answer);
    if (isNaN(numAnswer)) {
      toast.error('Please enter a valid number!');
      return;
    }

    try {
      // Phase 1: Encrypt the answer using FHE SDK
      setPhase('encrypting');
      pendingToastShown.current = false;

      console.log('Starting FHE encryption for answer:', {
        questionId: currentQuestionId.toString(),
        answer: numAnswer,
        questionText: questionText
      });

      // Wait for FHE SDK to be loaded
      if (!isFHEReady()) {
        toast.loading('Loading FHE SDK...');
        const ready = await waitForFHE(10000);
        toast.dismiss();
        if (!ready) {
          throw new Error('FHE SDK failed to load. Please refresh the page.');
        }
      }

      // Initialize FHE and encrypt the answer
      toast.loading('Encrypting answer with FHE...');
      await initializeFHE();
      const { handle, proof } = await encryptAnswer(address, numAnswer);
      toast.dismiss();

      console.log('FHE encryption complete:', {
        handle,
        proofLength: proof.length
      });

      // Phase 2: Submit the encrypted answer to the contract
      setPhase('submitting');
      toast.info('Submitting encrypted answer...');

      await writeContract({
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: 'submitEncryptedAnswer',
        args: [currentQuestionId, handle, proof],
      });

    } catch (error: any) {
      console.error('Error submitting answer:', error);
      setPhase('idle');
      pendingToastShown.current = false;
      toast.dismiss();

      if (error?.message?.includes('DailyLimitReached')) {
        toast.error('Daily limit reached!', 'Come back tomorrow');
      } else if (error?.message?.includes('AlreadySolved')) {
        toast.error('Already solved!', 'You already solved this question');
      } else if (error?.message?.includes('User rejected')) {
        toast.error('Transaction rejected', 'You cancelled the transaction');
      } else if (error?.message?.includes('FHE SDK')) {
        toast.error('FHE Error', error?.message || 'Failed to encrypt answer');
      } else {
        toast.error('Transaction failed', error?.shortMessage || error?.message || 'Please try again');
      }
    }
  };

  const handleReset = () => {
    setPhase('idle');
    setIsOpened(false);
    setLastReward(null);
    setAnswer('');
    setPendingAnswerId(null);
    setResultHandle(null);
    refetchProgress();
    refetchRandomQuestion();
  };

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours}h ${minutes}m ${secs}s`;
  };

  const isProcessing = phase !== 'idle' && phase !== 'completed';
  const remainingAttempts = playerProgress && Array.isArray(playerProgress) ? Number(playerProgress[1]) : 3;
  const totalSolved = playerProgress && Array.isArray(playerProgress) ? Number(playerProgress[2]) : 0;
  const totalRewards = playerProgress && Array.isArray(playerProgress) ? Number(playerProgress[3]) : 0;
  const timeUntilReset = playerProgress && Array.isArray(playerProgress) ? Number(playerProgress[4]) : 0;

  const getPhaseText = () => {
    switch (phase) {
      case 'encrypting': return 'Encrypting with FHE...';
      case 'submitting': return 'Submitting...';
      case 'confirming': return 'Confirming...';
      case 'decrypting': return 'Decrypting FHE...';
      case 'claiming': return 'Claiming result...';
      default: return 'Submit Answer';
    }
  };

  return (
    <div className="relative flex flex-col items-center justify-center gap-8 min-h-[600px]">
      <AnimatePresence>
        {isOpened && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.6 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 pointer-events-none"
            style={{
              backgroundImage: `url(${particles})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              mixBlendMode: 'screen',
            }}
          />
        )}
      </AnimatePresence>

      <motion.div
        className="relative"
        animate={!isProcessing ? { y: [0, -20, 0] } : {}}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
      >
        <AnimatePresence mode="wait">
          {!isOpened ? (
            <motion.img
              key="closed"
              src={chestClosedOriginal}
              alt="Treasure Chest"
              className="w-[400px] h-[400px] object-contain drop-shadow-2xl"
              initial={{ scale: 1 }}
              animate={isProcessing ? {
                scale: [1, 1.1, 1],
                rotate: [0, -5, 5, -5, 0]
              } : { scale: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ duration: 1.5 }}
              style={{
                filter: isProcessing
                  ? 'brightness(1.3) drop-shadow(0 0 30px hsl(var(--gold)))'
                  : 'drop-shadow(0 0 20px rgba(0,0,0,0.3))',
              }}
            />
          ) : (
            <motion.img
              key="open"
              src={chestOpenOriginal}
              alt="Opened Treasure Chest"
              className="w-[400px] h-[400px] object-contain"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.5 }}
              style={{
                filter: 'brightness(1.2) drop-shadow(0 0 40px hsl(var(--gold)))',
              }}
            />
          )}
        </AnimatePresence>

        {!isProcessing && !isOpened && (
          <motion.div
            className="absolute -inset-4"
            animate={{
              boxShadow: [
                '0 0 20px hsl(var(--gold) / 0.3)',
                '0 0 40px hsl(var(--gold) / 0.5)',
                '0 0 20px hsl(var(--gold) / 0.3)',
              ],
            }}
            transition={{ duration: 2, repeat: Infinity }}
            style={{ borderRadius: '50%' }}
          />
        )}
      </motion.div>

      <div className="flex flex-col items-center gap-4 w-full max-w-md">
        {!isOpened ? (
          <>
            {isConnected && questionText && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center mb-4 p-6 bg-card/50 backdrop-blur-sm rounded-xl border border-border"
              >
                <p className="text-lg font-medium text-foreground mb-2">🔐 FHE Encrypted Challenge</p>
                <p className="text-2xl font-bold text-[hsl(var(--gold))]">{questionText}</p>
                {phase === 'decrypting' && (
                  <p className="text-sm text-blue-400 mt-2 animate-pulse">
                    Requesting decryption from Zama KMS...
                  </p>
                )}
              </motion.div>
            )}

            {isConnected && remainingAttempts > 0 ? (
              <div className="flex flex-col gap-3 w-full">
                <Input
                  type="number"
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  placeholder="Enter your answer (number)"
                  disabled={isProcessing}
                  className="text-lg text-center h-14 bg-background/50 backdrop-blur-sm border-[hsl(var(--gold))]/30 focus:border-[hsl(var(--gold))]"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !isProcessing) {
                      handleSubmitAnswer();
                    }
                  }}
                />
                <Button
                  onClick={handleSubmitAnswer}
                  disabled={isProcessing || !answer.trim()}
                  size="lg"
                  className="relative px-12 py-6 text-xl font-bold bg-gradient-to-r from-[hsl(var(--gold))] to-[hsl(var(--gold-dark))] hover:from-[hsl(var(--gold-dark))] hover:to-[hsl(var(--gold))] text-[hsl(var(--background))] rounded-2xl shadow-[0_0_30px_hsl(var(--gold)/0.5)] hover:shadow-[0_0_50px_hsl(var(--gold)/0.8)] transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isProcessing ? (
                    <span className="flex items-center gap-2">
                      <span className="animate-spin">⚡</span>
                      {getPhaseText()}
                    </span>
                  ) : (
                    'Submit Answer'
                  )}
                </Button>
              </div>
            ) : isConnected ? (
              <div className="text-center p-6 bg-card/50 backdrop-blur-sm rounded-xl border border-border">
                <p className="text-lg font-medium text-red-400 mb-2">Daily Limit Reached!</p>
                <p className="text-sm text-muted-foreground">
                  Reset in: {formatTime(timeUntilReset)}
                </p>
              </div>
            ) : null}
          </>
        ) : (
          <Button
            onClick={handleReset}
            size="lg"
            className="px-12 py-6 text-xl font-bold bg-gradient-to-r from-[hsl(var(--primary))] to-[hsl(var(--accent))] hover:from-[hsl(var(--accent))] hover:to-[hsl(var(--primary))] text-foreground rounded-2xl shadow-[0_0_30px_hsl(var(--primary)/0.5)] transition-all duration-300"
          >
            Try Another Question
          </Button>
        )}

        {!isConnected && !isProcessing && (
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-sm text-muted-foreground mt-2"
          >
            Connect your wallet to start answering questions
          </motion.p>
        )}

        {isConnected && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mt-4 space-y-1"
          >
            <p className="text-sm text-muted-foreground">
              Attempts Remaining Today: <span className="text-[hsl(var(--gold))] font-bold">{remainingAttempts}/3</span>
            </p>
            <p className="text-sm text-muted-foreground">
              Total Solved: {totalSolved} | Total Rewards: {totalRewards} Coins
            </p>
          </motion.div>
        )}
      </div>
    </div>
  );
};
