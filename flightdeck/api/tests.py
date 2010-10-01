"""
Testing the cuddlefish engine to export API
"""
import os
from django.test import TestCase
from cuddlefish import apiparser
from api import conf


class CuddleTest(TestCase):

    def test_basic(self):
        """
        exporting hunks
        """
        #XXX: the path is different now
        docs_dir = os.path.join(
            conf.FRAMEWORK_PATH,
            'sdk_versions/jetpack-sdk/packages/jetpack-core/docs')
        text = open(os.path.join(docs_dir, 'url.md')).read()
        self.failUnless(len(list(apiparser.parse_hunks(text))) > 0)
