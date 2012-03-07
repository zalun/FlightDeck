import re
import mimetypes
import os
import sys

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


def filter_illegal_utf8(dirty, repl=''):
    """via StackOverflow:
    http://stackoverflow.com/questions/1707890/fast-way-to-filter-illegal-xml-unicode-chars-in-python
    XML specification lists a bunch of Unicode characters that are either
    illegal or "discouraged".
    """
    illegal_unichrs = [ (0x00, 0x08), (0x0B, 0x1F), (0x7F, 0x84), (0x86, 0x9F),
                    (0xD800, 0xDFFF), (0xFDD0, 0xFDDF), (0xFFFE, 0xFFFF),
                    (0x1FFFE, 0x1FFFF), (0x2FFFE, 0x2FFFF), (0x3FFFE, 0x3FFFF),
                    (0x4FFFE, 0x4FFFF), (0x5FFFE, 0x5FFFF), (0x6FFFE, 0x6FFFF),
                    (0x7FFFE, 0x7FFFF), (0x8FFFE, 0x8FFFF), (0x9FFFE, 0x9FFFF),
                    (0xAFFFE, 0xAFFFF), (0xBFFFE, 0xBFFFF), (0xCFFFE, 0xCFFFF),
                    (0xDFFFE, 0xDFFFF), (0xEFFFE, 0xEFFFF), (0xFFFFE, 0xFFFFF),
                    (0x10FFFE, 0x10FFFF) ]

    illegal_ranges = ["%s-%s" % (unichr(low), unichr(high))
                      for (low, high) in illegal_unichrs
                      if low < sys.maxunicode]

    illegal_xml_re = re.compile(u'[%s]' % u''.join(illegal_ranges))
    return illegal_xml_re.sub(repl, dirty)

def filter_illegal_chars(dirty, repl=''):
    """Remove character which allow to inject code which would be run by
    displaying on the page
    """
    illegal_chars_re = re.compile('[<>="]')
    return illegal_chars_re.sub(repl, dirty)

def sanitize_for_frontend(dirty, repl=''):
    """Remove illegal XML and dangerous frontend characters
    """
    return filter_illegal_utf8(filter_illegal_chars(dirty, repl))

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
