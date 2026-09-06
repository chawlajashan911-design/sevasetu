"""
Mock Adapters for Indian Public Digital Health Infrastructure:
1. BHASHINI (National Language Translation & Speech Mission)
2. ABDM / FHIR (Ayushman Bharat Digital Mission - ABHA & FHIR Health Records)
3. eSanjeevani (National Teleconsultation Service)
"""

import uuid
import random
from datetime import datetime
from typing import Dict, Any, List

class BhashiniService:
    """Mock adapter for Bhashini API for Indic voice and text translation"""

    DICTIONARY_MAPPING = {
        "fever": {"mr": "ताप", "hi": "बुखार"},
        "cough": {"mr": "खोकला", "hi": "खांसी"},
        "chest pain": {"mr": "छातीत दुखणे", "hi": "सीने में दर्द"},
        "headache": {"mr": "डोकेदुखी", "hi": "सिरदर्द"},
        "high bp": {"mr": "उच्च रक्तदाब", "hi": "हाई ब्लड प्रेशर"},
        "breathlessness": {"mr": "श्वास घेण्यास त्रास", "hi": "सांस लेने में तकलीफ"},
        "vomiting": {"mr": "उलटी", "hi": "उल्टी"},
        "weakness": {"mr": "अशक्तपणा", "hi": "कमजोरी"},
    }

    @staticmethod
    def translate_text(text: str, source_lang: str, target_lang: str) -> Dict[str, Any]:
        """Translates basic clinical symptoms between English, Marathi, and Hindi"""
        if source_lang == target_lang:
            return {"translated_text": text, "source": source_lang, "target": target_lang, "status": "identical"}
        
        # Simple lookup enhancement
        translated = text
        for en_word, translations in BhashiniService.DICTIONARY_MAPPING.items():
            if source_lang == "en" and en_word in text.lower():
                translated = translated.replace(en_word, translations.get(target_lang, en_word))
        
        return {
            "source_lang": source_lang,
            "target_lang": target_lang,
            "original_text": text,
            "translated_text": translated,
            "engine": "BHASHINI-IndicTrans-v2-Mock",
            "confidence": 0.94
        }

    @staticmethod
    def process_voice_asr(audio_duration_seconds: float, language: str) -> Dict[str, Any]:
        """Simulates ASR processing response from BHASHINI speech pipeline"""
        return {
            "session_id": str(uuid.uuid4()),
            "language": language,
            "duration": audio_duration_seconds,
            "status": "success",
            "asr_engine": "BHASHINI-Whisper-Indic-Fast",
            "detected_intent": "HEALTH_CHECK_VITALS"
        }


class AbdmFhirService:
    """Mock adapter for Ayushman Bharat Digital Mission (ABDM) & FHIR R4 Bundle generator"""

    @staticmethod
    def generate_abha_id(name: str, phone: str) -> Dict[str, str]:
        """Generates a realistic 14-digit ABHA Number and ABHA Address"""
        clean_phone = "".join(filter(str.isdigit, phone))[-4:] if phone else "9999"
        num1 = random.randint(10, 99)
        num2 = random.randint(1000, 9999)
        num3 = random.randint(1000, 9999)
        abha_number = f"{num1}-{num2}-{num3}-{clean_phone}"
        
        first_name = name.split()[0].lower() if name else "patient"
        abha_address = f"{first_name}.{clean_phone}@abdm"

        return {
            "abha_number": abha_number,
            "abha_address": abha_address,
            "status": "ACTIVE_VERIFIED",
            "kyc_status": "DEMO_VERIFIED",
            "issuer": "National Health Authority (NHA) - ABDM Sandbox"
        }

    @staticmethod
    def export_fhir_r4_bundle(patient: Dict[str, Any], vitals: Dict[str, Any], triage_result: Dict[str, Any]) -> Dict[str, Any]:
        """Creates an ABDM/FHIR compliant R4 Health Document Bundle"""
        bundle_id = str(uuid.uuid4())
        patient_id = f"Patient-{patient.get('id', 'DEMO')}"
        encounter_id = f"Encounter-{bundle_id[:8]}"

        fhir_bundle = {
            "resourceType": "Bundle",
            "id": bundle_id,
            "meta": {
                "versionId": "1",
                "lastUpdated": datetime.utcnow().isoformat() + "Z",
                "profile": ["https://nrces.in/ndhm/fhir/r4/StructureDefinition/DocumentBundle"]
            },
            "type": "document",
            "entry": [
                {
                    "resource": {
                        "resourceType": "Patient",
                        "id": patient_id,
                        "identifier": [{"system": "https://healthid.ndhm.gov.in", "value": patient.get("abha_id", "N/A")}],
                        "name": [{"text": patient.get("name", "Unknown")}],
                        "telecom": [{"system": "phone", "value": patient.get("phone", "")}],
                        "gender": patient.get("gender", "unknown").lower(),
                        "address": [{"city": patient.get("village", "Kharpudi"), "district": "Pune", "state": "Maharashtra"}]
                    }
                },
                {
                    "resource": {
                        "resourceType": "Observation",
                        "id": f"Obs-Vitals-{bundle_id[:8]}",
                        "status": "final",
                        "code": {"text": "Vital signs and Clinical Triage"},
                        "subject": {"reference": patient_id},
                        "component": [
                            {"code": {"text": "Systolic BP"}, "valueQuantity": {"value": vitals.get("systolic_bp"), "unit": "mmHg"}},
                            {"code": {"text": "SpO2"}, "valueQuantity": {"value": vitals.get("spo2"), "unit": "%"}},
                            {"code": {"text": "Body Temperature"}, "valueQuantity": {"value": vitals.get("temperature"), "unit": "degF"}},
                        ]
                    }
                },
                {
                    "resource": {
                        "resourceType": "ClinicalImpression",
                        "id": f"Impression-{bundle_id[:8]}",
                        "status": "in-progress",
                        "description": f"AI Rule Triage Priority: {triage_result.get('priority')} ({triage_result.get('triage_label')})",
                        "note": [{"text": triage_result.get("triage_reason", "")}]
                    }
                }
            ]
        }
        return fhir_bundle


class ESanjeevaniService:
    """Mock adapter for eSanjeevani National Tele-consultation Platform"""

    @staticmethod
    def create_teleconsult_session(patient_name: str, priority: str, doctor_id: str = "DOC_PHC_01") -> Dict[str, Any]:
        """Creates an eSanjeevani teleconsultation session room"""
        session_id = f"ESANJ-{random.randint(100000, 999999)}"
        room_token = f"rtc_tok_{uuid.uuid4().hex[:16]}"
        
        waiting_time_mins = 2 if priority == "P1" else (10 if priority == "P2" else 25)

        return {
            "session_id": session_id,
            "eSanjeevani_hub": "Kharpudi PHC Tele-Health Node",
            "spoke_facility": "Kharpudi Health & Wellness Centre",
            "patient_name": patient_name,
            "priority": priority,
            "assigned_doctor": "Dr. Anand Kulkarni (MBBS, MO Kharpudi PHC)",
            "room_token": room_token,
            "webrtc_channel": f"channel_{session_id}",
            "status": "WAITING_FOR_DOCTOR",
            "estimated_wait_minutes": waiting_time_mins,
            "channel_supported_modes": ["video", "audio", "chat", "async_voice_photo"]
        }
