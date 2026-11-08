import {
  ref,
  set,
  push,
  onValue,
  onChildAdded,
  remove,
  Unsubscribe,
} from 'firebase/database';
import { getAppDatabase } from './firebase';
import { WebRTCCallStatus } from '../types/game';

export interface WebRTCVoiceCallbacks {
  onStatusChange: (status: WebRTCCallStatus) => void;
  onVolumeChange?: (volume: number) => void;
  onError?: (err: Error) => void;
}

export class WebRTCVoiceSession {
  private roomCode: string;
  private myUid: string;
  private isHost: boolean;
  private callbacks: WebRTCVoiceCallbacks;

  private peerConnection: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private remoteAudio: HTMLAudioElement | null = null;
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private animFrameId: number | null = null;

  private unsubOffer: Unsubscribe | null = null;
  private unsubAnswer: Unsubscribe | null = null;
  private unsubCandidates: Unsubscribe | null = null;
  private isMuted: boolean = false;
  private destroyed: boolean = false;

  constructor(roomCode: string, myUid: string, isHost: boolean, callbacks: WebRTCVoiceCallbacks) {
    this.roomCode = roomCode;
    this.myUid = myUid;
    this.isHost = isHost;
    this.callbacks = callbacks;
  }

  public async start(): Promise<void> {
    if (this.destroyed) return;

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      this.callbacks.onStatusChange('unsupported');
      throw new Error('متصفحك لا يدعم الوصول للميكروفون أو WebRTC.');
    }

    this.callbacks.onStatusChange('requesting_permissions');

