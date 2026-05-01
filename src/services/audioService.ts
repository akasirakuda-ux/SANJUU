const VOLUME_STORAGE_KEY = 'word_search_bgm_volume';

class AudioService {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private isEnabled: boolean = true;
  private currentVolume: number = 0.3;
  private isPlaying: boolean = false;
  private schedulerTimer: number | null = null;
  private nextNoteTime: number = 0;
  private currentStep: number = 0;

  // 陽気なハ長調のメロディ譜面（MIDI番号）
  private melody = [60, 64, 67, 72, 69, 65, 62, 67, 60, 64, 67, 60, 65, 69, 67, 62];
  // 落ち着いたベースライン
  private bass = [48, 48, 53, 53, 55, 55, 48, 48, 48, 48, 53, 53, 55, 55, 48, 48];

  constructor() {
    if (typeof window !== 'undefined') {
      const savedVol = localStorage.getItem(VOLUME_STORAGE_KEY);
      this.currentVolume = savedVol ? parseFloat(savedVol) : 0.3;
    }
  }

  private initContext() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.masterGain = this.ctx.createGain();
      this.masterGain.connect(this.ctx.destination);
      this.masterGain.gain.value = this.currentVolume;
    }
    return this.ctx;
  }

  public setVolume(vol: number) {
    this.currentVolume = vol;
    if (this.masterGain) {
      this.masterGain.gain.setTargetAtTime(vol, this.ctx!.currentTime, 0.1);
    }
    localStorage.setItem(VOLUME_STORAGE_KEY, vol.toString());
  }

  public getVolume(): number {
    return this.currentVolume;
  }

  /**
   * 単一のノートを合成して鳴らす
   */
  private playSynthNote(freq: number, time: number, duration: number, type: OscillatorType = 'triangle', vol = 0.2) {
    if (!this.ctx || !this.masterGain) return;
    
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.type = type;
    osc.frequency.setValueAtTime(freq, time);
    
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(vol, time + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, time + duration);
    
    osc.connect(gain);
    gain.connect(this.masterGain);
    
    osc.start(time);
    osc.stop(time + duration);
  }

  private midiToFreq(midi: number): number {
    return 440 * Math.pow(2, (midi - 69) / 12);
  }

  /**
   * シーケンサー：音符をスケジュールする
   */
  private scheduler = () => {
    if (!this.ctx || !this.isPlaying) return;

    // 0.1秒先までの音符を予約する
    while (this.nextNoteTime < this.ctx.currentTime + 0.1) {
      const step = this.currentStep % this.melody.length;
      
      // メロディ（ピコピコした三角波）
      this.playSynthNote(
        this.midiToFreq(this.melody[step]), 
        this.nextNoteTime, 
        0.2, 
        'triangle', 
        0.15
      );
      
      // ベース（柔らかいサイン波、2ステップに1回）
      if (this.currentStep % 2 === 0) {
        this.playSynthNote(
          this.midiToFreq(this.bass[step]), 
          this.nextNoteTime, 
          0.4, 
          'sine', 
          0.2
        );
      }

      // 次の音符へ（BPM 120相当 = 0.25秒間隔）
      this.nextNoteTime += 0.25;
      this.currentStep++;
    }
    
    this.schedulerTimer = window.setTimeout(this.scheduler, 25);
  };

  public playCorrectSound() {
    try {
      this.initContext();
      if (this.ctx!.state === 'suspended') this.ctx!.resume();
      
      const now = this.ctx!.currentTime;
      this.playSynthNote(659.25, now, 0.15, 'triangle', 0.4);
      this.playSynthNote(880.00, now + 0.1, 0.3, 'triangle', 0.4);
      
      // Haptic feedback for success
      if ('vibrate' in navigator) {
        navigator.vibrate(40);
      }
    } catch (e) {}
  }

  public playFanfareSound() {
    try {
      this.initContext();
      if (this.ctx!.state === 'suspended') this.ctx!.resume();

      const now = this.ctx!.currentTime;
      const notes = [523.25, 659.25, 783.99, 1046.50];
      notes.forEach((freq, i) => {
        this.playSynthNote(freq, now + i * 0.1, 0.6, 'square', 0.3);
      });

      // Haptic feedback for clear
      if ('vibrate' in navigator) {
        navigator.vibrate([50, 30, 50, 30, 100]);
      }
    } catch (e) {}
  }

  public playBonusSound() {
    try {
      this.initContext();
      if (this.ctx!.state === 'suspended') this.ctx!.resume();

      const now = this.ctx!.currentTime;
      // Dramatic shimmering sweep
      for (let i = 0; i < 12; i++) {
        const freq = 440 * Math.pow(1.5, i / 2);
        this.playSynthNote(freq, now + i * 0.04, 0.4, 'sine', 0.15);
        this.playSynthNote(freq * 1.01, now + i * 0.04 + 0.01, 0.4, 'triangle', 0.05);
      }
      
      if ('vibrate' in navigator) {
        navigator.vibrate([50, 20, 50]);
      }
    } catch (e) {}
  }

  public vibrateLight() {
    if ('vibrate' in navigator) {
      navigator.vibrate(15);
    }
  }

  public start() {
    this.isEnabled = true;
    const context = this.initContext();
    
    if (context.state === 'suspended') {
      context.resume().then(() => {
        this.startSequencer();
      });
    } else {
      this.startSequencer();
    }
  }

  private startSequencer() {
    if (this.isPlaying) return;
    this.isPlaying = true;
    this.nextNoteTime = this.ctx!.currentTime;
    this.scheduler();
  }

  public stop() {
    this.isPlaying = false;
    if (this.schedulerTimer) {
      clearTimeout(this.schedulerTimer);
      this.schedulerTimer = null;
    }
  }

  public toggle(enabled: boolean) {
    if (enabled) {
      this.start();
    } else {
      this.stop();
    }
  }
}

export const audioService = new AudioService();