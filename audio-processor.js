export class AudioProcessor {
  constructor() {
    this.audioContext = null;
    this.initAudioContext();
  }

  initAudioContext() {
    try {
      window.AudioContext = window.AudioContext || window.webkitAudioContext;
      this.audioContext = new AudioContext();
    } catch (error) {
      console.error('Web Audio API not supported:', error);
      throw new Error('Web Audio API not supported in this browser');
    }
  }

  async loadSampleAudio() {
    try {
      const audioElement = document.getElementById('sampleAudio');
      if (!audioElement) {
        throw new Error('Sample audio element not found');
      }

      const response = await fetch(audioElement.src);
      if (!response.ok) {
        throw new Error('Failed to fetch sample audio');
      }

      const arrayBuffer = await response.arrayBuffer();
      return await this.audioContext.decodeAudioData(arrayBuffer);
    } catch (error) {
      console.error('Error loading sample audio:', error);
      throw new Error('Failed to load sample audio');
    }
  }

  async extractFeatures(audioFile) {
    try {
      const arrayBuffer = await audioFile.arrayBuffer();
      const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
      
      const channelData = audioBuffer.getChannelData(0);
      const features = [];
      
      // Use fixed size for consistent feature extraction
      const targetLength = 512; // Match model output size
      const frameSize = Math.floor(channelData.length / targetLength);
      
      for (let i = 0; i < targetLength; i++) {
        const startIdx = i * frameSize;
        const frame = channelData.slice(startIdx, startIdx + frameSize);
        // Calculate RMS and normalize
        const rms = Math.sqrt(frame.reduce((acc, val) => acc + val * val, 0) / frame.length);
        features.push(rms);
      }

      // Normalize features to [-1, 1] range
      const maxVal = Math.max(...features);
      const minVal = Math.min(...features);
      return features.map(f => (f - minVal) / (maxVal - minVal) * 2 - 1);
      
    } catch (error) {
      console.error('Error extracting features:', error);
      throw new Error('Failed to process audio file');
    }
  }

  async synthesizeSound(features, params) {
    try {
      if (!this.audioContext) {
        this.initAudioContext();
      }

      const sampleRate = this.audioContext.sampleRate;
      const duration = 2;
      const numSamples = sampleRate * duration;
      
      const buffer = this.audioContext.createBuffer(1, numSamples, sampleRate);
      const channelData = buffer.getChannelData(0);

      // Enhanced physical parameters
      const baseFreq = 220 * Math.pow(params.lungCapacity / 500, 0.5); // Base frequency scaled by lung capacity
      const harmonicRatio = params.pharynxLength / params.pharynxWidth;
      const resonanceFreq = 440 * (params.oralCavitySize / 250);
      const formantShape = this.getFormantShape(params.skullShape);
      
      // Envelope parameters
      const attack = 0.1;
      const decay = 0.2;
      const sustain = 0.7;
      const release = 0.5;

      // Generate samples with improved synthesis
      for (let i = 0; i < numSamples; i++) {
        const time = i / sampleRate;
        const featureIdx = Math.floor(i / numSamples * features.length);
        const amplitude = features[featureIdx];
        
        // Envelope generation
        const envelope = this.calculateEnvelope(time, duration, attack, decay, sustain, release);
        
        // Multi-harmonic synthesis
        let sample = 0;
        const numHarmonics = 8;
        
        for (let h = 1; h <= numHarmonics; h++) {
          const harmonicFreq = baseFreq * h;
          const harmonicAmp = 1 / (h * harmonicRatio);
          
          // Carrier wave with harmonics
          sample += harmonicAmp * Math.sin(2 * Math.PI * harmonicFreq * time);
          
          // Add formants based on skull shape
          for (const formant of formantShape) {
            sample += 0.2 * harmonicAmp * Math.sin(2 * Math.PI * formant * time);
          }
        }

        // Add resonance based on oral cavity
        const resonance = 0.3 * Math.sin(2 * Math.PI * resonanceFreq * time);
        
        // Add subtle noise for more natural sound
        const noise = (Math.random() * 2 - 1) * 0.05;
        
        // Combine all components with envelope
        channelData[i] = (sample + resonance + noise) * envelope * amplitude * 0.5;
      }

      // Apply subtle compression
      this.applyCompression(channelData);
      
      return buffer;
    } catch (error) {
      console.error('Error synthesizing sound:', error);
      throw new Error('Failed to synthesize sound');
    }
  }

  calculateEnvelope(time, duration, attack, decay, sustain, release) {
    if (time < attack) {
      return time / attack; // Attack phase
    } else if (time < attack + decay) {
      return 1.0 - (1.0 - sustain) * (time - attack) / decay; // Decay phase
    } else if (time < duration - release) {
      return sustain; // Sustain phase
    } else {
      return sustain * (1.0 - (time - (duration - release)) / release); // Release phase
    }
  }

  getFormantShape(skullShape) {
    // Formant frequencies based on skull shape
    const formants = {
      'redondo': [500, 1500, 2500],
      'alargado': [800, 2000, 3000],
      'aplanado': [600, 1800, 2800],
      'conico': [700, 1700, 2700]
    };
    return formants[skullShape] || formants.redondo;
  }

  applyCompression(channelData) {
    const threshold = 0.5;
    const ratio = 4;
    
    for (let i = 0; i < channelData.length; i++) {
      if (Math.abs(channelData[i]) > threshold) {
        const excess = Math.abs(channelData[i]) - threshold;
        const reduction = excess / ratio;
        channelData[i] = Math.sign(channelData[i]) * (threshold + reduction);
      }
    }
  }

  async play(audioBuffer) {
    try {
      if (!this.audioContext) {
        this.initAudioContext();
      }

      const source = this.audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(this.audioContext.destination);
      source.start();
      return new Promise(resolve => {
        source.onended = resolve;
      });
    } catch (error) {
      console.error('Error playing sound:', error);
      throw new Error('Failed to play sound');
    }
  }

  async createDownloadable(audioBuffer) {
    // Convert AudioBuffer to WAV format
    const numChannels = audioBuffer.numberOfChannels;
    const length = audioBuffer.length * numChannels * 2;
    const buffer = new ArrayBuffer(44 + length);
    const view = new DataView(buffer);

    // Write WAV header
    this.writeWAVHeader(view, {
      sampleRate: audioBuffer.sampleRate,
      numChannels,
      length
    });

    // Write audio data
    const offset = 44;
    const channelData = audioBuffer.getChannelData(0);
    for (let i = 0; i < channelData.length; i++) {
      const sample = Math.max(-1, Math.min(1, channelData[i]));
      view.setInt16(offset + i * 2, sample * 0x7FFF, true);
    }

    return new Blob([buffer], { type: 'audio/wav' });
  }

  writeWAVHeader(view, {sampleRate, numChannels, length}) {
    // RIFF chunk descriptor
    this.writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + length, true);
    this.writeString(view, 8, 'WAVE');
    
    // fmt sub-chunk
    this.writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * numChannels * 2, true);
    view.setUint16(32, numChannels * 2, true);
    view.setUint16(34, 16, true);
    
    // data sub-chunk
    this.writeString(view, 36, 'data');
    view.setUint32(40, length, true);
  }

  writeString(view, offset, string) {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  }
}