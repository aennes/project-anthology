import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { shortcutsList } from '../../utils/keyboardShortcuts';

interface ShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const ShortcutsModal: React.FC<ShortcutsModalProps> = ({ isOpen, onClose }) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100]"
            data-shortcuts-modal
            onClick={onClose}
          />
          
          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[101] flex items-center justify-center p-4 pointer-events-none"
          >
            <div 
              className="bg-f1-black border border-white/10 rounded-lg max-w-md w-full p-8 pointer-events-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-center mb-6">
                <h2 className="font-display text-4xl text-white tracking-wide">Keyboard Shortcuts</h2>
                <button
                  onClick={onClose}
                  className="font-mono text-xs uppercase tracking-widest text-gray-400 hover:text-white transition-colors focus:outline-none focus:ring-2 focus:ring-f1-red focus:ring-offset-2 focus:ring-offset-f1-black rounded px-2 py-1"
                  aria-label="Close shortcuts"
                >
                  ESC
                </button>
              </div>
              
              <div className="space-y-4">
                {shortcutsList.map((shortcut, index) => (
                  <motion.div
                    key={shortcut.key}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="flex justify-between items-center py-2 border-b border-white/5"
                  >
                    <span className="font-mono text-sm text-gray-400">{shortcut.description}</span>
                    <kbd className="font-mono text-xs px-3 py-1 bg-white/5 border border-white/10 rounded text-f1-red uppercase tracking-wider">
                      {shortcut.key}
                    </kbd>
                  </motion.div>
                ))}
              </div>
              
              <div className="mt-6 pt-6 border-t border-white/10">
                <p className="font-mono text-xs text-gray-500 text-center">
                  Press <kbd className="px-2 py-1 bg-white/5 border border-white/10 rounded text-f1-red">?</kbd> again to close
                </p>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default ShortcutsModal;
