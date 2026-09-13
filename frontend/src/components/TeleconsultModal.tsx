// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { translations } from '../i18n/translations';
import { api } from '../services/api';
import { 
  X, 
  Video, 
  Mic, 
  MicOff, 
  VideoOff, 
  MessageSquare, 
  PhoneOff, 
  Camera, 
  Send, 
  FileText,
  UserCheck,
  ExternalLink,
  Globe
} from 'lucide-react';

export const TeleconsultModal = ({
  isOpen,
  onClose,
  language,
  patientRecord
}) => {
  const t = translations[language] || translations.en;
  const [activeTab, setActiveTab] = useState('video');
  const [isMicOn, setIsMicOn] = useState(true);
  const [isVideoOn, setIsVideoOn] = useState(true);
  const [useIframe, setUseIframe] = useState(false);
  const [roomData, setRoomData] = useState(null);
  
  const initialGreeting = language === 'mr' 
    ? 'नमस्कार, मी वैद्यकीय अधिकारी बोलतोय. काय त्रास होतोय?' 
    : language === 'hi' 
    ? 'नमस्कार, मैं चिकित्सा अधिकारी बोल रहा हूँ। क्या तकलीफ हो रही है?' 
    : 'Hello, Medical Officer here. How are you feeling today?';

  const [messages, setMessages] = useState([
    { 
      sender: 'System', 
      text: language === 'mr' 
        ? 'ई-संजीवनी टेलिकन्सल्टेशन सत्र सुरू झाले' 
        : language === 'hi' 
        ? 'ई-संजीवनी टेलीपरामर्श सत्र प्रारंभ' 
        : 'eSanjeevani Teleconsultation Session Connected', 
      time: '12:00 PM' 
    },
    { sender: 'Medical Officer', text: initialGreeting, time: '12:01 PM' }
  ]);
  const [inputMsg, setInputMsg] = useState('');
  const [doctorNotes, setDoctorNotes] = useState('Advised Tab Paracetamol 500mg SOS, ORS sips, rest, review if symptoms persist > 48h.');

  // Create or fetch dynamic eSanjeevani / Jitsi room on open
  useEffect(() => {
    if (isOpen && patientRecord) {
      const initRoom = async () => {
        try {
          const room = await api.createTeleconsultRoom(
            patientRecord.patient_name,
            patientRecord.priority || 'P2',
            patientRecord.village || 'Primary Health Centre',
            patientRecord.id,
            'Medical Officer'
          );
          setRoomData(room);
        } catch (err) {
          console.warn('Backend teleconsult room creation fallback:', err);
          const mockId = 'sevasetu-' + (patientRecord.id || Date.now());
          setRoomData({
            session_id: mockId,
            room_url: `https://meet.jit.si/${mockId}#config.prejoinConfig.enabled=false`,
            room_name: mockId,
            priority: patientRecord.priority || 'P2'
          });
        }
      };
      initRoom();
    }
  }, [isOpen, patientRecord]);

  if (!isOpen || !patientRecord) return null;

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!inputMsg.trim()) return;
    setMessages(prev => [
      ...prev,
      { sender: 'Doctor Desk', text: inputMsg, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }
    ]);
    setInputMsg('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
      <div className="bg-white rounded-3xl max-w-5xl w-full h-[90vh] flex flex-col overflow-hidden shadow-2xl border border-slate-300">
        {/* Top Header */}
        <div className="bg-slate-900 text-white p-4 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-teal-600 flex items-center justify-center text-white font-bold text-lg">
              🩺
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="font-extrabold text-base sm:text-lg">
                  {language === 'mr' ? 'ई-संजीवनी टेलिकन्सल्टेशन कक्ष' : language === 'hi' ? 'ई-संजीवनी टेलीपरामर्श कक्ष' : 'eSanjeevani Teleconsultation Room'}
                </h3>
                <span className="bg-teal-500/30 text-teal-300 border border-teal-500/40 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">
                  Connected
                </span>
                {roomData?.priority && (
                  <span className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase ${
                    roomData.priority === 'P1' ? 'bg-red-500/30 text-red-300 border border-red-500/40' : 'bg-amber-500/30 text-amber-300 border border-amber-500/40'
                  }`}>
                    {roomData.priority}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400">
                {t.name || 'Patient'}: <strong className="text-white">{patientRecord.patient_name}</strong> ({patientRecord.age} Y, {patientRecord.gender}) • {t.village || 'Village'}: {patientRecord.village}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {roomData?.room_url && (
              <a
                href={roomData.room_url}
                target="_blank"
                rel="noreferrer"
                className="hidden sm:flex items-center space-x-1 text-xs bg-slate-800 hover:bg-slate-700 text-teal-300 px-3 py-1.5 rounded-xl border border-slate-700 transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Open in WebRTC Tab</span>
              </a>
            )}
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-full transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Mode Switcher Tabs */}
        <div className="flex items-center justify-between bg-slate-100 px-4 py-2 border-b border-slate-200 gap-2 overflow-x-auto">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('video')}
              className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'video' ? 'bg-teal-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-200'
              }`}
            >
              <Video className="w-4 h-4" />
              <span>{language === 'mr' ? 'व्हिडिओ कॉल' : language === 'hi' ? 'वीडियो कॉल' : 'Video Call'}</span>
            </button>
            <button
              onClick={() => setActiveTab('audio')}
              className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'audio' ? 'bg-teal-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-200'
              }`}
            >
              <Mic className="w-4 h-4" />
              <span>{language === 'mr' ? 'ऑडिओ कॉल' : language === 'hi' ? 'ऑडियो कॉल' : 'Audio Call'}</span>
            </button>
            <button
              onClick={() => setActiveTab('chat')}
              className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'chat' ? 'bg-teal-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-200'
              }`}
            >
              <MessageSquare className="w-4 h-4" />
              <span>{language === 'mr' ? 'थेट संदेश' : language === 'hi' ? 'लाइव चैट' : 'Live Chat'}</span>
            </button>
            <button
              onClick={() => setActiveTab('async')}
              className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'async' ? 'bg-teal-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-200'
              }`}
            >
              <Camera className="w-4 h-4" />
              <span>{language === 'mr' ? 'व्हॉइस व फोटो' : language === 'hi' ? 'वॉइस व फोटो' : 'Voice & Photo'}</span>
            </button>
          </div>

          {activeTab === 'video' && roomData?.room_url && (
            <button
              onClick={() => setUseIframe(!useIframe)}
              className="text-xs font-bold text-teal-700 bg-teal-50 border border-teal-200 px-3 py-1 rounded-xl hover:bg-teal-100 flex items-center space-x-1 cursor-pointer"
            >
              <Globe className="w-3.5 h-3.5" />
              <span>{useIframe ? 'Standard Stream UI' : 'Embed Jitsi Meet'}</span>
            </button>
          )}
        </div>

        {/* Modal Main Content Area */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-3 overflow-hidden bg-slate-900 text-white">
          {/* Main Stage (Video / Audio / Async) */}
          <div className="md:col-span-2 relative flex flex-col items-center justify-center p-4 bg-slate-950 border-r border-slate-800">
            {activeTab === 'video' && (
              <div className="w-full h-full rounded-2xl overflow-hidden relative bg-slate-900 flex items-center justify-center border border-slate-800">
                {useIframe && roomData?.room_url ? (
                  <iframe
                    src={roomData.room_url}
                    allow="camera; microphone; fullscreen; display-capture; autoplay"
                    className="w-full h-full border-0 rounded-2xl"
                    title="eSanjeevani WebRTC Teleconsultation Room"
                  />
                ) : isVideoOn ? (
                  <div className="relative w-full h-full flex items-center justify-center bg-gradient-to-tr from-slate-900 via-teal-950 to-slate-900">
                    <div className="text-center p-6">
                      <div className="w-24 h-24 rounded-full bg-teal-800/80 border-4 border-teal-500 flex items-center justify-center text-4xl shadow-xl mx-auto mb-3 animate-pulse">
                        👤
                      </div>
                      <h4 className="text-xl font-bold text-white">{patientRecord.patient_name}</h4>
                      <p className="text-sm text-teal-300 font-medium">
                        {language === 'mr' ? 'उपकेंद्र जोडलेले' : language === 'hi' ? 'उपकेंद्र कनेक्टेड' : 'Connected from Sub-Centre Node'}
                      </p>
                      <span className="inline-block mt-2 bg-emerald-500/20 text-emerald-300 text-xs px-2.5 py-0.5 rounded-full border border-emerald-500/30">
                        eSanjeevani HD 720p Active
                      </span>
                    </div>

                    {/* Doctor Mini View in corner */}
                    <div className="absolute top-4 right-4 w-32 h-24 bg-slate-800 rounded-xl border-2 border-teal-500 overflow-hidden shadow-lg flex flex-col items-center justify-center p-1">
                      <div className="text-xl">🩺</div>
                      <span className="text-[10px] text-teal-200 font-bold mt-1">Medical Officer</span>
                    </div>
                  </div>
                ) : (
                  <div className="text-center text-slate-500">
                    <VideoOff className="w-16 h-16 mx-auto mb-2" />
                    <p className="text-sm font-semibold">Video Off</p>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'audio' && (
              <div className="text-center p-6 bg-slate-900 rounded-2xl border border-slate-800 w-full max-w-md">
                <div className="w-20 h-20 rounded-full bg-teal-600 flex items-center justify-center mx-auto mb-4 animate-pulse text-3xl">
                  📞
                </div>
                <h4 className="text-lg font-bold text-white">{patientRecord.patient_name}</h4>
                <p className="text-xs text-slate-400 mt-1">
                  {language === 'mr' ? 'ग्रामीण भागासाठी कमी बँडविड्थ मोड' : language === 'hi' ? 'कम बैंडविड्थ मोड' : 'Optimized for Rural Low-Bandwidth Networks'}
                </p>
                <div className="flex items-center justify-center space-x-1 mt-4">
                  {[40, 70, 90, 50, 80, 100, 60, 90, 40].map((h, i) => (
                    <div key={i} className="w-1.5 bg-teal-400 rounded-full animate-bounce" style={{ height: `${h}%`, animationDelay: `${i * 0.1}s` }}></div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'async' && (
              <div className="w-full max-w-md bg-slate-900 p-4 rounded-2xl border border-slate-800 space-y-4">
                <h4 className="text-sm font-bold text-teal-300">
                  {language === 'mr' ? 'आशा सेविकेने पाठवलेले रेकॉर्डिंग व फोटो:' : language === 'hi' ? 'आशा कार्यकर्ता द्वारा अपलोड वॉइस व फोटो:' : 'ASHA Uploaded Clinical Media:'}
                </h4>
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-lg bg-teal-900 flex items-center justify-center text-teal-300">
                    🎙️
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-bold text-white">
                      {language === 'mr' ? 'आरोग्य सेविका (आशा) व्हॉइस नोट' : language === 'hi' ? 'आशा कार्यकर्ता वॉइस नोट' : 'Community Health Worker (ASHA) Voice Note'}
                    </p>
                    <p className="text-[11px] text-slate-400">0:42 sec • Audio description</p>
                  </div>
                  <button 
                    onClick={() => alert('Playing voice recording recorded by ASHA worker.')}
                    className="px-3 py-1 bg-teal-600 text-white rounded-lg text-xs font-bold hover:bg-teal-700 cursor-pointer"
                  >
                    Play
                  </button>
                </div>
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                  <p className="text-xs font-bold text-white mb-1.5">
                    {language === 'mr' ? 'क्लिनिकल फोटो:' : language === 'hi' ? 'क्लिनिकल फोटो:' : 'Clinical Photograph:'}
                  </p>
                  <div className="w-full h-32 bg-slate-900 rounded-lg border border-dashed border-slate-700 flex flex-col items-center justify-center text-slate-500">
                    <Camera className="w-8 h-8 mb-1" />
                    <span className="text-xs">Clinical Photograph Attached</span>
                  </div>
                </div>
              </div>
            )}

            {/* In-Call Floating Control Bar */}
            <div className="absolute bottom-6 flex items-center space-x-3 bg-slate-900/90 backdrop-blur-md p-2 rounded-2xl border border-slate-700 shadow-xl">
              <button
                onClick={() => setIsMicOn(!isMicOn)}
                className={`p-3 rounded-xl transition-all cursor-pointer ${isMicOn ? 'bg-slate-800 text-white hover:bg-slate-700' : 'bg-red-600 text-white'}`}
                title="Toggle Mic"
              >
                {isMicOn ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
              </button>

              <button
                onClick={() => setIsVideoOn(!isVideoOn)}
                className={`p-3 rounded-xl transition-all cursor-pointer ${isVideoOn ? 'bg-slate-800 text-white hover:bg-slate-700' : 'bg-red-600 text-white'}`}
                title="Toggle Camera"
              >
                {isVideoOn ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
              </button>

              <button
                onClick={onClose}
                className="flex items-center space-x-1.5 px-4 py-3 bg-red-600 hover:bg-red-700 active:scale-95 text-white rounded-xl font-bold text-xs shadow-md transition-all cursor-pointer"
                title="End Consultation Call"
              >
                <PhoneOff className="w-4 h-4" />
                <span>{language === 'mr' ? 'कॉल समाप्त करा' : language === 'hi' ? 'कॉल समाप्त करें' : 'End Call'}</span>
              </button>
            </div>
          </div>

          {/* Right Panel: Clinical Notes & Chat */}
          <div className="flex flex-col bg-white text-slate-900 border-l border-slate-200">
            <div className="p-4 border-b border-slate-200 bg-slate-50">
              <h4 className="font-extrabold text-sm text-slate-900 flex items-center space-x-2">
                <FileText className="w-4 h-4 text-teal-600" />
                <span>{language === 'mr' ? 'ई-प्रिस्क्रिप्शन व सूचना' : language === 'hi' ? 'ई-नुस्खा एवं निर्देश' : 'e-Prescription & Notes'}</span>
              </h4>
              <p className="text-xs text-slate-500 mt-0.5">
                {language === 'mr' ? 'ABDM आरोग्य रेकॉर्डशी थेट संलग्न' : language === 'hi' ? 'ABDM स्वास्थ्य रिकॉर्ड से जुड़ा हुआ' : 'Linked to ABDM Health Record'}
              </p>
            </div>

            <div className="flex-1 p-4 overflow-y-auto space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  {language === 'mr' ? 'औषधोपचार व सूचना:' : language === 'hi' ? 'चिकित्सकीय सलाह:' : 'Clinical Advice & Instructions:'}
                </label>
                <textarea
                  value={doctorNotes}
                  onChange={(e) => setDoctorNotes(e.target.value)}
                  rows={4}
                  className="w-full p-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-teal-500 text-xs text-slate-900 outline-none"
                  placeholder="Type clinical advice..."
                />
              </div>

              <div>
                <span className="font-bold text-slate-700 block mb-1">
                  {language === 'mr' ? 'थेट संदेश:' : language === 'hi' ? 'लाइव संदेश:' : 'In-Call Chat:'}
                </span>
                <div className="h-32 overflow-y-auto bg-slate-50 p-2.5 rounded-xl border border-slate-200 space-y-2">
                  {messages.map((m, idx) => (
                    <div key={idx} className={`p-1.5 rounded-lg ${m.sender === 'System' ? 'bg-slate-200 text-slate-600 text-[10px]' : 'bg-teal-50 border border-teal-200 text-slate-800'}`}>
                      <div className="flex justify-between items-center text-[10px] font-bold text-teal-900">
                        <span>{m.sender}</span>
                        <span className="text-slate-400 font-normal">{m.time}</span>
                      </div>
                      <p className="mt-0.5 text-xs">{m.text}</p>
                    </div>
                  ))}
                </div>
              </div>

              <form onSubmit={handleSendMessage} className="flex gap-2">
                <input
                  type="text"
                  value={inputMsg}
                  onChange={(e) => setInputMsg(e.target.value)}
                  placeholder="Type message..."
                  className="flex-1 px-3 py-1.5 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
                <button type="submit" className="px-3 py-1.5 bg-teal-600 text-white rounded-xl font-bold text-xs hover:bg-teal-700 cursor-pointer">
                  <Send className="w-3.5 h-3.5" />
                </button>
              </form>
            </div>

            <div className="p-4 border-t border-slate-200 bg-slate-50">
              <button
                onClick={() => {
                  const saveAlert = language === 'mr'
                    ? `${patientRecord.patient_name} यांच्यासाठी प्रिस्क्रिप्शन जतन झाले.`
                    : language === 'hi'
                    ? `${patientRecord.patient_name} के लिए नुस्खा सुरक्षित किया गया।`
                    : `e-Prescription saved and issued for ${patientRecord.patient_name}`;
                  alert(saveAlert);
                  onClose();
                }}
                className="w-full py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-bold text-xs flex items-center justify-center space-x-2 shadow-md cursor-pointer"
              >
                <UserCheck className="w-4 h-4" />
                <span>
                  {language === 'mr' ? 'प्रिस्क्रिप्शन जतन करा' : language === 'hi' ? 'नुस्खा सुरक्षित करें' : 'Save Prescription & End'}
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
