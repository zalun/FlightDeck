"""
Testing the cuddlefish engine to export API
"""
import os
from cuddlefish import apiparser


from utils.test import TestCase


class CuddleTest(TestCase):

    fixtures = ['mozilla', 'core_sdk']

    def setUp(self):
        self.createCore()

    def tearDown(self):
        self.deleteCore()

    def test_basic(self):
        """
        exporting hunks
        """
        from api.views import SDKPACKAGESDIR
        #XXX: the path is different now
        docs_dir = os.path.join(
            SDKPACKAGESDIR, 'jetpack-core/docs')
        text = open(os.path.join(docs_dir, 'url.md')).read()
        self.failUnless(len(list(apiparser.parse_hunks(text))) > 0)
