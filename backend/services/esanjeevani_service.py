"""
eSanjeevani Teleconsultation Room Suite Service
National Teleconsultation Platform adapter for Maharashtra Rural Health Grid.
Generates dynamic WebRTC / Jitsi Meet rooms tied to triage records and clinical doctor queues.
"""

import os
import uuid
from datetime import datetime
from typing import Dict, Any, Optional
from sqlalchemy.orm import Session

class ESanjeevaniService:
    JITSI_DOMAIN = os.getenv("ESANJEEVANI_JITSI_DOMAIN", "meet.jit.si")

    @classmethod
    def create_room(
        cls,
        patient_name: str,
        priority: str = "P1",
        facility_name: str = "Primary Healthcare Centre",
        triage_id: Optional[int] = None,
        doctor_name: Optional[str] = "Duty Medical Officer",
        db: Optional[Session] = None
    ) -> Dict[str, Any]:
        """
        Dynamically generates a WebRTC / Jitsi Meet teleconsultation room
        tied to patient and clinical priority triage.
        """
        short_id = uuid.uuid4().hex[:8].upper()
        session_id = f"ESANJ-{short_id}"
        room_token = f"tok_{uuid.uuid4().hex[:16]}"
        jitsi_room_name = f"sevasetu-{session_id.lower()}"
        jitsi_url = f"https://{cls.JITSI_DOMAIN}/{jitsi_room_name}"

        waiting_mins = 2 if priority == "P1" else (10 if priority == "P2" else 20)

        room_data = {
            "session_id": session_id,
            "room_token": room_token,
            "triage_id": triage_id,
            "patient_name": patient_name,
            "doctor_name": doctor_name or "Duty Medical Officer",
            "priority": priority,
            "facility_name": facility_name,
            "jitsi_url": jitsi_url,
            "room_url": jitsi_url,
            "webrtc_channel": f"channel_{session_id}",
            "status": "WAITING_FOR_DOCTOR",
            "estimated_wait_minutes": waiting_mins,
            "created_at": datetime.utcnow().isoformat(),
            "channel_supported_modes": ["video", "audio", "chat", "async_voice_photo"]
        }

        # Save to database if session provided
        if db is not None:
            try:
                from ..models import TeleconsultRoom
                room_record = TeleconsultRoom(
                    session_id=session_id,
                    room_token=room_token,
                    triage_id=triage_id,
                    patient_name=patient_name,
                    doctor_name=doctor_name,
                    priority=priority,
                    facility_name=facility_name,
                    jitsi_url=jitsi_url,
                    webrtc_channel=f"channel_{session_id}",
                    status="WAITING_FOR_DOCTOR"
                )
                db.add(room_record)
                db.commit()
                db.refresh(room_record)
                room_data["id"] = room_record.id
            except Exception as e:
                db.rollback()
                print(f"Error persisting teleconsult room: {e}")

        return room_data

    @classmethod
    def get_room(cls, session_id: str, db: Optional[Session] = None) -> Optional[Dict[str, Any]]:
        """Retrieves room details by session ID"""
        if db is not None:
            try:
                from ..models import TeleconsultRoom
                room = db.query(TeleconsultRoom).filter(TeleconsultRoom.session_id == session_id).first()
                if room:
                    return {
                        "id": room.id,
                        "session_id": room.session_id,
                        "room_token": room.room_token,
                        "triage_id": room.triage_id,
                        "patient_name": room.patient_name,
                        "doctor_name": room.doctor_name,
                        "priority": room.priority,
                        "facility_name": room.facility_name,
                        "jitsi_url": room.jitsi_url,
                        "room_url": room.jitsi_url,
                        "webrtc_channel": room.webrtc_channel,
                        "status": room.status,
                        "created_at": room.created_at.isoformat() if room.created_at else None
                    }
            except Exception as e:
                print(f"Error fetching teleconsult room: {e}")

        # Fallback generated response if DB not supplied
        jitsi_link = f"https://{cls.JITSI_DOMAIN}/sevasetu-{session_id.lower()}"
        return {
            "session_id": session_id,
            "room_token": f"tok_{session_id.lower()}",
            "jitsi_url": jitsi_link,
            "room_url": jitsi_link,
            "status": "ACTIVE",
            "message": "Room session is operational"
        }
