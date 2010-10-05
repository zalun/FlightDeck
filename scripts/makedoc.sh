#!/bin/bash

source scripts/environment.sh

cd $PROJECT_DIR/docs/
DJANGO_SETTINGS_MODULE='flightdeck.settings' make $@
