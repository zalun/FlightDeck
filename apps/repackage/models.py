"""
repackage.models
----------------
"""
import os
import shutil
import simplejson
import tempfile
import urllib
import zipfile

import commonware.log

#from django.conf import settings
from django.http import Http404
from django.template.defaultfilters import slugify

#from base.models import BaseModel
from xpi import xpi_utils

from repackage.helpers import Extractor

log = commonware.log.getLogger('f.repackage')


