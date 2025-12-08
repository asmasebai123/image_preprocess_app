from flask import Flask, render_template, request, jsonify, send_file
from flask_cors import CORS
import cv2
import numpy as np
import io
import base64
import json
import os
import traceback
import sys
import time
import tempfile

# Ajout du chemin pour les imports
current_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.append(current_dir)

app = Flask(__name__)
CORS(app)  # Active CORS
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024
app.config['SECRET_KEY'] = 'your-secret-key-here'

# Imports conditionnels
try:
    from models.image_model import *
    from controllers.preprocess_controller import process_image
    HAS_MODULES = True
    print("✓ Modules image chargés avec succès")
except ImportError as e:
    print(f"✗ Erreur import modules: {e}")
    HAS_MODULES = False
    
    # Mode démo
    def convert_to_grayscale(image):
        return cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    
    def process_image(operation, image, params=None):
        print(f"Mode démo: {operation}")
        if params is None:
            params = {}
        
        if operation == 'grayscale':
            gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
            return cv2.cvtColor(gray, cv2.COLOR_GRAY2BGR)
        elif operation == 'blur':
            return cv2.GaussianBlur(image, (5, 5), 0)
        elif operation == 'brightness':
            hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)
            hsv[:,:,2] = cv2.add(hsv[:,:,2], params.get('value', 0))
            return cv2.cvtColor(hsv, cv2.COLOR_HSV2BGR)
        elif operation == 'contrast':
            alpha = 1 + params.get('value', 0) / 100
            return cv2.convertScaleAbs(image, alpha=alpha, beta=0)
        elif operation == 'rotate':
            angle = params.get('angle', 0)
            (h, w) = image.shape[:2]
            center = (w // 2, h // 2)
            M = cv2.getRotationMatrix2D(center, angle, 1.0)
            return cv2.warpAffine(image, M, (w, h))
        elif operation == 'flip':
            mode = params.get('mode', 'horizontal')
            if mode == 'horizontal':
                return cv2.flip(image, 1)
            else:
                return cv2.flip(image, 0)
        elif operation == 'threshold':
            gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
            thresh_type = params.get('type', 'binary')
            value = params.get('value', 127)
            
            if thresh_type == 'otsu':
                _, result = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
            elif thresh_type == 'adaptive':
                result = cv2.adaptiveThreshold(gray, 255, cv2.ADAPTIVE_THRESH_MEAN_C, cv2.THRESH_BINARY, 11, 2)
            else:
                _, result = cv2.threshold(gray, value, 255, cv2.THRESH_BINARY)
            
            return cv2.cvtColor(result, cv2.COLOR_GRAY2BGR)
        elif operation == 'channel_split':
            channel = params.get('channel', 'red')
            b, g, r = cv2.split(image)
            
            if channel == 'red':
                return cv2.merge([np.zeros_like(b), np.zeros_like(g), r])
            elif channel == 'green':
                return cv2.merge([np.zeros_like(b), g, np.zeros_like(r)])
            elif channel == 'blue':
                return cv2.merge([b, np.zeros_like(g), np.zeros_like(r)])
            else:
                return image
        elif operation == 'edge_detection':
            detector = params.get('detector', 'canny')
            low = params.get('low', 50)
            high = params.get('high', 150)
            
            gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
            
            if detector == 'canny':
                edges = cv2.Canny(gray, low, high)
                return cv2.cvtColor(edges, cv2.COLOR_GRAY2BGR)
            elif detector == 'sobel':
                sobelx = cv2.Sobel(gray, cv2.CV_64F, 1, 0, ksize=3)
                sobely = cv2.Sobel(gray, cv2.CV_64F, 0, 1, ksize=3)
                magnitude = cv2.magnitude(sobelx, sobely)
                magnitude = cv2.normalize(magnitude, None, 0, 255, cv2.NORM_MINMAX, cv2.CV_8U)
                return cv2.cvtColor(magnitude, cv2.COLOR_GRAY2BGR)
            elif detector == 'laplacian':
                laplacian = cv2.Laplacian(gray, cv2.CV_64F)
                laplacian = cv2.normalize(laplacian, None, 0, 255, cv2.NORM_MINMAX, cv2.CV_8U)
                return cv2.cvtColor(laplacian, cv2.COLOR_GRAY2BGR)
            else:
                edges = cv2.Canny(gray, low, high)
                return cv2.cvtColor(edges, cv2.COLOR_GRAY2BGR)
        
        return image

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/health', methods=['GET'])
def health():
    return jsonify({'status': 'ok', 'modules': HAS_MODULES, 'timestamp': time.time()})

@app.route('/api/upload', methods=['POST'])
def upload_image():
    try:
        print("=== Upload d'image ===")
        
        if 'image' not in request.files:
            return jsonify({'error': 'No image uploaded'}), 400
        
        file = request.files['image']
        print(f"Fichier: {file.filename}")
        
        # Lire l'image
        file_bytes = file.read()
        img_array = np.frombuffer(file_bytes, np.uint8)
        image = cv2.imdecode(img_array, cv2.IMREAD_COLOR)
        
        if image is None:
            return jsonify({'error': 'Invalid image format'}), 400
        
        print(f"Dimensions originales: {image.shape}")
        
        # Redimensionner si trop grand
        max_width, max_height = 1200, 1200
        height, width = image.shape[:2]
        
        if width > max_width or height > max_height:
            print(f"Redimensionnement de {width}x{height}")
            if width > height:
                new_width = max_width
                new_height = int((max_width / width) * height)
            else:
                new_height = max_height
                new_width = int((max_height / height) * width)
            
            image = cv2.resize(image, (new_width, new_height), interpolation=cv2.INTER_AREA)
            print(f"Nouvelles dimensions: {new_width}x{new_height}")
        
        # Encoder en base64
        _, buffer = cv2.imencode('.png', image)
        img_base64 = base64.b64encode(buffer).decode('utf-8')
        
        print(f"✓ Upload réussi. Taille base64: {len(img_base64)}")
        
        return jsonify({
            'success': True,
            'image': f'data:image/png;base64,{img_base64}',
            'dimensions': f'{image.shape[1]} × {image.shape[0]}',
            'size': len(file_bytes)
        })
        
    except Exception as e:
        print(f"✗ Erreur upload: {str(e)}")
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@app.route('/api/process', methods=['POST'])
def process():
    try:
        data = request.json
        operation = data.get('operation')
        params = data.get('params', {})
        image_data = data.get('image')
        
        print(f"=== Traitement: {operation} ===")
        
        if not image_data:
            return jsonify({'error': 'No image data'}), 400
            
        if ',' in image_data:
            image_data = image_data.split(',')[1]
        
        # Décoder l'image
        print(f"Décodage base64...")
        img_array = np.frombuffer(base64.b64decode(image_data), np.uint8)
        image = cv2.imdecode(img_array, cv2.IMREAD_COLOR)
        
        if image is None:
            return jsonify({'error': 'Failed to decode image'}), 400
        
        print(f"Image à traiter: {image.shape}")
        
        # Traiter l'image
        result = process_image(operation, image, params)
        
        if result is None:
            print("⚠ Résultat vide, utilisation de l'original")
            result = image
        
        # S'assurer que l'image a 3 canaux pour l'affichage
        if len(result.shape) == 2:
            result = cv2.cvtColor(result, cv2.COLOR_GRAY2BGR)
        
        # Encoder le résultat
        print(f"Encodage résultat...")
        _, buffer = cv2.imencode('.png', result)
        img_base64 = base64.b64encode(buffer).decode('utf-8')
        
        print(f"✓ Traitement {operation} terminé")
        
        return jsonify({
            'success': True,
            'image': f'data:image/png;base64,{img_base64}',
            'operation': operation
        })
        
    except Exception as e:
        print(f"✗ Erreur traitement {operation}: {str(e)}")
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@app.route('/api/download', methods=['POST'])
def download():
    try:
        data = request.json
        image_data = data.get('image')
        if not image_data:
            return jsonify({'error': 'No image data'}), 400
            
        format = data.get('format', 'png').lower()
        quality = data.get('quality', 95)
        
        if ',' in image_data:
            image_data = image_data.split(',')[1]
            
        img_array = np.frombuffer(base64.b64decode(image_data), np.uint8)
        image = cv2.imdecode(img_array, cv2.IMREAD_COLOR)
        
        if image is None:
            return jsonify({'error': 'Failed to decode image'}), 400
        
        # Préparer les paramètres d'encodage
        encode_params = []
        if format in ['jpg', 'jpeg']:
            ext = '.jpg'
            encode_params = [cv2.IMWRITE_JPEG_QUALITY, max(0, min(100, quality))]
        elif format == 'tiff':
            ext = '.tiff'
        else:  # PNG par défaut
            ext = '.png'
        
        # Encoder l'image
        success, buffer = cv2.imencode(ext, image, encode_params)
        
        if not success:
            return jsonify({'error': 'Failed to encode image'}), 500
        
        # Créer un fichier temporaire
        with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as tmp_file:
            tmp_file.write(buffer.tobytes())
            tmp_path = tmp_file.name
        
        try:
            return send_file(
                tmp_path,
                mimetype=f'image/{ext[1:]}' if ext != '.tiff' else 'image/tiff',
                as_attachment=True,
                download_name=f'image_traitee{ext}'
            )
        finally:
            # Nettoyer le fichier temporaire après l'envoi
            if os.path.exists(tmp_path):
                os.unlink(tmp_path)
        
    except Exception as e:
        print(f"Erreur download: {str(e)}")
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    print("=" * 50)
    print("🚀 ImageLab Pro - Démarrage")
    print("=" * 50)
    print(f"📁 Répertoire: {current_dir}")
    print(f"🔧 Modules: {'✓ Chargés' if HAS_MODULES else '✗ Manquants'}")
    print("🌐 URL: http://localhost:5000")
    print("=" * 50)
    app.run(debug=True, port=5000, threaded=True)