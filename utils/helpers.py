import re
import mimetypes
import os

from random import choice

from django.shortcuts import render_to_response
from django.template import RequestContext


def get_random_string(length=10):
    """ return random alphanumeric string """
    allowed_chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    return ''.join([choice(allowed_chars) for i in range(length)])

def alphanum(text):
    " Strips all characters except alphanumerics. "
    return re.sub('[^a-zA-Z0-9]+', '', text.strip())


def alphanum_plus(text):
    return re.sub('[^a-zA-Z0-9\s\.,_\-\*&%\$#@:\(\)!\{\}\[\]\^\'\\/\?]+', '', text.strip())

def pathify(path):
    """ Replaces all characters except alpanum, dash, underscore, and slash with a dash """
    cleaned = re.sub('[^a-zA-Z0-9_\-\/\.]+', '-', path.strip())
    if cleaned[0] == '/':
        cleaned = cleaned[1:]
    if cleaned[-1] == '/':
        cleaned = cleaned[:-1]

    cleaned = re.sub('\/{2,}', '/', cleaned)
    return cleaned


def render(request, template_name, *args, **kwargs):
    """Render to response with context instance
    """
    return render_to_response(template_name,
            context_instance=RequestContext(request),
            *args, **kwargs)

def render_json(request, template_name, *args, **kwargs):
    """Render to response with context instans and json mimetype
    """
    return render(request, template_name, mimetype='application/json',
            *args, **kwargs)


def to_str(s):
    if isinstance(s, unicode):
        return s.encode('utf-8', 'strict')
    else:
        return str(s)


def data_keys(data):
    _data = {}
    for k, v in data.items():
        if is_file(v):
            v = ''
        _data[to_str(k)] = v
    return _data


def is_file(thing):
    return hasattr(thing, "read") and callable(thing.read)


def encode_multipart(boundary, data):
    """Ripped from django."""
    lines = []

    for key, value in data.items():
        if is_file(value):
            content_type = mimetypes.guess_type(value.name)[0]
            if content_type is None:
                content_type = 'application/octet-stream'
            lines.extend([
                '--' + boundary,
                'Content-Disposition: form-data; name="%s"; filename="%s"' \
                 % (to_str(key), to_str(os.path.basename(value.name))),
                'Content-Type: %s' % content_type,
                '',
                value.read(),
            ])
        else:
            lines.extend([
                '--' + boundary,
                'Content-Disposition: form-data; name="%s"' % to_str(key),
                '',
                to_str(value),
            ])

    lines.extend([
        '--' + boundary + '--',
        '',
    ])
    return '\r\n'.join(lines)
