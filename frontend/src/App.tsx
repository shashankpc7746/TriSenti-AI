import React, { useState, useEffect } from 'react';
import { MultimodalInput } from './components/MultimodalInput';
import { ProgressStepper } from './components/ProgressStepper';
import { FeatureCards } from './components/FeatureCards';
import { HistoryList } from './components/HistoryList';
import trisentiLogo from './assets/TriSenti logo.png';
import { AnimatedBackground } from './components/AnimatedBackground';
import { Footer } from './components/Footer';
import { HowItWorks } from './components/HowItWorks';
import { UseCases } from './components/UseCases';
import { ResultAfterTick } from './components/ResultAfterTick';
import { AlertTriangle, X, RefreshCw, ServerCrash } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { API_URL } from './config';

type BackendStatus = 'checking' | 'online' | 'offline';

export type ModelEngine = 'custom' | 'hf';

export interface Analysis {
  id: string;
  filename: string;
  type: 'video' | 'audio' | 'text';
  timestamp: Date;
  status: 'processing' | 'completed' | 'failed';
  currentStep: number;
  engine?: ModelEngine;
  sentiment?: {
    label: string;
    confidence: number;
    probabilities?: Record<string, number>;
    emotions: {
      video: { emotion: string; score: number };
      audio: { emotion: string; score: number };
      text: { emotion: string; score: number };
    };
    transcript?: string;
    /** Detected spoken language, e.g. "Marathi" */
    languageName?: string;
    /** English translation of a non-English transcript */
    translation?: string;
  };
}

