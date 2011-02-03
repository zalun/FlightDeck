from django.db import models, IntegrityError

from jetpack.models import SDK
from utils.exceptions import SimpleException

class DocPage(models.Model):
    sdk = models.ForeignKey(SDK)
    path = models.CharField(max_length=255)
    html = models.TextField()
    json = models.TextField()
