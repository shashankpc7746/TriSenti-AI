import React, { useState } from 'react';
import { TrendingUp, ChevronDown, Brain, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import type { ModelEngine } from '../App';

interface SentimentResultProps {
  sentiment: {
    label: string;
    confidence: number;
    probabilities?: Record<string, number>;
    emotions: {
      video: { emotion: string; score: number };
      audio: { emotion: string; score: number };
      text: { emotion: string; score: number };
    };
    transcript?: string;
  };
  engine?: ModelEngine;
}

export function SentimentResult({ sentiment, engine }: SentimentResultProps) {
  const [showDetails, setShowDetails] = useState(false);

  const getEmoji = (label: string) => {
    const emojiMap: { [key: string]: string } = {
      Positive: '😊',
      Negative: '😔',
      Neutral: '😐',
      Happy: '😄',
      Sad: '😢',
      Angry: '😠',
      Surprised: '😲',
      Excited: '🤩',
      Joyful: '😁',
    };
    return emojiMap[label] || '🎭';
  };

  const getColor = (label: string) => {
    if (label.toLowerCase().includes('positive') || label.toLowerCase().includes('happy') || label.toLowerCase().includes('joy')) {
      return 'from-green-500 to-green-600';
    } else if (label.toLowerCase().includes('negative') || label.toLowerCase().includes('sad')) {
      return 'from-red-500 to-red-600';
    }
    return 'from-gray-500 to-gray-600';
  };

  const isHF = engine === 'hf';

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5 }}
      className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
    >
      {/* Header */}
      <div className={`bg-gradient-to-r ${getColor(sentiment.label)} p-4 sm:p-6 text-white`}>
        <div className="flex flex-col sm:flex-row items-center sm:items-start sm:justify-between gap-4">
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <motion.div
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 200, damping: 15 }}
              className="w-16 h-16 sm:w-20 sm:h-20 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm shadow-lg"
            >
              <span className="text-4xl sm:text-5xl">{getEmoji(sentiment.label)}</span>
            </motion.div>
            
            <div className="text-center sm:text-left">
              <h2 className="text-2xl sm:text-3xl font-bold mb-1">
                {sentiment.label} Sentiment
              </h2>
              <p className="text-white/90 text-sm sm:text-base">
                Confidence: {(sentiment.confidence * 100).toFixed(1)}%
              </p>
            </div>
          </div>
          
          <TrendingUp className="w-10 h-10 sm:w-12 sm:h-12 text-white/50" />
        </div>

        {/* Engine Badge */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mt-4"
        >
          <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold backdrop-blur-sm ${
            isHF
              ? 'bg-amber-500/25 text-amber-100 border border-amber-400/30'
              : 'bg-blue-500/25 text-blue-100 border border-blue-400/30'
          }`}>
            {isHF ? <Zap className="w-3.5 h-3.5" /> : <Brain className="w-3.5 h-3.5" />}
            {isHF ? 'RoBERTa (HuggingFace)' : 'TriSenti Custom Model'}
          </span>
        </motion.div>
      </div>

      {/* Body */}
      <div className="p-4 sm:p-6">
        {/* Transcript Section */}
        {sentiment.transcript && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="mb-6 bg-gradient-to-br from-blue-500/10 to-purple-500/10 border border-blue-500/30 rounded-xl p-4"
          >
            <h4 className="font-semibold text-base sm:text-lg text-white mb-3 flex items-center gap-2">
              <span>💬</span> Extracted Transcript
            </h4>
            <div className="bg-black/30 rounded-lg p-4 text-sm sm:text-base text-gray-200 leading-relaxed italic border border-white/10">
              "{sentiment.transcript}"
            </div>
          </motion.div>
        )}

        {/* Confidence Meter */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-gray-300">Overall Confidence</span>
            <span className="text-sm text-gray-400">{(sentiment.confidence * 100).toFixed(1)}%</span>
          </div>
          
          <div className="h-4 bg-white/10 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${sentiment.confidence * 100}%` }}
              transition={{ duration: 1, ease: 'easeOut' }}
              className={`h-full bg-gradient-to-r ${getColor(sentiment.label)} rounded-full shadow-lg`}
            />
          </div>
        </div>

        {/* Sentiment Probability Breakdown */}
        {sentiment.probabilities && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.15 }}
            className="mb-6"
          >
            <h3 className="font-semibold text-base sm:text-lg text-white mb-3">Sentiment Probabilities</h3>
            <div className="space-y-3">
              {([
                { key: 'Positive', color: 'from-green-500 to-green-400',  bg: 'bg-green-500/10', label: '😊 Positive' },
                { key: 'Negative', color: 'from-red-500 to-red-400',     bg: 'bg-red-500/10',   label: '😔 Negative' },
                { key: 'Neutral',  color: 'from-gray-400 to-gray-300',   bg: 'bg-gray-500/10',  label: '😐 Neutral'  },
              ] as const).map(({ key, color, bg, label }) => {
                const pct = ((sentiment.probabilities?.[key] ?? 0) * 100);
                return (
                  <div key={key} className={`rounded-xl p-3 ${bg} border border-white/10`}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm font-medium text-gray-200">{label}</span>
                      <span className="text-sm font-bold text-white">{pct.toFixed(1)}%</span>
                    </div>
                    <div className="h-2.5 bg-white/10 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 1.2, ease: 'easeOut', delay: 0.2 }}
                        className={`h-full bg-gradient-to-r ${color} rounded-full`}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* Multimodal Breakdown */}
        <div className="space-y-4">
          <h3 className="font-semibold text-base sm:text-lg flex flex-col sm:flex-row items-start sm:items-center gap-1 sm:gap-2 text-white">
            <span>{isHF ? 'Text-Based Analysis' : 'Multimodal Analysis'}</span>
            <span className="text-xs sm:text-sm text-gray-400 font-normal">(Individual Scores)</span>
          </h3>
          
          {[
            { label: 'Video', data: sentiment.emotions.video, icon: '🎥', color: 'blue' },
            { label: 'Audio', data: sentiment.emotions.audio, icon: '🎵', color: 'purple' },
            { label: 'Text', data: sentiment.emotions.text, icon: '📝', color: 'pink' },
          ].map((modal, index) => (
            <motion.div
              key={modal.label}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              className="bg-white/5 border border-white/10 rounded-xl p-3 sm:p-4"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-xl sm:text-2xl">{modal.icon}</span>
                  <div>
                    <p className="font-semibold text-sm sm:text-base text-white">{modal.label}</p>
                    <p className="text-xs sm:text-sm text-gray-400">{modal.data.emotion}</p>
                  </div>
                </div>
                <span className="text-xs sm:text-sm font-semibold text-gray-300">
                  {(modal.data.score * 100).toFixed(1)}%
                </span>
              </div>
              
              <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${modal.data.score * 100}%` }}
                  transition={{ duration: 1, delay: index * 0.1, ease: 'easeOut' }}
                  className={`h-full rounded-full`}
                  style={{
                    background: modal.color === 'blue' 
                      ? 'linear-gradient(to right, #3b82f6, #2563eb)'
                      : modal.color === 'purple'
                      ? 'linear-gradient(to right, #a855f7, #9333ea)'
                      : 'linear-gradient(to right, #ec4899, #db2777)'
                  }}
                />
              </div>
            </motion.div>
          ))}
        </div>

        {/* Technical Details Toggle */}
        <motion.button
          onClick={() => setShowDetails(!showDetails)}
          className="w-full mt-6 py-3 px-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-colors flex items-center justify-between text-sm sm:text-base"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <span className="font-semibold text-gray-300">Technical Details</span>
          <motion.div
            animate={{ rotate: showDetails ? 180 : 0 }}
            transition={{ duration: 0.3 }}
          >
            <ChevronDown className="w-5 h-5 text-gray-400" />
          </motion.div>
        </motion.button>

        <AnimatePresence>
          {showDetails && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3 }}
              className="mt-4 p-4 bg-white/5 border border-white/10 rounded-xl space-y-2 text-sm text-gray-400"
            >
              {isHF ? (
                <>
                  <p><strong className="text-gray-300">Engine:</strong> HuggingFace Transformers</p>
                  <p><strong className="text-gray-300">Model:</strong> cardiffnlp/twitter-roberta-base-sentiment-latest</p>
                  <p><strong className="text-gray-300">Architecture:</strong> RoBERTa (Robustly Optimized BERT)</p>
                  <p><strong className="text-gray-300">Training Data:</strong> ~124M tweets</p>
                  <p><strong className="text-gray-300">Approach:</strong> Text classification via transcribed speech</p>
                </>
              ) : (
                <>
                  <p><strong className="text-gray-300">Engine:</strong> TriSenti Custom Model</p>
                  <p><strong className="text-gray-300">Model:</strong> Multimodal Early Fusion Network</p>
                  <p><strong className="text-gray-300">Architecture:</strong> ResNet18 (Video) + MFCC (Audio) + DistilBERT (Text)</p>
                  <p><strong className="text-gray-300">Training Data:</strong> CMU-MOSI Dataset (400 clips)</p>
                  <p><strong className="text-gray-300">Audio Sample Rate:</strong> 16 kHz</p>
                </>
              )}
              {sentiment.transcript && (
                <p><strong className="text-gray-300">Transcript Length:</strong> {sentiment.transcript.split(' ').length} words</p>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}