export default function App() {
  const [currentAnalysis, setCurrentAnalysis] = useState<Analysis | null>(null);
  const [analysisHistory, setAnalysisHistory] = useState<Analysis[]>([]);
  const [selectedModel, setSelectedModel] = useState<ModelEngine>('hf');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [backendStatus, setBackendStatus] = useState<BackendStatus>('checking');

  // Poll backend health every 30 s
  useEffect(() => {
    const check = async () => {
      try {
        const res = await fetch(`${API_URL}/`, { signal: AbortSignal.timeout(4000) });
        setBackendStatus(res.ok ? 'online' : 'offline');
      } catch {
        setBackendStatus('offline');
      }
    };
    void check();
    const id = setInterval(() => void check(), 30_000);
    return () => clearInterval(id);
  }, []);

  const handleAnalyze = async (data: { type: 'video' | 'audio' | 'text'; content: File | string }) => {
    setErrorMessage(null);
    setIsAnalyzing(true);

    const newAnalysis: Analysis = {
      id: Date.now().toString(),
      filename: data.type === 'text'
        ? `Text Input (${(data.content as string).substring(0, 30)}...)`
        : (data.content as File).name,
      type: data.type,
      timestamp: new Date(),
      status: 'processing',
      currentStep: 0,
      engine: selectedModel,
    };

    setCurrentAnalysis(newAnalysis);

    // Scroll to progress section
    setTimeout(() => {
      const progressSection = document.getElementById('analysis-progress');
      progressSection?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);

    await analyzeWithBackend(data.content, data.type, newAnalysis, selectedModel);
    setIsAnalyzing(false);
  };

  const analyzeWithBackend = async (
    fileData: File | string,
    type: 'video' | 'audio' | 'text',
    analysis: Analysis,
    engine: ModelEngine = 'hf'
  ) => {
    // API_URL comes from src/config.ts (VITE_API_URL env var, localhost fallback)

    // Animate progress steps 1–3
    for (let step = 1; step <= 3; step++) {
      await new Promise(resolve => setTimeout(resolve, step === 1 ? 500 : 1000));
      setCurrentAnalysis(prev => prev ? { ...prev, currentStep: step } : null);
    }

    // Step 4 — running model
    setCurrentAnalysis(prev => prev ? { ...prev, currentStep: 4 } : null);

    try {
      let response: Response;

      if (type === 'text') {
        const textContent = fileData as string;
        response = await fetch(`${API_URL}/api/analyze-text`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: textContent, model_engine: engine }),
        });
      } else {
        const formData = new FormData();
        formData.append('file', fileData as File);
        const endpoint = engine === 'hf' ? `${API_URL}/api/analyze-hf` : `${API_URL}/api/analyze`;
        response = await fetch(endpoint, { method: 'POST', body: formData });
      }

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: `Server error ${response.status}` }));
        throw new Error(error.detail || 'Analysis failed');
      }

      const result = await response.json();

      const emotionOptions = {
        Positive: ['Happy', 'Joyful', 'Excited', 'Content'],
        Negative: ['Sad', 'Angry', 'Frustrated', 'Disappointed'],
        Neutral:  ['Calm', 'Neutral', 'Thoughtful', 'Indifferent'],
      };

      const sentimentKey = result.sentiment as keyof typeof emotionOptions;
      const emotions = emotionOptions[sentimentKey] || emotionOptions.Neutral;

      const completedAnalysis: Analysis = {
        ...analysis,
        status: 'completed',
        currentStep: 5,
        engine: result.engine === 'huggingface' ? 'hf' : (result.engine as ModelEngine) || engine,
        sentiment: {
          label: result.sentiment,
          confidence: result.confidence,
          ...(result.probabilities && { probabilities: result.probabilities as Record<string, number> }),
          ...(result.transcript && result.transcript !== 'No speech detected' && { transcript: result.transcript as string }),
          ...(result.language_name && { languageName: result.language_name as string }),
          ...(result.translation && { translation: result.translation as string }),
          emotions: {
            video: { emotion: emotions[Math.floor(Math.random() * emotions.length)] ?? 'Neutral', score: result.breakdown.video },
            audio: { emotion: emotions[Math.floor(Math.random() * emotions.length)] ?? 'Neutral', score: result.breakdown.audio },
            text:  { emotion: emotions[Math.floor(Math.random() * emotions.length)] ?? 'Neutral', score: result.breakdown.text  },
          },
        },
      };

      setCurrentAnalysis(completedAnalysis);
      setAnalysisHistory(prev => [completedAnalysis, ...prev]);

    } catch (error) {
      console.error('Analysis error:', error);
      const raw = error instanceof Error ? error.message : 'Unknown error';
      const isNetworkError = raw.toLowerCase().includes('fetch') || raw.toLowerCase().includes('failed to fetch') || raw.toLowerCase().includes('networkerror');
      const isLocalBackend = API_URL.includes('localhost') || API_URL.includes('127.0.0.1');
      setErrorMessage(
        isNetworkError
          ? isLocalBackend
            ? 'Cannot reach the backend server. Make sure it is running on port 8000 (run run_backend.ps1) and try again.'
            : 'Cannot reach the analysis server. It may be waking up from sleep — please wait ~30 seconds and try again.'
          : raw
      );
      setCurrentAnalysis(prev => prev ? { ...prev, status: 'failed', currentStep: 4 } : null);
    }
  };

  const handleViewHistory = (analysis: Analysis) => {
    setCurrentAnalysis(analysis);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleReset = () => {
    setCurrentAnalysis(null);
    setErrorMessage(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const isNetworkErrorMsg = errorMessage?.includes('backend server') || errorMessage?.includes('analysis server');
  const showLocalRunHint = errorMessage?.includes('run_backend.ps1');

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-slate-800 to-gray-900 text-white relative overflow-hidden">
      <AnimatedBackground />

      <div className="relative z-10">
        {/* Header */}
        <header className="border-b border-white/10 backdrop-blur-sm bg-gray-900/50 sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-8 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <img
                  src={trisentiLogo}
                  alt="TriSenti Logo"
                  className="w-12 h-12 rounded-lg border-2 border-white/20 shadow-md object-cover"
                />
                <div>
                  <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                    TriSenti AI
                  </h1>
                  <p className="text-xs sm:text-sm text-gray-400">Multimodal Sentiment Analysis Platform</p>
                </div>
              </div>

              <div className="hidden md:flex items-center gap-6 text-sm">
                <a href="#features"    className="text-gray-400 hover:text-white transition-colors">Features</a>
                <a href="#how-it-works" className="text-gray-400 hover:text-white transition-colors">How It Works</a>
                <a href="#use-cases"   className="text-gray-400 hover:text-white transition-colors">Use Cases</a>

                {/* Backend status badge */}
                <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-medium ${
                  backendStatus === 'online'
                    ? 'bg-green-500/10 border-green-500/30 text-green-400'
                    : backendStatus === 'offline'
                    ? 'bg-red-500/10 border-red-500/30 text-red-400'
                    : 'bg-gray-500/10 border-gray-500/30 text-gray-400'
                }`}>
                  <span className={`w-2 h-2 rounded-full ${
                    backendStatus === 'online'
                      ? 'bg-green-400 animate-pulse'
                      : backendStatus === 'offline'
                      ? 'bg-red-400'
                      : 'bg-gray-400 animate-pulse'
                  }`} />
                  {backendStatus === 'online' ? 'API Online' : backendStatus === 'offline' ? 'API Offline' : 'Checking...'}
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-16 sm:space-y-20">

          {/* Hero */}
          <section className="text-center space-y-4 sm:space-y-6 py-4 sm:py-8">
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold leading-tight px-4">
              Analyze Emotions from Video, Audio &amp; Text
            </h2>
            <p className="text-lg sm:text-xl text-gray-400 max-w-3xl mx-auto px-4">
              Advanced deep learning models analyze multimodal inputs to detect sentiment and emotions with high accuracy
            </p>
          </section>

          {/* Input Section */}
          <section>
            <MultimodalInput
              onAnalyze={handleAnalyze}
              selectedModel={selectedModel}
              onModelChange={setSelectedModel}
              isAnalyzing={isAnalyzing}
            />
          </section>

          {/* Inline Error Banner */}
          <AnimatePresence>
            {errorMessage && (
              <motion.section
                initial={{ opacity: 0, y: -12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                className={`rounded-2xl border p-5 flex items-start gap-4 ${
                  isNetworkErrorMsg
                    ? 'bg-orange-500/10 border-orange-500/40'
                    : 'bg-red-500/10 border-red-500/40'
                }`}
              >
                {isNetworkErrorMsg
                  ? <ServerCrash className="w-6 h-6 text-orange-400 flex-shrink-0 mt-0.5" />
                  : <AlertTriangle className="w-6 h-6 text-red-400 flex-shrink-0 mt-0.5" />
                }
                <div className="flex-1">
                  <p className={`font-semibold text-base ${isNetworkErrorMsg ? 'text-orange-300' : 'text-red-300'}`}>
                    {isNetworkErrorMsg ? 'Backend Unreachable' : 'Analysis Failed'}
                  </p>
                  <p className={`text-sm mt-1 leading-relaxed ${isNetworkErrorMsg ? 'text-orange-400/90' : 'text-red-400/90'}`}>
                    {errorMessage}
                  </p>
                  {showLocalRunHint && (
                    <code className="block mt-2 text-xs bg-black/30 rounded-lg px-3 py-2 text-orange-200 font-mono">
                      .\\run_backend.ps1
                    </code>
                  )}
                </div>
                <button onClick={() => setErrorMessage(null)} className="text-gray-500 hover:text-gray-300 transition-colors mt-0.5">
                  <X className="w-5 h-5" />
                </button>
              </motion.section>
            )}
          </AnimatePresence>

          {/* Current Analysis */}
          {currentAnalysis && (
            <section id="analysis-progress" className="space-y-8 scroll-mt-24">
              <div className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 shadow-2xl p-6">
                <div className="flex items-start justify-between mb-6">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/30">
                      <span className="text-2xl">
                        {currentAnalysis.type === 'video' ? '🎥' : currentAnalysis.type === 'audio' ? '🎵' : '📝'}
                      </span>
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold">{currentAnalysis.filename}</h3>
                      <p className="text-gray-400">{currentAnalysis.timestamp.toLocaleString()}</p>
                    </div>
                  </div>
                  {/* New Analysis button — only shown when done or failed */}
                  {(currentAnalysis.status === 'completed' || currentAnalysis.status === 'failed') && (
                    <motion.button
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={handleReset}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-sm font-medium text-gray-300 hover:text-white transition-all"
                    >
                      <RefreshCw className="w-4 h-4" />
                      New Analysis
                    </motion.button>
                  )}
                </div>
                <ProgressStepper currentStep={currentAnalysis.currentStep} analysisType={currentAnalysis.type} />
              </div>
              <ResultAfterTick currentAnalysis={currentAnalysis} />
            </section>
          )}

          {/* How It Works */}
          <section id="how-it-works">
            <HowItWorks />
          </section>

          {/* Feature Cards */}
          <section id="features">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold mb-3">Analysis Capabilities</h2>
              <p className="text-gray-400 max-w-2xl mx-auto">
                Leverage cutting-edge AI models to extract insights from multiple data modalities
              </p>
            </div>
            <FeatureCards />
          </section>

          {/* Use Cases */}
          <section id="use-cases">
            <UseCases />
          </section>

          {/* History */}
          {analysisHistory.length > 0 && (
            <section>
              <h2 className="text-3xl font-bold mb-8">Analysis History</h2>
              <HistoryList analyses={analysisHistory} onViewAnalysis={handleViewHistory} />
            </section>
          )}
        </main>

        <Footer />
      </div>
    </div>
  );
}