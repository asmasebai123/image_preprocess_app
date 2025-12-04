// État de l'application
const appState = {
    currentImage: null,
    originalImage: null,
    zoomLevel: 1,
    isComparing: false,
    activeFilters: new Set(),
    currentChannel: 'rgb'
};

// Initialisation
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
});

function initializeApp() {
    // Initialiser les écouteurs d'événements
    initializeEventListeners();
    
    // Afficher la section par défaut
    showSection('adjustments');
    
    // Initialiser l'histogramme
    updateHistogram();
}

function initializeEventListeners() {
    // Upload d'image
    document.getElementById('upload-trigger').addEventListener('click', () => {
        document.getElementById('file-input').click();
    });
    
    document.getElementById('file-input').addEventListener('change', handleImageUpload);
    
    // Navigation sidebar
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', function() {
            const section = this.getAttribute('data-section');
            handleNavigation(section);
        });
    });
    
    // Contrôles d'image
    document.getElementById('undo-btn').addEventListener('click', undoModification);
    document.getElementById('redo-btn').addEventListener('click', redoModification);
    document.getElementById('reset-btn').addEventListener('click', resetImage);
    document.getElementById('compare-btn').addEventListener('click', toggleCompare);
    document.getElementById('save-btn').addEventListener('click', saveImage);
    
    // Contrôles de zoom
    document.getElementById('zoom-in').addEventListener('click', () => adjustZoom(0.1));
    document.getElementById('zoom-out').addEventListener('click', () => adjustZoom(-0.1));
    document.getElementById('zoom-reset').addEventListener('click', resetZoom);
    
    // Rotation personnalisée
    document.getElementById('apply-rotation').addEventListener('click', applyCustomRotation);
    
    // Filtres
    document.querySelectorAll('.filter-card').forEach(card => {
        card.addEventListener('click', function() {
            const filter = this.getAttribute('data-filter');
            toggleFilter(filter);
        });
    });
    
    // Transformations
    document.getElementById('rotate-left').addEventListener('click', () => rotateImage(-90));
    document.getElementById('rotate-right').addEventListener('click', () => rotateImage(90));
    document.getElementById('flip-horizontal').addEventListener('click', () => flipImage('horizontal'));
    document.getElementById('flip-vertical').addEventListener('click', () => flipImage('vertical'));
    
    // Séparation des canaux
    document.getElementById('channel-r').addEventListener('click', () => applyChannelSeparation('red'));
    document.getElementById('channel-g').addEventListener('click', () => applyChannelSeparation('green'));
    document.getElementById('channel-b').addEventListener('click', () => applyChannelSeparation('blue'));
    document.getElementById('channel-all').addEventListener('click', () => applyChannelSeparation('all'));
    
    // Histogramme
    document.querySelectorAll('.histogram-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.histogram-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            appState.currentChannel = this.getAttribute('data-channel');
            updateHistogram();
        });
    });
    
    // Glisser-déposer
    setupDragAndDrop();
}

function handleImageUpload(event) {
    const file = event.target.files[0];
    if (file && file.type.startsWith('image/')) {
        loadImage(file);
    }
}

