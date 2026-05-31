import React, { useState, useRef } from 'react';
import { Upload, Film, Music, Type, CheckCircle, X, Zap, Brain, AlertTriangle, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { InputPreview } from './InputPreview.js';
import type { ModelEngine } from '../App';

interface MultimodalInputProps {
  onAnalyze: (data: { type: 'video' | 'audio' | 'text'; content: File | string }) => void;
  selectedModel: ModelEngine;
  onModelChange: (model: ModelEngine) => void;
  isAnalyzing?: boolean;
}

type InputMode = 'video' | 'audio' | 'text';

// Allowed extensions per mode
const ALLOWED_EXTENSIONS: Record<'video' | 'audio', string[]> = {
  video: ['.mp4', '.mov', '.avi', '.mkv', '.webm'],
  audio: ['.mp3', '.wav', '.m4a', '.ogg', '.flac'],
};
const MAX_FILE_SIZE_MB = 200;

export function MultimodalInput({ onAnalyze, selectedModel, onModelChange, isAnalyzing = false }: MultimodalInputProps) {
  const [activeMode, setActiveMode] = useState<InputMode>('video');
  const [isDragging, setIsDragging] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [textInput, setTextInput] = useState('');
  const [fileError, setFileError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const modes = [
    { id: 'video' as InputMode, label: 'Video', icon: Film, color: 'from-blue-500 to-blue-600', formats: 'MP4, MOV, AVI, MKV, WebM' },
    { id: 'audio' as InputMode, label: 'Audio', icon: Music, color: 'from-purple-500 to-purple-600', formats: 'MP3, WAV, M4A, OGG, FLAC' },
    { id: 'text' as InputMode, label: 'Text', icon: Type, color: 'from-pink-500 to-pink-600', formats: 'Direct input' },
  ];

  const validateFile = (file: File, mode: 'video' | 'audio'): string | null => {
    const ext = '.' + (file.name.split('.').pop()?.toLowerCase() ?? '');
    if (!ALLOWED_EXTENSIONS[mode].includes(ext)) {
      return `Invalid file type "${ext}". Allowed: ${ALLOWED_EXTENSIONS[mode].join(', ')}`;
    }
    const sizeMB = file.size / (1024 * 1024);
    if (sizeMB > MAX_FILE_SIZE_MB) {
      return `File is too large (${sizeMB.toFixed(0)} MB). Maximum allowed: ${MAX_FILE_SIZE_MB} MB.`;
    }
    return null;
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && activeMode !== 'text') {
      const err = validateFile(file, activeMode);
      if (err) { setFileError(err); return; }
      setFileError(null);
      setUploadedFile(file);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && activeMode !== 'text') {
      const err = validateFile(file, activeMode);
      if (err) { setFileError(err); return; }
      setFileError(null);
      setUploadedFile(file);
    }
    // reset input so same file can be re-selected after removal
    e.target.value = '';
  };

  const handleAnalyze = () => {
    if (isAnalyzing) return;
    if (activeMode === 'text' && textInput.trim()) {
      onAnalyze({ type: 'text', content: textInput.trim() });
    } else if (uploadedFile) {
      onAnalyze({ type: activeMode, content: uploadedFile });
    }
  };

  const wordCount = textInput.trim() ? textInput.trim().split(/\s+/).length : 0;
  const canAnalyze = !isAnalyzing && (
    (activeMode === 'text' && textInput.trim().length >= 10) ||
    (activeMode !== 'text' && uploadedFile !== null)
  );

  const acceptedTypes = activeMode === 'video'
    ? 'video/*'
    : activeMode === 'audio'
    ? 'audio/*'
    : '';

  return (
    <div className="space-y-8">
      {/* Mode Selector */}
      <div className="flex gap-4 justify-center px-4">
        {modes.map((mode) => (
          <motion.button
            key={mode.id}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => {
              setActiveMode(mode.id);
              setUploadedFile(null);
              setTextInput('');
              setFileError(null);
            }}
            className={`flex items-center gap-2 px-4 sm:px-6 py-2 sm:py-3 rounded-xl font-semibold transition-all ${
              activeMode === mode.id
                ? `bg-gradient-to-br ${mode.color} text-white shadow-lg`
                : 'bg-white/5 text-gray-400 hover:bg-white/10'
            }`}
          >
            <mode.icon className="w-4 h-4 sm:w-5 sm:h-5" />
            <span className="text-sm sm:text-base">{mode.label}</span>
          </motion.button>
        ))}
      </div>

      {/* Input Area */}
      <motion.div
        key={activeMode}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="px-4"
      >
        {activeMode !== 'text' ? (
          <div className="space-y-3">
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => !uploadedFile && fileInputRef.current?.click()}
              className={`relative border-2 border-dashed rounded-2xl p-6 sm:p-12 transition-all cursor-pointer backdrop-blur-sm ${
                isDragging
                  ? 'border-blue-500 bg-blue-500/10 scale-105'
                  : fileError
                  ? 'border-red-500 bg-red-500/10'
                  : uploadedFile
                  ? 'border-green-500 bg-green-500/10'
                  : 'border-white/20 bg-white/5 hover:border-blue-400 hover:bg-blue-400/10'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept={acceptedTypes}
                onChange={handleFileSelect}
                className="hidden"
                aria-label="Upload file"
              />
              <AnimatePresence mode="wait">
                {!uploadedFile ? (
                  <motion.div
                    key="upload-prompt"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className="text-center space-y-4"
                  >
                    <motion.div
                      animate={{ y: isDragging ? -10 : [0, -10, 0] }}
                      transition={{
                        y: { duration: 2, repeat: isDragging ? 0 : Infinity, ease: 'easeInOut' },
                      }}
                      className="inline-block"
                    >
                      <div className={`w-20 h-20 sm:w-24 sm:h-24 mx-auto bg-gradient-to-br ${modes.find(m => m.id === activeMode)?.color} rounded-2xl flex items-center justify-center shadow-lg`}>
                        <Upload className="w-10 h-10 sm:w-12 sm:h-12 text-white" />
                      </div>
                    </motion.div>
                    <div>
                      <h3 className="text-xl sm:text-2xl font-bold mb-2">
                        {isDragging ? `Drop your ${activeMode} here` : `Upload a ${activeMode} file`}
                      </h3>
                      <p className="text-gray-400 text-sm sm:text-base">Drag and drop or click to browse</p>
                      <p className="text-xs sm:text-sm text-gray-500 mt-2">
                        Supported: {modes.find(m => m.id === activeMode)?.formats} · Max {MAX_FILE_SIZE_MB} MB
                      </p>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    key="upload-success"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className="flex flex-col sm:flex-row items-center gap-4"
                  >
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: 'spring', stiffness: 200, damping: 15 }}
                      className="w-14 h-14 sm:w-16 sm:h-16 bg-green-500 rounded-xl flex items-center justify-center shadow-lg shadow-green-500/50"
                    >
                      <CheckCircle className="w-7 h-7 sm:w-8 sm:h-8 text-white" />
                    </motion.div>
                    <div className="flex-1 text-left w-full sm:w-auto">
                      <div className="flex items-center gap-2 mb-1 justify-center sm:justify-start">
                        {activeMode === 'video' ? (
                          <Film className="w-5 h-5 text-gray-400" />
                        ) : (
                          <Music className="w-5 h-5 text-gray-400" />
                        )}
                        <h4 className="font-semibold text-base sm:text-lg truncate max-w-[200px] sm:max-w-none">{uploadedFile.name}</h4>
                      </div>
                      <p className="text-gray-400 text-sm text-center sm:text-left">
                        {(uploadedFile.size / (1024 * 1024)).toFixed(2)} MB
                      </p>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setUploadedFile(null);
                        setFileError(null);
                      }}
                      className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                      title="Remove uploaded file"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* File validation error */}
            <AnimatePresence>
              {fileError && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="flex items-start gap-3 bg-red-500/10 border border-red-500/40 rounded-xl px-4 py-3"
                >
                  <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-red-300">Invalid file</p>
                    <p className="text-xs text-red-400 mt-0.5">{fileError}</p>
                  </div>
                  <button onClick={() => setFileError(null)} className="ml-auto text-red-400 hover:text-red-300">
                    <X className="w-4 h-4" />
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ) : (
          <div className="bg-white/5 backdrop-blur-sm border border-white/20 rounded-2xl p-4 sm:p-6 space-y-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-pink-500 to-pink-600 rounded-xl flex items-center justify-center shadow-lg">
                <Type className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
              </div>
              <div>
                <h3 className="text-lg sm:text-xl font-bold">Enter Text for Analysis</h3>
                <p className="text-xs sm:text-sm text-gray-400">Type or paste your text below</p>
              </div>
            </div>
            <textarea
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              placeholder="Enter your text here... (e.g., 'I'm so happy today! This is the best day ever!' or 'I'm feeling really disappointed about the results.')"
              className="w-full h-40 sm:h-48 px-3 sm:px-4 py-2 sm:py-3 bg-white/5 border border-white/20 rounded-xl text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none text-sm sm:text-base"
            />
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-3">
                <span className={`${textInput.length < 10 ? 'text-gray-500' : 'text-gray-400'}`}>
                  {textInput.length} chars
                </span>
                {wordCount > 0 && (
                  <span className="text-gray-500">· {wordCount} {wordCount === 1 ? 'word' : 'words'}</span>
                )}
              </div>
              <span className={`text-xs font-medium ${textInput.length >= 10 ? 'text-green-400' : 'text-gray-500'}`}>
                {textInput.length >= 10 ? '✓ Ready to analyze' : 'Min. 10 characters'}
              </span>
            </div>
          </div>
        )}
      </motion.div>

      {/* Preview Section */}
      {((uploadedFile && (activeMode === 'video' || activeMode === 'audio')) || (activeMode === 'text' && textInput.trim())) && (
        <div className="mt-6 flex justify-center">
          <InputPreview
            type={activeMode}
            file={activeMode !== 'text' ? (uploadedFile || null) : null}
            text={activeMode === 'text' ? textInput : ''}
          />
        </div>
      )}

      {/* Model Selector — shown when input is ready */}
      <AnimatePresence>
        {canAnalyze && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            transition={{ duration: 0.35 }}
            className="px-4"
          >
            <p className="text-center text-sm font-semibold text-gray-400 mb-3 uppercase tracking-wider">
              Choose Analysis Engine
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* HuggingFace RoBERTa Card — recommended default */}
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => onModelChange('hf')}
                className={`relative text-left p-4 rounded-2xl border-2 transition-all ${
                  selectedModel === 'hf'
                    ? 'border-amber-500 bg-amber-500/15 shadow-lg shadow-amber-500/20'
                    : 'border-white/10 bg-white/5 hover:border-white/20'
                }`}
              >
                <span className="absolute top-3 right-3 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-amber-500/25 text-amber-200 border border-amber-400/40">
                  Recommended
                </span>
                <div className="flex items-center gap-3 mb-2 pr-24">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shadow">
                    <Zap className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="font-bold text-white text-sm">RoBERTa (HuggingFace)</p>
                    <p className="text-xs text-amber-300">State-of-the-Art NLP</p>
                  </div>
                </div>
                <p className="text-xs text-gray-400 leading-relaxed">
                  twitter-roberta-base-sentiment trained on 124M tweets. Fast &amp; highly accurate.
                </p>
              </motion.button>

              {/* Custom Model Card */}
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => onModelChange('custom')}
                className={`relative text-left p-4 rounded-2xl border-2 transition-all ${
                  selectedModel === 'custom'
                    ? 'border-blue-500 bg-blue-500/15 shadow-lg shadow-blue-500/20'
                    : 'border-white/10 bg-white/5 hover:border-white/20'
                }`}
              >
                {selectedModel === 'custom' && (
                  <span className="absolute top-3 right-3 w-2.5 h-2.5 rounded-full bg-blue-400 shadow-md shadow-blue-400/60" />
                )}
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow">
                    <Brain className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="font-bold text-white text-sm">TriSenti Custom Model</p>
                    <p className="text-xs text-blue-300">Multimodal Fusion</p>
                  </div>
                </div>
                <p className="text-xs text-gray-400 leading-relaxed">
                  ResNet18 + MFCC + DistilBERT early fusion model trained on CMU-MOSI dataset.
                </p>
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Analyze Button */}
      <motion.button
        whileHover={{ scale: canAnalyze ? 1.02 : 1 }}
        whileTap={{ scale: canAnalyze ? 0.98 : 1 }}
        onClick={handleAnalyze}
        disabled={!canAnalyze || isAnalyzing}
        className={`w-full py-3 sm:py-4 rounded-xl font-semibold text-base sm:text-lg transition-all mx-4 sm:mx-0 flex items-center justify-center gap-3 ${
          isAnalyzing
            ? 'bg-white/10 text-gray-400 cursor-not-allowed border border-white/10'
            : canAnalyze
            ? selectedModel === 'hf'
              ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg shadow-amber-500/50 hover:shadow-amber-500/70 cursor-pointer'
              : 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg shadow-blue-500/50 hover:shadow-blue-500/70 cursor-pointer'
            : 'bg-white/5 text-gray-500 cursor-not-allowed border border-white/10'
        }`}
      >
        {isAnalyzing ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            Analyzing...
          </>
        ) : canAnalyze ? (
          selectedModel === 'hf' ? '⚡ Analyze with RoBERTa' : '🧠 Analyze with Custom Model'
        ) : (
          '⚠️ Please provide input to analyze'
        )}
      </motion.button>
    </div>
  );
}
