import React, { useEffect } from 'react';
import { useSpeech } from '../hooks/useSpeech';
import { Mic, MicOff, Loader2 } from 'lucide-react';

export const VoiceInput = ({ language = 'mr', onTranscript, className = '', disabled = false }) => {
  const { isListening, transcript, startListening, stopListening, isSupported } = useSpeech(language);

  useEffect(() => {
    if (transcript && onTranscript) {
      onTranscript(transcript);
    }
  }, [transcript, onTranscript]);

  const toggleListening = (e) => {
    e.preventDefault();
    if (disabled) return;
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  const label = isListening
    ? (language === 'mr' ? 'ऐकत आहे...' : language === 'hi' ? 'सुन रहा है...' : 'Listening...')
    : (language === 'mr' ? 'आवाजाने सांगा' : language === 'hi' ? 'बोलकर बताएं' : 'Voice Input');

  return (
    <button
      type="button"
      onClick={toggleListening}
      disabled={disabled}
      className={`inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
        isListening
          ? 'bg-rose-500 text-white animate-pulse shadow-md shadow-rose-500/30'
          : 'bg-teal-50 text-teal-800 hover:bg-teal-100 border border-teal-200/80'
      } ${className}`}
      title={isListening ? 'Click to stop listening' : 'Click to speak symptoms'}
    >
      {isListening ? (
        <Mic className="w-3.5 h-3.5 text-white animate-bounce" />
      ) : (
        <Mic className="w-3.5 h-3.5 text-teal-600" />
      )}
      <span>{label}</span>
    </button>
  );
};
