// État de l'application
let appState = {
    currentImageData: null,
    originalImageData: null,
    history: [],
    historyIndex: -1,
    processing: false,
    zoomLevel: 1,
    isComparing: false
};

// Initialisation
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 ImageLab Pro - Initialisation');
    initializeApp();
});

function initializeApp() {
    // Test de connexion
    checkServer();
    
    // Événements de base
    setupBasicEvents();
    
    // Sliders
    setupSliders();
    
    // Afficher section par défaut
    showSection('adjustments');
    
    console.log('✓ Application initialisée');
}

async function checkServer() {
    try {
        const response = await fetch('/api/health');
        const data = await response.json();
        if (data.status === 'ok') {
            setStatus('✅ Prêt à traiter');
        }
    } catch (error) {
        setStatus('❌ Serveur non disponible', 'error');
        console.error('Serveur:', error);
    }
}

function setupBasicEvents() {
    // Upload
    const uploadBtn = document.getElementById('upload-trigger');
    const fileInput = document.getElementById('file-input');
    
    if (uploadBtn) {
        uploadBtn.addEventListener('click', () => fileInput.click());
    }
    
    if (fileInput) {
        fileInput.addEventListener('change', handleImageUpload);
    }
    
    // Navigation
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', function() {
            const section = this.getAttribute('data-section');
            handleNavigation(section);
        });
    });
    
    // Boutons de contrôle
    setupButton('undo-btn', undoModification);
    setupButton('redo-btn', redoModification);
    setupButton('reset-btn', resetImage);
    setupButton('compare-btn', toggleCompare);
    setupButton('save-btn', saveImage);
    
    // Zoom
    setupButton('zoom-in', () => adjustZoom(0.1));
    setupButton('zoom-out', () => adjustZoom(-0.1));
    setupButton('zoom-reset', resetZoom);
    
    // Filtres
    document.querySelectorAll('.filter-card').forEach(card => {
        card.addEventListener('click', function() {
            const filter = this.getAttribute('data-filter');
            applyFilter(filter);
        });
    });
    
    // Transformations
    setupButton('rotate-left', () => applyRotation(-90));
    setupButton('rotate-right', () => applyRotation(90));
    setupButton('flip-horizontal', () => applyFlip('horizontal'));
    setupButton('flip-vertical', () => applyFlip('vertical'));
    
    // Rotation personnalisée
    const applyRotationBtn = document.getElementById('apply-rotation');
    if (applyRotationBtn) {
        applyRotationBtn.addEventListener('click', applyCustomRotation);
    }
    
    // Thème
    const themeToggle = document.querySelector('.theme-toggle');
    if (themeToggle) {
        themeToggle.addEventListener('click', function() {
            document.body.classList.toggle('light-theme');
            const icon = this.querySelector('i');
            icon.classList.toggle('fa-moon');
            icon.classList.toggle('fa-sun');
        });
    }
    
    // Drag & drop
    setupDragAndDrop();
    // Dans la fonction setupBasicEvents(), ajouter ceci :

// Canaux RGB
setupButton('channel-r', () => applyChannelSeparation('red'));
setupButton('channel-g', () => applyChannelSeparation('green'));
setupButton('channel-b', () => applyChannelSeparation('blue'));
setupButton('channel-all', () => applyChannelSeparation('all'));

// Boutons de seuillage
document.querySelectorAll('.threshold-btn').forEach(btn => {
    btn.addEventListener('click', function() {
        const type = this.getAttribute('data-type');
        applyThreshold(type);
    });
});

// Boutons de détection de contours
document.querySelectorAll('.detection-btn').forEach(btn => {
    btn.addEventListener('click', function() {
        const detector = this.getAttribute('data-detector');
        applyEdgeDetection(detector);
    });
});

// Boutons d'exportation
setupButton('export-png', () => exportImage('png'));
setupButton('export-jpg', () => exportImage('jpg'));
setupButton('export-tiff', () => exportImage('tiff'));
}

function setupButton(id, handler) {
    const btn = document.getElementById(id);
    if (btn) {
        btn.addEventListener('click', handler);
    }
}

