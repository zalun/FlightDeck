"""
Special Exception classes
"""

from utils.exceptions import SimpleException


class SelfDependencyException(SimpleException):
    " Library may not depend on itself "


class DependencyException(SimpleException):
    " All dependency errors "


class FilenameExistException(SimpleException):
    " This filename already exists - it has to be unique "


class IllegalFilenameException(SimpleException):
    " This filename contains illegal characters "


class IllegalFileException(SimpleException):
    " This file is not allowed "


class UpdateDeniedException(SimpleException):
    " This item may not be updated "


class AddingAttachmentDenied(SimpleException):
    " Attachment may not be added "


class AttachmentWriteException(SimpleException):
    " Attachment failed to properly save to disk "


class AddingModuleDenied(SimpleException):
    " Modulke may not be added "


class SingletonCopyException(SimpleException):
    " Singleton may not be copied "


class ManifestNotValid(SimpleException):
    " Upload failed due to package.json malfunction "


class KeyNotAllowed(SimpleException):
    " Package keys are whitelisted. "

    def __init__(self, allowed_keys):
        value = ('Invalid key.<br/>'
                 'allowed keys: %s'
                 ) % ', '.join(allowed_keys)
        super(KeyNotAllowed, self).__init__(value)
