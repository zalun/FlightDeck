"""
Testing the cuddlefish engine to export API
"""
import os
from cuddlefish import apiparser

from api import conf

from utils.test import TestCase


class CuddleTest(TestCase):

    def setUp(self):
        self.createCore()

    def tearDown(self):
        self.deleteCore()

    def test_basic(self):
        """
        exporting hunks
        """
        #XXX: the path is different now
        docs_dir = os.path.join(
            conf.FRAMEWORK_PATH,
            'lib/jetpack-sdk/packages/jetpack-core/docs')
        text = open(os.path.join(docs_dir, 'url.md')).read()
        self.failUnless(len(list(apiparser.parse_hunks(text))) > 0)