function setupSliders() {
    // Brightness
    const brightnessSlider = document.getElementById('brightness-slider');
    if (brightnessSlider) {
        const brightnessValue = brightnessSlider.parentElement.querySelector('.slider-value');
        brightnessSlider.addEventListener('input', function() {
            brightnessValue.textContent = this.value;
            applyBrightness(parseInt(this.value));
        });
    }
    
    // Contrast
    const contrastSlider = document.getElementById('contrast-slider');
    if (contrastSlider) {
        const contrastValue = contrastSlider.parentElement.querySelector('.slider-value');
        contrastSlider.addEventListener('input', function() {
            contrastValue.textContent = this.value;
            applyContrast(parseInt(this.value));
        });
    }
    
    // Grayscale
    const grayscaleSlider = document.getElementById('grayscale-slider');
    if (grayscaleSlider) {
        const grayscaleValue = grayscaleSlider.parentElement.querySelector('.slider-value');
        grayscaleSlider.addEventListener('input', function() {
            grayscaleValue.textContent = `${this.value}%`;
            if (this.value == 100) {
                applyGrayscale();
            } else if (appState.originalImageData) {
                resetImage();
            }
        });
    }
    
    // Resize
    const resizeSlider = document.getElementById('resize-slider');
    if (resizeSlider) {
        const resizeValue = resizeSlider.parentElement.querySelector('.slider-value');
        resizeSlider.addEventListener('input', function() {
            resizeValue.textContent = `${this.value}%`;
        });
        resizeSlider.addEventListener('change', function() {
            applyResize(parseInt(this.value));
        });
    }
    
    // Filter intensity
    const filterSlider = document.getElementById('filter-intensity-slider');
    if (filterSlider) {
        const filterValue = filterSlider.parentElement.querySelector('.slider-value');
        filterSlider.addEventListener('input', function() {
            filterValue.textContent = this.value;
        });
    }
    
    // Threshold
    const thresholdSlider = document.getElementById('threshold-slider');
    if (thresholdSlider) {
        const thresholdValue = thresholdSlider.parentElement.querySelector('.slider-value');
        thresholdSlider.addEventListener('input', function() {
            thresholdValue.textContent = this.value;
            applyThreshold('binary', parseInt(this.value));
        });
    }
}

async function handleImageUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    console.log('📤 Upload:', file.name);
    setStatus('Chargement...', 'processing');
    showLoading(true);
    
    const formData = new FormData();
    formData.append('image', file);
    
    try {
        const response = await fetch('/api/upload', {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        const data = await response.json();
        console.log('📥 Réponse:', data);
        
        if (data.success) {
            await updateImageDisplay(data);
            setStatus('✅ Image chargée');
        } else {
            setStatus(`❌ ${data.error}`, 'error');
        }
    } catch (error) {
        console.error('❌ Upload error:', error);
        setStatus('❌ Erreur de connexion', 'error');
    } finally {
        showLoading(false);
    }
}

async function updateImageDisplay(data) {
    return new Promise((resolve) => {
        appState.currentImageData = data.image;
        appState.originalImageData = data.image;
        appState.history = [data.image];
        appState.historyIndex = 0;
        
        const previewImg = document.getElementById('preview-image');
        const placeholder = document.getElementById('placeholder');
        const originalImg = document.getElementById('original-preview');
        const originalPlaceholder = document.getElementById('original-placeholder');
        
        // Préparer les images
        const tempImg = new Image();
        tempImg.onload = function() {
            // Mettre à jour l'aperçu principal
            previewImg.src = data.image;
            previewImg.style.display = 'block';
            if (placeholder) placeholder.style.display = 'none';
            
            // Mettre à jour l'original
            if (originalImg) {
                originalImg.src = data.image;
                originalImg.style.display = 'block';
            }
            if (originalPlaceholder) originalPlaceholder.style.display = 'none';
            
            // Infos
            document.getElementById('image-dimensions').textContent = data.dimensions || '-';
            document.getElementById('image-size').textContent = data.size ? `${Math.round(data.size/1024)} KB` : '-';
            
            // Réinitialiser
            appState.activeFilters = new Set();
            resetFilterCards();
            resetZoom();
            
            updateHistogram();
            resolve();
        };
        
        tempImg.onerror = function() {
            console.error('❌ Erreur chargement image');
            setStatus('❌ Erreur affichage', 'error');
            resolve();
        };
        
        tempImg.src = data.image;
    });
}

function showLoading(show) {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) {
        overlay.style.display = show ? 'flex' : 'none';
    }
}

