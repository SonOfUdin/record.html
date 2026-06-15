// =========================================================================
// 1. FREE SUPABASE CONFIGURATION (NO CREDIT CARD REQUIRED)
// Replace these template strings with your real Project API values
// =========================================================================
const SUPABASE_URL = "https://ydvfmbvdxgtjtvowmdfj.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlkdmZtYnZkeGd0anR2b3dtZGZqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE0NjI1ODcsImV4cCI6MjA5NzAzODU4N30.ihE4GMKmG2f4E9M7xliSH1VvZ3wCiuXw56RLreQNIgU";

const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// =========================================================================
// 1. DOM ELEMENT REFERENCES
// =========================================================================
const btnRecord = document.getElementById('btn-record');
const btnStop = document.getElementById('btn-stop');
const btnDownload = document.getElementById('btn-download');
const timerDisplay = document.getElementById('timer');
const statusTag = document.getElementById('status-tag');
const previewSection = document.getElementById('preview-section');
const audioPreview = document.getElementById('audio-preview');
const metaForm = document.getElementById('meta-form');
const canvas = document.getElementById('visualizer-canvas');
const canvasCtx = canvas ? canvas.getContext('2d') : null;

// =========================================================================
// 2. CORE APPLICATION STATE VARIABLES
// =========================================================================
let mediaRecorder = null;
let audioChunks = [];
let timerInterval = null;
let secondsElapsed = 0;
let audioBlob = null;

// Visualizer specific states
let audioCtx = null;
let analyser = null;
let dataArray = null;
let source = null;
let animationFrameId = null;

// =========================================================================
// 3. ACTION DRIVEN EVENT LISTENERS
// =========================================================================
if (btnRecord) btnRecord.addEventListener('click', startRecording);
if (btnStop) btnStop.addEventListener('click', stopRecording);

if (metaForm) {
    metaForm.addEventListener('submit', function(event) {
        event.preventDefault();
        const name = document.getElementById('user-name').value;
        const track = document.getElementById('track-title').value;
        alert(`Local Mode Active!\nName: ${name}\nTrack: ${track}\n\nYour audio file is ready for download below.`);
    });
}

// Automatic canvas dimension calculator
function resizeCanvas() {
    if (!canvas) return;
    canvas.width = canvas.clientWidth * window.devicePixelRatio;
    canvas.height = canvas.clientHeight * window.devicePixelRatio;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// =========================================================================
// 4. FUNCTION IMPLEMENTATIONS
// =========================================================================

async function startRecording() {
    audioChunks = []; // Clear old data buffers
   
    try {
        // Request microphone hardware access tokens safely
        const stream = await navigator.mediaDevices.getUserMedia({
            audio: { echoCancellation: true, noiseSuppression: true }
        });

        // Initialize clean audio graph visualizer nodes
        if (canvasCtx) {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            analyser = audioCtx.createAnalyser();
            analyser.fftSize = 128;
            source = audioCtx.createMediaStreamSource(stream);
            source.connect(analyser);
            dataArray = new Uint8Array(analyser.frequencyBinCount);
            drawVisualizer(); // Launch rendering frames
        }

        // Start native media recorder capture framework
        mediaRecorder = new MediaRecorder(stream);
        mediaRecorder.ondataavailable = (e) => {
            if (e.data.size > 0) audioChunks.push(e.data);
        };
       
        mediaRecorder.onstop = processAudioOutput;
        mediaRecorder.start();

        updateUIState(true);
        startTimer();

    } catch (error) {
        console.error('System Access Denied:', error);
        alert('Microphone blocked! Ensure you are hosting this on GitHub Pages or a Local Server environment.');
    }
}

function drawVisualizer() {
    animationFrameId = requestAnimationFrame(drawVisualizer);
    if (!analyser || !canvasCtx) return;

    analyser.getByteFrequencyData(dataArray);
    canvasCtx.clearRect(0, 0, canvas.width, canvas.height);

    const barWidth = (canvas.width / analyser.frequencyBinCount) * 1.5;
    let x = 0;

    for (let i = 0; i < analyser.frequencyBinCount; i++) {
        let barHeight = (dataArray[i] / 255) * canvas.height * 0.8;
        canvasCtx.fillStyle = '#00f2fe';
        canvasCtx.fillRect(x, canvas.height - barHeight, barWidth - 4, barHeight);
        x += barWidth;
    }
}

function stopRecording() {
    // 1. IMMEDIATELY halt the timer clock from ticking forward
    stopTimer();

    if (!mediaRecorder || mediaRecorder.state === 'inactive') return;

    // 2. Stop the hardware media capture streams
    mediaRecorder.stop();
    mediaRecorder.stream.getTracks().forEach(track => track.stop()); // Shuts off privacy light indicator
   
    // 3. Reset your visual states and clean up the canvas animations
    updateUIState(false);

    if (animationFrameId) cancelAnimationFrame(animationFrameId);
    if (audioCtx) audioCtx.close();
}

function processAudioOutput() {
    audioBlob = new Blob(audioChunks, { type: mediaRecorder.mimeType || 'audio/wav' });
    const audioUrl = URL.createObjectURL(audioBlob);
   
    if (audioPreview) audioPreview.src = audioUrl;
    if (btnDownload) {
        btnDownload.href = audioUrl;
        btnDownload.setAttribute('download', 'take.wav');
    }

    if (previewSection) previewSection.classList.remove('hidden');
}

function updateUIState(isRecording) {
    if (isRecording) {
        document.body.classList.add('is-recording');
        if (statusTag) {
            statusTag.textContent = 'Recording';
            statusTag.className = 'status-tag recording';
        }
        if (btnRecord) btnRecord.disabled = true;
        if (btnStop) btnStop.disabled = false;
        if (previewSection) previewSection.classList.add('hidden');
    } else {
        document.body.classList.remove('is-recording');
        if (statusTag) {
            statusTag.textContent = 'Ready';
            statusTag.className = 'status-tag idle';
        }
        if (btnRecord) btnRecord.disabled = false;
        if (btnStop) btnStop.disabled = true;
    }
}

function startTimer() {
    secondsElapsed = 0;
    if (timerDisplay) timerDisplay.textContent = '00:00';
   
    timerInterval = setInterval(() => {
        secondsElapsed++;
        const mins = String(Math.floor(secondsElapsed / 60)).padStart(2, '0');
        const secs = String(secondsElapsed % 60).padStart(2, '0');
        if (timerDisplay) {
            timerDisplay.textContent = `${mins}:${secs}`;
        }
    }, 1000);
}

function stopTimer() {
    clearInterval(timerInterval);
}
