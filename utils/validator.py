import re

VALIDATE_TYPES = {
    'alphanum_plus': (
        '^[a-zA-z0-9._\-]+$',
        'Please use only letters (a-z), numbers (0-9) or \"_.-\" only as '
        'version name. No spaces or other characters are allowed.'
    ),
    'alphanum_plus_space': (
        '^[a-zA-z0-9 ._\-\(\)]+$',
        'Please use only letters (a-z), numbers (0-9) spaces or \"_().-\" '
        'only as a Package name. No other characters are allowed.'
    ),
    'alphanum': (
        '^[a-zA-z0-9]+$',
        'Please use only letters (a-z) and numbers (0-9)'
    )
}


def is_valid(type, text):
    " returns True if valid or type not supported "

    if type not in VALIDATE_TYPES:
        return True

    return re.match(VALIDATE_TYPES[type][0], text)


def get_validation_message(type):

    if type not in VALIDATE_TYPES:
        return ""

    return VALIDATE_TYPES[type][1]