async function processImage(operation, params = {}) {
    if (!appState.currentImageData || appState.processing) return;
    
    appState.processing = true;
    setStatus('Traitement...', 'processing');
    showLoading(true);
    
    try {
        console.log(`🔄 Traitement: ${operation}`, params);
        
        const response = await fetch('/api/process', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                operation: operation,
                params: params,
                image: appState.currentImageData
            })
        });
        
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        const data = await response.json();
        console.log('📥 Résultat:', data);
        
        if (data.success) {
            appState.currentImageData = data.image;
            
            // Mettre à jour l'image immédiatement
            const previewImg = document.getElementById('preview-image');
            if (previewImg) {
                previewImg.src = data.image;
            }
            
            // Historique
            if (appState.historyIndex < appState.history.length - 1) {
                appState.history = appState.history.slice(0, appState.historyIndex + 1);
            }
            appState.history.push(data.image);
            appState.historyIndex++;
            
            setStatus(`✅ ${operation} terminé`);
        } else {
            setStatus(`❌ ${data.error}`, 'error');
        }
    } catch (error) {
        console.error('❌ Traitement error:', error);
        setStatus('❌ Erreur traitement', 'error');
    } finally {
        appState.processing = false;
        showLoading(false);
    }
}

function handleNavigation(section) {
    // Navigation active
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
    });
    event.currentTarget.classList.add('active');
    
    // Afficher section
    document.querySelectorAll('.panel-section').forEach(panel => {
        panel.classList.remove('active');
    });
    
    const targetSection = document.getElementById(`${section}-section`);
    if (targetSection) {
        targetSection.classList.add('active');
    }
    
    setStatus(`📁 ${section}`);
}

function showSection(section) {
    handleNavigation({currentTarget: document.querySelector(`[data-section="${section}"]`)});
}

function applyCustomRotation() {
    const angleInput = document.getElementById('rotation-angle');
    const angle = parseFloat(angleInput.value);
    
    if (isNaN(angle)) {
        setStatus('❌ Angle invalide', 'error');
        return;
    }
    
    processImage('rotate', { angle: angle });
    angleInput.value = '';
}

function applyFilter(filter) {
    if (!appState.currentImageData) {
        setStatus('❌ Chargez une image d\'abord', 'error');
        return;
    }
    
    const card = document.querySelector(`[data-filter="${filter}"]`);
    const intensity = document.getElementById('filter-intensity-slider').value;
    
    const wasActive = card.classList.contains('active');
    
    // Désactiver tous les filtres
    document.querySelectorAll('.filter-card').forEach(c => c.classList.remove('active'));
    
    if (!wasActive) {
        card.classList.add('active');
        processImage('blur', { 
            method: filter,
            kernel_size: parseInt(intensity) || 5
        });
    } else {
        resetImage();
    }
}

function applyRotation(angle) {
    processImage('rotate', { angle: angle });
}

function applyFlip(mode) {
    processImage('flip', { mode: mode });
}

function applyGrayscale() {
    processImage('grayscale');
}

function applyBrightness(value) {
    processImage('brightness', { value: value });
}

function applyContrast(value) {
    processImage('contrast', { value: value });
}

function applyResize(percentage) {
    const slider = document.getElementById('resize-slider');
    const value = parseInt(slider.value);
    processImage('resize', { width: value, height: value });
}

function applyThreshold(type, value) {
    processImage('threshold', { type: type, value: value });
}

function applyChannelSeparation(channel) {
    if (channel === 'all') {
        resetImage();
    } else {
        processImage('channel_split', { channel: channel });
    }
}

function applyEdgeDetection(detector) {
    const low = document.getElementById('low-threshold-slider').value;
    const high = document.getElementById('high-threshold-slider').value;
    processImage('edge_detection', { 
        detector: detector,
        low: parseInt(low),
        high: parseInt(high)
    });
}

function adjustZoom(delta) {
    const previewImg = document.getElementById('preview-image');
    if (!previewImg) return;
    
    appState.zoomLevel += delta;
    appState.zoomLevel = Math.max(0.1, Math.min(5, appState.zoomLevel));
    
    previewImg.style.transform = `scale(${appState.zoomLevel})`;
    setStatus(`🔍 Zoom: ${Math.round(appState.zoomLevel * 100)}%`);
}

function resetZoom() {
    const previewImg = document.getElementById('preview-image');
    if (!previewImg) return;
    
    appState.zoomLevel = 1;
    previewImg.style.transform = 'scale(1)';
    setStatus('🔍 Zoom réinitialisé');
}

