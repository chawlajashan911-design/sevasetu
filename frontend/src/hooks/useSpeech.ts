import { useState, useEffect, useCallback, useRef } from 'react';
import { Language } from '../types';

export function useSpeech(lang: Language = 'mr') {
  const [isListening, setIsListening] = useState<boolean>(false);
  const [transcript, setTranscript] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [isSupported, setIsSupported] = useState<boolean>(true);
  const recognitionRef = useRef<any>(null);

  const langCodeMap: Record<Language, string> = {
    mr: 'mr-IN',
    hi: 'hi-IN',
    en: 'en-IN'
  };

  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

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

      recognition.onresult = (event: any) => {
        let currentTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          currentTranscript += event.results[i][0].transcript;
        }
        setTranscript(currentTranscript);
      };

      recognition.onerror = (event: any) => {
        setError(event.error);
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    } catch (err: any) {
      setError(err.message);
      setIsSupported(false);
    }
  }, [lang]);

  const startListening = useCallback(() => {
    if (recognitionRef.current) {
      try {
        setTranscript('');
        recognitionRef.current.lang = langCodeMap[lang] || 'mr-IN';
        recognitionRef.current.start();
      } catch (e) {
        console.warn('Speech recognition start error:', e);
      }
    } else {
      // Demo simulated speech if API not supported
      setIsListening(true);
      setTimeout(() => {
        const demoPhrases: Record<Language, string[]> = {
          mr: [
            "मला २ दिवसांपासून तीव्र ताप आहे आणि छातीत दुखत आहे",
            "रक्तदाब जास्त वाटतोय, चक्कर येत आहे आणि डोकेदुखी आहे",
            "गरोदरपणात अचानक रक्तस्त्राव सुरू झाला आहे"
          ],
          hi: [
            "मुझे 2 दिनों से तेज बुखार है और सीने में दर्द हो रहा है",
            "चक्कर आ रहे हैं और बहुत कमजोरी लग रही है",
            "गर्भावस्था में अचानक तेज दर्द और रक्तस्राव हो रहा है"
          ],
          en: [
            "Severe headache with high blood pressure and chest discomfort for 2 days",
            "High fever 103F with chills and breathlessness",
            "Pregnant 34 weeks with blurred vision and sudden abdominal pain"
          ]
        };
        const phraseList = demoPhrases[lang] || demoPhrases.en;
        const randomPhrase = phraseList[Math.floor(Math.random() * phraseList.length)];
        setTranscript(randomPhrase);
        setIsListening(false);
      }, 2000);
    }
  }, [lang]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
    }
    setIsListening(false);
  }, [isListening]);

  return {
    isListening,
    transcript,
    setTranscript,
    startListening,
    stopListening,
    error,
    isSupported
  };
}
