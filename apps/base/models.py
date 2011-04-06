import commonware
from django.db import models

#log = commonware.log.getLogger('f.jetpack')

class BaseModel(models.Model):
    class Meta:
        abstract = True

    def save(self, **kwargs):
        if not self.pk:
            self.run_default_setters()

        self.run_update_setters()

        self.full_clean()
        return super(BaseModel, self).save(**kwargs)

    def run_default_setters(self):
        for attrName in dir(self):
            if not attrName.startswith('default_'):
                continue
            attr = getattr(self, attrName)
            if callable(attr):
                field = attrName[8:]
                orig = getattr(self, field)
                if orig is None or orig == '':
                    attr()

    def run_update_setters(self):
        for attrName in dir(self):
            if not attrName.startswith('update_'):
                continue
            attr = getattr(self, attrName)
            if callable(attr):
                attr()


class CeleryResponse(BaseModel):
    kind = models.CharField(max_length=100)
    time = models.IntegerField()
    modified_at = models.DateTimeField(auto_now=True)
