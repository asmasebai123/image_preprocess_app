// État de l'application
let appState = {
    currentImageData: null,
    originalImageData: null,
    sessionId: null,
    currentAdjustments: {
        brightness: 0,
        contrast: 0,
        hue: 0,
        grayscale: 0,
        saturation: 0
    },
    activeFilters: new Set(),
    history: [],
    historyIndex: -1,
    processing: false,
    zoomLevel: 1,
    isComparing: false,
    imageInfo: {
        dimensions: '-',
        size: '-',
        colorMode: '-'
    }
};

// Variables pour le debouncing
let processingTimeout = null;
let histogramTimeout = null;

// Variables pour la modale histogramme
let modalZoomLevel = 1;
let modalActiveChannel = 'rgb';

// Initialisation
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 ImageLab Pro - Initialisation');
    initializeApp();
});

function initializeApp() {
    // Test de connexion serveur
    checkServer();
    
    // Événements de base
    setupBasicEvents();
    
    // Sliders
    setupSliders();
    
    // Initialiser les boutons d'histogramme
    setupHistogramEvents();
    
    // Initialiser la modale histogramme
    setupHistogramModal();
    
    // Afficher section par défaut
    showSection('adjustments');
    
    console.log('✓ Application initialisée');
}

async function checkServer() {
    try {
        const response = await fetch('/api/health');
        const data = await response.json();
        if (data.status === 'ok') {
            setStatus('✅ Prêt à traiter - Serveur connecté', 'success');
            console.log(`✓ Serveur: ${data.version}`);
        }
    } catch (error) {
        setStatus('❌ Serveur non disponible', 'error');
        console.error('Serveur:', error);
        
        // Mode dégradé
        const statusDot = document.querySelector('.status-dot');
        if (statusDot) {
            statusDot.style.background = '#ef4444';
            statusDot.innerHTML = '<i class="fas fa-exclamation-triangle"></i>';
        }
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
            handleNavigation(this, section);
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
            localStorage.setItem('theme', document.body.classList.contains('light-theme') ? 'light' : 'dark');
        });
        
        // Restaurer le thème
        const savedTheme = localStorage.getItem('theme');
        if (savedTheme === 'light') {
            document.body.classList.add('light-theme');
            themeToggle.querySelector('i').classList.remove('fa-moon');
            themeToggle.querySelector('i').classList.add('fa-sun');
        }
    }
    
    // Drag & drop
    setupDragAndDrop();
    
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
    
    // Redimensionnement
    const resizeSlider = document.getElementById('resize-slider');
    if (resizeSlider) {
        resizeSlider.addEventListener('change', function() {
            const percentage = parseInt(this.value);
            applyResize(percentage);
        });
    }
}

function setupButton(id, handler) {
    const btn = document.getElementById(id);
    if (btn) {
        btn.addEventListener('click', handler);
    }
}

function setupSliders() {
    // Brightness avec debounce
    const brightnessSlider = document.getElementById('brightness-slider');
    if (brightnessSlider) {
        const brightnessValue = brightnessSlider.parentElement.querySelector('.slider-value');
        brightnessSlider.addEventListener('input', function() {
            brightnessValue.textContent = this.value;
            appState.currentAdjustments.brightness = parseInt(this.value);
            
            // Debounce pour éviter trop de requêtes
            clearTimeout(processingTimeout);
            processingTimeout = setTimeout(() => {
                applyBrightness(appState.currentAdjustments.brightness);
            }, 300);
        });
    }
    
    // Contrast avec debounce
    const contrastSlider = document.getElementById('contrast-slider');
    if (contrastSlider) {
        const contrastValue = contrastSlider.parentElement.querySelector('.slider-value');
        contrastSlider.addEventListener('input', function() {
            contrastValue.textContent = this.value;
            appState.currentAdjustments.contrast = parseInt(this.value);
            
            clearTimeout(processingTimeout);
            processingTimeout = setTimeout(() => {
                applyContrast(appState.currentAdjustments.contrast);
            }, 300);
        });
    }
    
    // Hue
    const hueSlider = document.getElementById('hue-slider');
    if (hueSlider) {
        const hueValue = hueSlider.parentElement.querySelector('.slider-value');
        hueSlider.addEventListener('input', function() {
            hueValue.textContent = this.value;
            appState.currentAdjustments.hue = parseInt(this.value);
            
            clearTimeout(processingTimeout);
            processingTimeout = setTimeout(() => {
                processImage('hue', { value: appState.currentAdjustments.hue });
            }, 300);
        });
    }
    
    // Grayscale
    const grayscaleSlider = document.getElementById('grayscale-slider');
    if (grayscaleSlider) {
        const grayscaleValue = grayscaleSlider.parentElement.querySelector('.slider-value');
        grayscaleSlider.addEventListener('input', function() {
            const value = parseInt(this.value);
            grayscaleValue.textContent = `${value}%`;
            appState.currentAdjustments.grayscale = value;
            
            clearTimeout(processingTimeout);
            processingTimeout = setTimeout(() => {
                if (value >= 100) {
                    applyGrayscale();
                } else if (value === 0 && appState.originalImageData) {
                    resetImage();
                } else {
                    // Appliquer un niveau de gris partiel
                    processImage('grayscale_partial', { intensity: value });
                }
            }, 300);
        });
    }
    
    // Resize
    const resizeSlider = document.getElementById('resize-slider');
    if (resizeSlider) {
        const resizeValue = resizeSlider.parentElement.querySelector('.slider-value');
        resizeSlider.addEventListener('input', function() {
            resizeValue.textContent = `${this.value}%`;
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
            
            clearTimeout(processingTimeout);
            processingTimeout = setTimeout(() => {
                applyThreshold('binary', parseInt(this.value));
            }, 300);
        });
    }
    
    // Canny thresholds
    const lowThresholdSlider = document.getElementById('low-threshold-slider');
    const highThresholdSlider = document.getElementById('high-threshold-slider');
    
    if (lowThresholdSlider) {
        const lowValue = lowThresholdSlider.parentElement.querySelector('.slider-value');
        lowThresholdSlider.addEventListener('input', function() {
            lowValue.textContent = this.value;
        });
    }
    
    if (highThresholdSlider) {
        const highValue = highThresholdSlider.parentElement.querySelector('.slider-value');
        highThresholdSlider.addEventListener('input', function() {
            highValue.textContent = this.value;
        });
    }
    
    // Quality
    const qualitySlider = document.getElementById('quality-slider');
    if (qualitySlider) {
        const qualityValue = qualitySlider.parentElement.querySelector('.slider-value');
        qualitySlider.addEventListener('input', function() {
            qualityValue.textContent = `${this.value}%`;
        });
    }
}

