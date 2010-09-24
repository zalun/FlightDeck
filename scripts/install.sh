#!/bin/bash

source scripts/config_local.sh

### PIP packages installation
export PYTHONPATH=

if [ $# -eq 1 ]
then
	REQUIREMENTS=$1
else
	REQUIREMENTS='production'
fi

pip install -E $V_ENV/ -r $PROJECT_DIR/requirements/$REQUIREMENTS.txt


# src dir
SRC=$V_ENV/src
# find last python dir
for i in $V_ENV/lib/python*
do
	SITE_PACKAGES=$i/site-packages
done


### upload dir 
if [ ! -e $PROJECT_DIR/upload/ ]
then
	mkdir $PROJECT_DIR/upload/
fi


### SDK versions dir 
if [ ! -e $PROJECT_DIR/sdk_versions/ ]
then
	mkdir $PROJECT_DIR/sdk_versions/
fi


### flightdeck media dir 
if [ ! -e $PROJECT_DIR/$PROJECT_NAME/media/ ]
then
	mkdir $PROJECT_DIR/$PROJECT_NAME/media/
fi


### link tutorial application 
if [ ! -e $PROJECT_DIR/$PROJECT_NAME/media/tutorial ]
then
	ln -fs $PROJECT_DIR/$PROJECT_NAME/tutorial/media/ $PROJECT_DIR/$PROJECT_NAME/media/tutorial
fi


### link jetpack application 
if [ ! -e $PROJECT_DIR/$PROJECT_NAME/media/jetpack ]
then
	ln -fs $PROJECT_DIR/$PROJECT_NAME/jetpack/media/ $PROJECT_DIR/$PROJECT_NAME/media/jetpack
fi


### adminmedia dir
if [ ! -e $PROJECT_DIR/$PROJECT_NAME/adminmedia ]
then
	ln -fs $SITE_PACKAGES/django/contrib/admin/media/ $PROJECT_NAME/adminmedia
fi


### link api application 
if [ ! -e $PROJECT_DIR/$PROJECT_NAME/media/api ]
then
	ln -fs $PROJECT_DIR/$PROJECT_NAME/api/media/ $PROJECT_DIR/$PROJECT_NAME/media/api
fi


### Roar
if [ ! -e $V_ENV/lib/Roar1.0 ]
then 
	cd $V_ENV/lib/
	mkdir Roar1.0
	cd Roar1.0
	wget http://digitarald.de/project/roar/1-0/source/Roar.js
	wget http://digitarald.de/project/roar/1-0/assets/Roar.css
	if [ -e $V_ENV/lib/Roar ]
	then
		rm $V_ENV/lib/Roar
	fi
	ln -fs $V_ENV/lib/Roar1.0 $V_ENV/lib/Roar
fi
if [ ! -e $PROJECT_DIR/$PROJECT_NAME/media/roar ]
then
	ln -fs $V_ENV/lib/Roar/ $PROJECT_DIR/$PROJECT_NAME/media/roar
fi


### Jetpack SDK
if [ ! -e $PROJECT_DIR/sdk_versions/jetpack-sdk/ ]
then
	cd $PROJECT_DIR/sdk_versions/
	# copy an old or create a new sdk
	if [ -e $V_ENV/src/jetpack-sdk ]
	then
		mv $V_ENV/src/jetpack-sdk ./
	else
		hg clone -r 0.6 http://hg.mozilla.org/labs/jetpack-sdk/
	fi
	# link libs unable to install via pip
	CUDDLEFISH=$PROJECT_DIR/sdk_versions/jetpack-sdk/python-lib/cuddlefish
	if [ -e $SITE_PACKAGES/cuddlefish ]
	then
		rm $SITE_PACKAGES/cuddlefish
	fi
	ln -fs $CUDDLEFISH $SITE_PACKAGES/cuddlefish

	ECDSA=$PROJECT_DIR/sdk_versions/jetpack-sdk/python-lib/ecdsa
	if [ -e $SITE_PACKAGES/ecdsa ]
	then
		rm $SITE_PACKAGES/ecdsa
	fi
	ln -fs $ECDSA $SITE_PACKAGES/ecdsa
fi

