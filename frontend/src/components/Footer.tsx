import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Github, ArrowUp } from 'lucide-react';

export function Footer() {
  const currentYear = new Date().getFullYear();
  const [showBackToTop, setShowBackToTop] = useState(false);

  useEffect(() => {
    const onScroll = () => setShowBackToTop(window.scrollY > 400);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const scrollToTop = () => window.scrollTo({ top: 0, behavior: 'smooth' });

  const techStack = ['React 18', 'FastAPI', 'TensorFlow', 'HuggingFace', 'TypeScript'];

  return (
    <footer className="relative z-10 border-t border-white/10 backdrop-blur-sm bg-gray-900/50 mt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-4">

        {/* Tech stack pills */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-wrap items-center justify-center gap-2"
        >
          <span className="text-xs text-gray-500 mr-1">Built with</span>
          {techStack.map((tech) => (
            <span
              key={tech}
              className="px-2.5 py-1 text-xs font-medium rounded-full bg-white/5 border border-white/10 text-gray-400"
            >
              {tech}
            </span>
          ))}
        </motion.div>

        {/* Bottom row */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="flex flex-col sm:flex-row items-center justify-between gap-3 text-xs sm:text-sm text-gray-400"
        >
          <p>
            © {currentYear}{' '}
            <span className="text-blue-400 font-semibold">TriSenti AI</span>
            {' '}·{' '}
            Developed by{' '}
            <span className="text-purple-400 font-semibold">Shashank</span>
            {' '}· All Rights Reserved
          </p>

          <a
            href="https://github.com/shashankpc7746/Multimodal-Sentiment-Analysis-by-Shashank"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-gray-400 hover:text-white transition-colors group"
          >
            <Github className="w-4 h-4 group-hover:scale-110 transition-transform" />
            <span>View on GitHub</span>
          </a>
        </motion.div>
      </div>

      {/* Back-to-top button */}
      <AnimatePresence>
        {showBackToTop && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 10 }}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={scrollToTop}
            className="fixed bottom-6 right-6 z-50 w-11 h-11 bg-blue-600/90 hover:bg-blue-500 backdrop-blur-sm rounded-full flex items-center justify-center shadow-lg shadow-blue-500/40 transition-colors"
            title="Back to top"
          >
            <ArrowUp className="w-5 h-5 text-white" />
          </motion.button>
        )}
      </AnimatePresence>
    </footer>
  );
}