function setupHistogramEvents() {
    document.querySelectorAll('.histogram-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const channel = this.getAttribute('data-channel');
            
            // Mettre à jour l'état actif
            document.querySelectorAll('.histogram-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            
            if (channel === 'equalize') {
                applyHistogramEqualization();
            } else {
                updateHistogram(channel);
            }
        });
    });
}

function setupHistogramModal() {
    const histogramContainer = document.getElementById('histogram-container');
    const histogramOverlay = document.getElementById('histogram-overlay');
    const modal = document.getElementById('histogram-modal');
    const modalClose = document.getElementById('modal-close');
    const histogramCanvas = document.getElementById('histogram-canvas');
    
    // Ouvrir la modale au clic sur l'histogramme ou son overlay
    if (histogramContainer) {
        histogramContainer.addEventListener('click', function(e) {
            if (!appState.currentImageData) {
                setStatus('❌ Aucune image à analyser', 'error');
                return;
            }
            openHistogramModal();
        });
    }
    
    if (histogramOverlay) {
        histogramOverlay.addEventListener('click', function(e) {
            e.stopPropagation();
            if (!appState.currentImageData) {
                setStatus('❌ Aucune image à analyser', 'error');
                return;
            }
            openHistogramModal();
        });
    }
    
    if (histogramCanvas) {
        histogramCanvas.addEventListener('click', function(e) {
            e.stopPropagation();
            if (!appState.currentImageData) {
                setStatus('❌ Aucune image à analyser', 'error');
                return;
            }
            openHistogramModal();
        });
    }
    
    // Fermer la modale
    if (modalClose) {
        modalClose.addEventListener('click', closeHistogramModal);
    }
    
    // Fermer avec la touche ESC
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && modal.classList.contains('active')) {
            closeHistogramModal();
        }
    });
    
    // Fermer en cliquant sur l'overlay
    if (modal) {
        modal.addEventListener('click', function(e) {
            if (e.target.classList.contains('modal-overlay')) {
                closeHistogramModal();
            }
        });
    }
    
    // Boutons de contrôle de la modale
    setupModalControls();
    
    // Redimensionner le canvas quand la fenêtre change de taille
    window.addEventListener('resize', function() {
        if (modal.classList.contains('active') && appState.currentImageData) {
            updateModalHistogram(modalActiveChannel);
        }
    });
}

function setupModalControls() {
    // Sélecteurs de canaux
    document.querySelectorAll('.modal-channel-selector .channel-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const channel = this.getAttribute('data-channel');
            
            // Mettre à jour l'état actif
            document.querySelectorAll('.modal-channel-selector .channel-btn').forEach(b => {
                b.classList.remove('active');
            });
            this.classList.add('active');
            
            if (channel === 'rgb') {
                modalActiveChannel = 'rgb';
            } else if (channel) {
                modalActiveChannel = channel;
            }
            
            // Mettre à jour l'histogramme
            updateModalHistogram(modalActiveChannel);
            
            // Mettre à jour le canal actif dans les détails
            document.getElementById('modal-active-channel').textContent = 
                getChannelDisplayName(modalActiveChannel);
        });
    });
    
    // Bouton d'égalisation
    const equalizeBtn = document.getElementById('modal-equalize-btn');
    if (equalizeBtn) {
        equalizeBtn.addEventListener('click', function() {
            applyHistogramEqualization();
            setTimeout(() => {
                updateModalHistogram(modalActiveChannel);
            }, 500);
        });
    }
    
    // Contrôles de zoom
    setupButton('modal-zoom-in', () => adjustModalZoom(0.2));
    setupButton('modal-zoom-out', () => adjustModalZoom(-0.2));
    setupButton('modal-zoom-reset', resetModalZoom);
    
    // Actions
    setupButton('modal-save-btn', saveHistogramAsImage);
    setupButton('modal-print-btn', printHistogram);
    setupButton('modal-reset-btn', () => {
        resetModalZoom();
        modalActiveChannel = 'rgb';
        updateModalHistogram('rgb');
        
        // Réactiver le bouton RGB
        document.querySelectorAll('.modal-channel-selector .channel-btn').forEach(b => {
            b.classList.remove('active');
        });
        document.querySelector('.modal-channel-selector .channel-btn[data-channel="rgb"]').classList.add('active');
        document.getElementById('modal-active-channel').textContent = 'RGB';
    });
}

async function handleImageUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    // Vérifier le type de fichier
    if (!file.type.match('image.*')) {
        setStatus('❌ Veuillez sélectionner une image valide', 'error');
        return;
    }
    
    console.log('📤 Upload:', file.name, `(${Math.round(file.size/1024)} KB)`);
    setStatus('Chargement de l\'image...', 'processing');
    showLoading(true);
    
    const formData = new FormData();
    formData.append('image', file);
    
    try {
        const response = await fetch('/api/upload', {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || `HTTP ${response.status}`);
        }
        
        const data = await response.json();
        console.log('📥 Réponse:', data);
        
        if (data.success) {
            await updateImageDisplay(data);
            setStatus('✅ Image chargée avec succès', 'success');
        } else {
            throw new Error(data.error || 'Erreur inconnue');
        }
    } catch (error) {
        console.error('❌ Upload error:', error);
        setStatus(`❌ ${error.message}`, 'error');
    } finally {
        showLoading(false);
    }
}

