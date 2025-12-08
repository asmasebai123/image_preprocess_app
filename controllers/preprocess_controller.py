import cv2
import numpy as np
from models.image_model import *

def process_image(operation, image, params=None):
    """
    Process image based on operation type
    """
    if params is None:
        params = {}
    
    try:
        print(f"Traitement: {operation} avec params: {params}")
        
        if operation == 'grayscale':
            gray = convert_to_grayscale(image)
            return cv2.cvtColor(gray, cv2.COLOR_GRAY2BGR)
        
        elif operation == 'resize':
            width = params.get('width', image.shape[1])
            height = params.get('height', image.shape[0])
            # Protection contre les valeurs nulles ou négatives
            width = max(10, int(width))
            height = max(10, int(height))
            return resize_image(image, width, height)
        
        elif operation == 'blur':
            method = params.get('method', 'gaussian')
            kernel_size = params.get('kernel_size', 5)
            # S'assurer que kernel_size est impair
            if kernel_size % 2 == 0:
                kernel_size += 1
            kernel_size = max(3, min(kernel_size, 31))  # Limite
            return apply_blur(image, method, kernel_size)
        
        elif operation == 'brightness':
            value = params.get('value', 0)
            value = max(-100, min(100, value))  # Limite
            return adjust_brightness(image, value)
        
        elif operation == 'contrast':
            value = params.get('value', 0)
            value = max(-100, min(100, value))  # Limite
            return adjust_contrast(image, value)
        
        elif operation == 'rotate':
            angle = params.get('angle', 0)
            return rotate_image(image, angle)
        
        elif operation == 'flip':
            mode = params.get('mode', 'horizontal')
            return flip_image(image, mode)
        
        elif operation == 'crop':
            x1 = params.get('x', 0)
            y1 = params.get('y', 0)
            width = params.get('width', image.shape[1] // 2)
            height = params.get('height', image.shape[0] // 2)
            x2 = min(x1 + width, image.shape[1])
            y2 = min(y1 + height, image.shape[0])
            return crop_image(image, x1, y1, x2, y2)
        
        elif operation == 'threshold':
            threshold_type = params.get('type', 'binary')
            value = params.get('value', 127)
            value = max(0, min(255, value))  # Limite
            
            # First convert to grayscale
            gray = convert_to_grayscale(image)
            
            if threshold_type == 'binary':
                result = binary_threshold(gray, value)
            elif threshold_type == 'adaptive':
                result = adaptive_threshold(gray)
            elif threshold_type == 'mean':
                result = mean_based_threshold(gray)
            else:
                result = binary_threshold(gray, value)
            
            # Convertir en BGR pour l'affichage
            return cv2.cvtColor(result, cv2.COLOR_GRAY2BGR)
        
        elif operation == 'channel_split':
            channel = params.get('channel', 'red')
            b, g, r = split_rgb_channels(image)
            
            if channel == 'red':
                return cv2.merge([np.zeros_like(b), np.zeros_like(g), r])
            elif channel == 'green':
                return cv2.merge([np.zeros_like(b), g, np.zeros_like(r)])
            elif channel == 'blue':
                return cv2.merge([b, np.zeros_like(g), np.zeros_like(r)])
            else:
                return image
        
        elif operation == 'equalize':
            gray = convert_to_grayscale(image)
            equalized = equalize_histogram(gray)
            return cv2.cvtColor(equalized, cv2.COLOR_GRAY2BGR)
        
        elif operation == 'edge_detection':
            detector = params.get('detector', 'canny')
            low = params.get('low', 50)
            high = params.get('high', 150)
            
            gray = convert_to_grayscale(image)
            
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
        
        else:
            print(f"Opération non reconnue: {operation}")
            return image
    
    except Exception as e:
        print(f"Erreur dans process_image: {str(e)}")
        import traceback
        traceback.print_exc()
        return image