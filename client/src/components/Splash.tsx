import { motion } from 'motion/react';
import { Logo } from './Logo';

export function Splash() {
  return (
    <div className="grid min-h-dvh place-items-center bg-ink">
      <motion.div
        initial={{ opacity: 0, scale: 0.94 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      >
        <Logo className="text-[28px]" />
      </motion.div>
    </div>
  );
}
