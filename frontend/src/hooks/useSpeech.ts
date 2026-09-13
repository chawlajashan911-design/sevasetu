// @ts-nocheck
import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../services/api';

export function useSpeech(lang = 'mr') {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState(null);
  const [isSupported, setIsSupported] = useState(true);
  const recognitionRef = useRef(null);

  const langCodeMap = {
    mr: 'mr-IN',
    hi: 'hi-IN',
    en: 'en-IN'
  };

  useEffect(() => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setIsSupported(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = langCodeMap[lang] || 'mr-IN';

      recognition.onstart = () => {
        setIsListening(true);
        setError(null);
      };

      recognition.onresult = (event) => {
        let currentTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          currentTranscript += event.results[i][0].transcript;
        }
        setTranscript(currentTranscript);
      };

      recognition.onerror = (event) => {
        setError(event.error);
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    } catch (err) {
      setError(err.message);
      setIsSupported(false);
    }
  }, [lang]);

  const startListening = useCallback(async () => {
    if (recognitionRef.current) {
      try {
        setTranscript('');
        recognitionRef.current.lang = langCodeMap[lang] || 'mr-IN';
        recognitionRef.current.start();
      } catch (e) {
        console.warn('Web Speech start error:', e);
      }
    } else {
      // Use Bhashini backend STT endpoint as fallback
      setIsListening(true);
      try {
        const bhashiniRes = await api.speechToText(null, lang);
        if (bhashiniRes && bhashiniRes.transcript) {
          setTranscript(bhashiniRes.transcript);
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setIsListening(false);
      }
    }
  }, [lang]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current && isListening) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        console.warn('Speech stop error:', e);
      }
      setIsListening(false);
    }
  }, [isListening]);

  return {
    isListening,
    transcript,
    error,
    isSupported,
    startListening,
    stopListening
  };
}
