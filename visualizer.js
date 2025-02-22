export class WaveformVisualizer {
  constructor(canvasId) {
    this.canvasId = canvasId;
    this.canvas = null;
    this.ctx = null;
  }

  async init() {
    return new Promise((resolve, reject) => {
      // Wait for DOM to be fully loaded
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => this.setup(resolve, reject));
      } else {
        this.setup(resolve, reject);
      }
    });
  }

  setup(resolve, reject) {
    try {
      // Get canvas element
      this.canvas = document.getElementById(this.canvasId);
      if (!this.canvas) {
        throw new Error('Canvas element not found');
      }

      // Ensure the element is actually a canvas
      if (!(this.canvas instanceof HTMLCanvasElement)) {
        throw new Error(`Element with id '${this.canvasId}' is not a canvas element`);
      }

      // Set initial dimensions
      const container = this.canvas.parentElement;
      if (!container) {
        throw new Error('Canvas element does not have a parent container');
      }
      const styles = window.getComputedStyle(container);
      const width = parseInt(styles.width, 10);
      const height = parseInt(styles.height, 10);
      
      // Set canvas dimensions
      this.canvas.width = width;
      this.canvas.height = height;

      // Get context
      this.ctx = this.canvas.getContext('2d');
      if (!this.ctx) {
        throw new Error('Could not get canvas context');
      }

      // Add resize handler
      window.addEventListener('resize', () => this.resize());

      resolve();
    } catch (error) {
      console.error('Error during visualizer initialization:', error);
      reject(error);
    }
  }

  resize() {
    if (!this.canvas || !this.canvas.parentElement) return;
    
    const container = this.canvas.parentElement;
    if (!container) return;
    
    const styles = window.getComputedStyle(container);
    const width = parseInt(styles.width, 10);
    const height = parseInt(styles.height, 10);
    
    // Set canvas dimensions
    this.canvas.width = width;
    this.canvas.height = height;
  }

  async visualize(audioBuffer) {
    if (!this.ctx || !this.canvas) {
      console.error('Visualizer not initialized');
      return;
    }

    // Clear canvas
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Get audio data
    const data = audioBuffer.getChannelData(0);
    const step = Math.ceil(data.length / this.canvas.width);
    const amp = this.canvas.height / 2;

    // Draw waveform
    this.ctx.beginPath();
    this.ctx.strokeStyle = '#2c3e50';
    this.ctx.lineWidth = 2;
    
    // Move to first point
    this.ctx.moveTo(0, amp + (data[0] * amp));

    // Draw lines to each point
    for (let i = 0; i < this.canvas.width; i++) {
      const dataIdx = Math.floor(i * step);
      const x = i;
      const y = amp + (data[dataIdx] * amp);
      this.ctx.lineTo(x, y);
    }

    this.ctx.stroke();
  }
}