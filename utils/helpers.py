from random import choice
import re

def get_random_string(length=10):
    """ return random alphanumeric string """
    allowed_chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    return ''.join([choice(allowed_chars) for i in range(length)])

def alphanum(text):
    " Strips all characters except alphanumerics. "
    return re.sub('[^a-zA-Z0-9]+', '', text.strip())

def alphanum_plus(text):
    return re.sub('[^a-zA-Z0-9\s\.,_\-\*&%\$#@:\(\)!]+', '', text.strip())

def pathify(path):
    """ Replaces all characters except alpanum, dash, underscore, and slash with a dash """
    cleaned = re.sub('[^a-zA-Z0-9_\-\/\.]+', '-', path.strip())
    if cleaned[0] == '/':
        cleaned = cleaned[1:]
    if cleaned[-1] == '/':
        cleaned = cleaned[:-1]
    
    cleaned = re.sub('\/{2,}', '/', cleaned)
    return cleaned