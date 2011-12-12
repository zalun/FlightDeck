from django.template.defaultfilters import escape

class SimpleException(Exception):
    " Exception extended with a value "

    def __init__(self, value):
        self.value = value
        super(SimpleException, self).__init__()

    def __str__(self):
        return repr(self.value)

def parse_validation_messages(err):
    error = ''
    for field, msgs in err.message_dict.items():
        error += ("%s: " % field)
        for msg in msgs:
            error += ("%s " % escape(msg))
    return error
