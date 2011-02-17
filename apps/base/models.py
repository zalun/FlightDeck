from django.db import models


class BaseModel(models.Model):
    class Meta:
        abstract = True
    
    def save(self, **kwargs):
        if not self.pk:
            self.run_default_setters()
        
        self.full_clean()
        return super(BaseModel, self).save(**kwargs)
    
    def run_default_setters(self):
        for attrName in dir(self):
            if attrName.find('default_') != 0:
                continue
            
            attr = getattr(self, attrName)
            if callable(attr):
                field = attrName[8:]
                orig = getattr(self, field)
                if orig is None or orig == '':
                    attr()