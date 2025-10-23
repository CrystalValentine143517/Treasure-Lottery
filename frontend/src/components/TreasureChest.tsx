import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import chestClosedOriginal from '@/assets/chest-closed.png';
import chestOpenOriginal from '@/assets/chest-open.png';
import particles from '@/assets/particles.png';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useWatchContractEvent, useReadContract } from 'wagmi';
import { toast } from 'sonner';
import { CONTRACT_ADDRESS, CONTRACT_ABI } from '@/config/contract';

interface TreasureChestProps {
  onOpen: (reward: string) => void;
}

export const TreasureChest = ({ onOpen }: TreasureChestProps) => {
  const [isOpening, setIsOpening] = useState(false);
  const [isOpened, setIsOpened] = useState(false);
  const [lastReward, setLastReward] = useState<number | null>(null);
  const [answer, setAnswer] = useState('');
  const [currentQuestionId, setCurrentQuestionId] = useState<bigint>(0n);
  const [questionText, setQuestionText] = useState('');
  const { address, isConnected } = useAccount();

  // Contract interactions
  const { writeContract, data: hash } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash });

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

  // Watch for treasure unlocked event
  useWatchContractEvent({
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
    eventName: 'TreasureUnlocked',
    onLogs(logs) {
      for (const log of logs) {
        if (log.args.player?.toLowerCase() === address?.toLowerCase()) {
          const reward = Number(log.args.reward);
          setLastReward(reward);
          setIsOpened(true);
          onOpen(`${reward} Coins`);
          toast.success(`🎉 Correct! You won ${reward} Coins!`);
          refetchProgress();
          setIsOpening(false);
          setAnswer('');
        }
      }
    },
  });

  // Watch for failed attempts
  useWatchContractEvent({
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
    eventName: 'QuestionAttempted',
    onLogs(logs) {
      for (const log of logs) {
        if (log.args.player?.toLowerCase() === address?.toLowerCase()) {
          if (!log.args.success) {
            toast.error('❌ Wrong answer! Try again.');
            setIsOpening(false);
            refetchProgress();
            setAnswer('');
          }
        }
      }
    },
  });

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

  // Handle transaction confirmation timeout fallback
  useEffect(() => {
    if (isConfirmed) {
      // Wait a bit for events, then check if we need to reset manually
      const timeout = setTimeout(() => {
        if (isOpening) {
          // If still opening after confirmation, it means answer was wrong
          toast.error('❌ Wrong answer! Try again.');
          setIsOpening(false);
          refetchProgress();
          setAnswer('');
        }
      }, 3000);

      return () => clearTimeout(timeout);
    }
  }, [isConfirmed, isOpening]);

  const handleSubmitAnswer = async () => {
    if (!isConnected) {
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
      setIsOpening(true);
      
      await writeContract({
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: 'answerQuestion',
        args: [currentQuestionId, numAnswer],
      });

      toast.info('Submitting your answer...');
    } catch (error: any) {
      console.error('Error submitting answer:', error);
      setIsOpening(false);
      
      if (error?.message?.includes('DailyLimitReached')) {
        toast.error('Daily limit reached! Come back tomorrow.');
      } else if (error?.message?.includes('AlreadySolved')) {
        toast.error('You already solved this question!');
      } else {
        toast.error(error?.message || 'Failed to submit answer');
      }
    }
  };

  const handleReset = () => {
    setIsOpening(false);
    setIsOpened(false);
    setLastReward(null);
    setAnswer('');
    refetchProgress();
    refetchRandomQuestion();
  };

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours}h ${minutes}m ${secs}s`;
  };

  const remainingAttempts = playerProgress && Array.isArray(playerProgress) ? Number(playerProgress[1]) : 3;
  const totalSolved = playerProgress && Array.isArray(playerProgress) ? Number(playerProgress[2]) : 0;
  const totalRewards = playerProgress && Array.isArray(playerProgress) ? Number(playerProgress[3]) : 0;
  const timeUntilReset = playerProgress && Array.isArray(playerProgress) ? Number(playerProgress[4]) : 0;

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
        animate={!isOpening ? { y: [0, -20, 0] } : {}}
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
              animate={isOpening ? {
                scale: [1, 1.1, 1],
                rotate: [0, -5, 5, -5, 0]
              } : { scale: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ duration: 1.5 }}
              style={{
                filter: isOpening
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

        {!isOpening && !isOpened && (
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
              </motion.div>
            )}

            {isConnected && remainingAttempts > 0 ? (
              <div className="flex flex-col gap-3 w-full">
                <Input
                  type="number"
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  placeholder="Enter your answer (number)"
                  disabled={isOpening || isConfirming}
                  className="text-lg text-center h-14 bg-background/50 backdrop-blur-sm border-[hsl(var(--gold))]/30 focus:border-[hsl(var(--gold))]"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleSubmitAnswer();
                    }
                  }}
                />
                <Button
                  onClick={handleSubmitAnswer}
                  disabled={isOpening || isConfirming || !answer.trim()}
                  size="lg"
                  className="relative px-12 py-6 text-xl font-bold bg-gradient-to-r from-[hsl(var(--gold))] to-[hsl(var(--gold-dark))] hover:from-[hsl(var(--gold-dark))] hover:to-[hsl(var(--gold))] text-[hsl(var(--background))] rounded-2xl shadow-[0_0_30px_hsl(var(--gold)/0.5)] hover:shadow-[0_0_50px_hsl(var(--gold)/0.8)] transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isOpening || isConfirming ? (
                    <span className="flex items-center gap-2">
                      <span className="animate-spin">⚡</span>
                      {isConfirming ? 'Confirming...' : 'Checking...'}
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

        {!isConnected && !isOpening && (
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