function loadImage(file) {
    const reader = new FileReader();
    reader.onload = function(e) {
        const img = new Image();
        img.onload = function() {
            appState.currentImage = img;
            appState.originalImage = img;
            appState.zoomLevel = 1;
            appState.activeFilters.clear();
            
            const previewImage = document.getElementById('preview-image');
            const placeholder = document.getElementById('placeholder');
            const originalPreview = document.getElementById('original-preview');
            const originalPlaceholder = document.getElementById('original-placeholder');
            
            previewImage.src = e.target.result;
            previewImage.style.display = 'block';
            placeholder.style.display = 'none';
            
            // Mettre à jour la miniature de l'image originale
            originalPreview.src = e.target.result;
            originalPreview.style.display = 'block';
            originalPlaceholder.style.display = 'none';
            
            updateImageInfo(file, img);
            setStatus('Image chargée avec succès');
            
            // Mettre à jour l'histogramme
            updateHistogram();
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

function updateImageInfo(file, img) {
    document.getElementById('image-dimensions').textContent = `${img.width} × ${img.height} px`;
    document.getElementById('image-size').textContent = `${(file.size / 1024).toFixed(1)} KB`;
}

function handleNavigation(section) {
    // Mettre à jour la navigation active
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
    });
    event.currentTarget.classList.add('active');
    
    // Afficher la section correspondante
    showSection(section);
    
    setStatus(`Section ${section} active`);
}

function showSection(section) {
    // Masquer toutes les sections
    document.querySelectorAll('.panel-section').forEach(panel => {
        panel.classList.remove('active');
    });
    
    // Afficher la section demandée
    const targetSection = document.getElementById(`${section}-section`);
    if (targetSection) {
        targetSection.classList.add('active');
    }
}

function applyCustomRotation() {
    const angleInput = document.getElementById('rotation-angle');
    const angle = parseFloat(angleInput.value);
    
    if (isNaN(angle)) {
        setStatus('Veuillez entrer un angle valide', 'error');
        return;
    }
    
    rotateImage(angle);
    angleInput.value = '';
}

function toggleFilter(filter) {
    if (!appState.currentImage) return;
    
    const card = document.querySelector(`[data-filter="${filter}"]`);
    
    if (appState.activeFilters.has(filter)) {
        appState.activeFilters.delete(filter);
        card.classList.remove('active');
        setStatus(`Filtre ${filter} désactivé`);
    } else {
        appState.activeFilters.add(filter);
        card.classList.add('active');
        setStatus(`Filtre ${filter} activé`);
    }
}

function rotateImage(degrees) {
    if (!appState.currentImage) return;
    
    setStatus(`Image tournée de ${degrees}°`);
}

function flipImage(direction) {
    if (!appState.currentImage) return;
    
    setStatus(`Image miroir ${direction}`);
}

function applyChannelSeparation(channel) {
    if (!appState.currentImage) return;
    
    setStatus(`Canal ${channel} sélectionné`);
}

function adjustZoom(delta) {
    const previewImage = document.getElementById('preview-image');
    appState.zoomLevel += delta;
    appState.zoomLevel = Math.max(0.1, Math.min(5, appState.zoomLevel));
    
    previewImage.style.transform = `scale(${appState.zoomLevel})`;
    setStatus(`Zoom: ${Math.round(appState.zoomLevel * 100)}%`);
}

function resetZoom() {
    const previewImage = document.getElementById('preview-image');
    appState.zoomLevel = 1;
    previewImage.style.transform = 'scale(1)';
    setStatus('Zoom réinitialisé');
}

function undoModification() {
    setStatus('Modification annulée');
}

function redoModification() {
    setStatus('Modification rétablie');
}

function resetImage() {
    if (!appState.originalImage) return;
    
    const previewImage = document.getElementById('preview-image');
    appState.currentImage = appState.originalImage;
    appState.zoomLevel = 1;
    appState.activeFilters.clear();
    
    previewImage.src = appState.originalImage.src;
    resetFilterCards();
    resetZoom();
    
    setStatus('Image réinitialisée');
}

function toggleCompare() {
    const previewImage = document.getElementById('preview-image');
    const compareBtn = document.getElementById('compare-btn');
    
    appState.isComparing = !appState.isComparing;
    
    if (appState.isComparing) {
        previewImage.style.opacity = '0.5';
        compareBtn.classList.add('active');
        setStatus('Mode comparaison activé');
    } else {
        previewImage.style.opacity = '1';
        compareBtn.classList.remove('active');
        setStatus('Mode comparaison désactivé');
    }
}

function saveImage() {
    if (!appState.currentImage) return;
    
    const previewImage = document.getElementById('preview-image');
    const link = document.createElement('a');
    link.download = 'image-modifiee.png';
    link.href = previewImage.src;
    link.click();
    
    setStatus('Image sauvegardée');
}

function resetFilterCards() {
    document.querySelectorAll('.filter-card').forEach(card => {
        card.classList.remove('active');
    });
    appState.activeFilters.clear();
}

function setStatus(message, type = 'info') {
    const statusText = document.getElementById('status-text');
    const statusDot = document.querySelector('.status-dot');
    
    statusText.textContent = message;
    
    if (type === 'processing') {
        statusDot.classList.add('processing');
    } else {
        statusDot.classList.remove('processing');
    }
}

function updateHistogram() {
    const canvas = document.getElementById('histogram-canvas');
    const container = document.getElementById('histogram-container');
    const ctx = canvas.getContext('2d');
    
    // Ajuster la taille du canvas
    canvas.width = 200;
    canvas.height = 200;
    
    // Effacer le canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Dessiner un fond
    ctx.fillStyle = 'rgba(15, 14, 35, 0.8)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Dessiner une grille
    ctx.strokeStyle = 'rgba(168, 192, 255, 0.1)';
    ctx.lineWidth = 1;

    // Lignes verticales
    for (let x = 0; x <= canvas.width; x += canvas.width / 4) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }
    
    // Lignes horizontales
    for (let y = 0; y <= canvas.height; y += canvas.height / 4) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }
    
    // Générer des données d'histogramme simulées
    const data = [];
    for (let i = 0; i < 256; i++) {
        // Simulation d'une distribution normale pour un histogramme réaliste
        const x = (i - 128) / 50;
        const value = Math.exp(-x * x / 2) * canvas.height * 0.8;
        data.push(value);
    }
    
    // Dessiner l'histogramme
    const barWidth = canvas.width / 256;
    ctx.fillStyle = getChannelColor(appState.currentChannel);
    
    for (let i = 0; i < 256; i++) {
        const barHeight = data[i];
        ctx.fillRect(i * barWidth, canvas.height - barHeight, barWidth, barHeight);
    }
    
    // Ajouter des étiquettes
    ctx.fillStyle = 'rgba(224, 224, 224, 0.7)';
    ctx.font = '10px Inter';
    ctx.textAlign = 'center';
    ctx.fillText('0', 10, canvas.height - 5);
    ctx.fillText('255', canvas.width - 10, canvas.height - 5);
    
    // Titre de l'histogramme
    ctx.fillStyle = 'rgba(224, 224, 224, 0.9)';
    ctx.font = '12px Inter';
    ctx.textAlign = 'center';
    ctx.fillText(`Histogramme ${appState.currentChannel.toUpperCase()}`, canvas.width / 2, 15);
}

function getChannelColor(channel) {
    switch(channel) {
        case 'red': return '#ff6b6b';
        case 'green': return '#51cf66';
        case 'blue': return '#339af0';
        case 'equalize': return '#a8c0ff';
        default: return '#a8c0ff';
    }
}

function setupDragAndDrop() {
    const dropZone = document.querySelector('.image-preview-container');
    
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
        dropZone.style.boxShadow = '0 0 20px rgba(168, 192, 255, 0.4)';
    }
    
    function unhighlight() {
        dropZone.style.borderColor = 'var(--border)';
        dropZone.style.boxShadow = 'var(--shadow)';
    }
    
    dropZone.addEventListener('drop', handleDrop, false);
    
    function handleDrop(e) {
        const dt = e.dataTransfer;
        const files = dt.files;
        
        if (files.length) {
            handleFiles(files);
        }
    }
    
    function handleFiles(files) {
        const file = files[0];
        if (file.type.startsWith('image/')) {
            loadImage(file);
        } else {
            setStatus('Veuillez sélectionner un fichier image valide.', 'error');
        }
    }
}