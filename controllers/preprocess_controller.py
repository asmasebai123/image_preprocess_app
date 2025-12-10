import cv2
import numpy as np
from models.image_model import *

def process_image(operation, image, params=None, original_image=None):
    """
    Process image based on operation type
    """
    if params is None:
        params = {}
    
    try:
        print(f"Traitement: {operation} avec params: {params}")
        
        # Pour les réglages, utiliser l'image originale si fournie
        working_image = original_image if original_image is not None else image
        
        if operation == 'grayscale':
            gray = convert_to_grayscale(working_image)
            return cv2.cvtColor(gray, cv2.COLOR_GRAY2BGR)
        
        elif operation == 'resize':
            width = params.get('width', working_image.shape[1])
            height = params.get('height', working_image.shape[0])
            # Protection contre les valeurs nulles ou négatives
            width = max(10, int(width))
            height = max(10, int(height))
            return resize_image(working_image, width, height)
        
        elif operation == 'blur':
            method = params.get('method', 'gaussian')
            kernel_size = params.get('kernel_size', 5)
            # S'assurer que kernel_size est impair
            if kernel_size % 2 == 0:
                kernel_size += 1
            kernel_size = max(3, min(kernel_size, 31))  # Limite
            return apply_blur(working_image, method, kernel_size)
        
        elif operation == 'brightness':
            value = params.get('value', 0)
            value = max(-100, min(100, value))  # Limite
            return adjust_brightness(working_image, value)
        
        elif operation == 'contrast':
            value = params.get('value', 0)
            value = max(-100, min(100, value))  # Limite
            return adjust_contrast(working_image, value)
        
        elif operation == 'rotate':
            angle = params.get('angle', 0)
            return rotate_image(working_image, angle)
        
        elif operation == 'flip':
            mode = params.get('mode', 'horizontal')
            return flip_image(working_image, mode)
        
        elif operation == 'crop':
            x1 = params.get('x', 0)
            y1 = params.get('y', 0)
            width = params.get('width', working_image.shape[1] // 2)
            height = params.get('height', working_image.shape[0] // 2)
            x2 = min(x1 + width, working_image.shape[1])
            y2 = min(y1 + height, working_image.shape[0])
            return crop_image(working_image, x1, y1, x2, y2)
        
        # Dans preprocess_controller.py, dans la section threshold:
        elif operation == 'threshold':
            threshold_type = params.get('type', 'binary')
            value = params.get('value', 127)
            value = max(0, min(255, value))  # Limite
    
    # First convert to grayscale
            gray = convert_to_grayscale(working_image)
    
            if threshold_type == 'binary':
                result = binary_threshold(gray, value)
            elif threshold_type == 'adaptive':
                result = adaptive_threshold(gray)
            elif threshold_type == 'mean':
                result = mean_based_threshold(gray)
            elif threshold_type == 'otsu':
                result = otsu_threshold(gray)
            else:
                result = binary_threshold(gray, value)
    
    # Convertir en BGR pour l'affichage
            return cv2.cvtColor(result, cv2.COLOR_GRAY2BGR)
        elif operation == 'channel_split':
            channel = params.get('channel', 'red')
            b, g, r = split_rgb_channels(working_image)
            
            if channel == 'red':
                return cv2.merge([np.zeros_like(b), np.zeros_like(g), r])
            elif channel == 'green':
                return cv2.merge([np.zeros_like(b), g, np.zeros_like(r)])
            elif channel == 'blue':
                return cv2.merge([b, np.zeros_like(g), np.zeros_like(r)])
            else:
                return working_image
        
        elif operation == 'equalize':
            gray = convert_to_grayscale(working_image)
            equalized = equalize_histogram(gray)
            return cv2.cvtColor(equalized, cv2.COLOR_GRAY2BGR)
        
        elif operation == 'edge_detection':
            detector = params.get('detector', 'canny')
            low = params.get('low', 50)
            high = params.get('high', 150)
            
            gray = convert_to_grayscale(working_image)
            
            if detector == 'canny':
                edges = cv2.Canny(gray, low, high)
                # Convertir en 3 canaux pour l'affichage
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
                # Image en niveaux de gris
                return cv2.equalizeHist(working_image)
            else:
                # Image couleur
                ycrcb = cv2.cvtColor(working_image, cv2.COLOR_BGR2YCrCb)
                ycrcb[:,:,0] = cv2.equalizeHist(ycrcb[:,:,0])
                return cv2.cvtColor(ycrcb, cv2.COLOR_YCrCb2BGR)
        
        else:
            print(f"Opération non reconnue: {operation}")
            return working_image
    
    except Exception as e:
        print(f"Erreur dans process_image: {str(e)}")
        import traceback
        traceback.print_exc()
        return working_image if working_image is not None else image