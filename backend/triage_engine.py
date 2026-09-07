"""
Rural Healthcare AI Triage Engine (SIH26133)
Structured rule-based clinical triage with pluggable interface for future XGBoost / ML models.

Triage Tiers:
- P1 Critical:
    * Systolic BP >= 160 mmHg OR Diastolic BP >= 100 mmHg
    * SpO2 <= 90%
    * High-risk maternal indicators (severe pre-eclampsia, hemorrhage, severe abdominal pain, labor onset)
- P2 Urgent:
    * Temperature >= 102.0 °F
    * Symptom duration > 3 days (e.g. persistent fever, severe cough, dehydration)
- P3 Routine:
    * All other stable conditions
"""

from typing import Dict, Any, List, Tuple
from .schemas import VitalsInput

class TriageEngine:
    def __init__(self, model_version: str = "v1.2-rule-engine"):
        self.model_version = model_version
        self.disclaimer = (
            "Clinical AI Triage Priority Score — NOT a medical diagnosis. "
            "Doctor verification required."
        )

    def evaluate(self, vitals: VitalsInput) -> Dict[str, Any]:
        """
        Evaluates input vitals and symptoms to compute triage priority (P1/P2/P3),
        confidence score, uncertainty flag, triggered rules, and recommended actions.
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

        # Decision Matrix
        if p1_triggers:
            priority = "P1"
            triage_label = "P1 Critical"
            reason = " | ".join(p1_triggers)
            triggers = p1_triggers
            confidence = 0.96
            action = "Immediate Medical Attention & Referral to nearest Emergency Healthcare Facility / Hospital. 108 Ambulance ready."
        elif p2_triggers:
            priority = "P2"
            triage_label = "P2 Urgent"
            reason = " | ".join(p2_triggers)
            triggers = p2_triggers
            confidence = 0.92
            action = "Urgent Tele-consultation with Medical Officer within 4 hours. ASHA follow-up."
        else:
            priority = "P3"
            triage_label = "P3 Routine"
            reason = "Vitals within stable baseline limits. Mild or transient symptoms."
            triggers = ["Vitals in stable range", "No critical danger signs reported"]
            confidence = 0.89
            action = "Routine PHC OPD visit, home care guidance, or tele-consultation at convenience."

        # Structured response
        return {
            "priority": priority,
            "triage_label": triage_label,
            "triage_reason": reason,
            "confidence_score": confidence,
            "doctor_verification_required": True,
            "is_diagnosis": False,
            "disclaimer": self.disclaimer,
            "triggers": triggers,
            "recommended_action": action,
            "model_engine": self.model_version
        }

# Global triage engine singleton
triage_engine = TriageEngine()