async function updateImageDisplay(data) {
    return new Promise((resolve) => {
        appState.currentImageData = data.image;
        appState.originalImageData = data.image;
        appState.sessionId = data.session_id;
        appState.history = [data.image];
        appState.historyIndex = 0;
        appState.currentAdjustments = {
            brightness: 0,
            contrast: 0,
            hue: 0,
            grayscale: 0,
            saturation: 0
        };
        appState.imageInfo = {
            dimensions: data.dimensions || '-',
            size: data.size ? `${Math.round(data.size/1024)} KB` : '-',
            colorMode: data.color_mode || '-'
        };
        
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
            previewImg.style.transform = `scale(${appState.zoomLevel})`;
            
            if (placeholder) placeholder.style.display = 'none';
            
            // Mettre à jour l'original
            if (originalImg) {
                originalImg.src = data.image;
                originalImg.style.display = 'block';
            }
            if (originalPlaceholder) originalPlaceholder.style.display = 'none';
            
            // Mettre à jour les infos
            document.getElementById('image-dimensions').textContent = data.dimensions || '-';
            document.getElementById('image-size').textContent = data.size ? `${Math.round(data.size/1024)} KB` : '-';
            
            // Réinitialiser
            resetFilterCards();
            resetSliders();
            resetZoom();
            
            // Mettre à jour l'histogramme
            updateHistogram('rgb');
            
            // Activer les boutons
            document.querySelectorAll('.control-btn:not(#save-btn)').forEach(btn => {
                btn.disabled = false;
            });
            
            resolve();
        };
        
        tempImg.onerror = function() {
            console.error('❌ Erreur chargement image');
            setStatus('❌ Erreur d\'affichage de l\'image', 'error');
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
    setStatus(`Traitement: ${operation}...`, 'processing');
    showLoading(true);
    
    try {
        console.log(`🔄 Traitement: ${operation}`, params);
        
        const payload = {
            operation: operation,
            params: params,
            image: appState.currentImageData
        };
        
        // Ajouter l'ID de session pour les opérations qui en ont besoin
        if (appState.sessionId && ['brightness', 'contrast', 'hue', 'grayscale'].includes(operation)) {
            payload.session_id = appState.sessionId;
        }
        
        const response = await fetch('/api/process', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(payload)
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || `HTTP ${response.status}`);
        }
        
        const data = await response.json();
        console.log('📥 Résultat:', data);
        
        if (data.success) {
            appState.currentImageData = data.image;
            
            // Mettre à jour l'image immédiatement
            const previewImg = document.getElementById('preview-image');
            if (previewImg) {
                previewImg.src = data.image;
            }
            
            // Mettre à jour l'historique
            if (appState.historyIndex < appState.history.length - 1) {
                appState.history = appState.history.slice(0, appState.historyIndex + 1);
            }
            appState.history.push(data.image);
            appState.historyIndex++;
            
            // Mettre à jour les infos de dimensions si fournies
            if (data.dimensions) {
                document.getElementById('image-dimensions').textContent = data.dimensions;
            }
            
            setStatus(`✅ ${operation} terminé avec succès`, 'success');
            
            // Mettre à jour l'histogramme après certains traitements
            if (['grayscale', 'brightness', 'contrast', 'histogram_equalization', 'threshold'].includes(operation)) {
                updateHistogram('rgb');
            }
        } else {
            throw new Error(data.error || 'Erreur inconnue');
        }
    } catch (error) {
        console.error('❌ Traitement error:', error);
        setStatus(`❌ Erreur: ${error.message}`, 'error');
        
        // En cas d'erreur, revenir à l'image précédente
        if (appState.historyIndex > 0) {
            appState.historyIndex--;
            appState.currentImageData = appState.history[appState.historyIndex];
            const previewImg = document.getElementById('preview-image');
            if (previewImg) {
                previewImg.src = appState.currentImageData;
            }
        }
    } finally {
        appState.processing = false;
        showLoading(false);
    }
}

function handleNavigation(element, section) {
    // Navigation active
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
    });
    element.classList.add('active');
    
    // Afficher section
    document.querySelectorAll('.panel-section').forEach(panel => {
        panel.classList.remove('active');
    });
    
    const targetSection = document.getElementById(`${section}-section`);
    if (targetSection) {
        targetSection.classList.add('active');
    }
    
    // Mettre à jour l'histogramme si on passe à cette section
    if (section === 'histogram') {
        updateHistogram('rgb');
    }
}

function showSection(section) {
    const element = document.querySelector(`[data-section="${section}"]`);
    if (element) {
        handleNavigation(element, section);
    }
}

function applyCustomRotation() {
    const angleInput = document.getElementById('rotation-angle');
    const angle = parseFloat(angleInput.value);
    
    if (isNaN(angle)) {
        setStatus('❌ Veuillez entrer un angle valide', 'error');
        return;
    }
    
    if (angle < -360 || angle > 360) {
        setStatus('❌ Angle doit être entre -360 et 360 degrés', 'error');
        return;
    }
    
    processImage('rotate', { angle: angle });
    angleInput.value = '';
}

function applyFilter(filter) {
    if (!appState.currentImageData) {
        setStatus('❌ Veuillez charger une image d\'abord', 'error');
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
    if (!appState.currentImageData) return;
    
    // Calculer les nouvelles dimensions basées sur le pourcentage
    const img = new Image();
    img.onload = function() {
        const newWidth = Math.round(img.width * percentage / 100);
        const newHeight = Math.round(img.height * percentage / 100);
        processImage('resize', { width: newWidth, height: newHeight });
    };
    img.src = appState.currentImageData;
}

function applyThreshold(type, value) {
    if (!appState.currentImageData) return;
    
    if (type === 'adaptive') {
        processImage('threshold', { type: 'adaptive' });
    } else if (type === 'otsu') {
        processImage('threshold', { type: 'binary', value: 0 }); // 0 pour Otsu
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
    
    if (channel === 'all') {
        resetImage();
    } else {
        processImage('channel_split', { channel: channel });
    }
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

function applyHistogramEqualization() {
    processImage('histogram_equalization');
}

async function updateHistogram(channel = 'rgb') {
    if (!appState.currentImageData) {
        drawEmptyHistogram();
        return;
    }
    
    // Debounce pour éviter trop de requêtes
    clearTimeout(histogramTimeout);
    histogramTimeout = setTimeout(async () => {
        try {
            const response = await fetch('/api/histogram', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({
                    image: appState.currentImageData,
                    channel: channel
                })
            });
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || `HTTP ${response.status}`);
            }
            
            const data = await response.json();
            
            if (data.success) {
                drawHistogram(data.histogram, channel, data.stats);
            }
        } catch (error) {
            console.error('❌ Erreur histogramme:', error);
            drawEmptyHistogram();
        }
    }, 200);
}

