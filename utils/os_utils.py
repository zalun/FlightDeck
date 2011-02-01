import os
import commonware

log = commonware.log.getLogger('f.utils')


# from http://jimmyg.org/blog/2009/working-with-python-subprocess.html
def whereis(program):
    for path in os.environ.get('PATH', '').split(':'):
        if os.path.exists(os.path.join(path, program)) and \
           not os.path.isdir(os.path.join(path, program)):
            return os.path.join(path, program)
    return None


def make_path(directory):
    """ Create all needed directories on the path """
    sections = directory.split('/')
    path = '/'
    dir_created = False
    for d in sections:
        path = os.path.join(path, d)
        if path and not os.path.isdir(path):
            dir_created = True
            os.mkdir(path)

    if dir_created:
        log.debug('Directory created for %s', directory)
    return dir_created
