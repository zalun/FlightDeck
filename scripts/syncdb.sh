#!/bin/bash

source scripts/environment.sh

# run server
cd $PROJECT_DIR/$PROJECT_NAME/
FORCE_DB=True $PYTHON_COMMAND ./manage.py syncdb

