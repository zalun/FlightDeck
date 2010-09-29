#!/bin/bash

source scripts/environment.sh

# run server
cd $PROJECT_DIR/$PROJECT_NAME/
FORCE_DB=true $PYTHON_COMMAND ./manage.py test $@
