// UI Elements
const btnRecord = document.getElementById('btn-record');
const btnStop = document.getElementById('btn-stop');
const timerDisplay = document.getElementById('timer');
const statusTag = document.getElementById('status-tag');
const previewSection = document.getElementById('preview-section');
const audioPreview = document.getElementById('audio-preview');
const metaForm = document.getElementById('meta-form');
const canvas = document.getElementById('visualizer-canvas');
const canvasCtx = canvas.getContext('2d');

// State Variables
let mediaRecorder = null;
let audioChunks = [];
let timerInterval = null;
let secondsElapsed = 0;
let audioBlob = null;

// Visualizer State Variables
let audioCtx = null;
let analyser = null;
let dataArray = null;
let source = null;
let animationFrameId = null;

// Event Listeners
btnRecord.addEventListener('click', startRecording);
btnStop.addEventListener('click', stopRecording);

// Handle submission safely if form layout exists
if (metaForm) {
    metaForm.addEventListener('submit', (e) => {
        e.preventDefault();
        alert("Local testing mode active! To save files online, choose a storage provider next.");
    });
}

function resizeCanvas() {
    if (!canvas) return;
    canvas.width = canvas.clientWidth * window.devicePixelRatio;
    canvas.height = canvas.clientHeight * window.devicePixelRatio;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

async function startRecording() {
    audioChunks = [];
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
            audio: { echoCancellation: true, noiseSuppression: true } 
        });

        // Set up local canvas audio mapping visualizer
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        analyser = audioCtx.createAnalyser();
        analyser.fftSize = 128;
        source = audioCtx.createMediaStreamSource(stream);
        source.connect(analyser);
        dataArray = new Uint8Array(analyser.frequencyBinCount);

        mediaRecorder = new MediaRecorder(stream);
        mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunks.push(e.data); };
        mediaRecorder.onstop = () => {
            audioBlob = new Blob(audioChunks, { type: mediaRecorder.mimeType || 'audio/wav' });
            const audioUrl = URL.createObjectURL(audioBlob);
            audioPreview.src = audioUrl;
            
            const btnDownload = document.getElementById('btn-download');
            if (btnDownload) {
                btnDownload.href = audioUrl;
                btnDownload.setAttribute('download', `local-take.wav`);
            }
            previewSection.classList.remove('hidden');
        };

        mediaRecorder.start();
        updateUIState(true);
        startTimer();
        drawVisualizer();

    } catch (error) {
        console.error('Microphone Access Blocked:', error);
        alert('Browser Blocked Microphone! Check the URL bar or host this page on GitHub Pages to test.');
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
    if (!mediaRecorder || mediaRecorder.state === 'inactive') return;
    mediaRecorder.stop();
    mediaRecorder.stream.getTracks().forEach(track => track.stop());
    updateUIState(false);
    stopTimer();
    if (animationFrameId) cancelAnimationFrame(animationFrameId);
    if (audioCtx) audioCtx.close();
}

function updateUIState(isRecording) {
    if (isRecording) {
        document.body.classList.add('is-recording');
        statusTag.textContent = 'Recording';
        statusTag.className = 'status-tag recording';
        btnRecord.disabled = true;
        btnStop.disabled = false;
        previewSection.classList.add('hidden');
    } else {
        document.body.classList.remove('is-recording');
        statusTag.textContent = 'Ready';
        statusTag.className = 'status-tag idle';
        btnRecord.disabled = false;
        btnStop.disabled = true;
    }
}

function startTimer() {
    secondsElapsed = 0;
    timerDisplay.textContent = '00:00';
    timerInterval = setInterval(() => {
        secondsElapsed++;
        const mins = String(Math.floor(secondsElapsed / 60)).padStart(2, '0');
        const secs = String(secondsElapsed % 60).padStart(2, '0');
        timerDisplay.textContent = `${mins}:${secs}`;
    }, 1000);
}

function stopTimer() { clearInterval(timerInterval); }