function undoModification() {
    if (appState.historyIndex > 0) {
        appState.historyIndex--;
        appState.currentImageData = appState.history[appState.historyIndex];
        
        const previewImg = document.getElementById('preview-image');
        if (previewImg) {
            previewImg.src = appState.currentImageData;
        }
        
        setStatus('↩️ Modification annulée');
    }
}

function redoModification() {
    if (appState.historyIndex < appState.history.length - 1) {
        appState.historyIndex++;
        appState.currentImageData = appState.history[appState.historyIndex];
        
        const previewImg = document.getElementById('preview-image');
        if (previewImg) {
            previewImg.src = appState.currentImageData;
        }
        
        setStatus('↪️ Modification rétablie');
    }
}

function resetImage() {
    if (!appState.originalImageData) {
        setStatus('❌ Aucune image', 'error');
        return;
    }
    
    appState.currentImageData = appState.originalImageData;
    
    const previewImg = document.getElementById('preview-image');
    if (previewImg) {
        previewImg.src = appState.originalImageData;
    }
    
    appState.history = [appState.originalImageData];
    appState.historyIndex = 0;
    appState.activeFilters = new Set();
    
    resetFilterCards();
    resetSliders();
    resetZoom();
    
    setStatus('🔄 Image réinitialisée');
}

function toggleCompare() {
    const previewImg = document.getElementById('preview-image');
    const compareBtn = document.getElementById('compare-btn');
    
    if (!previewImg || !compareBtn) return;
    
    appState.isComparing = !appState.isComparing;
    
    if (appState.isComparing) {
        previewImg.style.opacity = '0.5';
        compareBtn.classList.add('active');
        setStatus('👁️ Comparaison activée');
    } else {
        previewImg.style.opacity = '1';
        compareBtn.classList.remove('active');
        setStatus('👁️ Comparaison désactivée');
    }
}

async function saveImage() {
    if (!appState.currentImageData) {
        setStatus('❌ Aucune image', 'error');
        return;
    }
    
    try {
        const response = await fetch('/api/download', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                image: appState.currentImageData,
                format: 'png'
            })
        });
        
        if (response.ok) {
            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'image_traitee.png';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            setStatus('💾 Image sauvegardée');
        } else {
            setStatus('❌ Erreur sauvegarde', 'error');
        }
    } catch (error) {
        setStatus('❌ Erreur connexion', 'error');
    }
}

function resetFilterCards() {
    document.querySelectorAll('.filter-card').forEach(card => {
        card.classList.remove('active');
    });
}

function resetSliders() {
    const sliders = [
        {id: 'brightness-slider', value: 0, suffix: ''},
        {id: 'contrast-slider', value: 0, suffix: ''},
        {id: 'grayscale-slider', value: 0, suffix: '%'},
        {id: 'resize-slider', value: 100, suffix: '%'},
        {id: 'filter-intensity-slider', value: 3, suffix: ''},
        {id: 'threshold-slider', value: 128, suffix: ''}
    ];
    
    sliders.forEach(slider => {
        const element = document.getElementById(slider.id);
        if (element) {
            element.value = slider.value;
            const valueElement = element.parentElement.querySelector('.slider-value');
            if (valueElement) {
                valueElement.textContent = slider.value + slider.suffix;
            }
        }
    });
}

function setStatus(message, type = 'info') {
    const statusText = document.getElementById('status-text');
    const statusDot = document.querySelector('.status-dot');
    
    if (statusText) {
        statusText.textContent = message;
    }
    
    if (statusDot) {
        if (type === 'error') {
            statusDot.style.background = '#ef4444';
            statusDot.classList.remove('processing');
        } else if (type === 'processing') {
            statusDot.style.background = '#f59e0b';
            statusDot.classList.add('processing');
        } else {
            statusDot.style.background = '#4ade80';
            statusDot.classList.remove('processing');
        }
    }
}

function updateHistogram() {
    const canvas = document.getElementById('histogram-canvas');
    const container = document.getElementById('histogram-container');
    
    if (!canvas || !container) return;
    
    const ctx = canvas.getContext('2d');
    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    if (!appState.currentImageData) {
        ctx.fillStyle = 'rgba(224, 224, 224, 0.5)';
        ctx.font = '14px Inter';
        ctx.textAlign = 'center';
        ctx.fillText('Aucune image', canvas.width / 2, canvas.height / 2);
        return;
    }
    
    // Exemple d'histogramme
    const data = [];
    for (let i = 0; i < 256; i++) {
        const x = (i - 128) / 50;
        data.push(Math.exp(-x * x / 2) * canvas.height * 0.8);
    }
    
    // Dessiner
    const barWidth = canvas.width / 256;
    ctx.fillStyle = '#a8c0ff';
    
    for (let i = 0; i < 256; i++) {
        ctx.fillRect(i * barWidth, canvas.height - data[i], barWidth, data[i]);
    }
}

