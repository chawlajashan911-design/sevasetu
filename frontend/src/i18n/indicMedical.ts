// Trilingual Medical Clinical Terminology & Phrase Helper for SevaSetu
// Supports English, Hindi (हिंदी), and Marathi (मराठी)

export interface TrilingualContent {
  differential_diagnosis?: string[];
  clinical_reasoning?: string;
  red_flag_warnings?: string[];
  recommended_investigations?: string[];
  recommended_action?: string;
}

const MEDICAL_DICTIONARY: Record<string, { hi: string; mr: string }> = {
  // Conditions & Differential Diagnoses
  'hypertensive crisis': { hi: 'हाइपरटेंसिव क्राइसिस (गंभीर उच्च रक्तचाप)', mr: 'हायपरटेन्सिव्ह क्रायसिस (तीव्र उच्च रक्तदाब)' },
  'hypertensive crisis / pre-eclampsia': { hi: 'हाइपरटेंसिव क्राइसिस / प्री-एक्लेम्पसिया', mr: 'उच्च रक्तदाब आणीबाणी / प्री-एक्लॅम्प्सिया' },
  'pre-eclampsia': { hi: 'प्री-एक्लेम्पसिया (गर्भावस्था में उच्च रक्तचाप)', mr: 'प्री-एक्लॅम्प्सिया (गरोदरपणातील उच्च रक्तदाब)' },
  'acute respiratory insufficiency': { hi: 'गंभीर श्वसन विफलता / सांस की तीव्र कमी', mr: 'तीव्र श्वसन अपुरेपणा / दम लागणे' },
  'cardiovascular emergency': { hi: 'हृदय रोग आपातकाल (कार्डियोवैस्कुलर इमरजेंसी)', mr: 'हृदय व रक्तवाहिन्यासंबंधी आणीबाणी' },
  'acute febrile illness': { hi: 'तीव्र ज्वर (बुखार)', mr: 'तीव्र ताप' },
  'acute febrile illness (suspected dengue/malaria/viral)': { hi: 'तीव्र ज्वर (डेंगू/मलेरिया/वायरल का संदेह)', mr: 'तीव्र ताप (डेंग्यू/मलेरिया/व्हायरल संशय)' },
  'lower respiratory tract infection': { hi: 'निचले श्वसन तंत्र का संक्रमण (ब्रोंकाइटिस/निमोनिया)', mr: 'श्वसननलिका संसर्ग (न्यूमोनिया/ब्राँकायटिस)' },
  'gastroenteritis with dehydration': { hi: 'निर्जलीकरण युक्त गैस्ट्रोएंटेराइटिस (उल्टी-दस्त)', mr: 'पाण्याच्या कमतरतेसह गॅस्ट्रो (उलट्या-जुलाब)' },
  'upper respiratory tract infection / common cold': { hi: 'सामान्य सर्दी-जुकाम / ऊपरी श्वसन संक्रमण', mr: 'सामान्य सर्दी-खोकला / वरच्या श्वसनमार्गाचा संसर्ग' },
  'upper respiratory tract infection': { hi: 'ऊपरी श्वसन संक्रमण', mr: 'वरच्या श्वसनमार्गाचा संसर्ग' },
  'common cold': { hi: 'सामान्य जुकाम', mr: 'सामान्य सर्दी' },
  'mild tension headache': { hi: 'हल्का सिरदर्द (तनाव सिरदर्द)', mr: 'सामान्य डोकेदुखी (तणावजन्य डोकेदुखी)' },
  'routine stable evaluation': { hi: 'नियमित सामान्य स्वास्थ्य जांच', mr: 'नियमित स्थिर तपासणी' },

  // Danger signs / Red flags
  'cyanosis or oxygen drop < 88%': { hi: 'ऑक्सीजन स्तर 88% से कम होना या त्वचा का नीला पड़ना', mr: 'ऑक्सिजन पातळी ८८% पेक्षा कमी होणे किंवा त्वचा निळसर पडणे' },
  'loss of consciousness or altered sensorium': { hi: 'बेहोशी या भ्रम की स्थिति', mr: 'बेशुद्ध पडणे किंवा चक्कर येणे' },
  'severe intractable headache or chest pressure': { hi: 'सीने में तेज दबाव या असहनीय सिरदर्द', mr: 'छातीत तीव्र दाब किंवा असह्य डोकेदुखी' },
  'persistent vomiting preventing hydration': { hi: 'लगातार उल्टी व पानी की अत्यधिक कमी', mr: 'सतत उलट्या व डिहायड्रेशन' },
  'temperature spike > 103°f': { hi: 'तापमान 103°F से अधिक होना', mr: 'ताप १०३°F पेक्षा जास्त वाढणे' },
  'onset of petechial rash or bleeding': { hi: 'त्वचा पर लाल चकत्ते या रक्तस्त्राव', mr: 'अंगावर लाल पुरळ किंवा रक्तस्त्राव' },
  'development of breathlessness': { hi: 'सांस लेने में तकलीफ होना', mr: 'श्वास घेण्यास त्रास जाणवणे' },
  'fever persisting past 3 days': { hi: '3 दिन से अधिक समय तक बुखार रहना', mr: 'ताप ३ दिवसांपेक्षा जास्त राहणे' },

  // Investigations
  'urgent 12-lead ecg': { hi: 'तत्काल 12-लीड ईसीजी', mr: 'तातडीची १२-लीड ईसीजी' },
  'continuous pulse oximetry': { hi: 'पल्स ऑक्सीमेट्री निरंतर निगरानी', mr: 'सतत पल्स ऑक्सिमीटर तपासणी' },
  'complete blood count & serum electrolytes': { hi: 'सीबीसी एवं सीरम इलेक्ट्रोलाइट्स जांच', mr: 'सीबीसी आणि सीरम इलेक्ट्रोलाइट्स तपासणी' },
  'urine protein dipstick': { hi: 'मूत्र प्रोटीन जांच (डिपस्टिक)', mr: 'लघवी प्रोटीन तपासणी (डिपस्टिक)' },
  'rapid diagnostic test for malaria / dengue ns1': { hi: 'मलेरिया / डेंगू एनएस1 रैपिड जांच', mr: 'मलेरिया / डेंग्यू एनएस१ जलद चाचणी' },
  'complete blood count (platelet count)': { hi: 'सीबीसी (प्लेटलेट काउंट)', mr: 'सीबीसी (प्लेटलेट मोजणी)' },
  'serum creatinine': { hi: 'सीरम क्रिएटिनिन जांच', mr: 'सीरम क्रिएटिनिन तपासणी' },
  'routine vital monitoring': { hi: 'नियमित शारीरिक जांच (वाइटल्स)', mr: 'नियमित तपासणी निरीक्षण (व्हायटल्स)' },
  'hydration & symptomatic review': { hi: 'पर्याप्त पानी व लक्षणाधारित आराम', mr: 'भरपूर पाणी पिणे व लक्षणाधारित विश्रांती' }
};

