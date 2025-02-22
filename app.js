import { initializeModel } from './ml-model.js';
import { DatabaseManager } from './database.js';
import { AudioProcessor } from './audio-processor.js';
import { WaveformVisualizer } from './visualizer.js';

class AnimalSoundGenerator {
  constructor() {
    this.initializeApp().catch(error => {
      console.error('Error initializing application:', error);
      alert('Error initializing application. Please check console for details.');
    });
  }

  async initializeApp() {
    try {
      // Ensure DOM is loaded
      if (document.readyState === 'loading') {
        await new Promise(resolve => document.addEventListener('DOMContentLoaded', resolve));
      }

      // Initialize components
      this.db = new DatabaseManager();
      this.audioProcessor = new AudioProcessor();
      this.visualizer = new WaveformVisualizer('waveform');
      
      // Initialize in sequence
      await this.visualizer.init();
      this.model = await initializeModel();
      
      // Load sample audio for testing
      const sampleAudio = await this.audioProcessor.loadSampleAudio();
      await this.visualizer.visualize(sampleAudio);
      
      // Setup event listeners
      this.setupEventListeners();
      
      // Load initial data
      await this.loadDatabase();
      
    } catch (error) {
      console.error('Initialization error:', error);
      throw error;
    }
  }

  setupEventListeners() {
    // Tab switching
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => this.switchTab(e.target.dataset.tab));
    });

    // Form submission
    document.getElementById('animalForm').addEventListener('submit', (e) => this.handleFormSubmit(e));

    // Generate button
    document.getElementById('generateBtn').addEventListener('click', () => this.generateSound());

    // Playback controls
    document.getElementById('playBtn').addEventListener('click', () => this.playSound());
    document.getElementById('downloadBtn').addEventListener('click', () => this.downloadSound());

    // Search and filter
    document.getElementById('searchInput').addEventListener('input', (e) => this.filterDatabase(e.target.value));
    document.getElementById('filterCategory').addEventListener('change', (e) => this.filterDatabase(e.target.value));

    // Slider value updates
    document.querySelectorAll('input[type="range"]').forEach(slider => {
      slider.addEventListener('input', (e) => {
        e.target.parentElement.querySelector('.value').textContent = e.target.value;
      });
    });
  }

  switchTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    
    document.getElementById(tabId).classList.add('active');
    document.querySelector(`[data-tab="${tabId}"]`).classList.add('active');
  }

  async handleFormSubmit(e) {
    e.preventDefault();
    const submitButton = e.target.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    
    try {
      const formData = new FormData(e.target);
      const audioFile = formData.get('sound');
      
      if (!audioFile || !audioFile.type.includes('audio')) {
        throw new Error('Please select a valid audio file');
      }
      
      const audioFeatures = await this.audioProcessor.extractFeatures(audioFile);
      
      const animalData = {
        name: formData.get('name'),
        category: formData.get('category'),
        lungCapacity: parseFloat(formData.get('lungCapacity')),
        pharynxLength: parseFloat(formData.get('pharynxLength')),
        pharynxWidth: parseFloat(formData.get('pharynxWidth')),
        oralCavitySize: parseFloat(formData.get('oralCavitySize')),
        skullShape: formData.get('skullShape'),
        boneStructures: formData.getAll('boneStructures'),
        audioFeatures
      };

      await this.db.addAnimal(animalData);
      await this.model.train(animalData);
      
      await this.loadDatabase();
      e.target.reset();
      alert('Animal agregado exitosamente');
    } catch (error) {
      console.error('Error al agregar animal:', error);
      alert(error.message || 'Error al agregar el animal');
    } finally {
      submitButton.disabled = false;
    }
  }

  async generateSound() {
    const generateBtn = document.getElementById('generateBtn');
    generateBtn.disabled = true;
    generateBtn.classList.add('generating');

    try {
      const params = {
        lungCapacity: parseFloat(document.getElementById('genLungCapacity').value),
        pharynxLength: parseFloat(document.getElementById('genPharynxLength').value),
        pharynxWidth: parseFloat(document.getElementById('genPharynxWidth').value),
        oralCavitySize: parseFloat(document.getElementById('genOralCavitySize').value),
        skullShape: document.getElementById('genSkullShape').value,
        boneStructures: {
          resonancia: document.getElementById('genResonancia').checked,
          senos: document.getElementById('genSenos').checked,
          crestas: document.getElementById('genCrestas').checked
        }
      };

      if (!params.skullShape) {
        throw new Error('Por favor seleccione una forma de cráneo');
      }

      // Get features from ML model
      const generatedFeatures = await this.model.generate(params);
      
      // Synthesize sound using both features and parameters
      this.currentSound = await this.audioProcessor.synthesizeSound(generatedFeatures, params);
      
      await this.visualizer.visualize(this.currentSound);
      
      document.getElementById('playBtn').disabled = false;
      document.getElementById('downloadBtn').disabled = false;
    } catch (error) {
      console.error('Error al generar sonido:', error);
      alert(error.message || 'Error al generar el sonido');
    } finally {
      generateBtn.disabled = false;
      generateBtn.classList.remove('generating');
    }
  }

  async playSound() {
    if (this.currentSound) {
      await this.audioProcessor.play(this.currentSound);
    }
  }

  async downloadSound() {
    if (this.currentSound) {
      const blob = await this.audioProcessor.createDownloadable(this.currentSound);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'animal-sound.wav';
      a.click();
      URL.revokeObjectURL(url);
    }
  }

  async loadDatabase() {
    const animals = await this.db.getAllAnimals();
    this.renderAnimalsGrid(animals);
  }

  async filterDatabase(searchTerm = '', category = '') {
    const animals = await this.db.getAllAnimals();
    const filtered = animals.filter(animal => {
      const matchesSearch = animal.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = !category || animal.category === category;
      return matchesSearch && matchesCategory;
    });
    this.renderAnimalsGrid(filtered);
  }

  async playAnimalSound(animalId) {
    try {
      const animal = await this.db.getAnimal(parseInt(animalId));
      if (!animal || !animal.audioFeatures) {
        throw new Error('Animal sound data not found');
      }

      // Generate audio from features
      const audioBuffer = await this.audioProcessor.synthesizeSound(animal.audioFeatures);
      
      // Visualize and play
      await this.visualizer.visualize(audioBuffer);
      await this.audioProcessor.play(audioBuffer);
    } catch (error) {
      console.error('Error playing animal sound:', error);
      alert('Error playing sound: ' + error.message);
    }
  }

  renderAnimalsGrid(animals) {
    const grid = document.getElementById('animalsGrid');
    grid.innerHTML = animals.map(animal => `
      <div class="animal-card">
        <h3>${animal.name}</h3>
        <p>Categoría: ${animal.category}</p>
        <p>Capacidad Pulmonar: ${animal.lungCapacity} cm³</p>
        <p>Faringe: ${animal.pharynxLength}x${animal.pharynxWidth} cm</p>
        <button onclick="app.playAnimalSound(${animal.id})">Reproducir</button>
      </div>
    `).join('');
  }
}

// Initialize app and make it globally available
window.addEventListener('load', () => {
  window.app = new AnimalSoundGenerator();
});