function setupDragAndDrop() {
    const dropZone = document.querySelector('.image-preview-container');
    if (!dropZone) return;
    
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(event => {
        dropZone.addEventListener(event, preventDefaults);
    });
    
    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }
    
    ['dragenter', 'dragover'].forEach(event => {
        dropZone.addEventListener(event, () => {
            dropZone.style.borderColor = 'var(--accent)';
        });
    });
    
    ['dragleave', 'drop'].forEach(event => {
        dropZone.addEventListener(event, () => {
            dropZone.style.borderColor = 'var(--border)';
        });
    });
    
    dropZone.addEventListener('drop', function(e) {
        const files = e.dataTransfer.files;
        if (files.length > 0 && files[0].type.startsWith('image/')) {
            handleImageUpload({target: {files: files}});
        }
    });
}
// Ajouter ces fonctions après les autres fonctions de traitement

function applyThreshold(type) {
    if (!appState.currentImageData) return;
    
    const slider = document.getElementById('threshold-slider');
    const value = parseInt(slider.value);
    
    if (type === 'adaptive') {
        processImage('threshold', { type: 'adaptive' });
    } else if (type === 'otsu') {
        processImage('threshold', { type: 'binary', value: 0 }); // Otsu sera géré côté serveur
    } else {
        processImage('threshold', { type: 'binary', value: value });
    }
    
    // Mettre à jour l'état des boutons
    document.querySelectorAll('.threshold-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    event.currentTarget.classList.add('active');
}

function applyChannelSeparation(channel) {
    if (!appState.currentImageData) return;
    
    processImage('channel_split', { channel: channel });
}

function applyEdgeDetection(detector) {
    if (!appState.currentImageData) return;
    
    const low = document.getElementById('low-threshold-slider').value;
    const high = document.getElementById('high-threshold-slider').value;
    
    processImage('edge_detection', { 
        detector: detector,
        low: parseInt(low),
        high: parseInt(high)
    });
    
    // Mettre à jour l'état des boutons
    document.querySelectorAll('.detection-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    event.currentTarget.classList.add('active');
}

async function exportImage(format) {
    if (!appState.currentImageData) {
        setStatus('❌ Aucune image', 'error');
        return;
    }
    
    try {
        const quality = document.getElementById('quality-slider').value;
        
        const response = await fetch('/api/download', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                image: appState.currentImageData,
                format: format,
                quality: parseInt(quality)
            })
        });
        
        if (response.ok) {
            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `image_traitee.${format}`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            setStatus(`💾 Image exportée en ${format.toUpperCase()}`);
        } else {
            setStatus('❌ Erreur exportation', 'error');
        }
    } catch (error) {
        console.error('Erreur export:', error);
        setStatus('❌ Erreur connexion', 'error');
    }
}

// Ajouter une fonction pour gérer le glisser-déposer
function setupDragAndDrop() {
    const dropZone = document.querySelector('.image-preview-container');
    if (!dropZone) return;
    
    // Prévenir le comportement par défaut
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, preventDefaults, false);
    });
    
    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }
    
    // Effets visuels
    ['dragenter', 'dragover'].forEach(eventName => {
        dropZone.addEventListener(eventName, highlight, false);
    });
    
    ['dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, unhighlight, false);
    });
    
    function highlight() {
        dropZone.style.borderColor = 'var(--accent)';
        dropZone.style.backgroundColor = 'rgba(168, 192, 255, 0.1)';
    }
    
    function unhighlight() {
        dropZone.style.borderColor = 'var(--border)';
        dropZone.style.backgroundColor = '';
    }
    
    // Gérer le drop
    dropZone.addEventListener('drop', handleDrop, false);
    
    function handleDrop(e) {
        const dt = e.dataTransfer;
        const files = dt.files;
        
        if (files.length > 0) {
            const file = files[0];
            if (file.type.startsWith('image/')) {
                // Créer un faux événement pour utiliser la fonction existante
                const event = {
                    target: {
                        files: files
                    }
                };
                handleImageUpload(event);
            } else {
                setStatus('❌ Veuillez déposer une image', 'error');
            }
        }
    }
}