"use client";

import { useEffect, useState, useRef, useCallback } from 'react';
import { X, Mic, MicOff } from 'lucide-react';

interface SpeechToTextModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTranscript: (transcript: string) => void;
  theme?: 'light' | 'dark';
}

export default function SpeechToTextModal({ isOpen, onClose, onTranscript, theme = 'light' }: SpeechToTextModalProps) {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const pipelineRef = useRef<any>(null);

  // Use the preloaded Whisper pipeline
  useEffect(() => {
    if (typeof window === 'undefined') return;
    let cancelled = false;
    const loadWhisper = async () => {
      try {
        setIsLoading(true);
        const { getOrLoadModel } = await import('@/lib/modelManager');
        const whisperModel = await getOrLoadModel();
        if (!cancelled) {
          pipelineRef.current = whisperModel;
        }
      } catch (err) {
        console.error('Failed to load Whisper model:', err);
        setError('Failed to load speech recognition model');
      } finally {
        setIsLoading(false);
      }
    };
    if (isOpen) {
      loadWhisper();
    }
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  const startRecording = useCallback(async () => {
    try {
      setError(null);
      audioChunksRef.current = [];
      
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        try {
          setIsLoading(true);
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          const audioBuffer = await audioBlob.arrayBuffer();
          console.log('[STT Modal] Audio buffer byteLength:', audioBuffer.byteLength);
          const audioContext = new AudioContext();
          const audioData = await audioContext.decodeAudioData(audioBuffer);
          console.log('[STT Modal] Decoded audio duration (s):', audioData.duration);

          // Convert audio buffer to a copy of Float32Array
          const channelData = audioData.getChannelData(0);
          const float32Array = new Float32Array(channelData.length);
          float32Array.set(channelData);
          console.log('[STT Modal] Float32Array length:', float32Array.length, 'Sample rate:', audioData.sampleRate);

          // Resample to 16kHz mono Float32Array for Whisper
          async function resampleTo16kHz(input: Float32Array, inputSampleRate: number): Promise<Float32Array> {
            if (inputSampleRate === 16000) return input;
            const offlineCtx = new OfflineAudioContext(1, Math.ceil(input.length * 16000 / inputSampleRate), 16000);
            const buffer = offlineCtx.createBuffer(1, input.length, inputSampleRate);
            buffer.copyToChannel(input, 0);
            const source = offlineCtx.createBufferSource();
            source.buffer = buffer;
            source.connect(offlineCtx.destination);
            source.start();
            const rendered = await offlineCtx.startRendering();
            return rendered.getChannelData(0);
          }

          const resampled = await resampleTo16kHz(float32Array, audioData.sampleRate);
          console.log('[STT Modal] Resampled Float32Array length:', resampled.length);

          // Transcribe using Whisper
          if (!pipelineRef.current) {
            setError('Speech model not loaded');
            setIsLoading(false);
            return;
          }
          const result = await pipelineRef.current(resampled, {
            chunk_length_s: 30,
            stride_length_s: 5,
            return_timestamps: false,
          });
          console.log('[STT Modal] Whisper output:', result);
          if (!result || !result.text || !result.text.trim()) {
            setError('No speech detected or transcription was empty.');
          } else {
            setTranscript(prev => prev + ' ' + result.text);
          }
        } catch (err) {
          console.error('Transcription error:', err);
          setError('Failed to transcribe audio');
        } finally {
          setIsLoading(false);
        }
      };

      mediaRecorder.start();
      setIsListening(true);
    } catch (err) {
      console.error('Recording error:', err);
      setError('Failed to access microphone');
      setIsListening(false);
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      setIsListening(false);
    }
  }, []);

  // Auto-start recording when modal opens
  useEffect(() => {
    if (!isOpen) {
      stopRecording();
      setTranscript('');
      setError(null);
    } else if (pipelineRef.current && !isListening) {
      // Auto-start recording after a brief delay for animation
      const timer = setTimeout(() => {
        startRecording();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isOpen, stopRecording, startRecording, isListening]);

  const handleClose = () => {
    stopRecording();
    onClose();
  };

  const handleSubmit = () => {
    if (transcript.trim()) {
      onTranscript(transcript.trim());
    }
    handleClose();
  };

  if (!isOpen) return null;

  const isDark = theme === 'dark';
  const bgClass = isDark ? 'bg-black/95' : 'bg-white/95';
  const modalBgClass = isDark ? 'bg-black border-gray-800' : 'bg-white border-gray-200';
  const closeButtonClass = isDark ? 'text-gray-500 hover:text-gray-300' : 'text-gray-400 hover:text-gray-600';
  const recordingBorderClass = isListening 
    ? (isDark ? 'border-white bg-white/5 shadow-lg shadow-white/20' : 'border-black bg-black/5 shadow-lg shadow-black/20')
    : (isDark ? 'border-gray-700 bg-gray-900/50' : 'border-gray-300 bg-gray-100/50');
  const micClass = isListening 
    ? (isDark ? 'text-white' : 'text-black')
    : (isDark ? 'text-gray-500' : 'text-gray-400');
  const pingClass = isDark ? 'border-white/30' : 'border-black/30';
  const statusTextClass = isDark ? 'text-white' : 'text-black';
  const loadingTextClass = isDark ? 'text-gray-400' : 'text-gray-600';
  const loadingDotClass = isDark ? 'bg-gray-400' : 'bg-gray-600';
  const readyTextClass = isDark ? 'text-gray-500' : 'text-gray-400';
  const transcriptBgClass = isDark ? 'bg-gray-900/50 border-gray-800' : 'bg-gray-100/50 border-gray-200';
  const transcriptTextClass = isDark ? 'text-gray-200' : 'text-gray-800';
  const primaryButtonClass = isListening
    ? (isDark ? 'bg-white text-black hover:bg-gray-100' : 'bg-black text-white hover:bg-gray-800')
    : (isDark ? 'bg-gray-900 text-white border-gray-700 hover:bg-gray-800' : 'bg-gray-100 text-black border-gray-300 hover:bg-gray-200');
  const secondaryButtonClass = isDark ? 'bg-white text-black hover:bg-gray-100' : 'bg-black text-white hover:bg-gray-800';

  return (
    <div className={`fixed inset-0 ${bgClass} backdrop-blur-md z-50 flex items-center justify-center animate-in fade-in duration-300`}>
      <div className={`relative w-full h-full ${modalBgClass} shadow-2xl animate-in slide-in-from-bottom-4 duration-500 ease-out`}>
        <button
          onClick={handleClose}
          className={`absolute top-8 right-8 ${closeButtonClass} transition-colors z-10`}
          disabled={isLoading}
        >
          <X size={24} />
        </button>

        <div className="flex flex-col items-center justify-center h-full p-8 space-y-12">
          {/* Recording indicator */}
          <div className="relative">
            <div
              className={`w-32 h-32 rounded-full border-4 flex items-center justify-center transition-all duration-300 ${recordingBorderClass}`}
            >
              {isListening && (
                <div className={`absolute inset-0 rounded-full border-4 ${pingClass} animate-ping`}></div>
              )}
              {isListening ? (
                <Mic size={48} className={`${micClass} relative z-10`} />
              ) : (
                <MicOff size={48} className={micClass} />
              )}
            </div>
          </div>

          {/* Status message */}
          <div className="text-center">
            {isLoading ? (
              <div className="flex items-center justify-center space-x-3">
                <div className={`w-3 h-3 ${loadingDotClass} rounded-full animate-pulse`}></div>
                <p className={`${loadingTextClass} text-lg`}>Processing...</p>
              </div>
            ) : error ? (
              <p className="text-red-500 text-lg">{error}</p>
            ) : isListening ? (
              <p className={`${statusTextClass} text-xl font-medium`}>Listening</p>
            ) : (
              <p className={`${readyTextClass} text-lg`}>Initializing...</p>
            )}
          </div>

          {/* Transcript */}
          {transcript && (
            <div className={`w-full max-w-2xl max-h-48 overflow-y-auto p-6 ${transcriptBgClass} rounded-2xl animate-in slide-in-from-bottom-2 duration-300`}>
              <p className={`${transcriptTextClass} text-lg leading-relaxed text-center`}>
                {transcript}
              </p>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex flex-col w-full max-w-sm space-y-4">
            <button
              onClick={isListening ? stopRecording : startRecording}
              disabled={isLoading}
              className={`w-full py-4 px-8 rounded-2xl text-lg font-medium transition-all duration-200 ${primaryButtonClass} ${isLoading ? 'opacity-50 cursor-not-allowed' : 'active:scale-95'}`}
            >
              {isListening ? 'Stop Recording' : 'Start Recording'}
            </button>

            {transcript && (
              <button
                onClick={handleSubmit}
                disabled={isLoading}
                className={`w-full py-4 px-8 ${secondaryButtonClass} rounded-2xl text-lg font-medium transition-all duration-200 hover:scale-105 active:scale-95 animate-in slide-in-from-bottom-2 duration-300`}
              >
                Send to Chat
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}