function drawHistogram(histogramData, channel, stats = null) {
    const canvas = document.getElementById('histogram-canvas');
    const container = document.querySelector('.histogram-canvas-container');
    
    if (!canvas || !container) return;
    
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    const width = rect.width;
    const height = rect.height;
    const padding = { top: 30, right: 20, bottom: 40, left: 50 };
    const graphWidth = width - padding.left - padding.right;
    const graphHeight = height - padding.top - padding.bottom;
    
    // Dessiner l'arrière-plan
    ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--bg-glass') || 'rgba(30, 27, 72, 0.3)';
    ctx.fillRect(0, 0, width, height);
    
    // Dessiner la grille
    ctx.strokeStyle = 'rgba(168, 192, 255, 0.2)';
    ctx.lineWidth = 0.5;
    
    // Grille horizontale
    for (let i = 0; i <= 10; i++) {
        const y = padding.top + (i / 10) * graphHeight;
        ctx.beginPath();
        ctx.moveTo(padding.left, y);
        ctx.lineTo(width - padding.right, y);
        ctx.stroke();
        
        // Étiquettes horizontales
        ctx.fillStyle = 'rgba(224, 224, 224, 0.8)';
        ctx.font = '10px Inter';
        ctx.textAlign = 'right';
        ctx.fillText(`${Math.round((1 - i/10) * 100)}%`, padding.left - 10, y + 3);
    }
    
    // Grille verticale
    for (let i = 0; i <= 10; i++) {
        const x = padding.left + (i / 10) * graphWidth;
        ctx.beginPath();
        ctx.moveTo(x, padding.top);
        ctx.lineTo(x, height - padding.bottom);
        ctx.stroke();
        
        // Étiquettes verticales (valeurs de 0 à 255)
        ctx.fillStyle = 'rgba(224, 224, 224, 0.8)';
        ctx.font = '10px Inter';
        ctx.textAlign = 'center';
        ctx.fillText(`${Math.round(i * 25.5)}`, x, height - padding.bottom + 15);
    }
    
    // Dessiner les axes
    ctx.strokeStyle = 'rgba(168, 192, 255, 0.6)';
    ctx.lineWidth = 2;
    
    // Axe X
    ctx.beginPath();
    ctx.moveTo(padding.left, height - padding.bottom);
    ctx.lineTo(width - padding.right, height - padding.bottom);
    ctx.stroke();
    
    // Axe Y
    ctx.beginPath();
    ctx.moveTo(padding.left, padding.top);
    ctx.lineTo(padding.left, height - padding.bottom);
    ctx.stroke();
    
    // Étiquettes des axes
    ctx.fillStyle = 'rgba(224, 224, 224, 0.9)';
    ctx.font = '12px Inter';
    ctx.textAlign = 'center';
    ctx.fillText('Intensité des pixels (0-255)', width / 2, height - 10);
    
    ctx.save();
    ctx.translate(10, height / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = 'center';
    ctx.fillText('Fréquence relative (%)', 0, 0);
    ctx.restore();
    
    // Dessiner les données d'histogramme
    if (channel === 'rgb' && histogramData.red && histogramData.green && histogramData.blue) {
        // Normaliser les données
        const allValues = [...histogramData.red, ...histogramData.green, ...histogramData.blue];
        const maxValue = Math.max(...allValues);
        
        const channels = [
            { data: histogramData.red, color: '#FF4444', name: 'Rouge' },
            { data: histogramData.green, color: '#44FF44', name: 'Vert' },
            { data: histogramData.blue, color: '#4444FF', name: 'Bleu' }
        ];
        
        channels.forEach(channel => {
            if (!channel.data) return;
            
            ctx.strokeStyle = channel.color;
            ctx.fillStyle = channel.color + '80'; // 80 = 50% d'opacité
            ctx.lineWidth = 2;
            
            ctx.beginPath();
            ctx.moveTo(padding.left, height - padding.bottom);
            
            for (let i = 0; i < 256; i++) {
                const value = channel.data[i];
                const heightValue = (value / maxValue) * graphHeight;
                const x = padding.left + (i / 255) * graphWidth;
                const y = height - padding.bottom - heightValue;
                
                if (i === 0) {
                    ctx.moveTo(x, y);
                } else {
                    ctx.lineTo(x, y);
                }
            }
            
            ctx.lineTo(padding.left + graphWidth, height - padding.bottom);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
        });
        
        // Mettre à jour les statistiques
        updateHistogramStats(histogramData, stats);
        
    } else if (channel === 'gray' && histogramData.gray) {
        // Histogramme en niveaux de gris
        const data = histogramData.gray;
        const maxValue = Math.max(...data);
        
        ctx.strokeStyle = '#CCCCCC';
        ctx.fillStyle = '#CCCCCC80';
        ctx.lineWidth = 2;
        
        ctx.beginPath();
        ctx.moveTo(padding.left, height - padding.bottom);
        
        for (let i = 0; i < 256; i++) {
            const value = data[i];
            const heightValue = (value / maxValue) * graphHeight;
            const x = padding.left + (i / 255) * graphWidth;
            const y = height - padding.bottom - heightValue;
            
            if (i === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        }
        
        ctx.lineTo(padding.left + graphWidth, height - padding.bottom);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        
        // Mettre à jour les statistiques
        updateHistogramStats({ gray: data }, stats);
        
    } else if (channel in ['red', 'green', 'blue'] && histogramData[channel]) {
        // Canal unique
        const data = histogramData[channel];
        const maxValue = Math.max(...data);
        
        let color;
        switch(channel) {
            case 'red': color = '#FF4444'; break;
            case 'green': color = '#44FF44'; break;
            case 'blue': color = '#4444FF'; break;
            default: color = '#A8C0FF';
        }
        
        ctx.strokeStyle = color;
        ctx.fillStyle = color + '80';
        ctx.lineWidth = 2;
        
        ctx.beginPath();
        ctx.moveTo(padding.left, height - padding.bottom);
        
        for (let i = 0; i < 256; i++) {
            const value = data[i];
            const heightValue = (value / maxValue) * graphHeight;
            const x = padding.left + (i / 255) * graphWidth;
            const y = height - padding.bottom - heightValue;
            
            if (i === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        }
        
        ctx.lineTo(padding.left + graphWidth, height - padding.bottom);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        
        // Mettre à jour les statistiques
        const channelData = {};
        channelData[channel] = data;
        updateHistogramStats(channelData, stats);
    }
    
    // Ajouter un titre
    ctx.fillStyle = 'rgba(224, 224, 224, 0.9)';
    ctx.font = 'bold 14px Inter';
    ctx.textAlign = 'center';
    ctx.fillText(`Histogramme - ${getChannelName(channel)}`, width / 2, 20);
}

function getChannelName(channel) {
    const names = {
        'rgb': 'Tous les canaux RGB',
        'red': 'Canal Rouge',
        'green': 'Canal Vert',
        'blue': 'Canal Bleu',
        'gray': 'Niveaux de gris'
    };
    return names[channel] || channel;
}

function updateHistogramStats(histogramData, stats) {
    if (!stats) return;
    
    let totalPixels = 0;
    let totalValue = 0;
    let pixelCount = 0;
    let minValue = 256;
    let maxValue = 0;
    
    // Calculer les statistiques combinées pour RGB
    if (histogramData.red && histogramData.green && histogramData.blue) {
        for (let i = 0; i < 256; i++) {
            const red = histogramData.red[i] || 0;
            const green = histogramData.green[i] || 0;
            const blue = histogramData.blue[i] || 0;
            const channelSum = red + green + blue;
            
            totalPixels += channelSum;
            totalValue += i * channelSum;
            pixelCount += red + green + blue;
            
            if (channelSum > 0) {
                minValue = Math.min(minValue, i);
                maxValue = Math.max(maxValue, i);
            }
        }
    } else if (histogramData.gray) {
        // Pour les niveaux de gris
        const data = histogramData.gray;
        for (let i = 0; i < 256; i++) {
            const value = data[i] || 0;
            totalPixels += value;
            totalValue += i * value;
            pixelCount += value;
            
            if (value > 0) {
                minValue = Math.min(minValue, i);
                maxValue = Math.max(maxValue, i);
            }
        }
    } else {
        // Pour un canal unique
        const channel = Object.keys(histogramData)[0];
        const data = histogramData[channel];
        if (data) {
            for (let i = 0; i < 256; i++) {
                const value = data[i] || 0;
                totalPixels += value;
                totalValue += i * value;
                pixelCount += value;
                
                if (value > 0) {
                    minValue = Math.min(minValue, i);
                    maxValue = Math.max(maxValue, i);
                }
            }
        }
    }
    
    const mean = pixelCount > 0 ? Math.round(totalValue / pixelCount) : 0;
    const dynamicRange = `${minValue} - ${maxValue}`;
    
    // Mettre à jour l'interface
    document.getElementById('pixel-count').textContent = totalPixels.toLocaleString();
    document.getElementById('mean-value').textContent = mean;
    document.getElementById('dynamic-range').textContent = dynamicRange;
    
    // Calculer l'écart-type approximatif
    if (stats.std && stats.std.gray) {
        document.getElementById('std-value').textContent = Math.round(stats.std.gray);
    } else if (stats.std && Object.keys(stats.std).length > 0) {
        const stdValues = Object.values(stats.std);
        const avgStd = stdValues.reduce((a, b) => a + b, 0) / stdValues.length;
        document.getElementById('std-value').textContent = Math.round(avgStd);
    }
}

function drawEmptyHistogram() {
    const canvas = document.getElementById('histogram-canvas');
    const container = document.getElementById('histogram-container');
    
    if (!canvas || !container) return;
    
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    const width = rect.width;
    const height = rect.height;
    
    // Message central
    ctx.fillStyle = 'rgba(224, 224, 224, 0.7)';
    ctx.font = '16px Inter';
    ctx.textAlign = 'center';
    ctx.fillText('Chargez une image pour voir l\'histogramme', width / 2, height / 2);
    
    // Icône
    ctx.font = '40px "Font Awesome 6 Free"';
    ctx.fillText('📊', width / 2, height / 2 - 40);
    
    // Réinitialiser les statistiques
    document.getElementById('pixel-count').textContent = '0';
    document.getElementById('mean-value').textContent = '0';
    document.getElementById('std-value').textContent = '0';
    document.getElementById('dynamic-range').textContent = '0-255';
}

function openHistogramModal() {
    const modal = document.getElementById('histogram-modal');
    if (!modal) return;
    
    // Empêcher le défilement du body
    document.body.classList.add('modal-open');
    
    // Afficher la modale
    modal.classList.add('active');
    
    // Réinitialiser le zoom modal
    modalZoomLevel = 1;
    
    // Mettre à jour l'histogramme modal
    updateModalHistogram(modalActiveChannel);
    
    // Mettre à jour les informations de l'image
    updateModalImageInfo();
    
    setStatus('📊 Affichage de l\'histogramme détaillé');
}

function closeHistogramModal() {
    const modal = document.getElementById('histogram-modal');
    if (!modal) return;
    
    modal.classList.remove('active');
    document.body.classList.remove('modal-open');
    
    setStatus('✅ Retour à l\'interface principale');
}

function getChannelDisplayName(channel) {
    const names = {
        'rgb': 'Tous les canaux (RGB)',
        'red': 'Canal Rouge',
        'green': 'Canal Vert',
        'blue': 'Canal Bleu',
        'gray': 'Niveaux de gris'
    };
    return names[channel] || channel;
}

async function updateModalHistogram(channel = 'rgb') {
    if (!appState.currentImageData) return;
    
    try {
        const response = await fetch('/api/histogram', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                image: appState.currentImageData,
                channel: channel
            })
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || `HTTP ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.success) {
            drawModalHistogram(data.histogram, channel, data.stats, data.image_info);
        }
    } catch (error) {
        console.error('❌ Erreur histogramme modal:', error);
        drawEmptyModalHistogram();
    }
}

function drawModalHistogram(histogramData, channel, stats = null, imageInfo = null) {
    const canvas = document.getElementById('modal-histogram-canvas');
    const container = document.querySelector('.modal-histogram-container');
    
    if (!canvas || !container) return;
    
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const rect = container.getBoundingClientRect();
    
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    const width = rect.width;
    const height = rect.height;
    const padding = { top: 60, right: 40, bottom: 80, left: 70 };
    const graphWidth = width - padding.left - padding.right;
    const graphHeight = height - padding.top - padding.bottom;
    
    // Appliquer le zoom
    ctx.save();
    ctx.translate(width / 2, height / 2);
    ctx.scale(modalZoomLevel, modalZoomLevel);
    ctx.translate(-width / 2, -height / 2);
    
    // Arrière-plan dégradé
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, 'rgba(30, 27, 72, 0.1)');
    gradient.addColorStop(1, 'rgba(15, 14, 35, 0.3)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
    
    // Grille de fond
    ctx.strokeStyle = 'rgba(168, 192, 255, 0.15)';
    ctx.lineWidth = 0.5;
    ctx.setLineDash([2, 2]);
    
    // Grille horizontale
    for (let i = 0; i <= 10; i++) {
        const y = padding.top + (i / 10) * graphHeight;
        ctx.beginPath();
        ctx.moveTo(padding.left, y);
        ctx.lineTo(width - padding.right, y);
        ctx.stroke();
        
        // Étiquettes horizontales
        ctx.fillStyle = 'rgba(224, 224, 224, 0.8)';
        ctx.font = '12px Inter';
        ctx.textAlign = 'right';
        ctx.fillText(`${Math.round((1 - i/10) * 100)}%`, padding.left - 15, y + 4);
    }
    
    // Grille verticale
    for (let i = 0; i <= 10; i++) {
        const x = padding.left + (i / 10) * graphWidth;
        ctx.beginPath();
        ctx.moveTo(x, padding.top);
        ctx.lineTo(x, height - padding.bottom);
        ctx.stroke();
        
        // Étiquettes verticales
        ctx.fillStyle = 'rgba(224, 224, 224, 0.8)';
        ctx.font = '12px Inter';
        ctx.textAlign = 'center';
        ctx.fillText(`${Math.round(i * 25.5)}`, x, height - padding.bottom + 20);
    }
    
    ctx.setLineDash([]);
    
    // Axes principaux
    ctx.strokeStyle = 'rgba(168, 192, 255, 0.6)';
    ctx.lineWidth = 2;
    
    // Axe X
    ctx.beginPath();
    ctx.moveTo(padding.left, height - padding.bottom);
    ctx.lineTo(width - padding.right, height - padding.bottom);
    ctx.stroke();
    
    // Axe Y
    ctx.beginPath();
    ctx.moveTo(padding.left, padding.top);
    ctx.lineTo(padding.left, height - padding.bottom);
    ctx.stroke();
    
    // Flèches
    ctx.fillStyle = 'rgba(168, 192, 255, 0.8)';
    
    // Flèche X
    ctx.beginPath();
    ctx.moveTo(width - padding.right, height - padding.bottom);
    ctx.lineTo(width - padding.right - 10, height - padding.bottom - 5);
    ctx.lineTo(width - padding.right - 10, height - padding.bottom + 5);
    ctx.closePath();
    ctx.fill();
    
    // Flèche Y
    ctx.beginPath();
    ctx.moveTo(padding.left, padding.top);
    ctx.lineTo(padding.left - 5, padding.top + 10);
    ctx.lineTo(padding.left + 5, padding.top + 10);
    ctx.closePath();
    ctx.fill();
    
    // Étiquettes des axes
    ctx.fillStyle = 'rgba(224, 224, 224, 0.9)';
    ctx.font = 'bold 14px Inter';
    ctx.textAlign = 'center';
    ctx.fillText('Intensité des pixels (0-255)', width / 2, height - 30);
    
    ctx.save();
    ctx.translate(20, height / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = 'center';
    ctx.fillText('Fréquence relative (%)', 0, 0);
    ctx.restore();
    
    // Dessiner les données d'histogramme
    if (channel === 'rgb' && histogramData.red && histogramData.green && histogramData.blue) {
        const allValues = [...histogramData.red, ...histogramData.green, ...histogramData.blue];
        const maxValue = Math.max(...allValues);
        
        const channels = [
            { data: histogramData.red, color: '#FF4444', name: 'red' },
            { data: histogramData.green, color: '#44FF44', name: 'green' },
            { data: histogramData.blue, color: '#4444FF', name: 'blue' }
        ];
        
        // Dessiner l'aire sous les courbes
        channels.forEach(ch => {
            ctx.strokeStyle = ch.color;
            ctx.fillStyle = ch.color + '40'; // Transparent
            ctx.lineWidth = 3;
            
            ctx.beginPath();
            ctx.moveTo(padding.left, height - padding.bottom);
            
            for (let i = 0; i < 256; i++) {
                const value = ch.data[i];
                const heightValue = (value / maxValue) * graphHeight;
                const x = padding.left + (i / 255) * graphWidth;
                const y = height - padding.bottom - heightValue;
                
                if (i === 0) {
                    ctx.moveTo(x, y);
                } else {
                    ctx.lineTo(x, y);
                }
            }
            
            ctx.lineTo(padding.left + graphWidth, height - padding.bottom);
            ctx.closePath();
            ctx.fill();
            
            // Dessiner la ligne
            ctx.beginPath();
            for (let i = 0; i < 256; i++) {
                const value = ch.data[i];
                const heightValue = (value / maxValue) * graphHeight;
                const x = padding.left + (i / 255) * graphWidth;
                const y = height - padding.bottom - heightValue;
                
                if (i === 0) {
                    ctx.moveTo(x, y);
                } else {
                    ctx.lineTo(x, y);
                }
            }
            ctx.stroke();
        });
        
        updateModalStats(histogramData, stats, imageInfo, 'rgb');
        
    } else if (channel === 'gray' && histogramData.gray) {
        const data = histogramData.gray;
        const maxValue = Math.max(...data);
        
        // Remplissage
        ctx.fillStyle = 'rgba(200, 200, 200, 0.3)';
        ctx.beginPath();
        ctx.moveTo(padding.left, height - padding.bottom);
        
        for (let i = 0; i < 256; i++) {
            const value = data[i];
            const heightValue = (value / maxValue) * graphHeight;
            const x = padding.left + (i / 255) * graphWidth;
            const y = height - padding.bottom - heightValue;
            
            if (i === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        }
        
        ctx.lineTo(padding.left + graphWidth, height - padding.bottom);
        ctx.closePath();
        ctx.fill();
        
        // Ligne
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 3;
        ctx.beginPath();
        
        for (let i = 0; i < 256; i++) {
            const value = data[i];
            const heightValue = (value / maxValue) * graphHeight;
            const x = padding.left + (i / 255) * graphWidth;
            const y = height - padding.bottom - heightValue;
            
            if (i === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        }
        ctx.stroke();
        
        updateModalStats({ gray: data }, stats, imageInfo, 'gray');
        
    } else if (histogramData[channel]) {
        const data = histogramData[channel];
        const maxValue = Math.max(...data);
        
        let color;
        switch(channel) {
            case 'red': color = '#FF4444'; break;
            case 'green': color = '#44FF44'; break;
            case 'blue': color = '#4444FF'; break;
            default: color = '#A8C0FF';
        }
        
        // Remplissage
        ctx.fillStyle = color + '40';
        ctx.beginPath();
        ctx.moveTo(padding.left, height - padding.bottom);
        
        for (let i = 0; i < 256; i++) {
            const value = data[i];
            const heightValue = (value / maxValue) * graphHeight;
            const x = padding.left + (i / 255) * graphWidth;
            const y = height - padding.bottom - heightValue;
            
            if (i === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        }
        
        ctx.lineTo(padding.left + graphWidth, height - padding.bottom);
        ctx.closePath();
        ctx.fill();
        
        // Ligne
        ctx.strokeStyle = color;
        ctx.lineWidth = 3;
        ctx.beginPath();
        
        for (let i = 0; i < 256; i++) {
            const value = data[i];
            const heightValue = (value / maxValue) * graphHeight;
            const x = padding.left + (i / 255) * graphWidth;
            const y = height - padding.bottom - heightValue;
            
            if (i === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        }
        ctx.stroke();
        
        const channelData = {};
        channelData[channel] = data;
        updateModalStats(channelData, stats, imageInfo, channel);
    }
    
    // Titre
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.font = 'bold 18px Inter';
    ctx.textAlign = 'center';
    ctx.fillText(`Histogramme - ${getChannelDisplayName(channel)}`, width / 2, 30);
    
    // Sous-titre
    ctx.fillStyle = 'rgba(168, 192, 255, 0.8)';
    ctx.font = '13px Inter';
    ctx.fillText(`Distribution des intensités de pixels (Zoom: ${Math.round(modalZoomLevel * 100)}%)`, width / 2, 50);
    
    ctx.restore(); // Restaurer la transformation du zoom
}

function updateModalStats(histogramData, stats, imageInfo, channel) {
    if (!stats) return;
    
    // Calculer les statistiques étendues
    let totalPixels = 0;
    let totalValue = 0;
    let pixelCount = 0;
    let minValue = 256;
    let maxValue = 0;
    
    if (histogramData.red && histogramData.green && histogramData.blue) {
        for (let i = 0; i < 256; i++) {
            const red = histogramData.red[i] || 0;
            const green = histogramData.green[i] || 0;
            const blue = histogramData.blue[i] || 0;
            const channelSum = red + green + blue;
            
            totalPixels += channelSum;
            totalValue += i * channelSum;
            pixelCount += red + green + blue;
            
            if (channelSum > 0) {
                minValue = Math.min(minValue, i);
                maxValue = Math.max(maxValue, i);
            }
        }
    } else if (histogramData.gray) {
        const data = histogramData.gray;
        for (let i = 0; i < 256; i++) {
            const value = data[i] || 0;
            totalPixels += value;
            totalValue += i * value;
            pixelCount += value;
            
            if (value > 0) {
                minValue = Math.min(minValue, i);
                maxValue = Math.max(maxValue, i);
            }
        }
    } else {
        const dataKey = Object.keys(histogramData)[0];
        const data = histogramData[dataKey];
        for (let i = 0; i < 256; i++) {
            const value = data[i] || 0;
            totalPixels += value;
            totalValue += i * value;
            pixelCount += value;
            
            if (value > 0) {
                minValue = Math.min(minValue, i);
                maxValue = Math.max(maxValue, i);
            }
        }
    }
    
    const mean = pixelCount > 0 ? Math.round(totalValue / pixelCount) : 0;
    const dynamicRange = `${minValue} - ${maxValue}`;
    
    // Calcul de l'entropie
    let entropy = 0;
    if (pixelCount > 0) {
        const dataArray = histogramData.gray || histogramData.red || histogramData[Object.keys(histogramData)[0]];
        for (let i = 0; i < 256; i++) {
            const p = (dataArray[i] || 0) / pixelCount;
            if (p > 0) {
                entropy -= p * Math.log2(p);
            }
        }
        entropy = Math.round(entropy * 100) / 100;
    }
    
    // Calcul du contraste (écart type)
    let contrast = 0;
    if (stats.std) {
        if (stats.std.gray) {
            contrast = Math.round(stats.std.gray);
        } else {
            const stdValues = Object.values(stats.std);
            const avgStd = stdValues.reduce((a, b) => a + b, 0) / stdValues.length;
            contrast = Math.round(avgStd);
        }
    }
    
    // Mettre à jour l'interface
    document.getElementById('modal-total-pixels').textContent = totalPixels.toLocaleString();
    document.getElementById('modal-mean-value').textContent = mean;
    document.getElementById('modal-std-value').textContent = contrast;
    document.getElementById('modal-dynamic-range').textContent = dynamicRange;
    document.getElementById('modal-entropy').textContent = entropy;
    document.getElementById('modal-contrast').textContent = maxValue - minValue;
    
    // Détails
    document.getElementById('modal-min-level').textContent = minValue;
    document.getElementById('modal-max-level').textContent = maxValue;
    
    if (stats.median && stats.median[channel]) {
        document.getElementById('modal-median').textContent = Math.round(stats.median[channel]);
    }
    
    if (stats.mode && stats.mode[channel]) {
        document.getElementById('modal-mode').textContent = Math.round(stats.mode[channel]);
    }
}

function updateModalImageInfo() {
    const dimensions = document.getElementById('image-dimensions').textContent;
    document.getElementById('modal-image-info').textContent = dimensions;
}

function drawEmptyModalHistogram() {
    const canvas = document.getElementById('modal-histogram-canvas');
    const container = document.querySelector('.modal-histogram-container');
    
    if (!canvas || !container) return;
    
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const rect = container.getBoundingClientRect();
    
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    const width = rect.width;
    const height = rect.height;
    
    // Message central stylisé
    ctx.fillStyle = 'rgba(168, 192, 255, 0.3)';
    ctx.font = 'bold 24px Inter';
    ctx.textAlign = 'center';
    ctx.fillText('📊', width / 2, height / 2 - 30);
    
    ctx.fillStyle = 'rgba(224, 224, 224, 0.8)';
    ctx.font = '18px Inter';
    ctx.fillText('Aucune image chargée', width / 2, height / 2);
    
    ctx.fillStyle = 'rgba(224, 224, 224, 0.6)';
    ctx.font = '14px Inter';
    ctx.fillText('Chargez une image pour voir son histogramme', width / 2, height / 2 + 30);
    
    // Réinitialiser les statistiques
    document.getElementById('modal-total-pixels').textContent = '0';
    document.getElementById('modal-mean-value').textContent = '0';
    document.getElementById('modal-std-value').textContent = '0';
    document.getElementById('modal-dynamic-range').textContent = '0-255';
    document.getElementById('modal-entropy').textContent = '0';
    document.getElementById('modal-contrast').textContent = '0';
    document.getElementById('modal-image-info').textContent = '-';
}

function adjustModalZoom(delta) {
    modalZoomLevel += delta;
    modalZoomLevel = Math.max(0.5, Math.min(3, modalZoomLevel));
    
    if (appState.currentImageData) {
        updateModalHistogram(modalActiveChannel);
    }
}

function resetModalZoom() {
    modalZoomLevel = 1;
    
    if (appState.currentImageData) {
        updateModalHistogram(modalActiveChannel);
    }
}

function adjustZoom(delta) {
    const previewImg = document.getElementById('preview-image');
    if (!previewImg || !previewImg.style.display || previewImg.style.display === 'none') return;
    
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
        updateHistogram('rgb');
    } else {
        setStatus('❌ Aucune modification à annuler', 'error');
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
        updateHistogram('rgb');
    } else {
        setStatus('❌ Aucune modification à rétablir', 'error');
    }
}

async function resetImage() {
    if (!appState.originalImageData || !appState.sessionId) {
        setStatus('❌ Aucune image chargée', 'error');
        return;
    }
    
    setStatus('Réinitialisation...', 'processing');
    showLoading(true);
    
    try {
        const response = await fetch('/api/reset', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                session_id: appState.sessionId
            })
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || `HTTP ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.success) {
            appState.currentImageData = data.image;
            appState.currentAdjustments = {
                brightness: 0,
                contrast: 0,
                hue: 0,
                grayscale: 0,
                saturation: 0
            };
            appState.activeFilters.clear();
            
            const previewImg = document.getElementById('preview-image');
            if (previewImg) {
                previewImg.src = data.image;
            }
            
            appState.history = [data.image];
            appState.historyIndex = 0;
            
            resetFilterCards();
            resetSliders();
            resetZoom();
            updateHistogram('rgb');
            
            setStatus('🔄 Image réinitialisée avec succès', 'success');
        }
    } catch (error) {
        console.error('❌ Erreur réinitialisation:', error);
        setStatus(`❌ ${error.message}`, 'error');
    } finally {
        showLoading(false);
    }
}

function toggleCompare() {
    const previewImg = document.getElementById('preview-image');
    const compareBtn = document.getElementById('compare-btn');
    
    if (!previewImg || !compareBtn) return;
    
    appState.isComparing = !appState.isComparing;
    
    if (appState.isComparing) {
        previewImg.style.opacity = '0.5';
        compareBtn.classList.add('active');
        compareBtn.innerHTML = '<i class="fas fa-eye-slash"></i> Arrêter comparaison';
        setStatus('👁️ Comparaison activée - Voir l\'original en arrière-plan');
    } else {
        previewImg.style.opacity = '1';
        compareBtn.classList.remove('active');
        compareBtn.innerHTML = '<i class="fas fa-eye"></i> Comparer';
        setStatus('👁️ Comparaison désactivée');
    }
}

async function saveImage() {
    if (!appState.currentImageData) {
        setStatus('❌ Aucune image à sauvegarder', 'error');
        return;
    }
    
    try {
        const a = document.createElement('a');
        a.href = appState.currentImageData;
        a.download = `image_traitee_${new Date().toISOString().slice(0, 10)}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        
        setStatus('💾 Image sauvegardée localement');
    } catch (error) {
        console.error('❌ Erreur sauvegarde:', error);
        setStatus('❌ Erreur lors de la sauvegarde', 'error');
    }
}

async function exportImage(format) {
    if (!appState.currentImageData) {
        setStatus('❌ Aucune image à exporter', 'error');
        return;
    }
    
    setStatus(`Exportation en ${format.toUpperCase()}...`, 'processing');
    showLoading(true);
    
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
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || `HTTP ${response.status}`);
        }
        
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `image_traitee_${new Date().toISOString().slice(0, 10)}.${format}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        setStatus(`💾 Image exportée en ${format.toUpperCase()}`, 'success');
    } catch (error) {
        console.error('❌ Erreur export:', error);
        setStatus(`❌ ${error.message}`, 'error');
    } finally {
        showLoading(false);
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
        {id: 'hue-slider', value: 0, suffix: ''},
        {id: 'grayscale-slider', value: 0, suffix: '%'},
        {id: 'resize-slider', value: 100, suffix: '%'},
        {id: 'filter-intensity-slider', value: 3, suffix: ''},
        {id: 'threshold-slider', value: 128, suffix: ''},
        {id: 'low-threshold-slider', value: 50, suffix: ''},
        {id: 'high-threshold-slider', value: 150, suffix: ''},
        {id: 'quality-slider', value: 95, suffix: '%'}
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
        statusDot.innerHTML = '';
        statusDot.style.animation = 'none';
        
        if (type === 'error') {
            statusDot.style.background = '#ef4444';
            statusDot.innerHTML = '<i class="fas fa-times"></i>';
        } else if (type === 'processing') {
            statusDot.style.background = '#f59e0b';
            statusDot.style.animation = 'pulse 1.5s infinite';
            statusDot.innerHTML = '<i class="fas fa-sync-alt fa-spin"></i>';
        } else if (type === 'success') {
            statusDot.style.background = '#4ade80';
            statusDot.innerHTML = '<i class="fas fa-check"></i>';
        } else {
            statusDot.style.background = '#3b82f6';
            statusDot.innerHTML = '<i class="fas fa-info-circle"></i>';
        }
    }
}

function setupDragAndDrop() {
    const dropZone = document.querySelector('.image-preview-container');
    if (!dropZone) return;
    
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, preventDefaults, false);
    });
    
    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }
    
    ['dragenter', 'dragover'].forEach(eventName => {
        dropZone.addEventListener(eventName, highlight, false);
    });
    
    ['dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, unhighlight, false);
    });
    
    function highlight() {
        dropZone.style.borderColor = 'var(--accent)';
        dropZone.style.backgroundColor = 'rgba(168, 192, 255, 0.1)';
        dropZone.style.boxShadow = '0 0 20px rgba(168, 192, 255, 0.3)';
    }
    
    function unhighlight() {
        dropZone.style.borderColor = 'var(--border)';
        dropZone.style.backgroundColor = '';
        dropZone.style.boxShadow = '';
    }
    
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
                setStatus('❌ Veuillez déposer une image valide (JPEG, PNG, etc.)', 'error');
            }
        }
    }
}

function saveHistogramAsImage() {
    const canvas = document.getElementById('modal-histogram-canvas');
    if (!canvas) return;
    
    const link = document.createElement('a');
    link.download = `histogramme_${new Date().toISOString().slice(0, 10)}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
    
    setStatus('💾 Histogramme sauvegardé');
}

function printHistogram() {
    window.print();
}

// Initialisation des dimensions du canvas histogramme
window.addEventListener('resize', function() {
    if (appState.currentImageData) {
        updateHistogram('rgb');
    }
});

console.log('✓ ImageLab Pro - Chargement terminé');