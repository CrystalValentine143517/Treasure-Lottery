import { useState } from 'react';
import { Header } from '@/components/Header';
import { TreasureChest } from '@/components/TreasureChest';
import { RewardModal } from '@/components/RewardModal';
import { motion } from 'framer-motion';

const Index = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentReward, setCurrentReward] = useState('');

  const handleChestOpen = (reward: string) => {
    setCurrentReward(reward);
    setIsModalOpen(true);
  };

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Animated Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div
          className="absolute w-96 h-96 rounded-full bg-[hsl(var(--primary))] opacity-20 blur-[100px]"
          animate={{
            x: [0, 100, 0],
            y: [0, 50, 0],
          }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
          style={{ top: '10%', left: '10%' }}
        />
        <motion.div
          className="absolute w-96 h-96 rounded-full bg-[hsl(var(--gold))] opacity-20 blur-[100px]"
          animate={{
            x: [0, -100, 0],
            y: [0, -50, 0],
          }}
          transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
          style={{ bottom: '10%', right: '10%' }}
        />
      </div>

      <Header />

      <main className="relative z-10 pt-28 px-6">
        <div className="max-w-7xl mx-auto">
          <motion.div
            className="text-center mb-12"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <h2 className="text-5xl md:text-6xl font-bold mb-4 bg-gradient-to-r from-[hsl(var(--gold))] via-[hsl(var(--primary-glow))] to-[hsl(var(--accent))] bg-clip-text text-transparent">
              Open Your Treasure
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Connect your wallet and open magical treasure chests to win amazing rewards!
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <TreasureChest onOpen={handleChestOpen} />
          </motion.div>

          {/* Features Section */}
          <motion.div
            className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-20 mb-12"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
          >
            {[
              {
                icon: '🎰',
                title: 'Provably Fair',
                description: 'On-chain randomness ensures fair gameplay'
              },
              {
                icon: '💎',
                title: 'Rare Rewards',
                description: 'Win exclusive NFTs and tokens'
              },
              {
                icon: '⚡',
                title: 'Instant Claim',
                description: 'Claim your rewards immediately'
              }
            ].map((feature, index) => (
              <motion.div
                key={index}
                className="bg-card/50 backdrop-blur-sm rounded-2xl p-6 border border-border hover:border-[hsl(var(--gold))] transition-all duration-300"
                whileHover={{ scale: 1.05, y: -5 }}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.5 + index * 0.1 }}
              >
                <div className="text-4xl mb-4">{feature.icon}</div>
                <h3 className="text-xl font-bold mb-2 text-foreground">{feature.title}</h3>
                <p className="text-muted-foreground">{feature.description}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </main>

      <RewardModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        reward={currentReward}
      />
    </div>
  );
};

export default Index;
