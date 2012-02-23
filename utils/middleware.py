
class GetUserInfoOnException(object):
    
    def process_exception(self, request, exception):
        
        if request.user.is_authenticated():
            request.META['CURRENT_USER'] = '%s: %s' % \
                (request.user.pk, request.user.username)
