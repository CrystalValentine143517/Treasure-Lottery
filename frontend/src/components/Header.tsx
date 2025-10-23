import { ConnectButton } from '@rainbow-me/rainbowkit';
import { motion } from 'framer-motion';
import chestLogo from '@/assets/chest-closed.png';

export const Header = () => {
  return (
    <motion.header
      className="fixed top-0 left-0 right-0 z-50 px-6 py-4"
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <motion.div
          className="flex items-center gap-3"
          whileHover={{ scale: 1.05 }}
        >
          <img src={chestLogo} alt="Treasure Chest" className="w-10 h-10 object-contain" />
          <h1 className="text-2xl font-bold bg-gradient-to-r from-[hsl(var(--gold))] to-[hsl(var(--primary-glow))] bg-clip-text text-transparent">
            Encrypted Treasure Dive
          </h1>
        </motion.div>
        
        <div className="flex items-center gap-4">
          <ConnectButton 
            showBalance={false}
            chainStatus="icon"
          />
        </div>
      </div>
    </motion.header>
  );
};