    try {
      // 1. Get user audio media with echo cancellation, noise suppression, auto gain control
      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      });

      this.callbacks.onStatusChange('connecting');

      // 2. Setup audio volume analyser for visual feedback
      this.setupVolumeMeter(this.localStream);

      // 3. Prepare remote audio playback element
      this.remoteAudio = new Audio();
      this.remoteAudio.autoplay = true;
      (this.remoteAudio as any).playsInline = true;

      // 4. Fetch ICE servers (STUN + optional TURN from /api/ice-config)
      const iceServers = await this.fetchIceConfig();

      // 5. Initialize RTCPeerConnection
      this.peerConnection = new RTCPeerConnection({
        iceServers,
        iceCandidatePoolSize: 10,
      });

      // Add local audio tracks to peer connection
      this.localStream.getTracks().forEach((track) => {
        if (this.peerConnection && this.localStream) {
          this.peerConnection.addTrack(track, this.localStream);
        }
      });

      // Handle incoming remote audio stream
      this.peerConnection.ontrack = (event) => {
        if (this.remoteAudio && event.streams[0]) {
          this.remoteAudio.srcObject = event.streams[0];
          this.remoteAudio.play().catch((e) => {
            console.warn('Audio auto-play blocked, awaiting user tap:', e);
          });
        }
      };

      // Handle connection state changes
      this.peerConnection.onconnectionstatechange = () => {
        if (!this.peerConnection) return;
        const state = this.peerConnection.connectionState;
        if (state === 'connected') {
          this.callbacks.onStatusChange(this.isMuted ? 'muted' : 'connected');
        } else if (state === 'connecting') {
          this.callbacks.onStatusChange('connecting');
        } else if (state === 'disconnected') {
          this.callbacks.onStatusChange('disconnected');
        } else if (state === 'failed') {
          this.callbacks.onStatusChange('failed');
          this.attemptIceRestart();
        }
      };

      this.peerConnection.oniceconnectionstatechange = () => {
        if (!this.peerConnection) return;
        const iceState = this.peerConnection.iceConnectionState;
        if (iceState === 'connected' || iceState === 'completed') {
          this.callbacks.onStatusChange(this.isMuted ? 'muted' : 'connected');
        } else if (iceState === 'failed') {
          this.attemptIceRestart();
        }
      };

      // 6. Handle local ICE candidates and write to Firebase RTDB
      const db = getAppDatabase();
      if (!db) {
        // In Local Simulation Mode, microphone is active locally with live visual volume meter
        this.callbacks.onStatusChange(this.isMuted ? 'muted' : 'connected');
        return;
      }

      this.peerConnection.onicecandidate = (event) => {
        if (event.candidate && db) {
          const candidateRef = push(ref(db, `rooms/${this.roomCode}/signaling/candidates/${this.myUid}`));
          set(candidateRef, event.candidate.toJSON()).catch(console.error);
        }
      };

      // 7. Signaling handshake
      if (this.isHost) {
        // Host creates Offer
        const offer = await this.peerConnection.createOffer({
          offerToReceiveAudio: true,
        });
        await this.peerConnection.setLocalDescription(offer);

        await set(ref(db, `rooms/${this.roomCode}/signaling/offer`), {
          type: offer.type,
          sdp: offer.sdp,
          senderUid: this.myUid,
          createdAt: Date.now(),
        });

        // Host listens for Answer from guest
        const answerRef = ref(db, `rooms/${this.roomCode}/signaling/answer`);
        this.unsubAnswer = onValue(answerRef, async (snap) => {
          const answer = snap.val();
          if (
            answer &&
            this.peerConnection &&
            answer.senderUid !== this.myUid &&
            !this.peerConnection.currentRemoteDescription
          ) {
            try {
              await this.peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
            } catch (err) {
              console.error('Failed to set remote answer:', err);
            }
          }
        });
      } else {
        // Guest listens for Offer from Host
        const offerRef = ref(db, `rooms/${this.roomCode}/signaling/offer`);
        this.unsubOffer = onValue(offerRef, async (snap) => {
          const offer = snap.val();
          if (
            offer &&
            this.peerConnection &&
            offer.senderUid !== this.myUid &&
            !this.peerConnection.currentRemoteDescription
          ) {
            try {
              await this.peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
              const answer = await this.peerConnection.createAnswer();
              await this.peerConnection.setLocalDescription(answer);

              await set(ref(db, `rooms/${this.roomCode}/signaling/answer`), {
                type: answer.type,
                sdp: answer.sdp,
                senderUid: this.myUid,
                createdAt: Date.now(),
              });
            } catch (err) {
              console.error('Failed to answer offer:', err);
            }
          }
        });
      }

      // 8. Listen for ICE candidates from other peer
      const candidatesRef = ref(db, `rooms/${this.roomCode}/signaling/candidates`);
      this.unsubCandidates = onChildAdded(candidatesRef, (peerSnap) => {
        const peerUid = peerSnap.key;
        if (peerUid !== this.myUid) {
          // Listen to new candidates added under this peer's node
          onChildAdded(peerSnap.ref, async (candidateSnap) => {
            const candData = candidateSnap.val();
            if (candData && this.peerConnection) {
              try {
                await this.peerConnection.addIceCandidate(new RTCIceCandidate(candData));
              } catch (e) {
                console.warn('Error adding ICE candidate:', e);
              }
            }
          });
        }
      });
    } catch (err: any) {
      this.callbacks.onStatusChange('failed');
      if (this.callbacks.onError) this.callbacks.onError(err);
      throw err;
    }
  }

  private async fetchIceConfig(): Promise<RTCIceServer[]> {
    const fallbackStun: RTCIceServer[] = [
      { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
    ];

    try {
      const res = await fetch('/api/ice-config');
      if (res.ok) {
        const data = await res.json();
        if (data && Array.isArray(data.iceServers) && data.iceServers.length > 0) {
          return data.iceServers;
        }
      }
    } catch {
      // Use fallback
    }
    return fallbackStun;
  }

  private setupVolumeMeter(stream: MediaStream) {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;

      this.audioContext = new AudioCtx();
      const source = this.audioContext.createMediaStreamSource(stream);
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 64;
      source.connect(this.analyser);

      const dataArray = new Uint8Array(this.analyser.frequencyBinCount);

      const checkVolume = () => {
        if (!this.analyser || this.destroyed) return;
        this.analyser.getByteFrequencyData(dataArray);

        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const avg = sum / dataArray.length;
        const normalizedVol = Math.min(100, Math.round((avg / 128) * 100));

        if (this.callbacks.onVolumeChange) {
          this.callbacks.onVolumeChange(this.isMuted ? 0 : normalizedVol);
        }

        this.animFrameId = requestAnimationFrame(checkVolume);
      };

      checkVolume();
    } catch (e) {
      console.warn('Could not initialize audio visualizer:', e);
    }
  }

  private async attemptIceRestart() {
    if (this.destroyed || !this.peerConnection || !this.isHost) return;
    try {
      const offer = await this.peerConnection.createOffer({ iceRestart: true });
      await this.peerConnection.setLocalDescription(offer);
      const db = getAppDatabase();
      if (db) {
        await set(ref(db, `rooms/${this.roomCode}/signaling/offer`), {
          type: offer.type,
          sdp: offer.sdp,
          senderUid: this.myUid,
          isRestart: true,
          createdAt: Date.now(),
        });
      }
    } catch (err) {
      console.error('ICE Restart failed:', err);
    }
  }

  public toggleMute(): boolean {
    if (!this.localStream) return false;
    const audioTrack = this.localStream.getAudioTracks()[0];
    if (audioTrack) {
      this.isMuted = !this.isMuted;
      audioTrack.enabled = !this.isMuted;
      this.callbacks.onStatusChange(this.isMuted ? 'muted' : 'connected');
      return this.isMuted;
    }
    return false;
  }

  public getIsMuted(): boolean {
    return this.isMuted;
  }

  public destroy() {
    this.destroyed = true;

    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }

    if (this.unsubOffer) this.unsubOffer();
    if (this.unsubAnswer) this.unsubAnswer();
    if (this.unsubCandidates) this.unsubCandidates();

    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => track.stop());
      this.localStream = null;
    }

    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close().catch(() => {});
      this.audioContext = null;
    }

    if (this.remoteAudio) {
      this.remoteAudio.pause();
      this.remoteAudio.srcObject = null;
      this.remoteAudio = null;
    }

    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }

    // Clean up signaling node if host
    if (this.isHost) {
      const db = getAppDatabase();
      if (db) {
        remove(ref(db, `rooms/${this.roomCode}/signaling`)).catch(() => {});
      }
    }

    this.callbacks.onStatusChange('disconnected');
  }
}
