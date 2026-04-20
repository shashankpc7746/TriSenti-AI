import React from 'react';
import { Film, Music, Type, CheckCircle, Clock, XCircle, Brain, Zap } from 'lucide-react';
import { motion } from 'motion/react';
import type { Analysis } from '../App';

interface HistoryListProps {
  analyses: Analysis[];
  onViewAnalysis: (analysis: Analysis) => void;
}

export function HistoryList({ analyses, onViewAnalysis }: HistoryListProps) {
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'processing':
        return <Clock className="w-5 h-5 text-blue-500 animate-spin" />;
      case 'failed':
        return <XCircle className="w-5 h-5 text-red-500" />;
      default:
        return null;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-500/10 border-green-500/30';
      case 'processing':
        return 'bg-blue-500/10 border-blue-500/30';
      case 'failed':
        return 'bg-red-500/10 border-red-500/30';
      default:
        return 'bg-white/5 border-white/10';
    }
  };

  const getTypeIcon = (type: 'video' | 'audio' | 'text') => {
    switch (type) {
      case 'video': return <Film className="w-6 h-6 sm:w-7 sm:h-7 text-white" />;
      case 'audio': return <Music className="w-6 h-6 sm:w-7 sm:h-7 text-white" />;
      case 'text':  return <Type className="w-6 h-6 sm:w-7 sm:h-7 text-white" />;
    }
  };

  const getTypeGradient = (type: 'video' | 'audio' | 'text') => {
    switch (type) {
      case 'video': return 'from-blue-500 to-blue-600';
      case 'audio': return 'from-purple-500 to-purple-600';
      case 'text':  return 'from-pink-500 to-pink-600';
    }
  };

  const getSentimentEmoji = (label?: string) => {
    if (!label) return '⏳';
    const emojiMap: { [key: string]: string } = {
      Positive: '😊',
      Negative: '😔',
      Neutral: '😐',
    };
    return emojiMap[label] ?? '🎭';
  };

  return (
    <div className="space-y-4 px-4">
      {analyses.map((analysis, index) => (
        <motion.div
          key={analysis.id}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: index * 0.05 }}
          whileHover={{ scale: 1.02, x: 4 }}
          onClick={() => onViewAnalysis(analysis)}
          className={`bg-white/5 backdrop-blur-sm border-2 rounded-xl p-4 sm:p-6 cursor-pointer transition-all ${getStatusColor(analysis.status)} hover:shadow-lg hover:shadow-blue-500/20`}
        >
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3 sm:gap-4 flex-1 w-full sm:w-auto">
              {/* Type Icon */}
              <div className={`w-12 h-12 sm:w-14 sm:h-14 bg-gradient-to-br ${getTypeGradient(analysis.type)} rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg`}>
                {getTypeIcon(analysis.type)}
              </div>

              {/* File Info */}
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-base sm:text-lg truncate text-white">{analysis.filename}</h3>
                <div className="flex items-center gap-2 flex-wrap mt-0.5">
                  <p className="text-xs sm:text-sm text-gray-400">
                    {analysis.timestamp.toLocaleDateString()} at {analysis.timestamp.toLocaleTimeString()}
                  </p>
                  {/* Engine badge */}
                  {analysis.engine && (
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                      analysis.engine === 'hf'
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                    }`}>
                      {analysis.engine === 'hf'
                        ? <><Zap className="w-3 h-3" /> RoBERTa</>
                        : <><Brain className="w-3 h-3" /> Custom</>
                      }
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Status & Result */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4 w-full sm:w-auto">
              {analysis.sentiment && (
                <div className="flex items-center gap-2 bg-white/10 px-3 sm:px-4 py-2 rounded-lg backdrop-blur-sm border border-white/10">
                  <span className="text-xl sm:text-2xl">{getSentimentEmoji(analysis.sentiment.label)}</span>
                  <div className="text-left">
                    <p className="text-xs sm:text-sm font-semibold text-white">{analysis.sentiment.label}</p>
                    <p className="text-xs text-gray-400">
                      {(analysis.sentiment.confidence * 100).toFixed(0)}% confidence
                    </p>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2">
                {getStatusIcon(analysis.status)}
                <span className="text-xs sm:text-sm font-medium capitalize text-gray-300">{analysis.status}</span>
              </div>
            </div>
          </div>

          {/* Progress Bar for Processing */}
          {analysis.status === 'processing' && (
            <div className="mt-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-400">
                  Step {analysis.currentStep} of 4
                </span>
                <span className="text-sm text-gray-400">
                  {Math.round((analysis.currentStep / 4) * 100)}%
                </span>
              </div>
              <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${(analysis.currentStep / 4) * 100}%` }}
                  transition={{ duration: 0.5 }}
                  className="h-full bg-gradient-to-r from-blue-500 to-purple-600 rounded-full"
                />
              </div>
            </div>
          )}
        </motion.div>
      ))}
    </div>
  );
}