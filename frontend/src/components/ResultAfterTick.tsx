import React from 'react';
import { SentimentResult } from './SentimentResult';
import { Analysis } from '../App';

interface ResultAfterTickProps {
  currentAnalysis: Analysis;
}

export function ResultAfterTick({ currentAnalysis }: ResultAfterTickProps) {
  const [showResult, setShowResult] = React.useState(false);
  
  React.useEffect(() => {
    // Only show result after step 4 completes (currentStep becomes 5) AND sentiment data exists
    if (currentAnalysis.currentStep >= 5 && currentAnalysis.sentiment && currentAnalysis.status === 'completed') {
      // Wait for tick animation to complete (800ms for smooth transition)
      const timeout = setTimeout(() => setShowResult(true), 800);
      return () => clearTimeout(timeout);
    } else {
      setShowResult(false);
    }
  }, [currentAnalysis.currentStep, currentAnalysis.sentiment, currentAnalysis.status]);
  
  if (!showResult || !currentAnalysis.sentiment) return null;
  
  return <SentimentResult sentiment={currentAnalysis.sentiment} {...(currentAnalysis.engine && { engine: currentAnalysis.engine })} />;
}
