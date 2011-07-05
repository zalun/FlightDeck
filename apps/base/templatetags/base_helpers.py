from django.template import Library, loader, TemplateSyntaxError, Node
from django.template.defaultfilters import escapejs
from utils.helpers import get_random_string

register = Library()


@register.filter
def replace(item, value):
    """Replaces first part of ``value`` with the second one

    :param: value (string) list of 2 items separated by comma
    :result: (string) ``item`` with the first string replaced by the other
    """
    items = value.split(',')
    if len(items) != 2:
        raise TemplateSyntaxError(
                "Replace filter argument is a comma separated list of 2 items")
    return item.replace(items[0], items[1])


@register.filter
def capitalize(item):
    """Return a copy of the string with its first character capitalized and
    the rest lowercased
    """
    return item.capitalize()


@register.tag
def escape_template(parser, token):
    try:
        tag_name, template_name = token.split_contents()
    except ValueError:
        raise TemplateSyntaxError(
            "%r tag requires exactly one argument" % token.contents.split()[0])
    if not (template_name[0] == template_name[-1] and template_name[0] \
            in ('"', "'")):
        raise TemplateSyntaxError(
                "%r tag's argument should be in quotes" % tag_name)
    return EscapeTemplate(template_name[1:-1])


class EscapeTemplate(Node):
    def __init__(self, template_name):
        self.t = loader.get_template(template_name)

    def render(self, context):
        return escapejs(self.t.render(context))


@register.simple_tag
def hashtag(length=10):
    """ return random string """
    return get_random_string(length)
