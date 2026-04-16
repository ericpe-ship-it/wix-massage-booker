import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import { Save, NotebookPen, Music, Upload, Play, Trash2, Mic, Square, Sparkles, Search } from 'lucide-react';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

const CHIMES = [
  { value: 'bell', label: '🔔 Bell', desc: 'Classic, clear bell tone' },
  { value: 'bowl', label: '🪘 Singing Bowl', desc: 'Deep, resonant meditation bowl' },
  { value: 'chime', label: '🎐 Wind Chime', desc: 'Gentle, airy wind chime' },
  { value: 'gong', label: '🥁 Gong', desc: 'Rich, powerful gong strike' },
  { value: 'marimba', label: '🎵 Marimba', desc: 'Warm, wooden marimba notes' },
  { value: 'none', label: '🔇 No Sound', desc: 'Silent – no chime at session end' },
];

function playChime(type) {
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  const configs = {
    bell: [{ freq: 830, gain: 0.6, decay: 2.8, type: 'sine' }, { freq: 1245, gain: 0.3, decay: 2.2, type: 'sine' }, { freq: 1660, gain: 0.15, decay: 1.8, type: 'sine' }],
    bowl: [{ freq: 220, gain: 0.5, decay: 4.5, type: 'sine' }, { freq: 440, gain: 0.25, decay: 3.5, type: 'sine' }, { freq: 660, gain: 0.1, decay: 2.5, type: 'sine' }],
    chime: [{ freq: 523, gain: 0.4, decay: 1.5, type: 'sine' }, { freq: 659, gain: 0.35, decay: 1.2, type: 'sine' }, { freq: 784, gain: 0.3, decay: 1.0, type: 'sine' }, { freq: 1047, gain: 0.25, decay: 0.8, type: 'sine' }],
    gong: [{ freq: 110, gain: 0.7, decay: 5.0, type: 'sine' }, { freq: 220, gain: 0.35, decay: 4.0, type: 'sine' }, { freq: 330, gain: 0.15, decay: 3.0, type: 'triangle' }],
    marimba: [{ freq: 523, gain: 0.5, decay: 0.8, type: 'triangle' }, { freq: 659, gain: 0.4, decay: 0.6, type: 'triangle' }, { freq: 784, gain: 0.35, decay: 0.5, type: 'triangle' }, { freq: 1047, gain: 0.3, decay: 0.4, type: 'triangle' }, { freq: 1319, gain: 0.2, decay: 0.3, type: 'triangle' }],
  };
  const partials = configs[type] || configs.bell;
  const startTime = ctx.currentTime;
  partials.forEach(({ freq, gain, decay, type: waveType }, i) => {
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();
    osc.connect(gainNode);
    gainNode.connect(ctx.destination);
    osc.type = waveType;
    osc.frequency.setValueAtTime(freq, startTime);
    gainNode.gain.setValueAtTime(0, startTime);
    gainNode.gain.linearRampToValueAtTime(gain, startTime + 0.01 + i * 0.05);
    gainNode.gain.exponentialRampToValueAtTime(0.001, startTime + decay + i * 0.05);
    osc.start(startTime + i * 0.05);
    osc.stop(startTime + decay + i * 0.05 + 0.1);
  });
}

