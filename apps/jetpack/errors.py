"""
Special Exception classes
"""

class SimpleException(Exception):
    " Exception extended with a value "

    def __init__(self, value):
        self.value = value
        super(SimpleException, self).__init__()

    def __str__(self):
        return repr(self.value)


class SelfDependencyException(SimpleException):
    " Library may not depend on itself "


class DependencyException(SimpleException):
    " All dependency errors "


class FilenameExistException(SimpleException):
    " This filename already exists - it has to be unique "


class UpdateDeniedException(SimpleException):
    " This item may not be updated "


class AddingAttachmentDenied(SimpleException):
    " Attachment may not be added "


class AddingModuleDenied(SimpleException):
    " Modulke may not be added "


class SingletonCopyException(SimpleException):
    " Singleton may not be copied "


class ManifestNotValid(SimpleException):
    " Upload failed due to package.json malfunction "
