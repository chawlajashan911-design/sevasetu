import os
import json
import logging
from typing import Dict, Any, List, Optional
from dotenv import load_dotenv, find_dotenv

load_dotenv(find_dotenv())

from .schemas import VitalsInput

logger = logging.getLogger("sevasetu.triage")

class TriageEngine:
    def __init__(self, model_version: str = "Gemini 3.6 Flash + Clinical Rule Guardrail v2.0"):
        self.model_version = model_version
        self.disclaimer = (
            "Clinical AI Triage & Differential Impression — NOT a definitive diagnosis. "
            "Doctor verification and clinical judgment required."
        )
        self._gemini_client = None

    def _get_gemini_client(self):
        if self._gemini_client is not None:
            return self._gemini_client
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            return None
        try:
            from google import genai
            self._gemini_client = genai.Client(api_key=api_key)
            return self._gemini_client
        except Exception as e:
            logger.warning(f"Could not initialize Gemini client: {e}")
            return None

    def _call_gemini_diagnosis(
        self,
        vitals: VitalsInput,
        rule_priority: str,
        triggers: List[str],
        age: Optional[int] = None,
        gender: Optional[str] = None,
        patient_name: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        """
        Uses Google Gemini 3.6 Flash to analyze unstructured symptoms (in English, Marathi, or Hindi),
        correlate with vital signs, and provide expert clinical differential diagnoses with trilingual translations.
        """
        client = self._get_gemini_client()
        if not client:
            return None

        prompt = f"""You are an expert Clinical Decision Support & Triage AI for India's rural healthcare system (SevaSetu / NHM).
Analyze the following patient clinical intake and vital signs. The patient symptoms may be in English, Marathi, or Hindi.

PATIENT PROFILE:
- Name: {patient_name or 'Citizen Patient'}
- Age: {age or 'Adult'} | Gender: {gender or 'Not Specified'}
- Systolic BP: {vitals.systolic_bp or 'N/A'} mmHg | Diastolic BP: {vitals.diastolic_bp or 'N/A'} mmHg
- SpO2 (Oxygen Saturation): {vitals.spo2 or 'N/A'}%
- Pulse Rate: {vitals.pulse_rate or 'N/A'} bpm
- Body Temperature: {vitals.temperature or 'N/A'} °F
- Symptom Duration: {vitals.symptom_duration_days or 1} days
- High-Risk Maternal: {vitals.high_risk_maternal} (Notes: {vitals.maternal_note or 'None'})
- Reported Symptoms: {vitals.symptoms or 'No free-text symptoms reported'}

DETERMINISTIC SAFETY RULE MATRIX OUTPUT:
- Baseline Triage Level: {rule_priority}
- Triggered Physiological Red-Lines: {', '.join(triggers) if triggers else 'None'}

TRIAGE SEPARATION CRITERIA (Emergency Severity Index / NHM Rural Protocol):
- P1 (Critical / Resuscitation / Immediate): Life-threatening emergency, severe respiratory distress, acute coronary syndrome/angina, altered consciousness, shock, or severe hypertensive crisis. Immediate referral and hospital readiness.
- P2 (Urgent / High Priority): Potentially unstable, high pyrexia (>=102°F), prolonged illness (>3 days) with systemic decline, intractable vomiting, severe dehydration, or infectious warning signs. Urgent doctor teleconsult or PHC review within 1-4 hours.
- P3 (Routine / Ambulatory): Stable vitals, mild self-limiting symptoms (cold, mild headache, minor ache). Standard OPD or home monitoring.

INSTRUCTIONS:
1. Assign priority as "P1", "P2", or "P3" based on the clinical intake. (Clinical Safety Guardrail: You may ELEVATE priority if danger signs are detected in symptoms, but NEVER downgrade below the rule baseline level '{rule_priority}').
2. Identify the top 2-3 most probable differential diagnoses.
3. Write concise clinical reasoning (2-3 sentences) explaining the pathophysiology and urgency in English.
4. List 2-4 critical red-flag symptoms to watch out for.
5. Recommend 2-4 primary diagnostic investigations or immediate stabilization steps.
6. Provide complete and accurate translations in Hindi ("hi") and Marathi ("mr") for differential diagnoses, clinical reasoning, red flag warnings, recommended investigations, and immediate first aid.

Return ONLY a valid, raw JSON object with this exact structure (no markdown fences, no extra text):
{{
  "priority": "{rule_priority}",
  "confidence_score": 0.96,
  "differential_diagnosis": ["Condition 1", "Condition 2"],
  "clinical_reasoning": "Detailed clinical rationale in English...",
  "red_flag_warnings": ["Sign 1", "Sign 2"],
  "recommended_investigations": ["Investigation 1", "Investigation 2"],
  "immediate_first_aid": "Stabilization guidance...",
  "translations": {{
    "hi": {{
      "differential_diagnosis": ["स्थिति 1", "स्थिति 2"],
      "clinical_reasoning": "हिंदी में नैदानिक स्पष्टीकरण...",
      "red_flag_warnings": ["खतरे का संकेत 1", "खतरे का संकेत 2"],
      "recommended_investigations": ["जांच 1", "जांच 2"],
      "immediate_first_aid": "प्राथमिक उपचार..."
    }},
    "mr": {{
      "differential_diagnosis": ["स्थिती 1", "स्थिती 2"],
      "clinical_reasoning": "मराठीत वैद्यकीय विश्लेषण...",
      "red_flag_warnings": ["धोक्याची सूचना 1", "धोक्याची सूचना 2"],
      "recommended_investigations": ["तपासणी 1", "तपासणी 2"],
      "immediate_first_aid": "प्रथमोपचार..."
    }}
  }}
}}"""

        try:
            response = client.models.generate_content(
                model="gemini-3.6-flash",
                contents=prompt
            )
            raw_text = (response.text or "").strip()
            # Strip markdown code blocks if present
            if raw_text.startswith("```"):
                raw_text = raw_text.split("\n", 1)[-1]
                if raw_text.endswith("```"):
                    raw_text = raw_text.rsplit("```", 1)[0]
                raw_text = raw_text.strip()
            if raw_text.startswith("json"):
                raw_text = raw_text[4:].strip()

            parsed = json.loads(raw_text)
            return parsed
        except Exception as err:
            logger.warning(f"Gemini triage evaluation fallback: {err}")
            return None

    def evaluate(
        self,
        vitals: VitalsInput,
        age: Optional[int] = None,
        gender: Optional[str] = None,
        patient_name: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Evaluates input vitals and symptoms through a hybrid intelligence pipeline:
        1. Hard-coded clinical safety guardrails enforce strict physiologic red-lines.
        2. Google Gemini 3.6 Flash provides contextual clinical diagnosis & reasoning in English, Hindi, and Marathi.
        """
        triggers: List[str] = []
        p1_triggers: List[str] = []
        p2_triggers: List[str] = []

        # 1. P1 Critical Rule Checks
        if vitals.systolic_bp is not None and vitals.systolic_bp >= 160:
            p1_triggers.append(f"Severe Hypertension (Systolic BP {vitals.systolic_bp} >= 160 mmHg)")
        
        if vitals.diastolic_bp is not None and vitals.diastolic_bp >= 100:
            p1_triggers.append(f"Severe Diastolic Hypertension (Diastolic BP {vitals.diastolic_bp} >= 100 mmHg)")

        if vitals.spo2 is not None and vitals.spo2 <= 90:
            p1_triggers.append(f"Critical Hypoxemia (SpO2 {vitals.spo2}% <= 90%)")

        if vitals.high_risk_maternal:
            note = f": {vitals.maternal_note}" if vitals.maternal_note else ""
            p1_triggers.append(f"High-Risk Maternal Indicator{note}")

        # Check critical emergency symptoms in text if present
        symptom_text = (vitals.symptoms or "").lower()
        if any(w in symptom_text for w in ["chest pain", "breathlessness", "unconscious", "seizure", "severe bleeding", "छातीत दुखणे", "श्वास घेण्यास त्रास", "बेहोश", "रक्तस्त्राव"]):
            p1_triggers.append("Critical Emergency Symptom Flag detected in symptom report")

        # 2. P2 Urgent Rule Checks
        if vitals.temperature is not None and vitals.temperature >= 102.0:
            p2_triggers.append(f"High Grade Pyrexia (Temperature {vitals.temperature}°F >= 102.0°F)")

        if vitals.symptom_duration_days is not None and vitals.symptom_duration_days > 3:
            p2_triggers.append(f"Prolonged Illness (Symptom duration {vitals.symptom_duration_days} days > 3 days)")

        if any(w in symptom_text for w in ["persistent vomiting", "moderate dehydration", "severe headache", "उलटी", "तीव्र डोकेदुखी"]):
            p2_triggers.append("Urgent acute symptom pattern detected")

        # Baseline Safety Decision Matrix
        if p1_triggers:
            rule_priority = "P1"
            triage_label = "P1 Critical"
            reason = " | ".join(p1_triggers)
            triggers = p1_triggers
            base_confidence = 0.96
            action = "Immediate Medical Attention & Referral to nearest Emergency Healthcare Facility / Hospital."
        elif p2_triggers:
            rule_priority = "P2"
            triage_label = "P2 Urgent"
            reason = " | ".join(p2_triggers)
            triggers = p2_triggers
            base_confidence = 0.92
            action = "Urgent Tele-consultation with Medical Officer within 4 hours. ASHA follow-up."
        else:
            rule_priority = "P3"
            triage_label = "P3 Routine"
            reason = "Vitals within stable baseline limits. Mild or transient symptoms."
            triggers = ["Vitals in stable range", "No critical danger signs reported"]
            base_confidence = 0.89
            action = "Routine PHC OPD visit, home care guidance, or tele-consultation at convenience."

        # Default clinical heuristics for fallback with full trilingual support
        if rule_priority == "P1":
            differential = ["Hypertensive Crisis / Pre-Eclampsia", "Acute Respiratory Insufficiency", "Cardiovascular Emergency"]
            clinical_reasoning = f"Physiological decompensation indicated by {reason}. Requires urgent physician triage and tertiary stabilization."
            red_flags = ["Cyanosis or oxygen drop < 88%", "Loss of consciousness or altered sensorium", "Severe intractable headache or chest pressure"]
            investigations = ["Urgent 12-Lead ECG", "Continuous Pulse Oximetry", "Complete Blood Count & Serum Electrolytes", "Urine Protein Dipstick"]
            translations = {
                "en": {
                    "differential_diagnosis": differential,
                    "clinical_reasoning": clinical_reasoning,
                    "red_flag_warnings": red_flags,
                    "recommended_investigations": investigations,
                    "recommended_action": action
                },
                "hi": {
                    "differential_diagnosis": ["हाइपरटेंसिव क्राइसिस / प्री-एक्लेम्पसिया", "गंभीर श्वसन विफलता", "कार्डियोवैस्कुलर आपातकाल"],
                    "clinical_reasoning": f"गंभीर स्थिति के संकेत ({reason})। तत्काल डॉक्टर सत्यापन एवं अस्पताल में स्थिरीकरण आवश्यक है।",
                    "red_flag_warnings": ["ऑक्सीजन स्तर 88% से कम होना", "बेहोशी या भ्रम की स्थिति", "सीने में तेज दबाव या असहनीय सिरदर्द"],
                    "recommended_investigations": ["तत्काल 12-लीड ईसीजी", "पल्स ऑक्सीमेट्री निगरानी", "सीबीसी एवं सीरम इलेक्ट्रोलाइट्स", "मूत्र प्रोटीन जांच"],
                    "recommended_action": "निकटतम आपातकालीन स्वास्थ्य केंद्र/अस्पताल में तत्काल चिकित्सा सहायता एवं रेफरल।"
                },
                "mr": {
                    "differential_diagnosis": ["उच्च रक्तदाब आणीबाणी / प्री-एक्लॅम्प्सिया", "तीव्र श्वसन अपुरेपणा", "हृदय व रक्तवाहिन्यासंबंधी आणीबाणी"],
                    "clinical_reasoning": f"शारीरिक स्थिती खालावल्याची चिन्हे ({reason})। त्वरित वैद्यकीय अधिकारी तपासणी व रुग्णालयात दाखल करणे आवश्यक.",
                    "red_flag_warnings": ["ऑक्सिजन पातळी ८८% पेक्षा कमी होणे", "बेशुद्ध पडणे किंवा चक्कर येणे", "छातीत तीव्र दाब किंवा असह्य डोकेदुखी"],
                    "recommended_investigations": ["तातडीची १२-लीड ईसीजी", "सतत पल्स ऑक्सिमीटर तपासणी", "सीबीसी आणि सीरम इलेक्ट्रोलाइट्स", "लघवी प्रोटीन तपासणी"],
                    "recommended_action": "जवळच्या आपत्कालीन आरोग्य केंद्र किंवा रुग्णालयात तातडीने वैद्यकीय उपचार व रेफरल."
                }
            }
        elif rule_priority == "P2":
            differential = ["Acute Febrile Illness (Suspected Dengue/Malaria/Viral)", "Lower Respiratory Tract Infection", "Gastroenteritis with Dehydration"]
            clinical_reasoning = f"Prolonged or elevated vitals: {reason}. Needs prompt Medical Officer evaluation to prevent escalation."
            red_flags = ["Persistent vomiting preventing hydration", "Temperature spike > 103°F", "Onset of petechial rash or bleeding"]
            investigations = ["Rapid Diagnostic Test for Malaria / Dengue NS1", "Complete Blood Count (Platelet count)", "Serum Creatinine"]
            translations = {
                "en": {
                    "differential_diagnosis": differential,
                    "clinical_reasoning": clinical_reasoning,
                    "red_flag_warnings": red_flags,
                    "recommended_investigations": investigations,
                    "recommended_action": action
                },
                "hi": {
                    "differential_diagnosis": ["तीव्र ज्वर (डेंगू/मलेरिया/वायरल का संदेह)", "श्वसन तंत्र संक्रमण", "निर्जलीकरण युक्त गैस्ट्रोएंटेराइटिस"],
                    "clinical_reasoning": f"लगातार बुखार या असामान्य लक्षण: {reason}। स्थिति बिगड़ने से पहले चिकित्सा अधिकारी द्वारा जांच आवश्यक।",
                    "red_flag_warnings": ["लगातार उल्टी व पानी की कमी", "तापमान 103°F से अधिक होना", "त्वचा पर लाल चकत्ते या रक्तस्त्राव"],
                    "recommended_investigations": ["मलेरिया/डेंगू एनएस1 रैपिड जांच", "सीबीसी (प्लेटलेट काउंट)", "सीरम क्रिएटिनिन"],
                    "recommended_action": "4 घंटे के भीतर चिकित्सा अधिकारी के साथ टेली-परामर्श। आशा कार्यकर्ता द्वारा फॉलो-अप।"
                },
                "mr": {
                    "differential_diagnosis": ["तीव्र ताप (डेंग्यू/मलेरिया/व्हायरल संशय)", "श्वसननलिका संसर्ग", "पाण्याच्या कमतरतेसह गॅस्ट्रो"],
                    "clinical_reasoning": f"दीर्घकालीन किंवा वाढलेली लक्षणे: {reason}। परिस्थिती अधिक बिघडू नये म्हणून वैद्यकीय अधिकाऱ्यांची तातडीची तपासणी आवश्यक.",
                    "red_flag_warnings": ["सतत उलट्या व डिहायड्रेशन", "ताप १०३°F पेक्षा जास्त वाढणे", "अंगावर लाल पुरळ किंवा रक्तस्त्राव"],
                    "recommended_investigations": ["मलेरिया / डेंग्यू एनएस१ जलद चाचणी", "सीबीसी (प्लेटलेट मोजणी)", "सीरम क्रिएटिनिन"],
                    "recommended_action": "४ तासांच्या आत वैद्यकीय अधिकाऱ्यांशी टेलिकन्सल्टेशन. आशा सेविकेद्वारे पाठपुरावा."
                }
            }
        else:
            differential = ["Upper Respiratory Tract Infection / Common Cold", "Mild Tension Headache", "Routine Stable Evaluation"]
            clinical_reasoning = "Vitals and reported signs are within safe ambulatory thresholds. Standard primary healthcare protocol applies."
            red_flags = ["Development of breathlessness", "Fever persisting past 3 days"]
            investigations = ["Routine Vital Monitoring", "Hydration & Symptomatic Review"]
            translations = {
                "en": {
                    "differential_diagnosis": differential,
                    "clinical_reasoning": clinical_reasoning,
                    "red_flag_warnings": red_flags,
                    "recommended_investigations": investigations,
                    "recommended_action": action
                },
                "hi": {
                    "differential_diagnosis": ["सामान्य सर्दी-जुकाम / ऊपरी श्वसन संक्रमण", "हल्का सिरदर्द", "नियमित सामान्य स्वास्थ्य जांच"],
                    "clinical_reasoning": "सभी शारीरिक पैरामीटर सामान्य सीमा में हैं। नियमित प्राथमिक स्वास्थ्य देखभाल प्रोटोकॉल लागू होता है।",
                    "red_flag_warnings": ["सांस लेने में तकलीफ होना", "3 दिन से अधिक समय तक बुखार रहना"],
                    "recommended_investigations": ["नियमित शारीरिक जांच", "पर्याप्त पानी व लक्षणाधारित आराम"],
                    "recommended_action": "नियमित पीएचसी ओपीडी भेंट, गृह देखभाल मार्गदर्शन, या सुविधानुसार टेली-परामर्श।"
                },
                "mr": {
                    "differential_diagnosis": ["सामान्य सर्दी-खोकला / वरच्या श्वसनमार्गाचा संसर्ग", "सामान्य डोकेदुखी", "नियमित स्थिर तपासणी"],
                    "clinical_reasoning": "शारीरिक तपासणी सामान्य कक्षेत आहे. मानक प्राथमिक आरोग्य सेवा मार्गदर्शन पुरेसे आहे.",
                    "red_flag_warnings": ["श्वास घेण्यास त्रास जाणवणे", "ताप ३ दिवसांपेक्षा जास्त राहणे"],
                    "recommended_investigations": ["नियमित तपासणी निरीक्षण", "भरपूर पाणी पिणे व लक्षणाधारित विश्रांती"],
                    "recommended_action": "नियमित प्राथमिक आरोग्य केंद्र ओपीडी भेट, घरगुती काळजी किंवा सवडीनुसार टेलिकन्सल्टेशन."
                }
            }

        final_priority = rule_priority
        final_confidence = base_confidence

        # 3. Call Google Gemini for contextual clinical AI diagnosis
        gemini_result = self._call_gemini_diagnosis(
            vitals=vitals,
            rule_priority=rule_priority,
            triggers=triggers,
            age=age,
            gender=gender,
            patient_name=patient_name
        )

        if gemini_result:
            # Enforce safety guardrail: Gemini can elevate, but can NEVER downgrade below rule baseline
            priority_rank = {"P3": 1, "P2": 2, "P1": 3}
            raw_p = str(gemini_result.get("priority", rule_priority)).upper().strip()
            if "P1" in raw_p:
                gemini_priority = "P1"
            elif "P2" in raw_p:
                gemini_priority = "P2"
            elif "P3" in raw_p:
                gemini_priority = "P3"
            else:
                gemini_priority = rule_priority

            if priority_rank.get(gemini_priority, 1) > priority_rank.get(rule_priority, 1):
                final_priority = gemini_priority
                triage_label = f"{final_priority} Critical" if final_priority == "P1" else f"{final_priority} Urgent"
                triggers.append(f"AI Clinical Elevation: Gemini identified high-risk symptoms requiring {final_priority} management")
                if final_priority == "P1":
                    action = "Immediate Medical Attention & Referral to nearest Emergency Healthcare Facility / Hospital."
                elif final_priority == "P2":
                    action = "Urgent Tele-consultation with Medical Officer within 4 hours. ASHA follow-up."

            differential = gemini_result.get("differential_diagnosis") or differential
            clinical_reasoning = gemini_result.get("clinical_reasoning") or clinical_reasoning
            red_flags = gemini_result.get("red_flag_warnings") or red_flags
            investigations = gemini_result.get("recommended_investigations") or investigations
            if gemini_result.get("confidence_score"):
                final_confidence = float(gemini_result["confidence_score"])
            if gemini_result.get("immediate_first_aid"):
                action = f"{action} First Aid: {gemini_result['immediate_first_aid']}"

            # Merge Gemini trilingual translations if provided
            gemini_translations = gemini_result.get("translations")
            if isinstance(gemini_translations, dict):
                if "hi" in gemini_translations and isinstance(gemini_translations["hi"], dict):
                    translations["hi"] = {
                        "differential_diagnosis": gemini_translations["hi"].get("differential_diagnosis") or translations["hi"]["differential_diagnosis"],
                        "clinical_reasoning": gemini_translations["hi"].get("clinical_reasoning") or translations["hi"]["clinical_reasoning"],
                        "red_flag_warnings": gemini_translations["hi"].get("red_flag_warnings") or translations["hi"]["red_flag_warnings"],
                        "recommended_investigations": gemini_translations["hi"].get("recommended_investigations") or translations["hi"]["recommended_investigations"],
                        "recommended_action": gemini_translations["hi"].get("immediate_first_aid") or translations["hi"]["recommended_action"]
                    }
                if "mr" in gemini_translations and isinstance(gemini_translations["mr"], dict):
                    translations["mr"] = {
                        "differential_diagnosis": gemini_translations["mr"].get("differential_diagnosis") or translations["mr"]["differential_diagnosis"],
                        "clinical_reasoning": gemini_translations["mr"].get("clinical_reasoning") or translations["mr"]["clinical_reasoning"],
                        "red_flag_warnings": gemini_translations["mr"].get("red_flag_warnings") or translations["mr"]["red_flag_warnings"],
                        "recommended_investigations": gemini_translations["mr"].get("recommended_investigations") or translations["mr"]["recommended_investigations"],
                        "recommended_action": gemini_translations["mr"].get("immediate_first_aid") or translations["mr"]["recommended_action"]
                    }
            translations["en"] = {
                "differential_diagnosis": differential,
                "clinical_reasoning": clinical_reasoning,
                "red_flag_warnings": red_flags,
                "recommended_investigations": investigations,
                "recommended_action": action
            }

        return {
            "priority": final_priority,
            "triage_label": triage_label,
            "triage_reason": reason,
            "confidence_score": final_confidence,
            "doctor_verification_required": True,
            "is_diagnosis": False,
            "disclaimer": self.disclaimer,
            "triggers": triggers,
            "recommended_action": action,
            "differential_diagnosis": differential,
            "clinical_reasoning": clinical_reasoning,
            "red_flag_warnings": red_flags,
            "recommended_investigations": investigations,
            "translations": translations,
            "model_engine": self.model_version
        }

# Global triage engine singleton
triage_engine = TriageEngine()

