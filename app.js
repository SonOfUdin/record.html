javascript// =========================================================================
// 1. CLOUD STORAGE CREDENTIAL MATRIX
// Ensure your Project URL and Anon key match your project dashboard exactly
// =========================================================================
const SUPABASE_URL = "https://supabase.co"; 
const SUPABASE_ANON_KEY = "YOUR_REAL_ANON_KEY_HERE";

const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// =========================================================================
// 2. DOM INTERFACE COMPONENT POINTERS
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
// 3. MASTER APPLICATION CONTAINER ENTRIES
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
// 4. BIND ACTION CAPTURE TRIGGERS
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
resizeCanvas(); // Calibrate visual matrix bounds upon frame load

// =========================================================================
// 5. INTERACTIVE FUNCTION CORE LOGIC
// =========================================================================

async function startRecording() {
    audioChunks = []; // Clean up historical records buffer tracks
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
            audio: { echoCancellation: true, noiseSuppression: true } 
        });

        // Setup real time audio listener canvas graphics
        if (canvasCtx) {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            analyser = audioCtx.createAnalyser();
            analyser.fftSize = 128; 
            source = audioCtx.createMediaStreamSource(stream);
            source.connect(analyser);
            dataArray = new Uint8Array(analyser.frequencyBinCount);
            drawVisualizer(); // Fire analytical painter frame loop
        }

        mediaRecorder = new MediaRecorder(stream);
        mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunks.push(e.data); };
        mediaRecorder.onstop = processAudioOutput;
        
        mediaRecorder.start();
        updateUIState(true);
        startTimer();

    } catch (error) {
        console.error('System Device Core Blocked:', error);
        alert('Microphone Blocked! Push your project folder online to your secure HTTPS GitHub Pages link to run.');
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
    stopTimer(); // Instantly stops the timer counter numbers from ticking
    if (!mediaRecorder || mediaRecorder.state === 'inactive') return;

    mediaRecorder.stop();
    mediaRecorder.stream.getTracks().forEach(track => track.stop()); // Shuts off system mic hardware alert bulb
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
        btnDownload.setAttribute('download', 'recording.wav');
    }
    if (previewSection) previewSection.classList.remove('hidden');
}

// =========================================================================
// 6. STORAGE PIPELINE CONNECTIONS
// =========================================================================

async function handleSupabaseUpload(event) {
    event.preventDefault(); // Secure form standard redirects from reloading
    if (!audioBlob) return alert('Data fault: Audio track asset empty.');

    const userName = document.getElementById('user-name').value.trim();
    const trackTitle = document.getElementById('track-title').value.trim();
    const trackLanguage = document.getElementById('audio-language').value;

    btnSubmit.disabled = true;
    btnSubmit.textContent = "Processing...";

    const fileExtension = mediaRecorder.mimeType.includes('mp4') ? 'm4a' : 
                          mediaRecorder.mimeType.includes('webm') ? 'webm' : 'wav';
    const uniqueFilename = `track_${Date.now()}.${fileExtension}`;

    try {
        // STEP A: Fire raw recording array bytes to Object bucket
        btnSubmit.textContent = "Uploading file track...";
        const { data: storageData, error: storageError } = await supabase.storage
            .from('audio-recordings')
            .upload(uniqueFilename, audioBlob, {
                cacheControl: '3600',
                upsert: false,
                contentType: audioBlob.type
            });

        if (storageError) throw storageError;

        // STEP B: Generate permanent reference cloud link URL for that asset
        const { data: publicUrlData } = supabase.storage
            .from('audio-recordings')
            .getPublicUrl(uniqueFilename);

        const absoluteAudioUrl = publicUrlData.publicUrl;

        // STEP C: Insert parameters row array package right into Database table structure logs
        btnSubmit.textContent = "Logging text metadata...";
        const { data: tableData, error: tableError } = await supabase
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

        alert(`Success!\nRecording submitted by ${userName} has been saved into your database columns.`);
        
        metaForm.reset();
        if (previewSection) previewSection.classList.add('hidden');

    } catch (err) {
        console.error("Cloud processing pipeline dropped context:", err);
        alert(`Process blocked: ${err.message || err}`);
    } finally {
        btnSubmit.disabled = false;
        btnSubmit.textContent = "Submit Track";
    }
}

// =========================================================================
// 7. INTERACTIVE DISPLAY ADJUSTMENTS
// =========================================================================

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
