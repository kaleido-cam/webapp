

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
    const script = new AsyncFunction('changeFrequency', 'changeBrightness', 'wait', code);

    await script(changeFrequency, changeBrightness, wait);
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