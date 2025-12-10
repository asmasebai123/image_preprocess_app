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
import hashlib
from datetime import datetime

# Ajout du chemin pour les imports
current_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.append(current_dir)

app = Flask(__name__)
CORS(app)  # Active CORS
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024
app.config['SECRET_KEY'] = 'image-lab-pro-secret-key-2024'
app.config['UPLOAD_FOLDER'] = 'temp_uploads'

# Créer le dossier temporaire s'il n'existe pas
if not os.path.exists(app.config['UPLOAD_FOLDER']):
    os.makedirs(app.config['UPLOAD_FOLDER'])

# Dictionnaires pour stocker les images par session
image_cache = {}
original_images = {}
session_data = {}

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
    
    def process_image(operation, image, params=None, original_image=None):
        print(f"Mode démo: {operation}")
        if params is None:
            params = {}
        
        # Utiliser l'originale si disponible
        working_image = original_image if original_image is not None else image
        
        if operation == 'grayscale':
            gray = cv2.cvtColor(working_image, cv2.COLOR_BGR2GRAY)
            return cv2.cvtColor(gray, cv2.COLOR_GRAY2BGR)
        elif operation == 'blur':
            return cv2.GaussianBlur(working_image, (5, 5), 0)
        elif operation == 'brightness':
            value = params.get('value', 0)
            value = max(-100, min(100, value))
            
            if value > 0:
                shadow = value
                highlight = 255
            else:
                shadow = 0
                highlight = 255 + value

            alpha = (highlight - shadow) / 255
            gamma = shadow
            return cv2.addWeighted(working_image, alpha, working_image, 0, gamma)
        elif operation == 'contrast':
            value = params.get('value', 0)
            f = 131 * (value + 127) / (127 * (131 - value))
            alpha = f
            gamma = 127 * (1 - f)
            return cv2.addWeighted(working_image, alpha, working_image, 0, gamma)
        elif operation == 'rotate':
            angle = params.get('angle', 0)
            (h, w) = working_image.shape[:2]
            center = (w // 2, h // 2)
            M = cv2.getRotationMatrix2D(center, angle, 1.0)
            return cv2.warpAffine(working_image, M, (w, h))
        elif operation == 'flip':
            mode = params.get('mode', 'horizontal')
            if mode == 'horizontal':
                return cv2.flip(working_image, 1)
            else:
                return cv2.flip(working_image, 0)
        elif operation == 'threshold':
            gray = cv2.cvtColor(working_image, cv2.COLOR_BGR2GRAY)
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
            b, g, r = cv2.split(working_image)
            
            if channel == 'red':
                return cv2.merge([np.zeros_like(b), np.zeros_like(g), r])
            elif channel == 'green':
                return cv2.merge([np.zeros_like(b), g, np.zeros_like(r)])
            elif channel == 'blue':
                return cv2.merge([b, np.zeros_like(g), np.zeros_like(r)])
            else:
                return working_image
        elif operation == 'edge_detection':
            detector = params.get('detector', 'canny')
            low = params.get('low', 50)
            high = params.get('high', 150)
            
            gray = cv2.cvtColor(working_image, cv2.COLOR_BGR2GRAY)
            
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
        elif operation == 'histogram_equalization':
            # Égalisation d'histogramme sur l'image en couleur
            if len(working_image.shape) == 2:
                return cv2.equalizeHist(working_image)
            else:
                ycrcb = cv2.cvtColor(working_image, cv2.COLOR_BGR2YCrCb)
                ycrcb[:,:,0] = cv2.equalizeHist(ycrcb[:,:,0])
                return cv2.cvtColor(ycrcb, cv2.COLOR_YCrCb2BGR)
        
        return working_image

def cleanup_old_files():
    """Nettoyer les fichiers temporaires anciens"""
    try:
        for filename in os.listdir(app.config['UPLOAD_FOLDER']):
            filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
            # Supprimer les fichiers de plus d'1 heure
            if os.path.isfile(filepath) and (time.time() - os.path.getmtime(filepath)) > 3600:
                os.remove(filepath)
                print(f"✓ Fichier temporaire nettoyé: {filename}")
    except Exception as e:
        print(f"✗ Erreur nettoyage: {e}")

@app.before_request
def before_request():
    """Nettoyage avant chaque requête"""
    cleanup_old_files()

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/health', methods=['GET'])
def health():
    return jsonify({
        'status': 'ok', 
        'modules': HAS_MODULES, 
        'timestamp': datetime.now().isoformat(),
        'version': '1.0.0'
    })

@app.route('/api/upload', methods=['POST'])
def upload_image():
    try:
        print(f"{'='*50}")
        print(f"📤 Upload d'image - {datetime.now().strftime('%H:%M:%S')}")
        
        if 'image' not in request.files:
            return jsonify({'error': 'Aucune image uploadée'}), 400
        
        file = request.files['image']
        if file.filename == '':
            return jsonify({'error': 'Aucun fichier sélectionné'}), 400
        
        print(f"📄 Fichier: {file.filename}, Taille: {len(file.read())} bytes")
        file.seek(0)  # Retour au début du fichier
        
        # Lire l'image
        file_bytes = file.read()
        img_array = np.frombuffer(file_bytes, np.uint8)
        image = cv2.imdecode(img_array, cv2.IMREAD_COLOR)
        
        if image is None:
            return jsonify({'error': 'Format d\'image invalide'}), 400
        
        print(f"📐 Dimensions originales: {image.shape[1]}x{image.shape[0]}")
        
        # Redimensionner si trop grand (pour performance)
        max_width, max_height = 1920, 1080
        height, width = image.shape[:2]
        
        if width > max_width or height > max_height:
            print(f"🔄 Redimensionnement de {width}x{height}")
            scale = min(max_width/width, max_height/height)
            new_width = int(width * scale)
            new_height = int(height * scale)
            
            image = cv2.resize(image, (new_width, new_height), interpolation=cv2.INTER_AREA)
            print(f"📏 Nouvelles dimensions: {new_width}x{new_height}")
        
        # Générer un ID unique pour cette session
        session_id = request.remote_addr + "_" + str(int(time.time()))
        
        # Encoder en base64 pour la réponse
        _, buffer = cv2.imencode('.png', image)
        img_base64 = base64.b64encode(buffer).decode('utf-8')
        
        # Stocker l'image originale
        original_images[session_id] = image.copy()
        session_data[session_id] = {
            'original_dimensions': (width, height),
            'upload_time': time.time(),
            'filename': file.filename
        }
        
        print(f"✅ Upload réussi - Session: {session_id[:10]}...")
        print(f"{'='*50}")
        
        return jsonify({
            'success': True,
            'image': f'data:image/png;base64,{img_base64}',
            'dimensions': f'{image.shape[1]} × {image.shape[0]}',
            'size': len(file_bytes),
            'session_id': session_id,
            'color_mode': 'Couleur' if len(image.shape) == 3 else 'Niveaux de gris'
        })
        
    except Exception as e:
        print(f"❌ Erreur upload: {str(e)}")
        traceback.print_exc()
        return jsonify({'error': f'Erreur serveur: {str(e)}'}), 500

@app.route('/api/process', methods=['POST'])
def process():
    try:
        data = request.json
        operation = data.get('operation')
        params = data.get('params', {})
        image_data = data.get('image')
        session_id = data.get('session_id')
        
        print(f"{'='*50}")
        print(f"🔄 Traitement: {operation} - {datetime.now().strftime('%H:%M:%S')}")
        print(f"📋 Paramètres: {params}")
        
        if not image_data:
            return jsonify({'error': 'Aucune donnée image'}), 400
            
        if not operation:
            return jsonify({'error': 'Aucune opération spécifiée'}), 400
            
        # Extraire les données base64
        if ',' in image_data:
            image_data = image_data.split(',')[1]
        
        # Décoder l'image
        img_array = np.frombuffer(base64.b64decode(image_data), np.uint8)
        current_image = cv2.imdecode(img_array, cv2.IMREAD_COLOR)
        
        if current_image is None:
            return jsonify({'error': 'Échec du décodage de l\'image'}), 400
        
        # Récupérer l'image originale si disponible
        original_image = None
        if session_id and session_id in original_images:
            original_image = original_images[session_id].copy()
            print(f"📁 Image originale récupérée pour session: {session_id[:10]}...")
        
        # Traiter l'image
        result = process_image(operation, current_image, params, original_image)
        
        if result is None:
            print("⚠️ Résultat vide, utilisation de l'image actuelle")
            result = current_image
        
        # Assurer que l'image a le bon format pour l'affichage
        if len(result.shape) == 2:  # Niveaux de gris
            result = cv2.cvtColor(result, cv2.COLOR_GRAY2BGR)
        elif len(result.shape) == 3 and result.shape[2] == 4:  # RGBA
            result = result[:, :, :3]
        
        print(f"✅ Traitement réussi - Nouvelle taille: {result.shape[1]}x{result.shape[0]}")
        
        # Encoder le résultat
        _, buffer = cv2.imencode('.png', result)
        img_base64 = base64.b64encode(buffer).decode('utf-8')
        
        return jsonify({
            'success': True,
            'image': f'data:image/png;base64,{img_base64}',
            'operation': operation,
            'dimensions': f'{result.shape[1]} × {result.shape[0]}'
        })
        
    except Exception as e:
        print(f"❌ Erreur traitement {operation}: {str(e)}")
        traceback.print_exc()
        return jsonify({'error': f'Erreur traitement: {str(e)}'}), 500

@app.route('/api/histogram', methods=['POST'])
def get_histogram():
    try:
        data = request.json
        image_data = data.get('image')
        channel = data.get('channel', 'rgb')
        
        if not image_data:
            return jsonify({'error': 'Aucune donnée image'}), 400
            
        if ',' in image_data:
            image_data = image_data.split(',')[1]
        
        # Décoder l'image
        img_array = np.frombuffer(base64.b64decode(image_data), np.uint8)
        image = cv2.imdecode(img_array, cv2.IMREAD_COLOR)
        
        if image is None:
            return jsonify({'error': 'Échec du décodage de l\'image'}), 400
        
        # Calculer l'histogramme selon le canal demandé
        hist_data = {}
        
        if channel == 'rgb' and len(image.shape) == 3:
            # Histogramme pour chaque canal couleur
            colors = ('blue', 'green', 'red')
            for i, col in enumerate(colors):
                hist = cv2.calcHist([image], [i], None, [256], [0, 256])
                hist_data[col] = hist.flatten().tolist()
        elif channel == 'gray':
            # Convertir en niveaux de gris
            gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
            hist = cv2.calcHist([gray], [0], None, [256], [0, 256])
            hist_data['gray'] = hist.flatten().tolist()
        elif channel in ['red', 'green', 'blue'] and len(image.shape) == 3:
            # Canal spécifique
            channel_map = {'red': 2, 'green': 1, 'blue': 0}
            idx = channel_map[channel]
            hist = cv2.calcHist([image], [idx], None, [256], [0, 256])
            hist_data[channel] = hist.flatten().tolist()
        
        # Calculer les statistiques
        stats = {
            'min': {},
            'max': {},
            'mean': {},
            'std': {}
        }
        
        for channel_name, hist in hist_data.items():
            if hist:
                hist_array = np.array(hist)
                stats['min'][channel_name] = float(np.min(hist_array))
                stats['max'][channel_name] = float(np.max(hist_array))
                stats['mean'][channel_name] = float(np.mean(hist_array))
                stats['std'][channel_name] = float(np.std(hist_array))
        
        return jsonify({
            'success': True,
            'histogram': hist_data,
            'channel': channel,
            'stats': stats
        })
        
    except Exception as e:
        print(f"❌ Erreur histogramme: {str(e)}")
        traceback.print_exc()
        return jsonify({'error': f'Erreur histogramme: {str(e)}'}), 500

@app.route('/api/download', methods=['POST'])
def download():
    try:
        data = request.json
        image_data = data.get('image')
        if not image_data:
            return jsonify({'error': 'Aucune donnée image'}), 400
            
        format = data.get('format', 'png').lower()
        quality = data.get('quality', 95)
        
        if ',' in image_data:
            image_data = image_data.split(',')[1]
            
        img_array = np.frombuffer(base64.b64decode(image_data), np.uint8)
        image = cv2.imdecode(img_array, cv2.IMREAD_COLOR)
        
        if image is None:
            return jsonify({'error': 'Échec du décodage de l\'image'}), 400
        
        # Préparer les paramètres d'encodage
        encode_params = []
        filename = 'image_traitee'
        
        if format in ['jpg', 'jpeg']:
            ext = '.jpg'
            filename += '.jpg'
            encode_params = [cv2.IMWRITE_JPEG_QUALITY, max(1, min(100, quality))]
            mimetype = 'image/jpeg'
        elif format == 'tiff':
            ext = '.tiff'
            filename += '.tiff'
            mimetype = 'image/tiff'
        elif format == 'webp':
            ext = '.webp'
            filename += '.webp'
            encode_params = [cv2.IMWRITE_WEBP_QUALITY, max(1, min(100, quality))]
            mimetype = 'image/webp'
        else:  # PNG par défaut
            ext = '.png'
            filename += '.png'
            mimetype = 'image/png'
        
        # Encoder l'image
        success, buffer = cv2.imencode(ext, image, encode_params)
        
        if not success:
            return jsonify({'error': 'Échec de l\'encodage de l\'image'}), 500
        
        # Créer un fichier temporaire
        with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as tmp_file:
            tmp_file.write(buffer.tobytes())
            tmp_path = tmp_file.name
        
        try:
            return send_file(
                tmp_path,
                mimetype=mimetype,
                as_attachment=True,
                download_name=filename
            )
        finally:
            # Nettoyer le fichier temporaire après l'envoi
            if os.path.exists(tmp_path):
                try:
                    os.unlink(tmp_path)
                except:
                    pass
        
    except Exception as e:
        print(f"❌ Erreur téléchargement: {str(e)}")
        traceback.print_exc()
        return jsonify({'error': f'Erreur téléchargement: {str(e)}'}), 500

@app.route('/api/reset', methods=['POST'])
def reset_to_original():
    try:
        data = request.json
        session_id = data.get('session_id')
        
        if not session_id or session_id not in original_images:
            return jsonify({'error': 'Session invalide ou image originale non trouvée'}), 400
        
        # Récupérer l'image originale
        original_image = original_images[session_id]
        
        # Encoder en base64
        _, buffer = cv2.imencode('.png', original_image)
        img_base64 = base64.b64encode(buffer).decode('utf-8')
        
        return jsonify({
            'success': True,
            'image': f'data:image/png;base64,{img_base64}',
            'dimensions': f'{original_image.shape[1]} × {original_image.shape[0]}'
        })
        
    except Exception as e:
        print(f"❌ Erreur réinitialisation: {str(e)}")
        return jsonify({'error': f'Erreur réinitialisation: {str(e)}'}), 500

@app.route('/api/crop', methods=['POST'])
def crop_image():
    try:
        data = request.json
        image_data = data.get('image')
        x = data.get('x', 0)
        y = data.get('y', 0)
        width = data.get('width')
        height = data.get('height')
        
        if not image_data:
            return jsonify({'error': 'Aucune donnée image'}), 400
            
        if ',' in image_data:
            image_data = image_data.split(',')[1]
            
        img_array = np.frombuffer(base64.b64decode(image_data), np.uint8)
        image = cv2.imdecode(img_array, cv2.IMREAD_COLOR)
        
        if image is None:
            return jsonify({'error': 'Échec du décodage de l\'image'}), 400
        
        # Vérifier et ajuster les paramètres de recadrage
        h, w = image.shape[:2]
        x = max(0, min(x, w-1))
        y = max(0, min(y, h-1))
        width = min(width, w - x)
        height = min(height, h - y)
        
        # Recadrer
        cropped = image[y:y+height, x:x+width]
        
        # Encoder
        _, buffer = cv2.imencode('.png', cropped)
        img_base64 = base64.b64encode(buffer).decode('utf-8')
        
        return jsonify({
            'success': True,
            'image': f'data:image/png;base64,{img_base64}',
            'dimensions': f'{cropped.shape[1]} × {cropped.shape[0]}'
        })
        
    except Exception as e:
        print(f"❌ Erreur recadrage: {str(e)}")
        return jsonify({'error': f'Erreur recadrage: {str(e)}'}), 500

@app.route('/api/cleanup', methods=['POST'])
def cleanup_sessions():
    """Nettoyer les sessions anciennes"""
    try:
        current_time = time.time()
        sessions_to_remove = []
        
        for session_id, session_info in session_data.items():
            if current_time - session_info['upload_time'] > 3600:  # 1 heure
                sessions_to_remove.append(session_id)
        
        for session_id in sessions_to_remove:
            if session_id in original_images:
                del original_images[session_id]
            if session_id in session_data:
                del session_data[session_id]
        
        return jsonify({
            'success': True,
            'cleaned': len(sessions_to_remove),
            'remaining': len(session_data)
        })
        
    except Exception as e:
        print(f"❌ Erreur nettoyage sessions: {str(e)}")
        return jsonify({'error': f'Erreur nettoyage: {str(e)}'}), 500

@app.errorhandler(404)
def not_found(error):
    return jsonify({'error': 'Route non trouvée'}), 404

@app.errorhandler(500)
def internal_error(error):
    return jsonify({'error': 'Erreur interne du serveur'}), 500

if __name__ == '__main__':
    print("=" * 60)
    print("🚀 ImageLab Pro - Démarrage du serveur")
    print("=" * 60)
    print(f"📁 Répertoire: {current_dir}")
    print(f"🔧 Modules: {'✓ Chargés' if HAS_MODULES else '⚠ Mode démo'}")
    print(f"💾 Dossier temporaire: {app.config['UPLOAD_FOLDER']}")
    print(f"🌐 URL: http://localhost:5000")
    print(f"📅 Heure: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 60)
    
    # Nettoyer au démarrage
    cleanup_old_files()
    
    app.run(
        debug=True, 
        port=5000, 
        threaded=True,
        host='0.0.0.0'
    )
@app.route('/api/histogram', methods=['POST'])
def get_histogram():
    try:
        data = request.json
        image_data = data.get('image')
        channel = data.get('channel', 'rgb')
        
        if not image_data:
            return jsonify({'error': 'Aucune donnée image'}), 400
            
        if ',' in image_data:
            image_data = image_data.split(',')[1]
        
        # Décoder l'image
        img_array = np.frombuffer(base64.b64decode(image_data), np.uint8)
        image = cv2.imdecode(img_array, cv2.IMREAD_COLOR)
        
        if image is None:
            return jsonify({'error': 'Échec du décodage de l\'image'}), 400
        
        # Calculer l'histogramme selon le canal demandé
        hist_data = {}
        
        if channel == 'rgb' and len(image.shape) == 3:
            # Histogramme pour chaque canal couleur
            colors = ('blue', 'green', 'red')
            for i, col in enumerate(colors):
                hist = cv2.calcHist([image], [i], None, [256], [0, 256])
                hist_data[col] = hist.flatten().tolist()
                
                # Calculer des statistiques plus détaillées
                hist_array = np.array(hist)
                non_zero = hist_array[hist_array > 0]
                
        elif channel == 'gray':
            # Convertir en niveaux de gris
            gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
            hist = cv2.calcHist([gray], [0], None, [256], [0, 256])
            hist_data['gray'] = hist.flatten().tolist()
            
        elif channel in ['red', 'green', 'blue'] and len(image.shape) == 3:
            # Canal spécifique
            channel_map = {'red': 2, 'green': 1, 'blue': 0}
            idx = channel_map[channel]
            hist = cv2.calcHist([image], [idx], None, [256], [0, 256])
            hist_data[channel] = hist.flatten().tolist()
        
        # Calculer des statistiques détaillées
        stats = {
            'min': {},
            'max': {},
            'mean': {},
            'std': {},
            'median': {},
            'mode': {},
            'total_pixels': image.shape[0] * image.shape[1]
        }
        
        for channel_name, hist in hist_data.items():
            if hist:
                hist_array = np.array(hist)
                
                # Valeurs de base
                stats['min'][channel_name] = float(np.min(hist_array))
                stats['max'][channel_name] = float(np.max(hist_array))
                stats['mean'][channel_name] = float(np.mean(hist_array))
                stats['std'][channel_name] = float(np.std(hist_array))
                
                # Médiane
                cumulative_sum = np.cumsum(hist_array)
                median_index = np.where(cumulative_sum >= cumulative_sum[-1] / 2)[0][0]
                stats['median'][channel_name] = float(median_index)
                
                # Mode (valeur la plus fréquente)
                mode_index = np.argmax(hist_array)
                stats['mode'][channel_name] = float(mode_index)
        
        return jsonify({
            'success': True,
            'histogram': hist_data,
            'channel': channel,
            'stats': stats,
            'image_info': {
                'width': image.shape[1],
                'height': image.shape[0],
                'channels': image.shape[2] if len(image.shape) == 3 else 1,
                'total_pixels': image.shape[0] * image.shape[1]
            }
        })
        
    except Exception as e:
        print(f"❌ Erreur histogramme: {str(e)}")
        traceback.print_exc()
        return jsonify({'error': f'Erreur histogramme: {str(e)}'}), 500
    