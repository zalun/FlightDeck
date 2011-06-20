from django.db.models import Manager, query

class QuerySetManager(Manager):
    """
    This lets an inheriting manager declare its own QuerySet
    and define methods on the QuerySet as if it were a manager.

    This way, the methods are available on both the manager
    and the returning QuerySet.

    Example:
    MyModel.objects.someMethod().filter()
    MyModel.objects.filter().select_related().someMethod()
    """
    def get_query_set(self):
        return self.QuerySet(model=self.model)


    def __getattr__(self, attr, *args):
        return getattr(self.get_query_set(), attr, *args)

    
        
    class QuerySet(query.QuerySet):
        
        def manual_order(self, pks):
            """
            Given a query set and a list of primary keys, return a set
            of objects from the query set in that exact order.
            """
            return self.filter(id__in=pks).extra(
                select={'_manual': 'FIELD(id, %s)'
                % ','.join(map(str, pks))},
                order_by=['_manual'])
