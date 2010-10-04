from exceptions import Exception


class SimpleException(Exception):

    def __init__(self, value):
        self.value = value

    def __str__(self):
        return repr(self.value)


class SelfDependencyException(SimpleException):
    ""


class DependencyException(SimpleException):
    ""


class FilenameExistException(SimpleException):
    ""


class UpdateDeniedException(SimpleException):
    ""


class AddingAttachmentDenied(SimpleException):
    ""


class AddingModuleDenied(SimpleException):
    ""


class SingletonCopyException(SimpleException):
    ""
