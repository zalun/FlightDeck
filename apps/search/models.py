from elasticutils import S

class SearchMixin(object):

    @classmethod
    def search(cls):
        return S(cls)
