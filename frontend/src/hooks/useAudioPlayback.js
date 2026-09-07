import { useEffect, useRef, useState, useCallback } from 'react';
import { Howl } from 'howler';
import { AGENT_MAP } from '../constants/agentConfigs';

/**
 * useAudioPlayback Hook
 * Manages Howler audio playback for character dialogues, procedural phoneme blips,
 * movement footsteps, and interaction SFX.
 */
export function useAudioPlayback() {
  const [isMuted, setIsMuted] = useState(false);
  const [speechSynthesisEnabled, setSpeechSynthesisEnabled] = useState(true);
  const [volume, setVolume] = useState(0.8);
  const activeHowlRef = useRef(null);
  const speechUtteranceRef = useRef(null);
  const blipIntervalRef = useRef(null);

  // Procedural Web Audio context for realistic phoneme chirps / blips
  const audioCtxRef = useRef(null);

  const getAudioContext = useCallback(() => {
    if (!audioCtxRef.current) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        audioCtxRef.current = new AudioCtx();
      }
    }
    if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume();
    }
    return audioCtxRef.current;
  }, []);

  // Play a procedural pitch-shifted phoneme blip for character speech
  const playPhoneme = useCallback((frequency = 250, duration = 0.06) => {
    if (isMuted) return;
    try {
      const ctx = getAudioContext();
      if (!ctx) return;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(frequency, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(frequency * 1.1, ctx.currentTime + duration);

      const targetGain = 0.08 * volume;
      gain.gain.setValueAtTime(targetGain, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch (err) {
      // Audio autoplay may need user gesture
    }
  }, [isMuted, volume, getAudioContext]);

  // Play interaction SFX
  const playSfx = useCallback((type) => {
    if (isMuted) return;
    try {
      const ctx = getAudioContext();
      if (!ctx) return;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      if (type === 'step') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(120, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(60, ctx.currentTime + 0.04);
        gain.gain.setValueAtTime(0.04 * volume, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.04);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.04);
      } else if (type === 'sit') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(180, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(240, ctx.currentTime + 0.08);
        gain.gain.setValueAtTime(0.05 * volume, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.08);
      } else if (type === 'agree') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.12);
        gain.gain.setValueAtTime(0.06 * volume, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.12);
      } else if (type === 'point') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(600, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(400, ctx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.05 * volume, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.1);
      }
    } catch (e) {
      // ignore
    }
  }, [isMuted, volume, getAudioContext]);

  // Stop currently playing speech audio
  const stopSpeech = useCallback(() => {
    if (activeHowlRef.current) {
      activeHowlRef.current.stop();
      activeHowlRef.current = null;
    }
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    if (blipIntervalRef.current) {
      clearInterval(blipIntervalRef.current);
      blipIntervalRef.current = null;
    }
  }, []);

  // Play character speech event: Howler audio_url OR SpeechSynthesis / phoneme blips
  // NOTE: Voice readout / TTS is strictly reserved for the Steelman (Crucible Arbiter). Evaluators do NOT speak aloud.
  /**
   * @param {{ speakerId: string; dialogue?: string | null; audioUrl?: string | null; onEnd?: () => void }} params
   */
  const playSpeech = useCallback(({ speakerId, dialogue, audioUrl = null, onEnd = () => {} }) => {
    stopSpeech();
    if (isMuted || !dialogue) {
      onEnd?.();
      return;
    }

    // Enforce Steelman-only voice: AI evaluators do NOT talk or speak aloud
    const isSteelmanSpeaker = speakerId === 'steelman' || speakerId === 'arbiter' || speakerId === 'moderator';
    if (!isSteelmanSpeaker) {
      onEnd?.();
      return;
    }

    const agent = AGENT_MAP[speakerId] || {};
    const agentFreq = agent.audioFrequency || 220;
    const agentPitch = agent.audioPitch || 1.0;

    // 1. If real audio_url is provided, stream via Howler
    if (audioUrl) {
      try {
        const sound = new Howl({
          src: [audioUrl],
          html5: true,
          volume: volume,
          onend: () => {
            activeHowlRef.current = null;
            onEnd?.();
          },
          onloaderror: (id, err) => {
            console.warn('Howler load error, falling back to synthesis', err);
            activeHowlRef.current = null;
            onEnd?.();
          },
        });
        activeHowlRef.current = sound;
        sound.play();
        return;
      } catch (err) {
        console.warn('Howler error', err);
      }
    }

    // 2. Synthesized speech or phoneme chatter
    if (speechSynthesisEnabled && 'speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(dialogue);
      utterance.pitch = agentPitch;
      utterance.rate = 1.05;
      utterance.volume = volume;

      // Select distinct voices if available
      const voices = window.speechSynthesis.getVoices();
      if (voices.length > 0) {
        // Deterministic voice selection per agent
        const index = parseInt(speakerId.replace(/\D/g, '') || '0', 10) % voices.length;
        utterance.voice = voices[index];
      }

      utterance.onend = () => {
        speechUtteranceRef.current = null;
        onEnd?.();
      };
      utterance.onerror = () => {
        speechUtteranceRef.current = null;
        onEnd?.();
      };

      speechUtteranceRef.current = utterance;
      window.speechSynthesis.speak(utterance);
    } else {
      // Phoneme blips fallback (Animal Crossing / Sci-Fi radio style)
      let count = 0;
      const totalBlips = Math.min(Math.max(Math.floor(dialogue.length / 3), 4), 18);
      blipIntervalRef.current = setInterval(() => {
        playPhoneme(agentFreq + (Math.random() * 40 - 20));
        count++;
        if (count >= totalBlips) {
          clearInterval(blipIntervalRef.current);
          blipIntervalRef.current = null;
          setTimeout(() => onEnd?.(), 300);
        }
      }, 100);
    }
  }, [isMuted, volume, speechSynthesisEnabled, stopSpeech, playPhoneme]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      stopSpeech();
      if (audioCtxRef.current) {
        audioCtxRef.current.close().catch(() => {});
      }
    };
  }, [stopSpeech]);

  return {
    isMuted,
    setIsMuted,
    speechSynthesisEnabled,
    setSpeechSynthesisEnabled,
    volume,
    setVolume,
    playSpeech,
    stopSpeech,
    playSfx,
  };
}

export default useAudioPlayback;
