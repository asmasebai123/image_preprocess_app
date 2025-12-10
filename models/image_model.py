import cv2
import numpy as np

def convert_to_grayscale(image):
   img=cv2.cvtColor(image,cv2.COLOR_BGR2GRAY)
   return img

def resize_image(image, width, height):
    # Correction de l'ordre des paramètres pour cv2.resize
    # cv2.resize prend (image, (width, height))
    if width > 0 and height > 0:
        img_resized = cv2.resize(image, (width, height))
        return img_resized
    return image
      
def apply_blur(image,method='gaussian', kernel_size=5, **kwargs):

    if kernel_size % 2 == 0:
        kernel_size += 1
    
    blurred_image = image.copy()
    
    try:
        if method == 'gaussian':
            
            sigma_x = kwargs.get('sigma_x', 0) 
            blurred_image = cv2.GaussianBlur(image, (kernel_size, kernel_size), sigma_x)
            
        elif method == 'median':
            blurred_image = cv2.medianBlur(image, kernel_size)
            
        elif method == 'average':
            blurred_image = cv2.blur(image, (kernel_size, kernel_size))
            
        elif method == 'bilateral':
            # Bilateral Filter - Le filtre bilatéral est un outil de traitement d’image qui sert à réduire le bruit tout en conservant les contours nets,il prend en compte à la fois la proximité spatiale et la différence d’intensité des pixels pour effectuer le lissage.
            sigma_color = kwargs.get('sigma_color', 75)  # Color space sigma
            sigma_space = kwargs.get('sigma_space', 75)  # Coordinate space sigma
            blurred_image = cv2.bilateralFilter(image, kernel_size, sigma_color, sigma_space)
            
        elif method == 'motion':
            # Motion Blur - Le filtre motion (ou flou directionnel) est un filtre utilisé en traitement d’image pour simuler ou corriger le flou dû au mouvement d’un objet ou de la caméra. Il est surtout utilisé dans le contexte de la restauration d’image ou pour créer un effet artistique.
            blurred_image = apply_motion_blur(image, kernel_size)
            
        else:
            raise ValueError(f"Unknown blur method: {method}")
            
    except Exception as e:
        print(f"Error applying {method} blur: {e}")
        return image
    
    return blurred_image

def apply_motion_blur(image, kernel_size=15, angle=0):
    """Apply motion blur effect"""
    # Create motion blur kernel
    kernel = np.zeros((kernel_size, kernel_size))
    kernel[int((kernel_size-1)/2), :] = np.ones(kernel_size)
    kernel = kernel / kernel_size  # Normalize
    
    # Rotate kernel to specified angle
    M = cv2.getRotationMatrix2D((kernel_size/2, kernel_size/2), angle, 1)
    kernel = cv2.warpAffine(kernel, M, (kernel_size, kernel_size))
    
    # Apply the kernel
    return cv2.filter2D(image, -1, kernel)

def adjust_brightness(image, brightness=0):
    
    if brightness == 0:
        return image

    if brightness > 0:
        shadow = brightness
        highlight = 255
    else:
        shadow = 0
        highlight = 255 + brightness

    alpha = (highlight - shadow) / 255
    gamma = shadow

    return cv2.addWeighted(image, alpha, image, 0, gamma)

def adjust_contrast(image, contrast=0):
    
    if contrast == 0:
        return image

    f = 131 * (contrast + 127) / (127 * (131 - contrast))
    alpha = f
    gamma = 127 * (1 - f)

    return cv2.addWeighted(image, alpha, image, 0, gamma)

def crop_image(image, x1, y1, x2, y2):
    """
    Recadre une région de l'image avec OpenCV.

    :param image: Image OpenCV (numpy array)
    :param x1: Coordonnée X du coin supérieur gauche
    :param y1: Coordonnée Y du coin supérieur gauche
    :param x2: Coordonnée X du coin inférieur droit
    :param y2: Coordonnée Y du coin inférieur droit
    :return: Image recadrée
    """
    return image[y1:y2, x1:x2]

def rotate_image(image, angle):

    (h, w) = image.shape[:2]
    center = (w // 2, h // 2)

    matrix = cv2.getRotationMatrix2D(center, angle, 1.0)
    rotated = cv2.warpAffine(image, matrix, (w, h))

    return rotated

def rotate_left(image):
    """
    Fait une rotation de 90 degrés vers la gauche (anti-horaire).
    """
    (h, w) = image.shape[:2]
    center = (w // 2, h // 2)

    matrix = cv2.getRotationMatrix2D(center, 90, 1.0)
    rotated = cv2.warpAffine(image, matrix, (w, h))

    return rotated

def rotate_right(image):
    """
    Fait une rotation de 90 degrés vers la droite (horaire).
    """
    (h, w) = image.shape[:2]
    center = (w // 2, h // 2)

    matrix = cv2.getRotationMatrix2D(center, -90, 1.0)
    rotated = cv2.warpAffine(image, matrix, (w, h))

    return rotated



def flip_image(image, mode):
   
    if mode == "horizontal":
        return cv2.flip(image, 1)

    elif mode == "vertical":
        return cv2.flip(image, 0)

    else:
        raise ValueError("Le mode doit être 'horizontal' ou 'vertical'")


def compute_gray_histogram(image_gray):
    """
    Calcule l'histogramme d'une image en niveaux de gris.
    """
    hist = cv2.calcHist([image_gray], [0], None, [256], [0, 256])
    return hist

def compute_Bleu_histogram(image):
    
    hist_b = cv2.calcHist([image], [0], None, [256], [0, 256])
    return hist_b

def compute_Red_histogram(image):
    
    hist_r = cv2.calcHist([image], [2], None, [256], [0, 256])
    return hist_r

def compute_Green_histogram(image):
   
    hist_g = cv2.calcHist([image], [1], None, [256], [0, 256])
    return  hist_g

def split_rgb_channels(image):
    
    b, g, r = cv2.split(image)
    return b, g, r

def equalize_histogram(image_gray):
    """
    Applique l'égalisation d'histogramme sur une image en niveaux de gris.
    """
    return cv2.equalizeHist(image_gray)

def binary_threshold(image_gray, threshold_value=127):
    """
    Applique un seuillage binaire simple.
    """
    _, binary = cv2.threshold(image_gray, threshold_value, 255, cv2.THRESH_BINARY)
    return binary

def adaptive_threshold(image_gray):
    """
    Applique un seuillage adaptatif.
    """
    return cv2.adaptiveThreshold(
        image_gray,
        255,
        cv2.ADAPTIVE_THRESH_MEAN_C,
        cv2.THRESH_BINARY,
        11,
        2
    )

def mean_based_threshold(image_gray):
    """
    Seuillage basé sur la moyenne des pixels.
    """
    mean_value = image_gray.mean()
    _, binary = cv2.threshold(image_gray, mean_value, 255, cv2.THRESH_BINARY)
    return binary

def otsu_threshold(image_gray):
    """
    Applique un seuillage avec la méthode d'Otsu.
    """
    _, binary = cv2.threshold(image_gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    return binary