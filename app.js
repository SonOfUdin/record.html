javascript// =========================================================================
// 1. FREE SUPABASE CONFIGURATION (NO CREDIT CARD REQUIRED)
// Changed variable name to 'supabaseClient' to fix the declaration crash
// =========================================================================
const SUPABASE_URL = ""https://ydvfmbvdxgtjtvowmdfj.supabase.co"; 
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlkdmZtYnZkeGd0anR2b3dtZGZqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE0NjI1ODcsImV4cCI6MjA5NzAzODU4N30.ihE4GMKmG2f4E9M7xliSH1VvZ3wCiuXw56RLreQNIgU";

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// =========================================================================
// 2. DOM ELEMENT UI REFERENCES
// =========================================================================
const btnRecord = document.getElementById('btn-record');
const btnStop = document.getElementById('btn-stop');
const btnSubmit = document.getElementById('btn-submit');
const btnDownload = document.getElementById('btn-download');
const timerDisplay = document.getElementById('timer');
const statusTag = document.getElementById('status-tag');
const previewSection = document.getElementById('preview-section');
const audioPreview = document.getElementById('audio-preview');
const metaForm = document.getElementById('meta-form');
const canvas = document.getElementById('visualizer-canvas');
const canvasCtx = canvas ? canvas.getContext('2d') : null;

// =========================================================================
// 3. SECURE APPLICATION STATE MATRIX
// =========================================================================
let mediaRecorder = null;
let audioChunks = [];
let timerInterval = null;
let secondsElapsed = 0;
let audioBlob = null;

let audioCtx = null;
let analyser = null;
let dataArray = null;
let source = null;
let animationFrameId = null;

// =========================================================================
// 4. ACTION DRIVEN EVENT LISTENERS
// =========================================================================
if (btnRecord) btnRecord.addEventListener('click', startRecording);
if (btnStop) btnStop.addEventListener('click', stopRecording);
if (metaForm) metaForm.addEventListener('submit', handleSupabaseUpload);

function resizeCanvas() {
    if (!canvas) return;
    canvas.width = canvas.clientWidth * window.devicePixelRatio;
    canvas.height = canvas.clientHeight * window.devicePixelRatio;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas(); 

// =========================================================================
// 5. ENGINE IMPLEMENTATION LOGIC
// =========================================================================

async function startRecording() {
    audioChunks = [];
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
            audio: { echoCancellation: true, noiseSuppression: true } 
        });

        if (canvasCtx) {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            analyser = audioCtx.createAnalyser();
            analyser.fftSize = 128;
            source = audioCtx.createMediaStreamSource(stream);
            source.connect(analyser);
            dataArray = new Uint8Array(analyser.frequencyBinCount);
            drawVisualizer();
        }

        mediaRecorder = new MediaRecorder(stream);
        mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunks.push(e.data); };
        mediaRecorder.onstop = processAudioOutput;
        
        mediaRecorder.start();
        updateUIState(true);
        startTimer();

    } catch (error) {
        console.error('System Access Denied:', error);
        alert('Microphone blocked! Ensure you are running on GitHub Pages over HTTPS.');
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
    stopTimer(); 
    if (!mediaRecorder || mediaRecorder.state === 'inactive') return;

    mediaRecorder.stop();
    mediaRecorder.stream.getTracks().forEach(track => track.stop());
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

/**
 * Uploads data smoothly using 'supabaseClient'
 */
async function handleSupabaseUpload(event) {
    event.preventDefault();
    if (!audioBlob) return alert('No audio file found.');

    const userName = document.getElementById('user-name').value.trim();
    const trackTitle = document.getElementById('track-title').value.trim();
    const trackLanguage = document.getElementById('audio-language').value;

    btnSubmit.disabled = true;
    btnSubmit.textContent = "Uploading...";

    const fileExtension = mediaRecorder.mimeType.includes('mp4') ? 'm4a' : 
                          mediaRecorder.mimeType.includes('webm') ? 'webm' : 'wav';
    const uniqueFilename = `track_${Date.now()}.${fileExtension}`;

    try {
        btnSubmit.textContent = "Uploading audio file...";
        const { data: storageData, error: storageError } = await supabaseClient.storage
            .from('audio-recordings')
            .upload(uniqueFilename, audioBlob, {
                cacheControl: '3600',
                upsert: false,
                contentType: audioBlob.type
            });

        if (storageError) throw storageError;

        const { data: publicUrlData } = supabaseClient.storage
            .from('audio-recordings')
            .getPublicUrl(uniqueFilename);

        const absoluteAudioUrl = publicUrlData.publicUrl;

        btnSubmit.textContent = "Saving data records...";
        const { data: tableData, error: tableError } = await supabaseClient
            .from('audio_submissions')
            .insert([
                {
                    recorder_name: userName,
                    track_title: trackTitle,
                    audio_language: trackLanguage,
                    audio_url: absoluteAudioUrl
                }
            ]);

        if (tableError) throw tableError;

        alert(`Success!\nTrack recorded by ${userName} has been saved into your database columns.`);
        
        metaForm.reset();
        if (previewSection) previewSection.classList.add('hidden');

    } catch (err) {
        console.error("Upload failure:", err);
        alert(`Upload failed: ${err.message || err}`);
    } finally {
        btnSubmit.disabled = false;
        btnSubmit.textContent = "Submit Track";
    }
}

function updateUIState(isRecording) {
    if (isRecording) {
        document.body.classList.add('is-recording');
        if (statusTag) { statusTag.textContent = 'Recording'; statusTag.className = 'status-tag recording'; }
        if (btnRecord) btnRecord.disabled = true;
        if (btnStop) btnStop.disabled = false;
        if (previewSection) previewSection.classList.add('hidden');
    } else {
        document.body.classList.remove('is-recording');
        if (statusTag) { statusTag.textContent = 'Ready'; statusTag.className = 'status-tag idle'; }
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
        if (timerDisplay) timerDisplay.textContent = `${mins}:${secs}`;
    }, 1000);
}

function stopTimer() { 
    clearInterval(timerInterval); 
}
