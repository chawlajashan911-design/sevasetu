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
        correlate with vital signs, and provide expert clinical differential diagnoses.
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
- P1 (Critical / Resuscitation / Immediate): Life-threatening emergency, impending collapse, severe respiratory distress, acute coronary syndrome/angina, altered consciousness, shock, or severe hypertensive crisis. Immediate referral and 108 ambulance standby.
- P2 (Urgent / High Priority): Potentially unstable, high pyrexia (>=102°F), prolonged illness (>3 days) with systemic decline, intractable vomiting, severe dehydration, or infectious warning signs. Urgent doctor teleconsult or PHC review within 1-4 hours.
- P3 (Routine / Ambulatory): Stable vitals, mild self-limiting symptoms (cold, mild headache, minor ache). Standard OPD or home monitoring.

INSTRUCTIONS:
1. Assign priority as "P1", "P2", or "P3" based on the clinical intake. (Clinical Safety Guardrail: You may ELEVATE priority if danger signs are detected in symptoms, but NEVER downgrade below the rule baseline level '{rule_priority}').
2. Identify the top 2-3 most probable differential diagnoses based on the clinical presentation.
3. Write concise clinical reasoning (2-3 sentences) explaining the pathophysiology and urgency.
4. List 2-4 critical red-flag symptoms to watch out for.
5. Recommend 2-4 primary diagnostic investigations or immediate stabilization steps appropriate for a rural PHC or referral hospital.

Return ONLY a valid, raw JSON object with this exact structure (no markdown fences, no extra text):
{{
  "priority": "{rule_priority}",
  "confidence_score": 0.96,
  "differential_diagnosis": ["Condition 1", "Condition 2"],
  "clinical_reasoning": "Detailed clinical rationale...",
  "red_flag_warnings": ["Sign 1", "Sign 2"],
  "recommended_investigations": ["Investigation 1", "Investigation 2"],
  "immediate_first_aid": "Stabilization guidance..."
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
        2. Google Gemini 3.6 Flash provides contextual clinical diagnosis & reasoning.
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
            action = "Immediate Medical Attention & Referral to nearest Emergency Healthcare Facility / Hospital. 108 Ambulance ready."
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

        # Default clinical heuristics for fallback
        differential: List[str] = []
        clinical_reasoning: Optional[str] = None
        red_flags: List[str] = []
        investigations: List[str] = []

        if rule_priority == "P1":
            differential = ["Hypertensive Crisis / Pre-Eclampsia", "Acute Respiratory Insufficiency", "Cardiovascular Emergency"]
            clinical_reasoning = f"Physiological decompensation indicated by {reason}. Requires urgent physician triage and tertiary stabilization."
            red_flags = ["Cyanosis or oxygen drop < 88%", "Loss of consciousness or altered sensorium", "Severe intractable headache or chest pressure"]
            investigations = ["Urgent 12-Lead ECG", "Continuous Pulse Oximetry", "Complete Blood Count & Serum Electrolytes", "Urine Protein Dipstick"]
        elif rule_priority == "P2":
            differential = ["Acute Febrile Illness (Suspected Dengue/Malaria/Viral)", "Lower Respiratory Tract Infection", "Gastroenteritis with Dehydration"]
            clinical_reasoning = f"Prolonged or elevated vitals: {reason}. Needs prompt Medical Officer evaluation to prevent escalation."
            red_flags = ["Persistent vomiting preventing hydration", "Temperature spike > 103°F", "Onset of petechial rash or bleeding"]
            investigations = ["Rapid Diagnostic Test for Malaria / Dengue NS1", "Complete Blood Count (Platelet count)", "Serum Creatinine"]
        else:
            differential = ["Upper Respiratory Tract Infection / Common Cold", "Mild Tension Headache", "Routine Stable Evaluation"]
            clinical_reasoning = "Vitals and reported signs are within safe ambulatory thresholds. Standard primary healthcare protocol applies."
            red_flags = ["Development of breathlessness", "Fever persisting past 3 days"]
            investigations = ["Routine Vital Monitoring", "Hydration & Symptomatic Review"]

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
                    action = "Immediate Medical Attention & Referral to nearest Emergency Healthcare Facility / Hospital. 108 Ambulance ready."
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
            "model_engine": self.model_version
        }

# Global triage engine singleton
triage_engine = TriageEngine()

