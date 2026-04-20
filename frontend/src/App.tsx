import React, { useState } from 'react';
import { MultimodalInput } from './components/MultimodalInput';
import { ProgressStepper } from './components/ProgressStepper';
import { FeatureCards } from './components/FeatureCards';
import { SentimentResult } from './components/SentimentResult';
import { HistoryList } from './components/HistoryList';
import trisentiLogo from './assets/TriSenti logo.png';
import { AnimatedBackground } from './components/AnimatedBackground';
import { Footer } from './components/Footer';
import { HowItWorks } from './components/HowItWorks';
import { UseCases } from './components/UseCases';
import { ResultAfterTick } from './components/ResultAfterTick';
import logoImage from 'figma:asset/3f3e9a7ff4d19c90aab4fecc28a836cb0f8ea242.png';

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
  };
}

export default function App() {
  const [currentAnalysis, setCurrentAnalysis] = useState<Analysis | null>(null);
  const [analysisHistory, setAnalysisHistory] = useState<Analysis[]>([]);
  const [selectedModel, setSelectedModel] = useState<ModelEngine>('custom');

  const handleAnalyze = async (data: { type: 'video' | 'audio' | 'text'; content: File | string }) => {
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
    
    // Scroll to the progress section
    setTimeout(() => {
      const progressSection = document.getElementById('analysis-progress');
      progressSection?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
    
    // Call real backend API
    await analyzeWithBackend(data.content, data.type, newAnalysis, selectedModel);
  };

  const analyzeWithBackend = async (fileData: File | string, type: 'video' | 'audio' | 'text', analysis: Analysis, engine: ModelEngine = 'custom') => {
    const API_URL = 'http://localhost:8000';
    
    // Animate progress steps 1-3 while backend processes
    for (let step = 1; step <= 3; step++) {
      await new Promise(resolve => setTimeout(resolve, step === 1 ? 500 : 1000));
      setCurrentAnalysis(prev => prev ? { ...prev, currentStep: step } : null);
    }
    
    // Set step 4 as in progress
    setCurrentAnalysis(prev => prev ? { ...prev, currentStep: 4 } : null);
    
    try {
      let response;
      
      if (type === 'text') {
        // Text-only analysis
        const textContent = fileData as string;
        const endpoint = `${API_URL}/api/analyze-text?text=${encodeURIComponent(textContent)}&model_engine=${engine}`;
        response = await fetch(endpoint, { method: 'POST' });
      } else {
        // Video/Audio analysis
        const formData = new FormData();
        formData.append('file', fileData as File);
        const endpoint = engine === 'hf'
          ? `${API_URL}/api/analyze-hf`
          : `${API_URL}/api/analyze`;
        response = await fetch(endpoint, { method: 'POST', body: formData });
      }
      
      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: `Server error: ${response.status}` }));
        throw new Error(error.detail || 'Analysis failed');
      }
      
      const result = await response.json();
      
      // Map backend response to frontend format
      const emotionOptions = {
        Positive: ['Happy', 'Joyful', 'Excited', 'Content'],
        Negative: ['Sad', 'Angry', 'Frustrated', 'Disappointed'],
        Neutral: ['Calm', 'Neutral', 'Thoughtful', 'Indifferent'],
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
          probabilities: result.probabilities as Record<string, number> | undefined,
          transcript: result.transcript && result.transcript !== "No speech detected" ? result.transcript : undefined,
          emotions: {
            video: {
              emotion: emotions[Math.floor(Math.random() * emotions.length)] ?? 'Neutral',
              score: result.breakdown.video
            },
            audio: {
              emotion: emotions[Math.floor(Math.random() * emotions.length)] ?? 'Neutral',
              score: result.breakdown.audio
            },
            text: {
              emotion: emotions[Math.floor(Math.random() * emotions.length)] ?? 'Neutral',
              score: result.breakdown.text
            },
          },
        },
      };
      
      setCurrentAnalysis(completedAnalysis);
      setAnalysisHistory(prev => [completedAnalysis, ...prev]);
      
    } catch (error) {
      console.error('Analysis error:', error);
      
      // Show detailed error message
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const detailedError = errorMessage.includes('fetch') || errorMessage.includes('Failed to fetch')
        ? '❌ Cannot connect to backend server!\n\nPlease ensure the backend is running:\n\n1. Open PowerShell\n2. Run .\\run_backend.ps1\n3. Wait for "✅ Models loaded successfully"\n4. Try again!'
        : `❌ ${errorMessage}`;
      
      alert(detailedError);
      
      setCurrentAnalysis(prev => prev ? {
        ...prev,
        status: 'failed',
        currentStep: 4,
      } : null);
    }
  };

  const simulateAnalysis = (analysis: Analysis) => {
    let currentStepIndex = 0;

    const interval = setInterval(() => {
      currentStepIndex++;
      
      // Steps 1-3 progress normally
      if (currentStepIndex <= 3) {
        setCurrentAnalysis(prev => prev ? { ...prev, currentStep: currentStepIndex } : null);
      }
      
      // When reaching step 4 (Sentiment Prediction), clear interval and handle separately
      if (currentStepIndex === 4) {
        clearInterval(interval);
        
        // Set to step 4 (in progress)
        setCurrentAnalysis(prev => prev ? { ...prev, currentStep: 4 } : null);
        
        // Wait for prediction to "complete"
        setTimeout(() => {
          // Generate mock sentiment results with more realistic variation
          const sentimentOptions = ['Positive', 'Negative', 'Neutral'];
          const emotionOptions = {
            positive: ['Happy', 'Joyful', 'Excited', 'Content'],
            negative: ['Sad', 'Angry', 'Frustrated', 'Disappointed'],
            neutral: ['Calm', 'Neutral', 'Thoughtful', 'Indifferent'],
          };
          
          // More varied sentiment selection
          const rand = Math.random();
          const randomSentiment = rand < 0.4 ? 'Positive' : rand < 0.7 ? 'Negative' : 'Neutral';
          const emotionSet = randomSentiment === 'Positive' ? emotionOptions.positive 
            : randomSentiment === 'Negative' ? emotionOptions.negative 
            : emotionOptions.neutral;
          
          // Note: Mock transcripts removed - real transcription will be done by backend
          // Currently showing demo UI only without actual speech recognition
          
          const completedAnalysis: Analysis = {
            ...analysis,
            status: 'completed',
            currentStep: 5, // Mark as completed (step 5 means step 4 is done with checkmark)
            sentiment: {
              label: randomSentiment,
              confidence: 0.82 + Math.random() * 0.15,
              emotions: {
                video: { 
                  emotion: emotionSet[Math.floor(Math.random() * emotionSet.length)] ?? 'Neutral', 
                  score: 0.75 + Math.random() * 0.2 
                },
                audio: { 
                  emotion: emotionSet[Math.floor(Math.random() * emotionSet.length)] ?? 'Neutral', 
                  score: 0.75 + Math.random() * 0.2 
                },
                text: { 
                  emotion: emotionSet[Math.floor(Math.random() * emotionSet.length)] ?? 'Neutral', 
                  score: 0.75 + Math.random() * 0.2 
                },
              },
              // transcript omitted — backend provides it for real analyses
            },
          };
          
          setCurrentAnalysis(completedAnalysis);
          setAnalysisHistory(prev => [completedAnalysis, ...prev]);
        }, 2500); // Wait 2.5s for "prediction" to complete
      }
    }, 1500);
  };

  const handleViewHistory = (analysis: Analysis) => {
    setCurrentAnalysis(analysis);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

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
                <a href="#features" className="text-gray-400 hover:text-white transition-colors">Features</a>
                <a href="#how-it-works" className="text-gray-400 hover:text-white transition-colors">How It Works</a>
                <a href="#use-cases" className="text-gray-400 hover:text-white transition-colors">Use Cases</a>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-16 sm:space-y-20">
          {/* Hero Section */}
          <section className="text-center space-y-4 sm:space-y-6 py-4 sm:py-8">
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold leading-tight px-4">
              Analyze Emotions from Video, Audio & Text
            </h2>
            <p className="text-lg sm:text-xl text-gray-400 max-w-3xl mx-auto px-4">
              Advanced deep learning models analyze multimodal inputs to detect sentiment and emotions with high accuracy
            </p>
          </section>

          {/* Input Section */}
          <section>
            <MultimodalInput onAnalyze={handleAnalyze} selectedModel={selectedModel} onModelChange={setSelectedModel} />
          </section>

          {/* Current Analysis */}
          {currentAnalysis && (
            <section id="analysis-progress" className="space-y-8 scroll-mt-24">
              <div className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 shadow-2xl p-6">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/30">
                    <span className="text-2xl">
                      {currentAnalysis.type === 'video' ? '🎥' : currentAnalysis.type === 'audio' ? '🎵' : '📝'}
                    </span>
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold">{currentAnalysis.filename}</h3>
                    <p className="text-gray-400">
                      {currentAnalysis.timestamp.toLocaleString()}
                    </p>
                  </div>
                </div>
                <ProgressStepper currentStep={currentAnalysis.currentStep} analysisType={currentAnalysis.type} />
              </div>
              {/* Only show result after last step (Sentiment Prediction) is completed with tick */}
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
              <HistoryList 
                analyses={analysisHistory} 
                onViewAnalysis={handleViewHistory}
              />
            </section>
          )}
        </main>

        {/* Footer */}
        <Footer />
      </div>
    </div>
  );
}