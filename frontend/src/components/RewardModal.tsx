import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';

interface RewardModalProps {
  isOpen: boolean;
  onClose: () => void;
  reward: string;
}

export const RewardModal = ({ isOpen, onClose, reward }: RewardModalProps) => {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md bg-card border-2 border-[hsl(var(--gold))] shadow-[0_0_50px_hsl(var(--gold)/0.5)]">
        <DialogHeader>
          <DialogTitle className="text-center text-2xl font-bold bg-gradient-to-r from-[hsl(var(--gold))] to-[hsl(var(--primary-glow))] bg-clip-text text-transparent">
            🎉 Congratulations!
          </DialogTitle>
        </DialogHeader>
        
        <motion.div
          className="flex flex-col items-center gap-6 py-8"
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ 
            type: "spring",
            stiffness: 260,
            damping: 20 
          }}
        >
          <motion.div
            className="text-6xl"
            animate={{ 
              rotate: [0, -10, 10, -10, 0],
              scale: [1, 1.2, 1] 
            }}
            transition={{ 
              duration: 0.5,
              repeat: Infinity,
              repeatDelay: 1
            }}
          >
            ✨
          </motion.div>
          
          <div className="text-center space-y-2">
            <h3 className="text-xl font-semibold text-foreground">
              You won:
            </h3>
            <motion.p 
              className="text-3xl font-bold text-gold glow-gold"
              animate={{ scale: [1, 1.05, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              {reward}
            </motion.p>
          </div>

          <div className="flex gap-3 mt-4">
            <Button
              onClick={onClose}
              className="bg-gradient-to-r from-[hsl(var(--gold))] to-[hsl(var(--gold-dark))] hover:from-[hsl(var(--gold-dark))] hover:to-[hsl(var(--gold))] text-[hsl(var(--background))] font-bold"
            >
              Claim Reward
            </Button>
          </div>
        </motion.div>
      </DialogContent>
    </Dialog>
  );
};