export function translateClinicalTerm(term: string, targetLang: 'en' | 'hi' | 'mr'): string {
  if (!term || targetLang === 'en') return term;
  const key = term.trim().toLowerCase();
  const match = MEDICAL_DICTIONARY[key];
  if (match && match[targetLang]) {
    return match[targetLang];
  }
  // Substring match fallback
  for (const [dictKey, dictVal] of Object.entries(MEDICAL_DICTIONARY)) {
    if (key.includes(dictKey) && dictVal[targetLang]) {
      return dictVal[targetLang];
    }
  }
  return term;
}

export function getLocalizedClinicalData(
  record: any,
  lang: string
): {
  differential: string[];
  reasoning: string;
  redFlags: string[];
  investigations: string[];
  action: string;
} {
  const targetLang = (lang === 'hi' || lang === 'mr' || lang === 'en') ? lang : 'en';
  const translations = record?.translations;

  // Check if explicit translations are available from Gemini backend
  if (translations && translations[targetLang]) {
    const tData = translations[targetLang];
    return {
      differential: tData.differential_diagnosis || record.differential_diagnosis || [],
      reasoning: tData.clinical_reasoning || record.clinical_reasoning || '',
      redFlags: tData.red_flag_warnings || record.red_flag_warnings || [],
      investigations: tData.recommended_investigations || record.recommended_investigations || [],
      action: tData.recommended_action || record.recommended_action || ''
    };
  }

  // Fallback to local clinical translation
  const diff = (record?.differential_diagnosis || []).map((d: string) =>
    translateClinicalTerm(d, targetLang as 'en' | 'hi' | 'mr')
  );

  const redFlags = (record?.red_flag_warnings || []).map((f: string) =>
    translateClinicalTerm(f, targetLang as 'en' | 'hi' | 'mr')
  );

  const investigations = (record?.recommended_investigations || []).map((i: string) =>
    translateClinicalTerm(i, targetLang as 'en' | 'hi' | 'mr')
  );

  let reasoning = record?.clinical_reasoning || '';
  if (targetLang === 'hi' && translations?.hi?.clinical_reasoning) {
    reasoning = translations.hi.clinical_reasoning;
  } else if (targetLang === 'mr' && translations?.mr?.clinical_reasoning) {
    reasoning = translations.mr.clinical_reasoning;
  }

  let action = record?.recommended_action || '';
  if (targetLang === 'hi' && translations?.hi?.recommended_action) {
    action = translations.hi.recommended_action;
  } else if (targetLang === 'mr' && translations?.mr?.recommended_action) {
    action = translations.mr.recommended_action;
  }

  return {
    differential: diff,
    reasoning,
    redFlags,
    investigations,
    action
  };
}
