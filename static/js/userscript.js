
/**
 * Calculates frequency of a note string (e.g., "C4", "Eb5", "A#3")
 * @param {string} note - The note name with octave
 * @returns {number} Frequency in Hz (rounded to 3 decimal places)
 */
function getNoteFrequency(note) {
    const notes = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

    // Normalize flats to sharps (e.g., Eb -> D#)
    const normalizedNote = note.replace("db", "C#").replace("eb", "D#")
                               .replace("gb", "F#").replace("ab", "G#")
                               .replace("bb", "A#")
                               .replace("Db", "C#").replace("Eb", "D#")
                               .replace("Gb", "F#").replace("Ab", "G#")
                               .replace("Bb", "A#");

    // Extract note name and octave number
    const noteName = normalizedNote.slice(0, -1);
    const octave = parseInt(normalizedNote.slice(-1));

    // Calculate distance from A4
    // A4 is index 9 in Octave 4
    const semitoneIndex = notes.indexOf(noteName);
    const distanceToA4 = (semitoneIndex - 9) + (octave - 4) * 12;

    const frequency = 440 * Math.pow(2, distanceToA4 / 12);
    return Math.round(frequency * 1000) / 1000;
}

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
    const frequency = getNoteFrequency(note);
    if (frequency) {
        changeApiState("frequency", frequency);
        await wait(duration);
    } else {
      changeApiState("frequency", 0);
      await wait(duration);
    }
}

async function playToneJS(instructions, track=0) {
    const notes = instructions["tracks"][track]["notes"];
    const songStartedAt = performance.now();
    for (const noteObj of notes) {
        const startTime = songStartedAt + noteObj["time"] * 1000;
        const now = performance.now();
        if (startTime > now) {
            await playNote("-", startTime - now);
        }
        const note = noteObj["name"];
        const duration = noteObj["duration"] * 1000;
        await playNote(note, duration);
    }
    changeApiState("frequency", 0);
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