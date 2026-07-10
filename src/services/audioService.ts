const VOLUME_STORAGE_KEY = 'word_search_bgm_volume';

/** 端末・Bluetooth・サイレント等で resume が失敗してもアプリ全体を止めない */
function isAudioContextResumeFailure(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err ?? '');
  if (/failed to start the audio device/i.test(msg)) return true;
  if (/audio(context)?.*(not allowed|interact)/i.test(msg)) return true;
  const name = typeof err === 'object' && err !== null && 'name' in err ? String((err as { name?: string }).name) : '';
  return name === 'NotAllowedError' || name === 'AbortError';
}

async function safeAudioContextResume(context: AudioContext | null | undefined): Promise<boolean> {
  if (!context || context.state === 'closed') return false;
  if (context.state === 'running') return true;
  try {
    await context.resume();
    return context.state === 'running';
  } catch (err) {
    if (import.meta.env.DEV && !isAudioContextResumeFailure(err)) {
      console.warn('[audioService] AudioContext.resume failed', err);
    }
    return false;
  }
}

class AudioService {
  /** BGM はページ表示直後の useEffect から start される。Web Audio の自動再生制限に合わせ、最初のユーザージェスチャーまで遅延する */
  private static userHasGestured = false;
  private waitingForGestureToStartBgm = false;

  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private isEnabled: boolean = true;
  /** CM 等の一時停止（シーケンサーは維持して再開時に途切れない） */
  private hubOverlayPaused: boolean = false;
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
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState !== 'visible') return;
        if (!this.isEnabled || this.hubOverlayPaused) return;
        void safeAudioContextResume(this.ctx).then((ok) => {
          if (!ok) return;
          if (!this.isEnabled || this.hubOverlayPaused) return;
          this.setMasterAudible(true);
          if (!this.isPlaying) this.beginBgmPlayback();
        });
      });
    }
  }

  private setMasterAudible(audible: boolean) {
    if (!this.masterGain || !this.ctx) return;
    const target = audible ? this.currentVolume : 0;
    this.masterGain.gain.setTargetAtTime(target, this.ctx.currentTime, audible ? 0.1 : 0.05);
  }

  private static markUserGesture() {
    AudioService.userHasGestured = true;
  }

  /** 盤面操作・ボタンなど、実際のユーザージェスチャーから呼ぶ */
  public noteUserGesture() {
    AudioService.markUserGesture();
    this.tryStartBgmAfterGesture();
  }

  private tryStartBgmAfterGesture() {
    if (!this.isEnabled || this.hubOverlayPaused) return;
    this.waitingForGestureToStartBgm = false;
    if (!this.ctx) {
      this.initContext();
    }
    if (!this.ctx) return;
    this.setMasterAudible(true);
    if (!this.isPlaying) {
      this.beginBgmPlayback();
    } else if (this.ctx.state === 'suspended') {
      void safeAudioContextResume(this.ctx);
    }
  }

  private canPlayFeedback(): boolean {
    return AudioService.userHasGestured;
  }

  private initContext(): AudioContext | null {
    if (!AudioService.userHasGestured) return null;
    if (!this.ctx) {
      try {
        this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        this.masterGain = this.ctx.createGain();
        this.masterGain.connect(this.ctx.destination);
        this.masterGain.gain.value = this.currentVolume;
      } catch {
        return null;
      }
    }
    return this.ctx;
  }

  public setVolume(vol: number) {
    this.currentVolume = vol;
    if (this.masterGain) {
      const audible = this.isEnabled && !this.hubOverlayPaused;
      this.masterGain.gain.setTargetAtTime(audible ? vol : 0, this.ctx!.currentTime, 0.1);
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

  /** 正解発見（ことば探し・ひと言探し）。iPad では resume 完了後に鳴らす */
  public playCorrectSound() {
    void this.playCorrectSoundAsync();
  }

  private async playCorrectSoundAsync() {
    if (!this.canPlayFeedback()) return;
    try {
      if (!this.initContext() || !this.ctx) return;
      const ok = await safeAudioContextResume(this.ctx);
      if (!ok && this.ctx.state !== 'running') return;

      const now = this.ctx.currentTime;
      const vol = Math.max(0.35, this.currentVolume * 0.55);
      this.playSynthNote(523.25, now, 0.08, 'sine', vol * 0.5);
      this.playSynthNote(659.25, now + 0.06, 0.18, 'triangle', vol);
      this.playSynthNote(880.0, now + 0.14, 0.32, 'triangle', vol * 0.9);

      if ('vibrate' in navigator) {
        navigator.vibrate(40);
      }
    } catch {
      /* ignore */
    }
  }

  public playFanfareSound() {
    if (!this.canPlayFeedback()) return;
    try {
      if (!this.initContext()) return;
      if (this.ctx!.state === 'suspended') void safeAudioContextResume(this.ctx);

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
    if (!this.canPlayFeedback()) return;
    try {
      if (!this.initContext()) return;
      if (this.ctx!.state === 'suspended') void safeAudioContextResume(this.ctx);

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

  /** スライドパズル：ピースが滑る「シュッ」 */
  public playSlideSound() {
    if (!this.canPlayFeedback()) return;
    try {
      if (!this.initContext()) return;
      const ctx = this.ctx!;
      if (ctx.state === 'suspended') void safeAudioContextResume(ctx);

      const now = ctx.currentTime;
      const duration = 0.14;
      const vol = Math.max(0.08, this.currentVolume * 0.35);

      const bufferSize = Math.max(1, Math.floor(ctx.sampleRate * duration));
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i += 1) {
        const t = i / bufferSize;
        data[i] = (Math.random() * 2 - 1) * (1 - t) * (1 - t);
      }

      const noise = ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(2800, now);
      filter.frequency.exponentialRampToValueAtTime(700, now + duration);
      filter.Q.value = 0.7;

      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(0, now);
      noiseGain.gain.linearRampToValueAtTime(vol, now + 0.006);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + duration);

      noise.connect(filter);
      filter.connect(noiseGain);
      noiseGain.connect(this.masterGain!);
      noise.start(now);
      noise.stop(now + duration + 0.02);

      const sweep = ctx.createOscillator();
      const sweepGain = ctx.createGain();
      sweep.type = 'sine';
      sweep.frequency.setValueAtTime(640, now);
      sweep.frequency.exponentialRampToValueAtTime(220, now + duration);
      sweepGain.gain.setValueAtTime(0, now);
      sweepGain.gain.linearRampToValueAtTime(vol * 0.25, now + 0.008);
      sweepGain.gain.exponentialRampToValueAtTime(0.001, now + duration);
      sweep.connect(sweepGain);
      sweepGain.connect(this.masterGain!);
      sweep.start(now);
      sweep.stop(now + duration + 0.02);
    } catch (e) {}
  }

  /** リバーシ：駒を置く「トン」 */
  public playReversiStoneSound() {
    if (!this.canPlayFeedback()) return;
    try {
      if (!this.initContext()) return;
      const ctx = this.ctx!;
      if (ctx.state === 'suspended') void safeAudioContextResume(ctx);

      const now = ctx.currentTime;
      const duration = 0.07;
      const vol = Math.max(0.1, this.currentVolume * 0.45);

      const thump = ctx.createOscillator();
      const thumpGain = ctx.createGain();
      thump.type = 'sine';
      thump.frequency.setValueAtTime(220, now);
      thump.frequency.exponentialRampToValueAtTime(95, now + duration);
      thumpGain.gain.setValueAtTime(0, now);
      thumpGain.gain.linearRampToValueAtTime(vol, now + 0.004);
      thumpGain.gain.exponentialRampToValueAtTime(0.001, now + duration);
      thump.connect(thumpGain);
      thumpGain.connect(this.masterGain!);
      thump.start(now);
      thump.stop(now + duration + 0.01);

      const clickDur = 0.025;
      const bufferSize = Math.max(1, Math.floor(ctx.sampleRate * clickDur));
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i += 1) {
        const t = i / bufferSize;
        data[i] = (Math.random() * 2 - 1) * (1 - t);
      }
      const click = ctx.createBufferSource();
      click.buffer = buffer;
      const clickFilter = ctx.createBiquadFilter();
      clickFilter.type = 'highpass';
      clickFilter.frequency.value = 1200;
      const clickGain = ctx.createGain();
      clickGain.gain.setValueAtTime(vol * 0.35, now);
      clickGain.gain.exponentialRampToValueAtTime(0.001, now + clickDur);
      click.connect(clickFilter);
      clickFilter.connect(clickGain);
      clickGain.connect(this.masterGain!);
      click.start(now);
      click.stop(now + clickDur + 0.01);
    } catch (e) {}
  }

  /** スライドパズル：完成（やわらかい3音） */
  public playSlidePuzzleCompleteSound() {
    if (!this.canPlayFeedback()) return;
    try {
      if (!this.initContext()) return;
      if (this.ctx!.state === 'suspended') void safeAudioContextResume(this.ctx);

      const now = this.ctx!.currentTime;
      const notes = [523.25, 659.25, 783.99, 1046.5];
      notes.forEach((freq, index) => {
        this.playSynthNote(freq, now + index * 0.11, 0.42, 'triangle', 0.3);
      });

      if ('vibrate' in navigator) {
        navigator.vibrate([25, 35, 45]);
      }
    } catch (e) {}
  }

  public vibrateLight() {
    if (!this.canPlayFeedback()) return;
    if ('vibrate' in navigator) {
      navigator.vibrate(15);
    }
  }

  public start() {
    this.isEnabled = true;
    this.resumeHubBgm();
  }

  /** 席選択・ボタンなど、ユーザ操作のハンドラから呼ぶ（Web Audio を同じジェスチャーで開始） */
  public startFromUserAction() {
    AudioService.markUserGesture();
    this.tryStartBgmAfterGesture();
  }

  /** しずかの間など — ハブ BGM を完全停止（設定 OFF とは別） */
  public stopHubBgm() {
    this.hubOverlayPaused = true;
    this.setMasterAudible(false);
    this.waitingForGestureToStartBgm = false;
    this.isPlaying = false;
    if (this.schedulerTimer) {
      clearTimeout(this.schedulerTimer);
      this.schedulerTimer = null;
    }
  }

  /** 全面 CM 中 — ミュートのみ（終了後に途切れず再開） */
  public pauseHubBgm() {
    this.hubOverlayPaused = true;
    this.setMasterAudible(false);
  }

  /** オーバーレイ解除後、設定 ON ならハブ BGM を再開 */
  public resumeHubBgm() {
    this.hubOverlayPaused = false;
    if (!this.isEnabled) return;
    if (!AudioService.userHasGestured) {
      this.waitingForGestureToStartBgm = true;
      return;
    }
    if (!this.ctx) {
      this.initContext();
    }
    this.setMasterAudible(true);
    if (!this.isPlaying) {
      this.beginBgmPlayback();
    } else if (this.ctx?.state === 'suspended') {
      void safeAudioContextResume(this.ctx);
    }
  }

  private beginBgmPlayback() {
    if (!AudioService.userHasGestured || !this.isEnabled || this.hubOverlayPaused) {
      this.waitingForGestureToStartBgm = true;
      return;
    }
    if (this.isPlaying) return;

    try {
      const context = this.initContext();
      if (!context) {
        this.waitingForGestureToStartBgm = true;
        return;
      }

      const tryStart = () => {
        if (context.state === 'running' && this.isEnabled && !this.hubOverlayPaused && !this.isPlaying) {
          this.waitingForGestureToStartBgm = false;
          this.startSequencer();
        }
      };

      if (context.state === 'running') {
        tryStart();
        return;
      }

      const previousOnStateChange = context.onstatechange;
      context.onstatechange = () => {
        if (context.state !== 'running') return;
        context.onstatechange = previousOnStateChange ?? null;
        tryStart();
      };

      void safeAudioContextResume(context).then((ok) => {
        context.onstatechange = previousOnStateChange ?? null;
        if (ok) tryStart();
        else this.waitingForGestureToStartBgm = true;
      });
    } catch {
      this.waitingForGestureToStartBgm = true;
    }
  }

  private startSequencer() {
    if (this.isPlaying) return;
    this.isPlaying = true;
    this.nextNoteTime = this.ctx!.currentTime;
    this.setMasterAudible(!this.hubOverlayPaused);
    this.scheduler();
  }

  public stop() {
    this.hubOverlayPaused = false;
    this.waitingForGestureToStartBgm = false;
    this.isPlaying = false;
    if (this.schedulerTimer) {
      clearTimeout(this.schedulerTimer);
      this.schedulerTimer = null;
    }
    this.setMasterAudible(false);
  }

  public toggle(enabled: boolean) {
    this.isEnabled = enabled;
    if (enabled) {
      this.resumeHubBgm();
    } else {
      this.stop();
    }
  }
}

export const audioService = new AudioService();
