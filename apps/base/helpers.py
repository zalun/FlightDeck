import urllib
import urlparse
from django.utils.encoding import smart_str

def querystring(query_, **params):
    """
    Add paramaters to a query string. New params will be appended, duplicates will
    be overwritten.
    """
    query_dict = dict(urlparse.parse_qsl(smart_str(query_))) if query_ else {}

    query_dict.update(**params)
    query_string = urlencode([(k ,v) for k, v in query_dict.items()
                             if v is not None])
    return query_string

def urlparams(url_, **query):
    """
    Update the parameters of a url and return it.
    """
    url = urlparse.urlparse(url_)
    query_string = querystring(url.query)
    new = urlparse.ParseResult(url.scheme, url.netloc, url.path, url.params,
                               querty_string, url.fragment)
    return new.geturl()

def urlencode(items):
    """A Unicode-safe URLencoder."""
    try:
        return urllib.urlencode(items)
    except UnicodeEncodeError:
        return urllib.urlencode([(k, smart_str(v)) for k, v in items])
