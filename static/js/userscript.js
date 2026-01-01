
const NOTE_FREQUENCIES = {
  // Octave 0
  "C0": 16.35, "C#0": 17.32, "Db0": 17.32, "D0": 18.35, "D#0": 19.45, "Eb0": 19.45, "E0": 20.60, "F0": 21.83, "F#0": 23.12, "Gb0": 23.12, "G0": 24.50, "G#0": 25.96, "Ab0": 25.96, "A0": 27.50, "A#0": 29.14, "Bb0": 29.14, "B0": 30.87,

  // Octave 1
  "C1": 32.70, "C#1": 34.65, "Db1": 34.65, "D1": 36.71, "D#1": 38.89, "Eb1": 38.89, "E1": 41.20, "F1": 43.65, "F#1": 46.25, "Gb1": 46.25, "G1": 49.00, "G#1": 51.91, "Ab1": 51.91, "A1": 55.00, "A#1": 58.27, "Bb1": 58.27, "B1": 61.74,

  // Octave 2
  "C2": 65.41, "C#2": 69.30, "Db2": 69.30, "D2": 73.42, "D#2": 77.78, "Eb2": 77.78, "E2": 82.41, "F2": 87.31, "F#2": 92.50, "Gb2": 92.50, "G2": 98.00, "G#2": 103.83, "Ab2": 103.83, "A2": 110.00, "A#2": 116.54, "Bb2": 116.54, "B2": 123.47,

  // Octave 3
  "C3": 130.81, "C#3": 138.59, "Db3": 138.59, "D3": 146.83, "D#3": 155.56, "Eb3": 155.56, "E3": 164.81, "F3": 174.61, "F#3": 185.00, "Gb3": 185.00, "G3": 196.00, "G#3": 207.65, "Ab3": 207.65, "A3": 220.00, "A#3": 233.08, "Bb3": 233.08, "B3": 246.94,

  // Octave 4
  "C4": 261.63, "C#4": 277.18, "Db4": 277.18, "D4": 293.66, "D#4": 311.13, "Eb4": 311.13, "E4": 329.63, "F4": 349.23, "F#4": 369.99, "Gb4": 369.99, "G4": 392.00, "G#4": 415.30, "Ab4": 415.30, "A4": 440.00, "A#4": 466.16, "Bb4": 466.16, "B4": 493.88,

  // Octave 5
  "C5": 523.25, "C#5": 554.37, "Db5": 554.37, "D5": 587.33, "D#5": 622.25, "Eb5": 622.25, "E5": 659.25, "F5": 698.46, "F#5": 739.99, "Gb5": 739.99, "G5": 783.99, "G#5": 830.61, "Ab5": 830.61, "A5": 880.00, "A#5": 932.33, "Bb5": 932.33, "B5": 987.77,

  // Octave 6
  "C6": 1046.50, "C#6": 1108.73, "Db6": 1108.73, "D6": 1174.66, "D#6": 1244.51, "Eb6": 1244.51, "E6": 1318.51, "F6": 1396.91, "F#6": 1479.98, "Gb6": 1479.98, "G6": 1567.98, "G#6": 1661.22, "Ab6": 1661.22, "A6": 1760.00, "A#6": 1864.66, "Bb6": 1864.66, "B6": 1975.53,
};

// Wait function that can be "cancelled"
const wait = (ms) => {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      if (isRunning) resolve();
      else reject(new Error("Script Stopped"));
    }, ms);

    // This checks periodically or allows external rejection
    const checkInterval = setInterval(() => {
      if (!isRunning) {
        clearTimeout(timeout);
        clearInterval(checkInterval);
        reject(new Error("Script Stopped"));
      }
    }, 50); // Check every 50ms if we should stop
  });
};

// Non-throttled playNote function
async function playNote(note, duration) {
    const frequency = NOTE_FREQUENCIES[note];
    if (frequency) {
        // direction doesn't matter for sound, so randomly choose one
        const inverted = Math.random() < 0.5 ? -1 : 1;
        changeApiState("frequency", frequency * inverted);
        await wait(duration);
    } else {
      changeApiState("frequency", 0);
      await wait(duration);
    }
}

let isRunning = false;

async function runUserScript() {
  if (isRunning) return; // Prevent double runs

  const code = document.getElementById('userscript-code').value;
  const runBtn = document.getElementById('run-userscript-btn');
  const stopBtn = document.getElementById('stop-userscript-btn');

  isRunning = true;
  runBtn.style.display = "none";
  stopBtn.style.display = "inline-block";

  try {
    const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
    const script = new AsyncFunction('changeFrequency', 'changeBrightness', 'wait', 'playNote', code);

    await script(changeFrequency, changeBrightness, wait, playNote);
  } catch (err) {
    if (err.message !== "Script Stopped") {
      alert("Script Error: " + err.message);
    }
  } finally {
    isRunning = false;
    runBtn.style.display = "inline-block";
    stopBtn.style.display = "none";
  }
}

function stopUserScript() {
  isRunning = false;
  document.getElementById("run-userscript-btn").style.display = "inline-block";
  document.getElementById("stop-userscript-btn").style.display = "none";
  changeFrequency(0);
}