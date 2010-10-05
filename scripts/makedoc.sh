#!/bin/bash

source scripts/environment.sh

cd $PROJECT_DIR/sphinx/
DJANGO_SETTINGS_MODULE='flightdeck.settings' make $@
