from random import choice
import re

def get_random_string(length=10):
    """ return random alphanumeric string """
    allowed_chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    return ''.join([choice(allowed_chars) for i in range(length)])

def pathify(path):
    return re.sub('[^a-zA-Z0-9_\-\/]+', '-', path.strip())
