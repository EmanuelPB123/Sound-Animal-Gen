export class AnimalSoundModel {
  constructor() {
    this.model = null;
    this.initialized = false;
    this.isTraining = false;
    this.trainingData = [];
    this.outputSize = 512;
  }

  async initialize() {
    try {
      // Wait for TensorFlow.js to be fully loaded
      if (typeof tf === 'undefined') {
        throw new Error('TensorFlow.js not loaded');
      }

      this.model = tf.sequential();
      
      // Input layer
      this.model.add(tf.layers.dense({
        inputShape: [7],
        units: 128,
        activation: 'relu',
        kernelInitializer: 'glorotNormal'
      }));
      
      // Hidden layers
      this.model.add(tf.layers.batchNormalization());
      
      this.model.add(tf.layers.dense({
        units: 256,
        activation: 'relu',
        kernelInitializer: 'glorotNormal'
      }));
      
      this.model.add(tf.layers.dropout({ rate: 0.3 }));
      
      this.model.add(tf.layers.dense({
        units: 512,
        activation: 'relu',
        kernelInitializer: 'glorotNormal'
      }));
      
      // Output layer
      this.model.add(tf.layers.dense({
        units: this.outputSize,
        activation: 'tanh',
        kernelInitializer: 'glorotNormal'
      }));

      // Compile model
      this.model.compile({
        optimizer: 'adam',
        loss: 'meanSquaredError',
        metrics: ['accuracy']
      });

      this.initialized = true;
      console.log('Model initialized successfully');
      
    } catch (error) {
      console.error('Error initializing model:', error);
      throw new Error('Failed to initialize ML model: ' + error.message);
    }
  }

  resampleAudioFeatures(features, targetLength) {
    const result = new Array(targetLength).fill(0);
    if (!features || features.length === 0) return result;
    
    const scale = features.length / targetLength;
    for (let i = 0; i < targetLength; i++) {
      const sourceIdx = Math.floor(i * scale);
      result[i] = features[sourceIdx] || 0;
    }
    return result;
  }

  async train(animalData) {
    if (this.isTraining) return;
    
    try {
      this.isTraining = true;
      
      if (!this.initialized) {
        await this.initialize();
      }

      if (!animalData.audioFeatures || !Array.isArray(animalData.audioFeatures)) {
        throw new Error('Invalid audio features format');
      }

      // Store training data
      this.trainingData.push(animalData);

      // Process training batch
      const xs = [];
      const ys = [];

      for (const data of this.trainingData) {
        // Process input features
        const inputFeatures = [
          this.normalize(data.lungCapacity, 0, 1000),
          this.normalize(data.pharynxLength, 0, 50),
          this.normalize(data.pharynxWidth, 0, 50),
          this.normalize(data.oralCavitySize, 0, 500),
          this.encodeSkullShape(data.skullShape),
          this.encodeBoneStructures(data.boneStructures),
          Math.random() * 0.1
        ];

        // Process output features (resample to fixed size)
        const outputFeatures = this.resampleAudioFeatures(data.audioFeatures, this.outputSize);

        xs.push(inputFeatures);
        ys.push(outputFeatures);
      }

      // Convert to tensors
      const xsTensor = tf.tensor2d(xs);
      const ysTensor = tf.tensor2d(ys);

      // Train model
      const result = await this.model.fit(xsTensor, ysTensor, {
        epochs: 50,
        batchSize: 32,
        shuffle: true,
        callbacks: {
          onEpochEnd: (epoch, logs) => {
            console.log(`Epoch ${epoch + 1}: loss = ${logs.loss.toFixed(4)}`);
          }
        }
      });

      // Cleanup
      xsTensor.dispose();
      ysTensor.dispose();

      console.log('Training completed successfully');
      return result;

    } catch (error) {
      console.error('Training error:', error);
      throw new Error('Failed to train model: ' + error.message);
    } finally {
      this.isTraining = false;
    }
  }

  async generate(params) {
    try {
      if (!this.initialized) await this.initialize();
      if (this.trainingData.length === 0) {
        throw new Error('No training data available');
      }

      // Generate prediction from model
      const inputFeatures = this.preprocessInput(params);
      const prediction = this.model.predict(inputFeatures);
      const features = await prediction.array();

      // Get base features from model prediction
      const baseFeatures = features[0].map(value => 
        Math.max(-1, Math.min(1, value))
      );

      // Find closest training example for reference
      const closestExample = this.findClosestExample(params);
      if (closestExample) {
        // Blend predicted features with closest example
        const blendedFeatures = baseFeatures.map((value, i) => {
          const reference = closestExample.audioFeatures[i] || value;
          return value * 0.7 + reference * 0.3; // 70-30 blend
        });
        
        prediction.dispose();
        inputFeatures.dispose();
        return blendedFeatures;
      }

      prediction.dispose();
      inputFeatures.dispose();
      return baseFeatures;
      
    } catch (error) {
      console.error('Error generating sound:', error);
      throw new Error('Failed to generate sound');
    }
  }

  preprocessInput(params) {
    try {
      const features = [
        this.normalize(params.lungCapacity, 0, 1000),
        this.normalize(params.pharynxLength, 0, 50),
        this.normalize(params.pharynxWidth, 0, 50),
        this.normalize(params.oralCavitySize, 0, 500),
        this.encodeSkullShape(params.skullShape),
        this.encodeBoneStructures(params.boneStructures),
        Math.random() * 0.1
      ];

      return tf.tensor2d([features]);
    } catch (error) {
      console.error('Error preprocessing input:', error);
      throw new Error('Failed to preprocess input parameters');
    }
  }

  normalize(value, min, max) {
    return (value - min) / (max - min);
  }

  encodeSkullShape(shape) {
    const shapes = ['redondo', 'alargado', 'aplanado', 'conico'];
    return shapes.indexOf(shape) / (shapes.length - 1);
  }

  encodeBoneStructures(structures) {
    if (typeof structures === 'object') {
      return Object.values(structures).reduce((acc, val) => acc + (val ? 1 : 0), 0) / 3;
    }
    // Handle array of strings (from form data)
    if (Array.isArray(structures)) {
      return structures.length / 3;
    }
    return 0;
  }

  findClosestExample(params) {
    if (!this.trainingData.length) return null;

    // Calculate distances to all training examples
    const distances = this.trainingData.map(example => {
      let distance = 0;
      distance += Math.abs(example.lungCapacity - params.lungCapacity);
      distance += Math.abs(example.pharynxLength - params.pharynxLength);
      distance += Math.abs(example.pharynxWidth - params.pharynxWidth);
      distance += Math.abs(example.oralCavitySize - params.oralCavitySize);
      if (example.skullShape !== params.skullShape) distance += 100;
      return { example, distance };
    });

    // Return the closest example
    return distances.sort((a, b) => a.distance - b.distance)[0]?.example;
  }
}

export async function initializeModel() {
  return new Promise((resolve, reject) => {
    // Check if TensorFlow is already loaded
    if (typeof tf !== 'undefined') {
      const model = new AnimalSoundModel();
      model.initialize()
        .then(() => resolve(model))
        .catch(reject);
      return;
    }

    // Load TensorFlow.js
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.2.0/dist/tf.min.js';
    script.async = true;
    
    script.onload = () => {
      const model = new AnimalSoundModel();
      model.initialize()
        .then(() => resolve(model))
        .catch(reject);
    };
    
    script.onerror = () => {
      reject(new Error('Failed to load TensorFlow.js'));
    };

    document.head.appendChild(script);
  });
}