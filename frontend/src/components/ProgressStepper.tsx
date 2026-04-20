import React from 'react';
import { CheckCircle, Loader2 } from 'lucide-react';
import { motion } from 'motion/react';

interface ProgressStepperProps {
  currentStep: number;
  analysisType?: 'video' | 'audio' | 'text';
}

export function ProgressStepper({ currentStep, analysisType = 'video' }: ProgressStepperProps) {
  const stepsByType: Record<'video' | 'audio' | 'text', { id: number; label: string; icon: string }[]> = {
    video: [
      { id: 1, label: 'Audio Extraction',      icon: '🔊' },
      { id: 2, label: 'Speech Recognition',    icon: '🎤' },
      { id: 3, label: 'Feature Extraction',    icon: '🧬' },
      { id: 4, label: 'Sentiment Prediction',  icon: '🎯' },
    ],
    audio: [
      { id: 1, label: 'Audio Processing',      icon: '🎵' },
      { id: 2, label: 'Speech Recognition',    icon: '🎤' },
      { id: 3, label: 'MFCC Feature Extraction', icon: '🧬' },
      { id: 4, label: 'Sentiment Prediction',  icon: '🎯' },
    ],
    text: [
      { id: 1, label: 'Text Tokenisation',     icon: '📝' },
      { id: 2, label: 'Embedding Generation',  icon: '🔢' },
      { id: 3, label: 'Feature Extraction',    icon: '🧬' },
      { id: 4, label: 'Sentiment Prediction',  icon: '🎯' },
    ],
  };

  const steps = stepsByType[analysisType];

  return (
    <div className="space-y-6">
      {steps.map((step, index) => {
        const isCompleted = currentStep > step.id;
        const isCurrent = currentStep === step.id;

        return (
          <motion.div
            key={step.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.1 }}
            className="relative"
          >
            <div className="flex items-center gap-4">
              {/* Step Indicator */}
              <motion.div
                animate={{
                  scale: isCurrent ? [1, 1.1, 1] : 1,
                }}
                transition={{
                  duration: 1,
                  repeat: isCurrent ? Infinity : 0,
                  ease: 'easeInOut',
                }}
                className={`relative w-16 h-16 rounded-xl flex items-center justify-center ${
                  isCompleted
                    ? 'bg-green-500 text-white shadow-lg shadow-green-500/50'
                    : isCurrent
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/50'
                    : 'bg-white/5 text-gray-500 border border-white/10'
                }`}
              >
                {isCompleted ? (
                  <motion.div
                    initial={{ scale: 0, rotate: -180 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: 'spring', stiffness: 200, damping: 15 }}
                  >
                    <CheckCircle className="w-7 h-7 sm:w-8 sm:h-8" />
                  </motion.div>
                ) : isCurrent ? (
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                  >
                    <Loader2 className="w-7 h-7 sm:w-8 sm:h-8" />
                  </motion.div>
                ) : (
                  <span className="text-2xl sm:text-3xl">{step.icon}</span>
                )}
              </motion.div>

              {/* Step Info */}
              <div className="flex-1">
                <h3
                  className={`font-semibold text-base sm:text-lg ${
                    isCompleted || isCurrent ? 'text-white' : 'text-gray-500'
                  }`}
                >
                  {step.label}
                </h3>
                <p className="text-sm text-gray-400">
                  {isCompleted
                    ? 'Completed'
                    : isCurrent
                    ? 'In progress...'
                    : 'Pending'}
                </p>
              </div>

              {/* Shimmer progress bar for current step */}
              {isCurrent && (
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: '100px' }}
                  className="h-2 bg-white/10 rounded-full overflow-hidden"
                >
                  <motion.div
                    animate={{ x: ['-100%', '200%'] }}
                    transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
                    className="h-full w-1/3 bg-gradient-to-r from-blue-400 to-purple-600"
                  />
                </motion.div>
              )}
            </div>

            {/* Connecting Line */}
            {index < steps.length - 1 && (
              <div className="absolute left-8 top-16 w-0.5 h-8 bg-white/10">
                {isCompleted && (
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: '100%' }}
                    transition={{ duration: 0.3 }}
                    className="w-full bg-green-500"
                  />
                )}
              </div>
            )}
          </motion.div>
        );
      })}
    </div>
  );
}