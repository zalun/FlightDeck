class SimpleException(Exception):
    " Exception extended with a value "

    def __init__(self, value):
        self.value = value
        super(SimpleException, self).__init__()

    def __str__(self):
        return repr(self.value)