export default function MyProfile() {
  const { toast } = useToast();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [personalNote, setPersonalNote] = useState('');
  const [chimePreference, setChimePreference] = useState('bell');
  const [customChimeUrl, setCustomChimeUrl] = useState('');
  const [uploadingChime, setUploadingChime] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [songSearch, setSongSearch] = useState('');
  const [aiChimeBase, setAiChimeBase] = useState('bell');
  const [generatingAiChime, setGeneratingAiChime] = useState(false);
  const [aiChimePreview, setAiChimePreview] = useState(null);
  const fileInputRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const recordingChunksRef = useRef([]);
  const recordingTimerRef = useRef(null);

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    const me = await base44.auth.me();
    setUser(me);
    setPersonalNote(me.personal_note || '');
    setChimePreference(me.chime_preference || 'bell');
    setCustomChimeUrl(me.custom_chime_url || '');
    setLoading(false);
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('audio/')) {
      toast({ title: 'Invalid file', description: 'Please upload an audio file (mp3, wav, ogg, etc.)', variant: 'destructive' });
      return;
    }
    setUploadingChime(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setCustomChimeUrl(file_url);
    setChimePreference('custom');
    setUploadingChime(false);
    toast({ title: 'Audio uploaded!', description: 'Your custom chime is ready.' });
  };

  const playCustomChime = () => {
    if (!customChimeUrl) return;
    if (customChimeUrl.startsWith('ai:')) {
      const data = JSON.parse(customChimeUrl.slice(3));
      playAiChimeNotes(data.notes, data.chimeType);
    } else {
      const audio = new Audio(customChimeUrl);
      audio.play();
    }
  };

  const removeCustomChime = () => {
    setCustomChimeUrl('');
    if (chimePreference === 'custom') setChimePreference('bell');
  };

  const startRecording = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mediaRecorder = new MediaRecorder(stream);
    mediaRecorderRef.current = mediaRecorder;
    recordingChunksRef.current = [];

    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) recordingChunksRef.current.push(e.data);
    };

    mediaRecorder.onstop = async () => {
      stream.getTracks().forEach(t => t.stop());
      const blob = new Blob(recordingChunksRef.current, { type: 'audio/webm' });
      const file = new File([blob], 'recording.webm', { type: 'audio/webm' });
      setUploadingChime(true);
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setCustomChimeUrl(file_url);
      setChimePreference('custom');
      setUploadingChime(false);
      toast({ title: 'Recording saved!', description: 'Your recorded chime is ready.' });
    };

    mediaRecorder.start();
    setIsRecording(true);
    setRecordingSeconds(0);
    recordingTimerRef.current = setInterval(() => {
      setRecordingSeconds(s => s + 1);
    }, 1000);
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    clearInterval(recordingTimerRef.current);
    setIsRecording(false);
    setRecordingSeconds(0);
  };

  const playAiChimeNotes = (notes, chimeType) => {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    notes.forEach(({ freq, delay, duration }) => {
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();
      osc.connect(gainNode);
      gainNode.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime + delay);
      gainNode.gain.setValueAtTime(0, ctx.currentTime + delay);
      gainNode.gain.linearRampToValueAtTime(0.5, ctx.currentTime + delay + 0.01);
      gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + duration);
      osc.start(ctx.currentTime + delay);
      osc.stop(ctx.currentTime + delay + duration + 0.1);
    });
  };

  const generateAiChime = async () => {
    if (!songSearch.trim()) return;
    setGeneratingAiChime(true);
    try {
      const result = await base44.integrations.Core.InvokeLLM({
        add_context_from_internet: true,
        prompt: `Find the most recognizable melody hook from "${songSearch}" and transcribe it into exact notes with frequencies and timing. Return JSON with: song (string), bpm (number), notes (array of {note, freq, delay, duration}).`,
        response_json_schema: {
          type: 'object',
          properties: {
            song: { type: 'string' },
            bpm: { type: 'number' },
            notes: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  note: { type: 'string' },
                  freq: { type: 'number' },
                  delay: { type: 'number' },
                  duration: { type: 'number' }
                }
              }
            }
          }
        }
      });
      setAiChimePreview({ notes: result.notes, label: result.song });
      playAiChimeNotes(result.notes, aiChimeBase);
    } finally {
      setGeneratingAiChime(false);
    }
  };

  const saveProfile = async () => {
    setSaving(true);
    await base44.auth.updateMe({
      personal_note: personalNote,
      chime_preference: chimePreference,
      custom_chime_url: customChimeUrl
    });
    toast({ title: 'Profile saved!' });
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">My Profile</h1>
      <p className="text-gray-500 mb-8">{user?.full_name} · {user?.email}</p>

      {/* Personal Note */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 mb-6">
        <div className="flex items-center gap-2 mb-3">
          <NotebookPen className="w-5 h-5 text-indigo-500" />
          <h2 className="font-semibold text-gray-900">Session Note</h2>
        </div>
        <p className="text-sm text-gray-500 mb-3">This note is visible to your therapist before each session.</p>
        <Textarea
          value={personalNote}
          onChange={(e) => setPersonalNote(e.target.value)}
          placeholder="e.g. Please focus on my shoulders and neck..."
          className="h-28 resize-none"
        />
      </div>

      {/* Chime Preference */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 mb-6">
        <div className="flex items-center gap-2 mb-3">
          <Music className="w-5 h-5 text-indigo-500" />
          <h2 className="font-semibold text-gray-900">Session End Chime</h2>
        </div>
        <p className="text-sm text-gray-500 mb-4">Choose the sound played when your session timer ends.</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-4">
          {CHIMES.map(c => (
            <button
              key={c.value}
              onClick={() => { setChimePreference(c.value); if (c.value !== 'none' && c.value !== 'custom') playChime(c.value); }}
              className={`text-left p-3 rounded-lg border transition-all ${chimePreference === c.value ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 hover:border-indigo-300'}`}
            >
              <div className="font-medium text-sm">{c.label}</div>
              <div className="text-xs text-gray-500 mt-0.5">{c.desc}</div>
            </button>
          ))}
        </div>

        {/* Custom upload */}
        <div className="border-t pt-4">
          <p className="text-sm font-medium text-gray-700 mb-2">Or use a custom sound:</p>
          <div className="flex gap-2 flex-wrap">
            <Button size="sm" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={uploadingChime}>
              <Upload className="w-3 h-3 mr-1" /> Upload Audio
            </Button>
            <input ref={fileInputRef} type="file" accept="audio/*" className="hidden" onChange={handleFileUpload} />
            <Button size="sm" variant="outline" onClick={isRecording ? stopRecording : startRecording}>
              {isRecording ? <><Square className="w-3 h-3 mr-1" /> Stop ({recordingSeconds}s)</> : <><Mic className="w-3 h-3 mr-1" /> Record</>}
            </Button>
            {customChimeUrl && (
              <>
                <Button size="sm" variant="outline" onClick={playCustomChime}><Play className="w-3 h-3 mr-1" /> Preview</Button>
                <Button size="sm" variant="outline" onClick={removeCustomChime}><Trash2 className="w-3 h-3 mr-1" /> Remove</Button>
              </>
            )}
          </div>
        </div>

        {/* AI Chime */}
        <div className="border-t pt-4 mt-4">
          <p className="text-sm font-medium text-gray-700 mb-2">🤖 AI Song Chime — type any song:</p>
          <div className="flex gap-2">
            <Input
              value={songSearch}
              onChange={(e) => setSongSearch(e.target.value)}
              placeholder="e.g. Happy Birthday, Let It Go..."
              onKeyDown={(e) => e.key === 'Enter' && generateAiChime()}
            />
            <Button size="sm" onClick={generateAiChime} disabled={generatingAiChime || !songSearch.trim()}>
              {generatingAiChime ? <LoadingSpinner size="sm" /> : <><Sparkles className="w-3 h-3 mr-1" /> Generate</>}
            </Button>
          </div>
          {aiChimePreview && (
            <div className="mt-2 flex items-center gap-2 text-sm text-gray-600">
              <span>✓ {aiChimePreview.label}</span>
              <Button size="sm" variant="outline" onClick={() => playAiChimeNotes(aiChimePreview.notes, aiChimeBase)}>
                <Play className="w-3 h-3 mr-1" /> Play Again
              </Button>
              <Button size="sm" onClick={() => {
                setCustomChimeUrl('ai:' + JSON.stringify({ notes: aiChimePreview.notes, chimeType: aiChimeBase }));
                setChimePreference('custom');
                toast({ title: 'AI chime saved!' });
              }} className="bg-indigo-600 hover:bg-indigo-700">
                Use This
              </Button>
            </div>
          )}
        </div>
      </div>

      <Button onClick={saveProfile} disabled={saving} className="w-full bg-indigo-600 hover:bg-indigo-700">
        {saving ? <LoadingSpinner size="sm" /> : <><Save className="w-4 h-4 mr-2" /> Save Profile</>}
      </Button>
    </div>
  );
}